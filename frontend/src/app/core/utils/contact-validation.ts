/**
 * Validation des courriels et téléphones à la saisie. Mêmes règles que le
 * serveur (backend/src/components/consent/contact.validation.js), qui fait foi.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARACTERS = /^[\d\s+().-]+$/;

const isBlank = (value: string | null | undefined): boolean => !value || !value.trim();

/** Message d'erreur, ou null si vide (champ facultatif) ou valide. */
export function emailError(value: string | null | undefined): string | null {
  if (isBlank(value)) return null;
  return EMAIL_PATTERN.test(value!.trim()) ? null : "Courriel invalide. Exemple : nom@domaine.com";
}

/** Numéro nord-américain : 10 chiffres, ou 11 commençant par 1. */
export function phoneError(value: string | null | undefined): string | null {
  if (isBlank(value)) return null;
  const trimmed = value!.trim();
  const digits = trimmed.replace(/\D/g, "");
  const valid = PHONE_CHARACTERS.test(trimmed) && (digits.length === 10 || (digits.length === 11 && digits.startsWith("1")));
  return valid ? null : "Numéro invalide : il faut 10 chiffres, ex. 819 555-1234.";
}

/** Première erreur de contact d'un formulaire, pour bloquer l'envoi. */
export function contactErrors(fields: { Email?: string | null; Phone?: string | null }): string | null {
  return emailError(fields.Email) ?? phoneError(fields.Phone);
}
