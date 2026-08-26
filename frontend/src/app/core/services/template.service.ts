import { inject, Injectable } from "@angular/core";
import { ApiService } from "../api.service";
import { NotificationTemplate } from "../models/notification.model";

@Injectable({
  providedIn: "root"
})
export class TemplateService {
  private readonly api = inject(ApiService);

  getTemplates(): Promise<NotificationTemplate[]> {
    return this.api.get<NotificationTemplate[]>("template");
  }

  createTemplate(template: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
    return this.api.post<NotificationTemplate>("template", template);
  }

  updateTemplate(id: number, template: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
    return this.api.put<NotificationTemplate>(`template/${id}`, template);
  }

  deactivateTemplate(id: number): Promise<void> {
    return this.api.delete<void>(`template/${id}`);
  }
}
