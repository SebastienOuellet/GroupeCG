export type UserRole = "admin" | "operator" | "user";

export interface User {
  Id: number;
  FirebaseUid: string;
  Email: string;
  Name: string | null;
  Role: UserRole;
}
