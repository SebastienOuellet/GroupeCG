import db from "../../../models/index.js";
import { logger } from "../../config/logger.js";

const { User } = db;

export const findByFirebaseUid = async (firebaseUid) => {
  return User.findOne({ where: { FirebaseUid: firebaseUid } });
};

/**
 * Récupère l'utilisateur associé au token Firebase, ou le crée s'il se connecte pour la première fois.
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
    Name: decodedToken.name || null
  });
};

export const getUsers = async () => {
  return User.findAll();
};
