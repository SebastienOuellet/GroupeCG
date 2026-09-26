import { ConfigService } from "../config/configService.js";
import { USER_ROLES } from "../components/user/user.constants.js";

const configService = new ConfigService();

const ROLE_LABELS = {
  [USER_ROLES.ADMIN]: "administrateur",
  [USER_ROLES.OPERATOR]: "opérateur",
  [USER_ROLES.USER]: "utilisateur"
};

/** Échappe les valeurs saisies (nom, mot de passe) avant insertion dans le HTML. */
const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getLoginUrl = () => `${configService.get("PUBLIC_BASE_URL").replace(/\/$/, "")}/login`;

/**
 * Gabarit commun. Courriel transactionnel (compte employé) : pas de lien de
 * désabonnement, ce n'est pas un message commercial au sens de la LCAP.
 */
const wrapHtml = ({ greeting, intro, email, password, loginUrl }) => `<!doctype html>
<html lang="fr">
<body style="font-family: Arial, sans-serif; color: #2f3840; max-width: 600px; margin: 0 auto; padding: 16px;">
  <div style="border-top: 4px solid #052261; padding-top: 16px;">
    <p>${greeting}</p>
    <p>${intro}</p>
    <table style="margin: 16px 0; font-size: 16px;">
      <tr><td style="padding: 4px 16px 4px 0; color: #7a8591;">Courriel</td><td><strong>${escapeHtml(email)}</strong></td></tr>
      ${password ? `<tr><td style="padding: 4px 16px 4px 0; color: #7a8591;">Mot de passe</td><td><strong style="font-family: monospace; font-size: 18px;">${escapeHtml(password)}</strong></td></tr>` : ""}
    </table>
    <p style="margin: 24px 0;">
      <a href="${loginUrl}" style="background: #052261; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Ouvrir l'application</a>
    </p>
    <p style="font-size: 13px; color: #7a8591;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br />${loginUrl}</p>
    <p style="font-size: 13px; color: #7a8591;">Conservez ce courriel en lieu sûr et ne le transférez à personne.</p>
  </div>
</body>
</html>`;

const buildText = ({ greetingText, introText, email, password, loginUrl }) =>
  [
    greetingText,
    "",
    introText,
    "",
    `Courriel : ${email}`,
    ...(password ? [`Mot de passe : ${password}`] : []),
    "",
    `Ouvrir l'application : ${loginUrl}`,
    "",
    "Conservez ce courriel en lieu sûr et ne le transférez à personne."
  ].join("\n");

/**
 * @param {{ email: string, name?: string|null, role: string, password?: string|null }} params
 * @returns {{ subject: string, html: string, text: string }}
 */
export const buildWelcomeEmail = ({ email, name, role, password }) => {
  const loginUrl = getLoginUrl();
  const roleLabel = ROLE_LABELS[role] ?? "utilisateur";
  const greetingText = name ? `Bonjour ${name},` : "Bonjour,";
  const introText = `Un compte ${roleLabel} a été créé pour vous sur l'application Groupe CG. Voici vos informations de connexion :`;
  return {
    subject: "Votre accès à l'application Groupe CG",
    html: wrapHtml({
      greeting: name ? `Bonjour ${escapeHtml(name)},` : "Bonjour,",
      intro: `Un compte <strong>${roleLabel}</strong> a été créé pour vous sur l'application Groupe CG. Voici vos informations de connexion :`,
      email,
      password,
      loginUrl
    }),
    text: buildText({ greetingText, introText, email, password, loginUrl })
  };
};

/**
 * @param {{ email: string, name?: string|null, password?: string|null }} params
 * @returns {{ subject: string, html: string, text: string }}
 */
export const buildPasswordChangedEmail = ({ email, name, password }) => {
  const loginUrl = getLoginUrl();
  const greetingText = name ? `Bonjour ${name},` : "Bonjour,";
  const introText = "Le mot de passe de votre compte Groupe CG a été modifié par un administrateur.";
  return {
    subject: "Votre mot de passe Déneigement Groupe CG a été modifié",
    html: wrapHtml({
      greeting: name ? `Bonjour ${escapeHtml(name)},` : "Bonjour,",
      intro: introText,
      email,
      password,
      loginUrl
    }),
    text: buildText({ greetingText, introText, email, password, loginUrl })
  };
};
