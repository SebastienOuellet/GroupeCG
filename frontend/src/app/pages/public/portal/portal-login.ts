import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { PortalApiService } from "../../../core/portal/portal-api.service";
import { PortalSessionService } from "../../../core/portal/portal-session.service";
import { PortalLoginResponse } from "../../../core/models/portal.model";

@Component({
  selector: "app-portal-login",
  imports: [FormsModule],
  templateUrl: "./portal-login.html",
  styleUrl: "./portal-login.scss"
})
export class PortalLogin {
  private readonly portalApi = inject(PortalApiService);
  private readonly session = inject(PortalSessionService);
  private readonly router = inject(Router);

  reference = "";
  contractNumber = "";
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      const result = await this.portalApi.post<PortalLoginResponse>("login", {
        reference: this.reference.trim(),
        contractNumber: Number(this.contractNumber)
      });
      this.session.setToken(result.token);
      await this.router.navigate(["/portail/gestion"]);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
