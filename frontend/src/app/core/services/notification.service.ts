import { inject, Injectable } from "@angular/core";
import { ApiService } from "../api.service";
import {
  NotificationBatch,
  NotificationDelivery,
  SendNotificationRequest
} from "../models/notification.model";

@Injectable({
  providedIn: "root"
})
export class NotificationService {
  private readonly api = inject(ApiService);

  send(request: SendNotificationRequest): Promise<NotificationBatch> {
    return this.api.post<NotificationBatch>("notification/send", request);
  }

  getBatches(): Promise<NotificationBatch[]> {
    return this.api.get<NotificationBatch[]>("notification/batches");
  }

  getBatch(id: number): Promise<NotificationBatch> {
    return this.api.get<NotificationBatch>(`notification/batches/${id}`);
  }

  getBatchDeliveries(id: number): Promise<NotificationDelivery[]> {
    return this.api.get<NotificationDelivery[]>(`notification/batches/${id}/deliveries`);
  }
}
