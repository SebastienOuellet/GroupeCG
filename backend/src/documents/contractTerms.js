/**
 * Conditions imprimées sur le contrat PDF, reprises du contrat papier 2025-2026.
 * Les valeurs saisonnières se modifient dans Paramètres › Contrat (table Settings,
 * clé "contract_terms") ; celles-ci sont les valeurs par défaut.
 */
export const DEFAULT_CONTRACT_TERMS = {
  /** Accumulation minimale déclenchant un déblaiement (cm). */
  minSnowfallCm: 6,
  /** Précipitations couvertes par le contrat (cm) et moyenne régionale citée. */
  maxSnowfallCm: 325,
  regionalAverageCm: 265,
  /** Charge additionnelle pour les tempêtes après la date de fin du contrat (%). */
  lateStormSurchargePercent: 5,
  /** Abrasifs : appel d'épandage, baril saisonnier et remplissage ($ avant taxes). */
  abrasiveCallFrom: 50,
  abrasiveBarrelSeason: 350,
  abrasiveBarrelRefill: 100,
  /** Option d'épandage signée par le client ($ avant taxes). */
  abrasiveOptionFrom: 40,
  /** Date limite de signature / validité de l'offre, dans l'année de début de saison. */
  signatureDeadlineMonth: 10,
  signatureDeadlineDay: 15
};

/** Bornes de validation (l'API refuse hors bornes ; décimales permises pour les montants). */
export const CONTRACT_TERMS_RULES = {
  minSnowfallCm: { label: "Accumulation minimale (cm)", min: 0, max: 100, integer: true },
  maxSnowfallCm: { label: "Maximum couvert (cm)", min: 1, max: 2000, integer: true },
  regionalAverageCm: { label: "Moyenne régionale (cm)", min: 0, max: 2000, integer: true },
  lateStormSurchargePercent: { label: "Charge après la date du contrat (%)", min: 0, max: 100 },
  abrasiveCallFrom: { label: "Appel d'épandage à partir de ($)", min: 0, max: 10000 },
  abrasiveBarrelSeason: { label: "Baril d'abrasif, par hiver ($)", min: 0, max: 10000 },
  abrasiveBarrelRefill: { label: "Remplissage du baril ($)", min: 0, max: 10000 },
  abrasiveOptionFrom: { label: "Option d'épandage à partir de ($)", min: 0, max: 10000 },
  signatureDeadlineMonth: { label: "Date limite de signature (mois)", min: 1, max: 12, integer: true },
  signatureDeadlineDay: { label: "Date limite de signature (jour)", min: 1, max: 31, integer: true }
};

/** 50 → « 50 », 12.5 → « 12,50 » */
const amount = (value) => (Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(2).replace(".", ","));

/**
 * @param {object} params
 * @param {string} params.company      Raison sociale (ex. « Entreprises Christian Giroux »)
 * @param {string} params.amount       Montant total formaté (« 460,00 $ »)
 * @param {string} params.dueDate      Date limite de paiement formatée
 * @param {object} params.terms        Valeurs saisonnières (voir DEFAULT_CONTRACT_TERMS)
 * @returns {{ forClient: string[], forProvider: string[], clauses: string[], abrasiveOption: string }}
 */
export const buildContractTerms = ({ company, amount: total, dueDate, terms = DEFAULT_CONTRACT_TERMS }) => {
  const t = terms;
  return {
    forClient: [
      `Le CLIENT déboursera les frais de ${total} (taxes incluses) pour le contrat de déneigement, payables au plus tard le ${dueDate}.`
    ],
    forProvider: [
      `Le RESPONSABLE déblaiera l'entrée du CLIENT lors des tempêtes de neige (min. ${t.minSnowfallCm} cm) et fera l'entretien normal dans de telles circonstances.`,
      "Le RESPONSABLE pourra déblayer partiellement l'entrée le matin des tempêtes pour permettre au CLIENT de sortir en cas d'urgence et revenir plus tard dans la journée pour terminer le travail."
    ],
    clauses: [
      "En cas de bris d'équipement, nous serons responsables du déblaiement de votre entrée en considérant quand même un certain délai.",
      "Nous ne défraierons pas les frais encourus par un autre contracteur sans autorisation de notre part au préalable.",
      `Le présent contrat couvre les chutes de neige jusqu'à un maximum de ${t.maxSnowfallCm} cm (moyenne de notre région : ${t.regionalAverageCm} cm). Si la quantité de précipitations excède ${t.maxSnowfallCm} cm, le surplus vous sera facturé au prorata du présent contrat selon le nombre de centimètres excédentaires.`,
      `Toute tempête dépassant la date du contrat pourra amener une charge additionnelle de ${amount(t.lateStormSurchargePercent)} %.`,
      `Abrasifs en sus et sur demande. Appel d'épandage à partir de ${amount(t.abrasiveCallFrom)} $ plus taxes ; baril ${amount(t.abrasiveBarrelSeason)} $/hiver + ${amount(t.abrasiveBarrelRefill)} $/remplissage.`,
      `${company} ne sera pas tenue responsable des bris causés à des biens camouflés par la neige, incluant le revêtement et les bordures des cours.`
    ],
    abrasiveOption:
      `J'autorise ${company} à épandre de l'abrasif si j'en fais la demande et/ou si jugé nécessaire par ${company}. ` +
      `Frais d'épandage à partir de ${amount(t.abrasiveOptionFrom)} $ plus taxes. Le client est responsable d'évaluer ce besoin pendant la saison, et surtout en période de verglas.`
  };
};

/** Date limite de signature pour une saison (« 15 octobre 2026 » pour la saison 2026-2027), au format AAAA-MM-JJ. */
export const signatureDeadline = (seasonStartYear, terms = DEFAULT_CONTRACT_TERMS) => {
  const month = terms.signatureDeadlineMonth;
  const day = terms.signatureDeadlineDay;
  return `${seasonStartYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};
