import { BadRequestError } from "../../errors/Errors.js";

/**
 * Validation des moyens de contact (clients et locataires). Volontairement
 * pragmatique : on bloque les fautes de frappe évidentes (« aa », « 819-555 »),
 * pas les adresses exotiques mais valides.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Chiffres, espaces, +, -, points et parenthèses seulement. */
const PHONE_CHARACTERS = /^[\d\s+().-]+$/;

export const isValidEmail = (email) => EMAIL_PATTERN.test(String(email).trim());

/** Numéro nord-américain : 10 chiffres, ou 11 commençant par 1 (+1). */
export const isValidPhone = (phone) => {
  const value = String(phone).trim();
  if (!PHONE_CHARACTERS.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
};

const isFilled = (value) => value !== undefined && value !== null && String(value).trim() !== "";

/** Valide Email/Phone s'ils sont fournis et non vides (champs vides = absents). */
export const validateContactFields = ({ Email, Phone } = {}) => {
  if (isFilled(Email) && !isValidEmail(Email)) {
    throw new BadRequestError(`Courriel invalide : « ${String(Email).trim()} ». Exemple : nom@domaine.com`);
  }
  if (isFilled(Phone) && !isValidPhone(Phone)) {
    throw new BadRequestError(`Numéro de téléphone invalide : « ${String(Phone).trim()} ». Il faut 10 chiffres, ex. 819 555-1234.`);
  }
};
