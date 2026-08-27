import { Component, inject, OnInit, signal } from "@angular/core";
import { SlicePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { NotificationService } from "../../../core/services/notification.service";
import { TemplateService } from "../../../core/services/template.service";
import { RouteService } from "../../../core/services/route.service";
import { ContractService } from "../../../core/services/contract.service";
import { NotificationBatch, NotificationTemplate, TargetType } from "../../../core/models/notification.model";
import { Contract, RouteModel } from "../../../core/models/domain.model";
import { calculateSmsSegments, SmsSegmentInfo } from "../../../core/utils/sms-segments";

@Component({
  selector: "app-notifications-page",
  imports: [FormsModule, SlicePipe],
  templateUrl: "./notifications-page.html"
})
export class NotificationsPage implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly templateService = inject(TemplateService);
  private readonly routeService = inject(RouteService);
  private readonly contractService = inject(ContractService);
  private readonly router = inject(Router);

  readonly batches = signal<NotificationBatch[]>([]);
  readonly templates = signal<NotificationTemplate[]>([]);
  readonly routes = signal<RouteModel[]>([]);
  readonly contracts = signal<Contract[]>([]);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly sending = signal(false);

  form = {
    targetType: "route" as TargetType,
    targetId: null as number | null,
    templateId: null as number | null,
    smsBody: "",
    emailSubject: "",
    emailBody: "",
    useSms: true,
    useEmail: false
  };

  readonly statusLabels: Record<string, string> = {
    pending: "En attente",
    processing: "En cours",
    completed: "Complété",
    failed: "Échec"
  };

  readonly targetLabels: Record<string, string> = {
    route: "Route",
    contract: "Contrat",
    all: "Tous"
  };

  async ngOnInit(): Promise<void> {
    try {
      const [batches, templates, routes, contracts] = await Promise.all([
        this.notificationService.getBatches(),
        this.templateService.getTemplates(),
        this.routeService.getRoutes(),
        this.contractService.getContracts({ status: "active" })
      ]);
      this.batches.set(batches);
      this.templates.set(templates);
      this.routes.set(routes);
      this.contracts.set(contracts);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  onTemplateChange(): void {
    const template = this.templates().find((t) => t.Id === Number(this.form.templateId));
    if (!template) return;
    this.form.smsBody = template.SmsBody || "";
    this.form.emailSubject = template.EmailSubject || "";
    this.form.emailBody = template.EmailBody || "";
  }

  get smsPreview(): string {
    return `${this.form.smsBody}\nRépondez ARRET pour vous désabonner.`;
  }

  /** Segments SMS facturés, calculés sur le message final (pied ARRET inclus). */
  get smsSegmentInfo(): SmsSegmentInfo {
    return calculateSmsSegments(this.smsPreview);
  }

  async send(): Promise<void> {
    if (!this.form.useSms && !this.form.useEmail) {
      this.error.set("Choisissez au moins un canal (SMS ou courriel).");
      return;
    }
    if (this.form.targetType !== "all" && !this.form.targetId) {
      this.error.set("Choisissez une cible.");
      return;
    }
    if (!confirm("Confirmer l'envoi de cette notification ?")) return;

    this.sending.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      const batch = await this.notificationService.send({
        targetType: this.form.targetType,
        targetId: this.form.targetType === "all" ? null : Number(this.form.targetId),
        templateId: this.form.templateId ? Number(this.form.templateId) : null,
        smsBody: this.form.smsBody || undefined,
        emailSubject: this.form.emailSubject || undefined,
        emailBody: this.form.emailBody || undefined,
        useSms: this.form.useSms,
        useEmail: this.form.useEmail
      });
      this.info.set(`Notification mise en file (batch #${batch.Id}, ${batch.TotalCount} destinataire(s)).`);
      this.batches.set(await this.notificationService.getBatches());
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.sending.set(false);
    }
  }

  openBatch(batch: NotificationBatch): void {
    this.router.navigate(["/notifications", batch.Id]);
  }
}
