export type UserRole = "admin" | "operator" | "user";

export interface User {
  Id: number;
  FirebaseUid: string;
  Email: string;
  Name: string | null;
  Role: UserRole;
}

/** Utilisateur tel que retourné par l'API de gestion (GET /api/user, admin seulement). */
export interface ManagedUser {
  Id: number;
  Email: string;
  Name: string | null;
  Role: UserRole;
  createdAt: string;
  OperatedRoutes?: { Id: number; Name: string }[];
}

export interface NewUserRequest {
  email: string;
  name: string;
  role: UserRole;
  password: string;
  sendEmail: boolean;
  includePassword: boolean;
}

export type AccountEmailStatus = "sent" | "logged" | "failed" | "skipped";

export const ACCOUNT_EMAIL_STATUS_LABELS: Record<AccountEmailStatus, string> = {
  sent: "Courriel envoyé à l'utilisateur.",
  logged: "Courriel NON envoyé : SMTP non configuré sur le serveur (journalisé seulement).",
  failed: "Échec de l'envoi du courriel : communiquez les informations vous-même.",
  skipped: "Aucun courriel envoyé (option décochée)."
};

/** Miroir de MIN_PASSWORD_LENGTH côté backend. */
export const MIN_PASSWORD_LENGTH = 8;

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrateur",
  operator: "Opérateur",
  user: "Aucun accès"
};

/** Rôles pouvant être assignés comme opérateur d'une route (miroir du backend). */
export const OPERATOR_CAPABLE_ROLES: UserRole[] = ["operator", "admin"];
