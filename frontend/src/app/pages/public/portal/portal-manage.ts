import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { PortalApiService } from "../../../core/portal/portal-api.service";
import { PortalSessionService } from "../../../core/portal/portal-session.service";
import { PortalMe } from "../../../core/models/portal.model";
import { Tenant } from "../../../core/models/domain.model";
import { NoticeChannel, Suppression, suppressionNote } from "../../../core/models/consent";
import { ContactForm } from "../../../shared/contact-form/contact-form";
import { NoticeStatus } from "../../../shared/notice-status/notice-status";

import { PortalTrackingCard } from "./portal-tracking-card";
@Component({
  selector: "app-portal-manage",
  imports: [FormsModule, ContactForm, NoticeStatus, PortalTrackingCard],
  templateUrl: "./portal-manage.html",
  styleUrl: "./portal-manage.scss"
})
export class PortalManage implements OnInit {
  private readonly portalApi = inject(PortalApiService);
  private readonly session = inject(PortalSessionService);
  private readonly router = inject(Router);

  readonly me = signal<PortalMe | null>(null);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly saving = signal(false);
  /** Personne en cours d'ajout (sans Id) ou de modification. */
  readonly tenantEditor = signal<Partial<Tenant> | null>(null);
  preferences = { SmsConsent: true, EmailConsent: true };

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.error.set(null);
    try {
      const me = await this.portalApi.get<PortalMe>("me");
      this.me.set(me);
      this.preferences = { SmsConsent: me.client.SmsConsent, EmailConsent: me.client.EmailConsent };
    } catch (e) {
      this.error.set((e as Error).message);
      if ((e as Error).message.includes("Session")) {
        await this.router.navigate(["/portail"]);
      }
    }
  }

  openTenantForm(): void {
    this.tenantEditor.set({ SmsConsent: true, EmailConsent: true });
  }

  editTenant(tenant: Tenant): void {
    this.tenantEditor.set({ ...tenant });
  }

  async saveTenant(fields: Partial<Tenant>): Promise<void> {
    const editing = this.tenantEditor();
    this.saving.set(true);
    this.error.set(null);
    try {
      if (editing?.Id) {
        await this.portalApi.put(`tenants/${editing.Id}`, fields);
      } else {
        await this.portalApi.post("tenants", fields);
      }
      this.tenantEditor.set(null);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  /** `self` : la personne est le client connecté (peut se réabonner aux courriels). */
  note(channel: NoticeChannel, suppression: Suppression, self: boolean): string {
    return suppressionNote(channel, suppression, self);
  }

  async removeTenant(tenant: Tenant): Promise<void> {
    if (!confirm("Retirer cette personne de la liste des avis ?")) return;
    try {
      await this.portalApi.delete(`tenants/${tenant.Id}`);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async savePreferences(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      await this.portalApi.put("preferences", this.preferences);
      this.info.set("Préférences mises à jour.");
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  logout(): void {
    this.session.clear();
    this.router.navigate(["/portail"]);
  }

  tenantName(tenant: Tenant): string {
    return [tenant.FirstName, tenant.LastName].filter(Boolean).join(" ") || "—";
  }
}
