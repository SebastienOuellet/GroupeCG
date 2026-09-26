import fs from "node:fs";
import PDFDocument from "pdfkit";
import { ConfigService } from "../config/configService.js";
import { buildContractTerms, signatureDeadline } from "./contractTerms.js";

const configService = new ConfigService();

const COLOR_PRIMARY = "#052261";
const COLOR_TEXT = "#2f3840";
const COLOR_MUTED = "#7a8591";
const COLOR_LINE = "#d0d5dd";
const COLOR_FILL = "#f3f5f9";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

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

/** « J1H0A0 » → « J1H 0A0 » */
const formatPostalCode = (postalCode) => {
  const compact = String(postalCode ?? "").replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact) ? `${compact.slice(0, 3)} ${compact.slice(3)}` : postalCode;
};

const addressLine = (address) =>
  address ? `${address.CivicNumber} ${address.Street}, ${address.City} ${formatPostalCode(address.PostalCode)}` : "—";

/**
 * Contrat de déneigement en PDF (le contrat fait office de facture).
 *
 * @param {object} params
 * @param {object} params.contract  Contrat avec Client, ServiceAddress
 * @param {object} params.invoice   Paiement du contrat (Invoice type contract) avec Lines
 * @param {string} params.dueDate   Date limite de paiement affichée (YYYY-MM-DD)
 * @param {string} params.issueDate Date du document (YYYY-MM-DD)
 * @param {object} [params.terms]   Valeurs des conditions (Paramètres › Contrat)
 * @param {string} [params.watermark] Texte en filigrane sur chaque page (ex. « EXEMPLE »)
 * @returns {Promise<Buffer>}
 */
export const buildContractPdf = ({ contract, invoice, dueDate, issueDate, terms: termValues, watermark }) =>
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
    const companyLines = [
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
    for (const line of [...companyLines, ...taxNumbers]) {
      doc.text(line, { width, align: "right" });
    }

    /* --- Titre --- */
    doc.y = Math.max(doc.y, top + 70) + 20;
    doc.rect(left, doc.y, width, 34).fill(COLOR_PRIMARY);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(14)
      .text("CONTRAT DE DÉNEIGEMENT", left + 12, doc.y + 10, { continued: true })
      .font("Helvetica").fontSize(11)
      .text(`   Saison ${contract.SeasonStartYear}-${contract.SeasonStartYear + 1}`);
    doc.y += 14;
    const city = configService.get("COMPANY_CITY");
    doc.font("Helvetica").fontSize(9).fillColor(COLOR_MUTED)
      .text(`Entente intervenue${city ? ` à ${city}` : ""}, le ${formatDate(issueDate)}.`, left, doc.y, { width });
    doc.y += 10;

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

    /* --- Conditions (contrat papier 2025-2026, voir contractTerms.js) --- */
    const company = configService.get("COMPANY_LEGAL_NAME");
    const representative = configService.get("COMPANY_REPRESENTATIVE");
    const terms = buildContractTerms({ company, amount: formatMoney(invoice.Amount), dueDate: formatDate(dueDate), terms: termValues });
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
    const ensureSpace = (height) => {
      if (doc.y + height > bottomLimit()) doc.addPage();
    };
    const numbered = (items) => {
      doc.font("Helvetica").fontSize(9).fillColor(COLOR_TEXT);
      items.forEach((item, index) => {
        ensureSpace(doc.heightOfString(item, { width: width - 14 }) + 4);
        const y = doc.y;
        doc.text(`${index + 1}.`, left, y, { width: 14 });
        doc.text(item, left + 14, y, { width: width - 14 });
        doc.moveDown(0.25);
      });
      doc.moveDown(0.6);
    };

    ensureSpace(40);
    doc.font("Helvetica").fontSize(9).fillColor(COLOR_TEXT)
      .text(
        `Entre le CLIENT ci-dessus et ${company}${representative ? `, représentée par ${representative}` : ""}, ci-après appelée LE RESPONSABLE, les parties conviennent de ce qui suit :`,
        left, doc.y, { width }
      );
    doc.moveDown(0.8);

    section("A. Pour le client");
    numbered(terms.forClient);
    section("B. Pour le responsable");
    numbered(terms.forProvider);
    section("Clauses particulières");
    numbered(terms.clauses);

    /* --- Option abrasif (à initialer par le client) --- */
    ensureSpace(70);
    const optionY = doc.y;
    const optionHeight = doc.heightOfString(terms.abrasiveOption, { width: width - 24 }) + 38;
    doc.rect(left, optionY, width, optionHeight).lineWidth(0.7).strokeColor(COLOR_LINE).stroke();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_PRIMARY).text("OPTION — ÉPANDAGE D'ABRASIF", left + 12, optionY + 8, { width: width - 24 });
    doc.font("Helvetica").fontSize(9).fillColor(COLOR_TEXT).text(terms.abrasiveOption, left + 12, doc.y + 3, { width: width - 24 });
    const initialsY = optionY + optionHeight - 10;
    doc.moveTo(right - 170, initialsY).lineTo(right - 12, initialsY).lineWidth(0.7).strokeColor(COLOR_TEXT).stroke();
    doc.font("Helvetica").fontSize(7).fillColor(COLOR_MUTED).text("Initiales du client (si l'option est choisie)", right - 170, initialsY + 2, { width: 158, lineBreak: false });
    doc.y = optionY + optionHeight + 18;

    /* --- Signatures --- */
    const deadline = signatureDeadline(contract.SeasonStartYear, termValues);
    const beforeDeadline = issueDate <= deadline;
    ensureSpace(90);
    if (beforeDeadline) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_TEXT)
        .text(`Signer et retourner une copie avant le ${formatDate(deadline)}.`, left, doc.y, { width });
    }
    const signY = doc.y + 34;
    const signWidth = (width - 40) / 2;
    ["Signature du client", "Date"].forEach((caption, index) => {
      const x = left + index * (signWidth + 40);
      doc.moveTo(x, signY).lineTo(x + signWidth, signY).lineWidth(0.7).strokeColor(COLOR_TEXT).stroke();
      doc.font("Helvetica").fontSize(8).fillColor(COLOR_MUTED).text(caption, x, signY + 4, { width: signWidth });
    });
    doc.y = signY + 26;
    if (beforeDeadline) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_PRIMARY)
        .text(`Note : offre valide jusqu'au ${formatDate(deadline)} ; ensuite, votre place ainsi que le prix ne sont plus garantis.`, left, doc.y, { width });
    }

    /* --- Pied de page (toutes les pages) --- */
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      if (watermark) {
        doc.save();
        doc.rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] });
        doc.font("Helvetica-Bold").fontSize(110).fillColor(COLOR_PRIMARY).fillOpacity(0.07)
          .text(watermark, 0, doc.page.height / 2 - 55, { width: doc.page.width, align: "center", lineBreak: false });
        doc.restore();
        doc.fillOpacity(1);
      }
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
