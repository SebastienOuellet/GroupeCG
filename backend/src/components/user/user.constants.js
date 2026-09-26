export const USER_ROLES = {
  ADMIN: "admin",
  OPERATOR: "operator",
  USER: "user"
};

/** Longueur minimale d'un mot de passe fixé par un admin (Firebase exige 6). */
export const MIN_PASSWORD_LENGTH = 8;

/** Résultat de l'envoi d'un courriel de compte (création / mot de passe). */
export const ACCOUNT_EMAIL_STATUS = {
  SENT: "sent",
  LOGGED: "logged",
  FAILED: "failed",
  SKIPPED: "skipped"
};
