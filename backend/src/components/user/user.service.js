import db from "../../../models/index.js";
import { logger } from "../../config/logger.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/Errors.js";
import { getFirebaseAuth } from "../../config/firebase.js";
import { ACCOUNT_EMAIL_STATUS, MIN_PASSWORD_LENGTH, USER_ROLES } from "./user.constants.js";
import { getTransactionalEmailProvider, isTransactionalEmailLive } from "../../notifications/providerFactory.js";
import { buildPasswordChangedEmail, buildWelcomeEmail } from "../../notifications/AccountEmailBuilder.js";

const { User, Route, sequelize } = db;

/** Attributs exposés par l'API de gestion (le FirebaseUid reste interne). */
const PUBLIC_ATTRIBUTES = ["Id", "Email", "Name", "Role", "createdAt"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validatePassword = (password) => {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
  }
};

/**
 * Envoie un courriel de compte sans jamais faire échouer l'opération principale :
 * le compte est créé / le mot de passe changé même si SMTP est en panne.
 * @returns {Promise<string>} Une valeur de ACCOUNT_EMAIL_STATUS.
 */
const sendAccountEmail = async (to, message) => {
  try {
    await getTransactionalEmailProvider().send({ to, ...message });
    return isTransactionalEmailLive() ? ACCOUNT_EMAIL_STATUS.SENT : ACCOUNT_EMAIL_STATUS.LOGGED;
  } catch (error) {
    logger.error(`Échec d'envoi du courriel de compte à ${to}: ${error.message}`);
    return ACCOUNT_EMAIL_STATUS.FAILED;
  }
};

/** Traduit les erreurs Firebase Admin courantes en erreurs typées avec message FR. */
const mapFirebaseError = (error) => {
  switch (error?.code) {
    case "auth/invalid-email":
      return new BadRequestError("Adresse courriel invalide.");
    case "auth/invalid-password":
      return new BadRequestError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
    case "auth/email-already-exists":
      return new ConflictError("Un compte existe déjà pour ce courriel.");
    case "auth/user-not-found":
      return new NotFoundError("Compte Firebase introuvable pour cet utilisateur.");
    default:
      logger.error(`Erreur Firebase Admin: ${error?.code} ${error?.message}`);
      return error;
  }
};

export const findByFirebaseUid = async (firebaseUid) => {
  return User.findOne({ where: { FirebaseUid: firebaseUid } });
};

/**
 * Récupère l'utilisateur associé au token Firebase, ou le crée s'il se connecte pour la première fois.
 * Un nouveau compte reçoit USER_ROLES.USER (aucun accès) jusqu'à ce qu'un admin lui attribue un rôle.
 * @param {import("firebase-admin/auth").DecodedIdToken} decodedToken
 */
export const findOrCreateFromFirebase = async (decodedToken) => {
  const existing = await findByFirebaseUid(decodedToken.uid);
  if (existing) {
    return existing;
  }

  logger.info(`Nouvel utilisateur créé depuis Firebase | uid: ${decodedToken.uid} - email: ${decodedToken.email}`);

  return User.create({
    FirebaseUid: decodedToken.uid,
    Email: decodedToken.email,
    Name: decodedToken.name || null,
    Role: USER_ROLES.USER
  });
};

export const getUsers = async ({ role } = {}) => {
  const where = {};
  if (role) {
    if (!Object.values(USER_ROLES).includes(role)) {
      throw new BadRequestError("Rôle invalide.");
    }
    where.Role = role;
  }
  return User.findAll({
    where,
    attributes: PUBLIC_ATTRIBUTES,
    include: [{ model: Route, as: "OperatedRoutes", attributes: ["Id", "Name"], required: false }],
    order: [["Email", "ASC"]]
  });
};

/**
 * Change le rôle d'un utilisateur.
 * Garde-fous : un admin ne peut pas modifier son propre rôle (évite de se verrouiller dehors),
 * le dernier admin ne peut pas être rétrogradé, et un opérateur assigné à des routes actives
 * doit d'abord en être désassigné.
 *
 * @param {number|string} id - Id de l'utilisateur ciblé.
 * @param {string} role - Nouveau rôle (voir USER_ROLES).
 * @param {{ Id: number }} actor - Utilisateur qui fait la demande.
 */
export const updateUserRole = async (id, role, actor) => {
  if (!Object.values(USER_ROLES).includes(role)) {
    throw new BadRequestError("Rôle invalide.");
  }
  if (Number(id) === actor.Id) {
    throw new BadRequestError("Vous ne pouvez pas modifier votre propre rôle.");
  }

  return sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) {
      throw new NotFoundError("Utilisateur introuvable.");
    }
    if (user.Role === role) {
      return user;
    }

    if (user.Role === USER_ROLES.ADMIN) {
      const adminCount = await User.count({ where: { Role: USER_ROLES.ADMIN }, transaction });
      if (adminCount <= 1) {
        throw new ConflictError("Impossible de retirer le dernier administrateur.");
      }
    }

    // Un admin peut aussi être assigné à une route : on ne bloque que si le
    // nouveau rôle ne permet plus d'opérer une route.
    if (role === USER_ROLES.USER) {
      const assignedRoutes = await Route.findAll({
        where: { OperatorUserId: user.Id, IsActive: true },
        attributes: ["Name"],
        transaction
      });
      if (assignedRoutes.length > 0) {
        const names = assignedRoutes.map((r) => r.Name).join(", ");
        throw new ConflictError(`Cet utilisateur est assigné aux routes : ${names}. Réassignez-les d'abord.`);
      }
    }

    const previousRole = user.Role;
    user.Role = role;
    await user.save({ transaction });

    logger.info(`Rôle modifié | user: ${user.Id} (${user.Email}) - ${previousRole} → ${role} - par: ${actor.Id}`);

    return User.findByPk(user.Id, { attributes: PUBLIC_ATTRIBUTES, transaction });
  });
};

