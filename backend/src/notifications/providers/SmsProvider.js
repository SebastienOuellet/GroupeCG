/**
 * Contrat de base d'un fournisseur SMS. Toute implémentation doit retourner
 * `{ providerMessageId }` en succès et lancer une erreur en échec.
 */
export class SmsProvider {
  // eslint-disable-next-line no-unused-vars
  async send({ to, body }) {
    throw new Error("SmsProvider.send doit être implémenté.");
  }
}
