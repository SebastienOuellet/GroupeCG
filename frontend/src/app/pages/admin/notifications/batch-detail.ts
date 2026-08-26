import { Component, inject, OnInit, signal } from "@angular/core";
import { SlicePipe } from "@angular/common";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { NotificationService } from "../../../core/services/notification.service";
import { NotificationBatch, NotificationDelivery } from "../../../core/models/notification.model";

@Component({
  selector: "app-batch-detail",
  imports: [RouterLink, SlicePipe],
  templateUrl: "./batch-detail.html"
})
export class BatchDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly notificationService = inject(NotificationService);

  readonly batch = signal<NotificationBatch | null>(null);
  readonly deliveries = signal<NotificationDelivery[]>([]);
  readonly error = signal<string | null>(null);

  readonly statusLabels: Record<string, string> = {
    queued: "En file",
    sending: "Envoi...",
    sent: "Envoyé",
    failed: "Échec",
    skipped_no_consent: "Sans consentement",
    suppressed: "Désabonné"
  };

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get("id"));
    try {
      const [batch, deliveries] = await Promise.all([
        this.notificationService.getBatch(id),
        this.notificationService.getBatchDeliveries(id)
      ]);
      this.batch.set(batch);
      this.deliveries.set(deliveries);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async refresh(): Promise<void> {
    const batch = this.batch();
    if (!batch) return;
    this.batch.set(await this.notificationService.getBatch(batch.Id));
    this.deliveries.set(await this.notificationService.getBatchDeliveries(batch.Id));
  }

  badgeClass(status: string): string {
    if (status === "sent") return "badge--active";
    if (status === "failed") return "badge--cancelled";
    if (status === "queued" || status === "sending") return "badge--draft";
    return "badge--inactive";
  }
}