/**
 * Crée un utilisateur complet (compte Firebase + ligne Users) avec un mot de passe fixé par l'admin.
 * Si le courriel existe déjà dans Firebase mais pas en DB (ex. compte créé dans la console et
 * jamais connecté), le compte Firebase est relié et son mot de passe remplacé.
 * Si l'insertion DB échoue après la création Firebase, le compte Firebase créé est supprimé.
 *
 * Un courriel de bienvenue (lien vers l'application, avec ou sans le mot de passe) est
 * envoyé si sendEmail est vrai.
 *
 * @param {{ email: string, name?: string, role: string, password: string, sendEmail?: boolean, includePassword?: boolean }} userInfo
 * @param {{ Id: number }} actor
 * @returns {Promise<{ user: object, emailStatus: string }>}
 */
export const createUser = async (
  { email, name, role, password, sendEmail = true, includePassword = true } = {},
  actor
) => {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new BadRequestError("Adresse courriel invalide.");
  }
  if (!Object.values(USER_ROLES).includes(role)) {
    throw new BadRequestError("Rôle invalide.");
  }
  validatePassword(password);
  const displayName = typeof name === "string" && name.trim() ? name.trim() : null;

  const existingDbUser = await User.findOne({ where: sequelize.where(sequelize.fn("lower", sequelize.col("Email")), normalizedEmail) });
  if (existingDbUser) {
    throw new ConflictError("Un utilisateur existe déjà avec ce courriel. Utilisez « Mot de passe » pour le modifier.");
  }

  const auth = getFirebaseAuth();
  let firebaseUser;
  let createdInFirebase = false;
  try {
    firebaseUser = await auth.createUser({ email: normalizedEmail, password, displayName: displayName ?? undefined });
    createdInFirebase = true;
  } catch (error) {
    if (error?.code !== "auth/email-already-exists") {
      throw mapFirebaseError(error);
    }
    try {
      const existing = await auth.getUserByEmail(normalizedEmail);
      firebaseUser = await auth.updateUser(existing.uid, {
        password,
        ...(displayName ? { displayName } : {})
      });
    } catch (linkError) {
      throw mapFirebaseError(linkError);
    }
  }

  let user;
  try {
    user = await User.create({
      FirebaseUid: firebaseUser.uid,
      Email: normalizedEmail,
      Name: displayName,
      Role: role
    });
  } catch (error) {
    if (createdInFirebase) {
      await auth.deleteUser(firebaseUser.uid).catch((cleanupError) => {
        logger.error(`Compte Firebase orphelin non supprimé | uid: ${firebaseUser.uid} - ${cleanupError.message}`);
      });
    }
    throw error;
  }
  logger.info(`Utilisateur créé par un admin | user: ${user.Id} (${normalizedEmail}) - rôle: ${role} - par: ${actor.Id}`);

  const emailStatus = sendEmail
    ? await sendAccountEmail(
        normalizedEmail,
        buildWelcomeEmail({ email: normalizedEmail, name: displayName, role, password: includePassword ? password : null })
      )
    : ACCOUNT_EMAIL_STATUS.SKIPPED;

  return { user: await User.findByPk(user.Id, { attributes: PUBLIC_ATTRIBUTES }), emailStatus };
};

/**
 * Remplace le mot de passe d'un utilisateur (ex. mot de passe oublié). Firebase invalide
 * alors les sessions existantes de ce compte.
 *
 * @param {number|string} id
 * @param {string} password
 * @param {{ Id: number }} actor
 * @param {{ sendEmail?: boolean, includePassword?: boolean }} [options]
 * @returns {Promise<{ emailStatus: string }>}
 */
export const setUserPassword = async (id, password, actor, { sendEmail = true, includePassword = true } = {}) => {
  validatePassword(password);
  const user = await User.findByPk(id);
  if (!user) {
    throw new NotFoundError("Utilisateur introuvable.");
  }
  try {
    await getFirebaseAuth().updateUser(user.FirebaseUid, { password });
  } catch (error) {
    throw mapFirebaseError(error);
  }
  logger.info(`Mot de passe modifié par un admin | user: ${user.Id} (${user.Email}) - par: ${actor.Id}`);

  const emailStatus = sendEmail
    ? await sendAccountEmail(
        user.Email,
        buildPasswordChangedEmail({ email: user.Email, name: user.Name, password: includePassword ? password : null })
      )
    : ACCOUNT_EMAIL_STATUS.SKIPPED;

  return { emailStatus };
};
