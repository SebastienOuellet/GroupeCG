import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Charge un compte de service Google/Firebase.
 *
 * En prod (App Platform, Docker), les fichiers JSON non versionnés ne sont pas déployés :
 * on passe le contenu dans une variable d'environnement, en JSON brut ou encodé en base64
 * (plus sûr pour copier-coller : pas de guillemets ni de \n à échapper).
 * En dev, on garde le fichier dans backend/firebaseConfig/ ou backend/googleConfig/.
 *
 * @param {{ json?: string, jsonVar: string, dir: string, file?: string, fileVar: string }} options
 * @returns {object} Le compte de service ({ project_id, client_email, private_key, ... }).
 * @throws {Error} Message explicite si rien n'est configuré ou si le contenu est invalide.
 */
export const loadServiceAccount = ({ json, jsonVar, dir, file, fileVar }) => {
  if (json) {
    return parseServiceAccount(json, jsonVar);
  }

  if (!file) {
    throw new Error(`Compte de service non configuré : définir ${jsonVar} (prod) ou ${fileVar} (dev).`);
  }

  const filePath = join(dir, file);
  if (!existsSync(filePath)) {
    throw new Error(`Compte de service introuvable : ${filePath}. En prod, utiliser ${jsonVar}.`);
  }
  return parseServiceAccount(readFileSync(filePath, "utf8"), fileVar);
};

const parseServiceAccount = (raw, source) => {
  const text = raw.trim();
  const decoded = text.startsWith("{") ? text : Buffer.from(text, "base64").toString("utf8");

  let account;
  try {
    account = JSON.parse(decoded);
  } catch {
    throw new Error(`${source} : contenu invalide (attendu : JSON du compte de service, brut ou en base64).`);
  }

  if (!account.client_email || !account.private_key) {
    throw new Error(`${source} : client_email ou private_key manquant dans le compte de service.`);
  }
  return account;
};
