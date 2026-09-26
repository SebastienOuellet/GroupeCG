/**
 * Contrat de base d'un fournisseur courriel. Toute implémentation doit
 * retourner `{ providerMessageId }` en succès et lancer une erreur en échec.
 */
export class EmailProvider {
  /** `attachments` (optionnel) : [{ filename, content: Buffer, contentType }] */
  // eslint-disable-next-line no-unused-vars
  async send({ to, subject, html, text, attachments }) {
    throw new Error("EmailProvider.send doit être implémenté.");
  }
}
