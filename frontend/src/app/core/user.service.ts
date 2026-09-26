import { inject, Injectable } from "@angular/core";
import { ApiService } from "./api.service";
import { AccountEmailStatus, ManagedUser, NewUserRequest, User, UserRole } from "./models/user.model";

@Injectable({
  providedIn: "root"
})
export class UserService {
  private readonly api = inject(ApiService);

  getMe(): Promise<User> {
    return this.api.get<User>("user/me");
  }

  /** Admin seulement. */
  getUsers(role?: UserRole): Promise<ManagedUser[]> {
    return this.api.get<ManagedUser[]>("user", role ? { params: { role } } : undefined);
  }

  /** Admin seulement : crée le compte Firebase + la ligne Users avec le mot de passe fourni. */
  createUser(user: NewUserRequest): Promise<ManagedUser & { emailStatus: AccountEmailStatus }> {
    return this.api.post<ManagedUser & { emailStatus: AccountEmailStatus }>("user", user);
  }

  /** Admin seulement. */
  setPassword(
    id: number,
    password: string,
    options: { sendEmail: boolean; includePassword: boolean }
  ): Promise<{ emailStatus: AccountEmailStatus }> {
    return this.api.put<{ emailStatus: AccountEmailStatus }>(`user/${id}/password`, { password, ...options });
  }

  /** Admin seulement. */
  updateRole(id: number, role: UserRole): Promise<ManagedUser> {
    return this.api.put<ManagedUser>(`user/${id}/role`, { role });
  }
}
