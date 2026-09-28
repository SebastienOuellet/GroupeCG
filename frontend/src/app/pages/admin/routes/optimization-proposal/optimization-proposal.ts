import { Component, computed, input } from "@angular/core";
import { OptimizationProposal } from "../../../../core/models/location.model";

interface Measure {
  icon: string;
  label: string;
  saved: number | null;
  proposed: number | null;
  gainPercent: number | null;
}

const gain = (saved: number | null, proposed: number | null): number | null =>
  saved && proposed !== null ? Math.round((1 - proposed / saved) * 100) : null;

/**
 * Résumé d'une proposition de l'optimiseur : ordre enregistré vs proposé, sur les deux mesures
 * (🚜 trajet routier Google, 🐦 vol d'oiseau), et arrêts exclus. Les km viennent de la page
 * (même calcul que la carte), donc restent justes si la proposition est retouchée.
 */
@Component({
  selector: "app-optimization-proposal",
  templateUrl: "./optimization-proposal.html",
  styleUrl: "./optimization-proposal.scss"
})
export class OptimizationProposalPanel {
  readonly proposal = input.required<OptimizationProposal>();
  /** Proposition retouchée à la main : sera enregistrée comme ordre manuel. */
  readonly edited = input(false);
  readonly savedStraightKm = input.required<number>();
  readonly currentStraightKm = input.required<number>();
  readonly savedRoadKm = input<number | null>(null);
  readonly currentRoadKm = input<number | null>(null);
  readonly roadLoading = input(false);

  readonly providerLabel = computed(() =>
    this.proposal().provider === "google" ? "Google Route Optimization" : "optimiseur local (à vol d'oiseau)"
  );

  readonly measures = computed<Measure[]>(() => [
    { icon: "🚜", label: "Trajet routier", saved: this.savedRoadKm(), proposed: this.currentRoadKm(), gainPercent: gain(this.savedRoadKm(), this.currentRoadKm()) },
    { icon: "🐦", label: "Vol d'oiseau", saved: this.savedStraightKm(), proposed: this.currentStraightKm(), gainPercent: gain(this.savedStraightKm(), this.currentStraightKm()) }
  ]);

  /** L'optimiseur local raccourcit la ligne droite ; par la route, ça peut être pire : on le dit. */
  readonly roadWorse = computed(() => {
    const road = this.measures()[0].gainPercent;
    return road !== null && road < 0;
  });
}
