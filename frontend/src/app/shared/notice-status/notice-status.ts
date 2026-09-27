import { Component, computed, input } from "@angular/core";
import { ContactPerson, NoticeChannel, noticeLabel, noticeState } from "../../core/models/consent";

/** Pastille de l'état réel d'un avis (Oui / Non / Pas de courriel / Désinscrit). */
@Component({
  selector: "app-notice-status",
  template: `<span class="notice notice--{{ state() }}">{{ label() }}</span>`,
  styles: `
    .notice { display: inline-block; padding: 0.1rem 0.55rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
    .notice--on { background: #e3f4e8; color: #1e7a3c; }
    .notice--off { background: #eef0f3; color: #5a646e; }
    .notice--no-contact { background: transparent; color: #7a8591; font-weight: 400; padding-left: 0; padding-right: 0; }
    .notice--unsubscribed { background: #fbe9e7; color: #c0392b; }
  `
})
export class NoticeStatus {
  readonly person = input.required<Partial<ContactPerson>>();
  readonly channel = input.required<NoticeChannel>();
  readonly state = computed(() => noticeState(this.person(), this.channel()));
  readonly label = computed(() => noticeLabel(this.state(), this.channel()));
}
