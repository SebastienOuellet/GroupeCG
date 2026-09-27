/** Désinscriptions (Loi 25 / LCAP) et état réel des avis d'une personne. */
export type NoticeChannel = "sms" | "email";

export interface Suppression {
  Reason: string;
  /** Ex. « réponse ARRÊT par SMS », « lien de désabonnement ». */
  ReasonLabel: string;
  createdAt: string;
}

export interface Suppressions {
  sms: Suppression | null;
  email: Suppression | null;
}

/** Client ou locataire : mêmes champs de contact et de consentement. */
export interface ContactPerson {
  Phone: string | null;
  Email: string | null;
  SmsConsent: boolean;
  EmailConsent: boolean;
  Suppressions?: Suppressions;
}

export type NoticeState = "on" | "off" | "no-contact" | "unsubscribed";

const CONTACT_FIELD: Record<NoticeChannel, "Phone" | "Email"> = { sms: "Phone", email: "Email" };
const CONSENT_FIELD: Record<NoticeChannel, "SmsConsent" | "EmailConsent"> = { sms: "SmsConsent", email: "EmailConsent" };

export function contactValue(person: Partial<ContactPerson>, channel: NoticeChannel): string {
  return String(person[CONTACT_FIELD[channel]] ?? "").trim();
}

export function suppressionOf(person: Partial<ContactPerson>, channel: NoticeChannel): Suppression | null {
  return person.Suppressions?.[channel] ?? null;
}

/**
 * État réel d'un canal : une case cochée sans numéro/courriel n'envoie rien,
 * et une désinscription l'emporte sur la case.
 */
export function noticeState(person: Partial<ContactPerson>, channel: NoticeChannel): NoticeState {
  if (suppressionOf(person, channel)) return "unsubscribed";
  if (!contactValue(person, channel)) return "no-contact";
  return person[CONSENT_FIELD[channel]] ? "on" : "off";
}

export function noticeLabel(state: NoticeState, channel: NoticeChannel): string {
  switch (state) {
    case "on":
      return "Oui";
    case "off":
      return "Non";
    case "no-contact":
      return channel === "sms" ? "Pas de numéro" : "Pas de courriel";
    case "unsubscribed":
      return "Désinscrit";
  }
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });

/**
 * Note affichée sous un contact désinscrit.
 * `selfService` : c'est la personne elle-même (client dans le portail) → peut se réabonner aux courriels.
 */
export function suppressionNote(channel: NoticeChannel, suppression: Suppression, selfService = false): string {
  const what = channel === "sms" ? "des avis par SMS" : "des avis par courriel";
  const base = `Désinscrit ${what} le ${formatDate(suppression.createdAt)} (${suppression.ReasonLabel}).`;
  if (channel === "sms") {
    return `${base} Seule la personne peut se réabonner, en répondant OUI (ou START) par SMS. Le numéro et l'avis ne peuvent pas être modifiés.`;
  }
  return selfService
    ? `${base} Cochez la case pour vous réabonner.`
    : `${base} Seule la personne peut se réabonner. Le courriel et l'avis ne peuvent pas être modifiés.`;
}
