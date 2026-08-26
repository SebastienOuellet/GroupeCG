/**
 * Contrat de base d'un fournisseur d'appels vocaux. Canal conçu mais non
 * implémenté — voir le plan (aucune implémentation au MVP).
 */
export class VoiceProvider {
  // eslint-disable-next-line no-unused-vars
  async call({ to, message }) {
    throw new Error("VoiceProvider.call doit être implémenté.");
  }
}
