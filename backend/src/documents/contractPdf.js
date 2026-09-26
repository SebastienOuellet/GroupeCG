import fs from "node:fs";
import PDFDocument from "pdfkit";
import { ConfigService } from "../config/configService.js";

const configService = new ConfigService();

const COLOR_PRIMARY = "#052261";
const COLOR_TEXT = "#2f3840";
const COLOR_MUTED = "#7a8591";
const COLOR_LINE = "#d0d5dd";
const COLOR_FILL = "#f3f5f9";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/**
 * Conditions imprimées au bas du contrat. Volontairement factuelles : les
 * conditions commerciales réelles de GroupeCG (précipitations minimales,
 * dommages, résiliation...) sont à compléter ici.
 */
export const CONTRACT_CONDITIONS = [
  "Le montant total, taxes incluses, est payable au plus tard à la date indiquée ci-dessus.",
  "Le service couvre la période indiquée au contrat, pour l'adresse de service indiquée.",
  "Les consignes particulières ci-dessus font partie du contrat."
];

/** 1234.5 → « 1 234,50 $ » (espaces normales : les polices PDF standard n'ont pas l'espace fine). */
export const formatMoney = (value) => {
  const [int, dec] = Number(value || 0).toFixed(2).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${dec} $`;
};

/** "2026-11-01" → « 1er novembre 2026 » */
export const formatDate = (dateOnly) => {
  if (!dateOnly) return "—";
  const [year, month, day] = String(dateOnly).slice(0, 10).split("-").map(Number);
  return `${day === 1 ? "1er" : day} ${MONTHS[month - 1]} ${year}`;
};

const formatQuantity = (value) => {
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(".", ",");
};

/** +18195551234 → « 819 555-1234 » ; autre format laissé tel quel. */
const formatPhone = (phone) => {
  const match = String(phone ?? "").match(/^\+?1?(\d{3})(\d{3})(\d{4})$/);
  return match ? `${match[1]} ${match[2]}-${match[3]}` : phone;
};

const clientName = (client) => {
  const person = [client?.FirstName, client?.LastName].filter(Boolean).join(" ");
  return client?.CompanyName ? `${client.CompanyName}${person ? ` (${person})` : ""}` : person || `Client #${client?.ClientNumber}`;
};

const addressLine = (address) =>
  address ? `${address.CivicNumber} ${address.Street}, ${address.City} ${address.PostalCode}` : "—";

/**
 * Contrat de déneigement en PDF (le contrat fait office de facture).
 *
 * @param {object} params
 * @param {object} params.contract  Contrat avec Client, ServiceAddress
 * @param {object} params.invoice   Paiement du contrat (Invoice type contract) avec Lines
 * @param {string} params.dueDate   Date limite de paiement affichée (YYYY-MM-DD)
 * @param {string} params.issueDate Date du document (YYYY-MM-DD)
 * @returns {Promise<Buffer>}
 */
