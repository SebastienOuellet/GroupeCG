import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { TemplateService } from "../../../core/services/template.service";
import { NotificationTemplate } from "../../../core/models/notification.model";
import { calculateSmsSegments, SmsSegmentInfo } from "../../../core/utils/sms-segments";

@Component({
  selector: "app-templates-list",
  imports: [FormsModule],
  templateUrl: "./templates-list.html"
})
export class TemplatesList implements OnInit {
  private readonly templateService = inject(TemplateService);

  readonly templates = signal<NotificationTemplate[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly saving = signal(false);

  form: Partial<NotificationTemplate> = {};

  readonly typeLabels: Record<string, string> = {
    storm: "Tempête",
    route_start: "Départ de route",
    renewal: "Renouvellement",
    custom: "Personnalisé"
  };

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.templates.set(await this.templateService.getTemplates());
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  /** Segments SMS du modèle, pied ARRET inclus (ajouté automatiquement à l'envoi). */
  get smsSegmentInfo(): SmsSegmentInfo {
    return calculateSmsSegments(`${this.form.SmsBody || ""}\nRépondez ARRET pour vous désabonner.`);
  }

  openForm(template?: NotificationTemplate): void {
    this.form = template ? { ...template } : { Type: "custom" };
    this.showForm.set(true);
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      if (this.form.Id) {
        await this.templateService.updateTemplate(this.form.Id, this.form);
      } else {
        await this.templateService.createTemplate(this.form);
      }
      this.showForm.set(false);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async deactivate(template: NotificationTemplate): Promise<void> {
    if (!confirm(`Désactiver le modèle « ${template.Name} » ?`)) return;
    try {
      await this.templateService.deactivateTemplate(template.Id);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
}
