/**
 * Contrat commun des optimiseurs de tournée (1 véhicule).
 *
 * Entrée `optimize({ start, end, stops })` :
 *  - start / end : { latitude, longitude, placeId? } — départ et retour (dépôt ou point d'attache)
 *  - startTime : Date de départ de la tournée (optionnelle ; Google s'en sert pour ses horaires)
 *  - stops : [{ id, latitude?, longitude?, placeId?, visitSeconds }] — `id` = ContractId.
 *    Minimisation Loi 25 : aucune donnée nominative ne doit entrer ici.
 *
 * Sortie : { provider, orderedIds, skipped: [{ id, reason }], distanceKm, durationMinutes }
 *  - distanceKm / durationMinutes : estimation du fournisseur (routière pour Google,
 *    vol d'oiseau pour l'optimiseur local), null si inconnue.
 */
export class RouteOptimizer {
  get provider() {
    throw new Error("provider non implémenté");
  }

  // eslint-disable-next-line no-unused-vars
  async optimize({ start, end, stops }) {
    throw new Error("optimize() non implémenté");
  }
}
