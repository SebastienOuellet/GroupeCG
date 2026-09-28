import { Component, inject, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouteRun } from "../../../core/models/route-run.model";
import { PhoneGpsService } from "../../../core/services/phone-gps.service";

/**
 * Encadré de suivi GPS de la vue opérateur : le serveur reçoit-il des positions ?
 * Option pour envoyer celle du téléphone quand le tracteur n'a pas d'appareil.
 */
@Component({
  selector: "app-gps-status-card",
  imports: [FormsModule],
  template: `
<div class="gps-card" [class.gps-card--ok]="!stale()">
  <div class="gps-card__status">
    @if (!stale()) {
      📡 <strong>Suivi actif</strong>
    } @else if (run().Signal?.lastPositionAt) {
      ⚠️ <strong>Aucun signal GPS récent</strong>
    } @else {
      ⚠️ <strong>Aucune position reçue</strong>
    }
    <span class="gps-card__detail">
      {{ run().Vehicle ? "🚜 " + run().Vehicle?.Name : "Sans tracteur suivi" }}
      @if (run().Signal?.lastPositionAt) { · dernier signal {{ signalAgo() }} }
    </span>
  </div>
  @if (phoneGps.supported) {
    <label class="gps-card__toggle">
      <input type="checkbox" [ngModel]="phoneGps.active()" (ngModelChange)="phoneGpsChange.emit($event)" name="phoneGps" />
      Envoyer la position de ce téléphone
    </label>
    @if (phoneGps.active()) {
      <small class="gps-card__hint">
        GPS du téléphone : {{ phoneGps.lastFixAt() ? "position " + phoneFixAgo() : "recherche du signal..." }}.
        Garder cette page ouverte et l'écran allumé : le suivi s'arrête si vous ouvrez « Naviguer » ou verrouillez le téléphone.
      </small>
    } @else if (!run().Vehicle) {
      <small class="gps-card__hint">Ce tracteur n'a pas d'appareil de suivi : cochez pour que le bureau vous voie sur la carte.</small>
    }
    @if (phoneGps.error(); as gpsError) {
      <small class="gps-card__error">{{ gpsError }}</small>
    }
  }
</div>
  `,
  styles: `
/* Suivi GPS : vert quand le serveur reçoit des positions, orange sinon */
.gps-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border-left: 4px solid #a35200;
  background: #fff8ef;
  font-size: 0.875rem;
  color: var(--color-secondary);

  &--ok {
    border-left-color: #1e7a3c;
    background: #eef8f1;
  }

  &__status {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.5rem;
  }

  &__detail {
    color: #5a646e;
    font-size: 0.8125rem;
  }

  &__toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
    font-weight: 600;

    input {
      width: 22px;
      height: 22px;
    }
  }

  &__hint {
    color: #5a646e;
    line-height: 1.4;
  }

  &__error {
    color: #a02020;
    font-weight: 600;
  }
}

  `
})
export class GpsStatusCard {
  readonly phoneGps = inject(PhoneGpsService);

  readonly run = input.required<RouteRun>();
  /** Aucune position reçue depuis 2 min (ni appareil, ni ce téléphone). */
  readonly stale = input.required<boolean>();
  readonly signalAgo = input.required<string>();
  readonly phoneFixAgo = input.required<string>();

  readonly phoneGpsChange = output<boolean>();
}
