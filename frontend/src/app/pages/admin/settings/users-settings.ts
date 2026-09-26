import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { AuthStore } from "../../../core/auth/auth.store";
import { UserService } from "../../../core/user.service";
import {
  ACCOUNT_EMAIL_STATUS_LABELS,
  AccountEmailStatus,
  ManagedUser,
  MIN_PASSWORD_LENGTH,
  NewUserRequest,
  USER_ROLE_LABELS,
  UserRole
} from "../../../core/models/user.model";
import { generateReadablePassword } from "../../../core/utils/password-generator";

/** Identifiants à communiquer à l'utilisateur, affichés une seule fois après l'action. */
interface CredentialsNotice {
  title: string;
  email: string;
  password: string;
  emailStatus: AccountEmailStatus;
}

@Component({
  selector: "app-users-settings",
  imports: [DatePipe, FormsModule],
  templateUrl: "./users-settings.html"
})
export class UsersSettings implements OnInit {
  private readonly userService = inject(UserService);
  private readonly authStore = inject(AuthStore);

  readonly users = signal<ManagedUser[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly savingId = signal<number | null>(null);

  readonly showCreateForm = signal(false);
  readonly creating = signal(false);
  readonly passwordUserId = signal<number | null>(null);
  readonly savingPassword = signal(false);
  readonly notice = signal<CredentialsNotice | null>(null);

  readonly roleLabels = USER_ROLE_LABELS;
  readonly roles = Object.keys(USER_ROLE_LABELS) as UserRole[];
  readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  readonly currentUserId = computed(() => this.authStore.dbUser()?.Id ?? null);
  readonly pendingCount = computed(() => this.users().filter((u) => u.Role === "user").length);

  newUser: NewUserRequest = this.emptyNewUser();
  newPassword = "";
  passwordEmailOptions = { sendEmail: true, includePassword: true };
  readonly emailStatusLabels = ACCOUNT_EMAIL_STATUS_LABELS;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.users.set(await this.userService.getUsers());
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  openCreateForm(): void {
    this.newUser = this.emptyNewUser();
    this.passwordUserId.set(null);
    this.notice.set(null);
    this.showCreateForm.set(true);
  }

  generateForNewUser(): void {
    this.newUser.password = generateReadablePassword();
  }

  async createUser(): Promise<void> {
    if (this.newUser.password.length < MIN_PASSWORD_LENGTH) {
      this.error.set(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      return;
    }
    this.creating.set(true);
    this.error.set(null);
    try {
      const created = await this.userService.createUser(this.newUser);
      this.notice.set({
        title: "Compte créé",
        email: created.Email,
        password: this.newUser.password,
        emailStatus: created.emailStatus
      });
      this.showCreateForm.set(false);
      this.newUser = this.emptyNewUser();
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.creating.set(false);
    }
  }

  openPasswordForm(user: ManagedUser): void {
    this.showCreateForm.set(false);
    this.notice.set(null);
    this.newPassword = "";
    this.passwordEmailOptions = { sendEmail: true, includePassword: true };
    this.passwordUserId.set(this.passwordUserId() === user.Id ? null : user.Id);
  }

  generateForPassword(): void {
    this.newPassword = generateReadablePassword();
  }

  async savePassword(user: ManagedUser): Promise<void> {
    if (this.newPassword.length < MIN_PASSWORD_LENGTH) {
      this.error.set(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      return;
    }
    this.savingPassword.set(true);
    this.error.set(null);
    try {
      const { emailStatus } = await this.userService.setPassword(user.Id, this.newPassword, this.passwordEmailOptions);
      this.notice.set({ title: "Mot de passe modifié", email: user.Email, password: this.newPassword, emailStatus });
      this.passwordUserId.set(null);
      this.newPassword = "";
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.savingPassword.set(false);
    }
  }

  async changeRole(user: ManagedUser, select: HTMLSelectElement): Promise<void> {
    const role = select.value as UserRole;
    if (role === user.Role) return;

    const label = user.Name || user.Email;
    if (!confirm(`Changer le rôle de ${label} : ${this.roleLabels[user.Role]} → ${this.roleLabels[role]} ?`)) {
      select.value = user.Role;
      return;
    }

    this.savingId.set(user.Id);
    this.error.set(null);
    try {
      await this.userService.updateRole(user.Id, role);
      await this.load();
    } catch (e) {
      select.value = user.Role;
      this.error.set((e as Error).message);
    } finally {
      this.savingId.set(null);
    }
  }

  routeNames(user: ManagedUser): string {
    return user.OperatedRoutes?.map((r) => r.Name).join(", ") || "—";
  }

  private emptyNewUser(): NewUserRequest {
    return { email: "", name: "", role: "operator", password: "", sendEmail: true, includePassword: true };
  }
}
