import { ConfigService } from "../config/configService.js";
import { formatDate, formatMoney } from "./contractPdf.js";

const configService = new ConfigService();

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/**
 * Courriel qui accompagne le contrat PDF. Message transactionnel (contrat en
 * cours avec le client) : pas de lien de désabonnement au sens de la LCAP.
 */
export const buildContractEmail = ({ contract, invoice, dueDate }) => {
  const company = configService.get("COMPANY_NAME");
  const firstName = contract.Client?.FirstName || "";
  const season = `${contract.SeasonStartYear}-${contract.SeasonStartYear + 1}`;
  const contact = [configService.get("COMPANY_PHONE"), configService.get("COMPANY_EMAIL")].filter(Boolean).join(" · ");

  const subject = `Votre contrat de déneigement ${season} — ${contract.Reference}`;

  const text = [
    `Bonjour ${firstName},`.trim(),
    "",
    `Vous trouverez ci-joint votre contrat de déneigement pour la saison ${season} (référence ${contract.Reference}).`,
    "",
    `Montant à payer : ${formatMoney(invoice.Amount)} (taxes incluses)`,
    `Payable au plus tard le : ${formatDate(dueDate)}`,
    "",
    "Merci de votre confiance.",
    company,
    ...(contact ? [contact] : [])
  ].join("\n");

  const html = `<!doctype html>
<html lang="fr">
<body style="font-family: Arial, sans-serif; color: #2f3840; max-width: 600px; margin: 0 auto; padding: 16px;">
  <div style="border-top: 4px solid #052261; padding-top: 16px;">
    <p>Bonjour ${escapeHtml(firstName)},</p>
    <p>Vous trouverez ci-joint votre contrat de déneigement pour la saison ${season} (référence <strong>${escapeHtml(contract.Reference)}</strong>).</p>
    <table style="margin: 16px 0; font-size: 15px;">
      <tr><td style="padding: 4px 16px 4px 0; color: #7a8591;">Montant à payer</td><td><strong>${formatMoney(invoice.Amount)}</strong> (taxes incluses)</td></tr>
      <tr><td style="padding: 4px 16px 4px 0; color: #7a8591;">Payable au plus tard le</td><td><strong>${formatDate(dueDate)}</strong></td></tr>
    </table>
    <p>Merci de votre confiance.</p>
    <p style="color: #7a8591; font-size: 13px;">${escapeHtml(company)}${contact ? `<br />${escapeHtml(contact)}` : ""}</p>
  </div>
</body>
</html>`;

  return { subject, text, html };
};
