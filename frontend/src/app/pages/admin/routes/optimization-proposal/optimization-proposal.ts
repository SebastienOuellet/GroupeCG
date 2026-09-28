import { Component, computed, input } from "@angular/core";
import { OptimizationProposal } from "../../../../core/models/location.model";

/** Résumé d'une proposition de l'optimiseur : ordre enregistré vs proposé, arrêts exclus. */
@Component({
  selector: "app-optimization-proposal",
  templateUrl: "./optimization-proposal.html",
  styleUrl: "./optimization-proposal.scss"
})
export class OptimizationProposalPanel {
  readonly proposal = input.required<OptimizationProposal>();
  /** Proposition retouchée à la main : sera enregistrée comme ordre manuel. */
  readonly edited = input(false);

  readonly providerLabel = computed(() =>
    this.proposal().provider === "google" ? "Google Route Optimization" : "optimiseur local (à vol d'oiseau)"
  );

  /** Gain en % à vol d'oiseau ; null si l'ordre enregistré n'a pas de distance mesurable. */
  readonly savingPercent = computed(() => {
    const p = this.proposal();
    if (!p.current.straightLineKm) return null;
    return Math.round((1 - p.proposed.straightLineKm / p.current.straightLineKm) * 100);
  });
}
