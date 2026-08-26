/**
 * Contrat de base d'un fournisseur courriel. Toute implémentation doit
 * retourner `{ providerMessageId }` en succès et lancer une erreur en échec.
 */
export class EmailProvider {
  // eslint-disable-next-line no-unused-vars
  async send({ to, subject, html, text }) {
    throw new Error("EmailProvider.send doit être implémenté.");
  }
}