export const buildContractPdf = ({ contract, invoice, dueDate, issueDate }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 50, bottom: 60, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: `Contrat ${contract.Reference}`,
        Author: configService.get("COMPANY_NAME")
      }
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const right = left + width;

    /* --- En-tête : logo + coordonnées de l'entreprise --- */
    const logoPath = configService.get("COMPANY_LOGO_PATH");
    const top = doc.y;
    if (logoPath && fs.existsSync(logoPath)) {
      doc.image(logoPath, left, top, { fit: [70, 70] });
    }
    const company = [
      configService.get("COMPANY_ADDRESS"),
      configService.get("COMPANY_PHONE"),
      configService.get("COMPANY_EMAIL")
    ].filter(Boolean);
    const taxNumbers = [
      configService.get("COMPANY_TPS_NUMBER") && `TPS : ${configService.get("COMPANY_TPS_NUMBER")}`,
      configService.get("COMPANY_TVQ_NUMBER") && `TVQ : ${configService.get("COMPANY_TVQ_NUMBER")}`
    ].filter(Boolean);

    doc.font("Helvetica-Bold").fontSize(14).fillColor(COLOR_PRIMARY)
      .text(configService.get("COMPANY_NAME"), left, top, { width, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor(COLOR_MUTED);
    for (const line of [...company, ...taxNumbers]) {
      doc.text(line, { width, align: "right" });
    }

    /* --- Titre --- */
    doc.y = Math.max(doc.y, top + 70) + 20;
    doc.rect(left, doc.y, width, 34).fill(COLOR_PRIMARY);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(14)
      .text("CONTRAT DE DÉNEIGEMENT", left + 12, doc.y + 10, { continued: true })
      .font("Helvetica").fontSize(11)
      .text(`   Saison ${contract.SeasonStartYear}-${contract.SeasonStartYear + 1}`);
    doc.y += 18;

    /* --- Client | Contrat --- */
    const colWidth = (width - 20) / 2;
    const blockTop = doc.y;
    const label = (text, x, y) => doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR_MUTED).text(text.toUpperCase(), x, y, { width: colWidth });
    const value = (text, x) => doc.font("Helvetica").fontSize(10).fillColor(COLOR_TEXT).text(text, x, doc.y, { width: colWidth });

    label("Client", left, blockTop);
    value(clientName(contract.Client), left);
    if (contract.Client?.Phone) value(formatPhone(contract.Client.Phone), left);
    if (contract.Client?.Email) value(contract.Client.Email, left);
    doc.moveDown(0.6);
    label("Adresse de service", left, doc.y);
    value(addressLine(contract.ServiceAddress), left);
    const leftBottom = doc.y;

    const col2 = left + colWidth + 20;
    const kv = [
      ["Référence client", contract.Reference],
      ["N° de contrat", String(contract.ContractNumber)],
      ["N° de facture", invoice.InvoiceNumber],
      ["Date", formatDate(issueDate)],
      ["Période de service", `Du ${formatDate(contract.StartDate)} au ${formatDate(contract.EndDate)}`]
    ];
    doc.y = blockTop;
    for (const [k, v] of kv) {
      const y = doc.y;
      doc.font("Helvetica").fontSize(9).fillColor(COLOR_MUTED).text(k, col2, y, { width: 95 });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_TEXT).text(v, col2 + 95, y, { width: colWidth - 95 });
      doc.y = Math.max(doc.y, y + 14);
    }
    doc.y = Math.max(doc.y, leftBottom) + 18;

    /* --- Éléments --- */
    const cols = [
      { key: "Description", title: "Description", x: left + 8, w: width - 250, align: "left" },
      { key: "Quantity", title: "Qté", x: right - 240, w: 50, align: "right" },
      { key: "UnitPrice", title: "Prix unitaire", x: right - 180, w: 80, align: "right" },
      { key: "LineTotal", title: "Total", x: right - 90, w: 82, align: "right" }
    ];
    const headerY = doc.y;
    doc.rect(left, headerY, width, 22).fill(COLOR_FILL);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_TEXT);
    for (const col of cols) doc.text(col.title, col.x, headerY + 7, { width: col.w, align: col.align });
    doc.y = headerY + 22;

    for (const line of invoice.Lines ?? []) {
      const rowY = doc.y + 6;
      const cells = {
        Description: line.Description,
        Quantity: formatQuantity(line.Quantity),
        UnitPrice: formatMoney(line.UnitPrice),
        LineTotal: formatMoney(line.LineTotal)
      };
      doc.font("Helvetica").fontSize(10).fillColor(COLOR_TEXT);
      const rowHeight = doc.heightOfString(cells.Description, { width: cols[0].w });
      for (const col of cols) doc.text(cells[col.key], col.x, rowY, { width: col.w, align: col.align });
      doc.y = rowY + rowHeight + 6;
      doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(0.5).strokeColor(COLOR_LINE).stroke();
    }

    /* --- Totaux --- */
    doc.y += 8;
    const totals = [
      ["Sous-total", invoice.Subtotal],
      ["TPS (5 %)", invoice.TpsAmount],
      ["TVQ (9,975 %)", invoice.TvqAmount]
    ];
    for (const [k, v] of totals) {
      const y = doc.y;
      doc.font("Helvetica").fontSize(10).fillColor(COLOR_MUTED).text(k, right - 240, y, { width: 140, align: "right" });
      doc.fillColor(COLOR_TEXT).text(formatMoney(v), right - 90, y, { width: 82, align: "right" });
      doc.y = y + 15;
    }
    doc.y += 4;
    const payY = doc.y;
    doc.rect(right - 250, payY, 250, 30).fill(COLOR_PRIMARY);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#ffffff")
      .text("Montant à payer", right - 240, payY + 10, { width: 140, align: "left" })
      .text(formatMoney(invoice.Amount), right - 100, payY + 10, { width: 92, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor(COLOR_TEXT)
      .text(`Payable au plus tard le ${formatDate(dueDate)}`, right - 250, payY + 36, { width: 250, align: "right" });
    doc.y = payY + 60;

    /* --- Consignes --- */
    const section = (title) => {
      doc.x = left;
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR_PRIMARY).text(title, left, doc.y, { width });
      doc.moveDown(0.3);
    };
    if (contract.Notes?.trim()) {
      section("Consignes de déneigement");
      doc.font("Helvetica").fontSize(10).fillColor(COLOR_TEXT).text(contract.Notes.trim(), left, doc.y, { width });
      doc.moveDown(1);
    }

    /* --- Conditions --- */
    section("Conditions");
    doc.font("Helvetica").fontSize(9).fillColor(COLOR_TEXT);
    CONTRACT_CONDITIONS.forEach((condition, index) => {
      doc.text(`${index + 1}. ${condition}`, left, doc.y, { width });
      doc.moveDown(0.2);
    });

    /* --- Signatures --- */
    doc.moveDown(2);
    if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
    const signY = doc.y + 20;
    const signWidth = (width - 40) / 2;
    for (const [i, text] of ["Signature du client", "Date"].entries()) {
      const x = left + i * (signWidth + 40);
      doc.moveTo(x, signY).lineTo(x + signWidth, signY).lineWidth(0.7).strokeColor(COLOR_TEXT).stroke();
      doc.font("Helvetica").fontSize(8).fillColor(COLOR_MUTED).text(text, x, signY + 4, { width: signWidth });
    }

    /* --- Pied de page (toutes les pages) --- */
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Écrire sous la marge du bas ferait ajouter une page par pdfkit : marge levée le temps du pied.
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const footerY = doc.page.height - 40;
      doc.font("Helvetica").fontSize(8).fillColor(COLOR_MUTED)
        .text(`${configService.get("COMPANY_NAME")} — Contrat ${contract.Reference} — ${invoice.InvoiceNumber}`, left, footerY, { width, align: "left", lineBreak: false })
        .text(`Page ${i + 1} / ${range.count}`, left, footerY, { width, align: "right", lineBreak: false });
      doc.page.margins.bottom = bottomMargin;
    }

    doc.end();
  });
