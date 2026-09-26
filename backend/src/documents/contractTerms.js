/**
 * Conditions imprimées sur le contrat PDF, reprises du contrat papier 2025-2026.
 * Les valeurs qui changent d'une saison à l'autre sont regroupées ici.
 */
export const CONTRACT_TERMS = {
  /** Accumulation minimale déclenchant un déblaiement (cm). */
  MIN_SNOWFALL_CM: 6,
  /** Précipitations couvertes par le contrat (cm) et moyenne régionale citée. */
  MAX_SNOWFALL_CM: 325,
  REGIONAL_AVERAGE_CM: 265,
  /** Charge additionnelle pour les tempêtes après la date de fin du contrat (%). */
  LATE_STORM_SURCHARGE_PERCENT: 5,
  /** Abrasifs : appel d'épandage, baril saisonnier et remplissage ($ avant taxes). */
  ABRASIVE_CALL_FROM: 50,
  ABRASIVE_BARREL_SEASON: 350,
  ABRASIVE_BARREL_REFILL: 100,
  /** Option d'épandage signée par le client ($ avant taxes). */
  ABRASIVE_OPTION_FROM: 40,
  /** Date limite de signature / validité de l'offre, dans l'année de début de saison. */
  SIGNATURE_DEADLINE: { month: 10, day: 15 }
};

/**
 * @param {object} params
 * @param {string} params.company      Raison sociale (ex. « Entreprises Christian Giroux »)
 * @param {string} params.amount       Montant total formaté (« 460,00 $ »)
 * @param {string} params.dueDate      Date limite de paiement formatée
 * @returns {{ forClient: string[], forProvider: string[], clauses: string[], abrasiveOption: string }}
 */
export const buildContractTerms = ({ company, amount, dueDate }) => {
  const t = CONTRACT_TERMS;
  return {
    forClient: [
      `Le CLIENT déboursera les frais de ${amount} (taxes incluses) pour le contrat de déneigement, payables au plus tard le ${dueDate}.`
    ],
    forProvider: [
      `Le RESPONSABLE déblaiera l'entrée du CLIENT lors des tempêtes de neige (min. ${t.MIN_SNOWFALL_CM} cm) et fera l'entretien normal dans de telles circonstances.`,
      "Le RESPONSABLE pourra déblayer partiellement l'entrée le matin des tempêtes pour permettre au CLIENT de sortir en cas d'urgence et revenir plus tard dans la journée pour terminer le travail."
    ],
    clauses: [
      "En cas de bris d'équipement, nous serons responsables du déblaiement de votre entrée en considérant quand même un certain délai.",
      "Nous ne défraierons pas les frais encourus par un autre contracteur sans autorisation de notre part au préalable.",
      `Le présent contrat couvre les chutes de neige jusqu'à un maximum de ${t.MAX_SNOWFALL_CM} cm (moyenne de notre région : ${t.REGIONAL_AVERAGE_CM} cm). Si la quantité de précipitations excède ${t.MAX_SNOWFALL_CM} cm, le surplus vous sera facturé au prorata du présent contrat selon le nombre de centimètres excédentaires.`,
      `Toute tempête dépassant la date du contrat pourra amener une charge additionnelle de ${t.LATE_STORM_SURCHARGE_PERCENT} %.`,
      `Abrasifs en sus et sur demande. Appel d'épandage à partir de ${t.ABRASIVE_CALL_FROM} $ plus taxes ; baril ${t.ABRASIVE_BARREL_SEASON} $/hiver + ${t.ABRASIVE_BARREL_REFILL} $/remplissage.`,
      `${company} ne sera pas tenue responsable des bris causés à des biens camouflés par la neige, incluant le revêtement et les bordures des cours.`
    ],
    abrasiveOption:
      `J'autorise ${company} à épandre de l'abrasif si j'en fais la demande et/ou si jugé nécessaire par ${company}. ` +
      `Frais d'épandage à partir de ${t.ABRASIVE_OPTION_FROM} $ plus taxes. Le client est responsable d'évaluer ce besoin pendant la saison, et surtout en période de verglas.`
  };
};

/** Date limite de signature pour une saison (« 15 octobre 2026 » pour la saison 2026-2027), au format AAAA-MM-JJ. */
export const signatureDeadline = (seasonStartYear) => {
  const { month, day } = CONTRACT_TERMS.SIGNATURE_DEADLINE;
  return `${seasonStartYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};
