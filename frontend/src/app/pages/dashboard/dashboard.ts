import { Component, inject, OnInit, signal } from "@angular/core";
import { AuthStore } from "../../core/auth/auth.store";
import { UserService } from "../../core/user.service";
import { User } from "../../core/models/user.model";

@Component({
  selector: "app-dashboard",
  imports: [],
  templateUrl: "./dashboard.html",
  styleUrl: "./dashboard.scss"
})
export class Dashboard implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly userService = inject(UserService);

  readonly me = signal<User | null>(null);

  async ngOnInit(): Promise<void> {
    this.me.set(await this.userService.getMe());
  }

  logout(): void {
    this.authStore.logout();
  }
}
