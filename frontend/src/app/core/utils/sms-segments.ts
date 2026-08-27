/**
 * Calcul du nombre de segments SMS facturés par les fournisseurs (Twilio et
 * autres). Règles standard de l'industrie:
 *  - Encodage GSM-7 : 160 caractères par SMS, ou 153/segment si multi-parties.
 *  - Un caractère hors GSM-7 (ê, â, î, ô, û, œ, emoji...) force l'encodage
 *    UCS-2 pour TOUT le message : 70 caractères, ou 67/segment si multi-parties.
 *  - Les caractères de l'extension GSM-7 (€ [ ] { } ~ ^ | \) comptent double.
 */

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

const GSM7_EXTENDED = "^{}\\[~]|€";

export interface SmsSegmentInfo {
  /** Nombre de caractères visibles du message. */
  chars: number;
  /** Nombre de segments SMS facturés. */
  segments: number;
  /** Encodage détecté. */
  encoding: "GSM-7" | "UCS-2";
  /** Caractères qui forcent l'encodage Unicode (pour aider à les remplacer). */
  ucs2Culprits: string[];
}

export const calculateSmsSegments = (text: string): SmsSegmentInfo => {
  const value = text || "";
  const culprits = new Set<string>();
  let gsmLength = 0;

  for (const char of value) {
    if (GSM7_BASIC.includes(char)) {
      gsmLength += 1;
    } else if (GSM7_EXTENDED.includes(char)) {
      gsmLength += 2;
    } else {
      culprits.add(char);
    }
  }

  const isUcs2 = culprits.size > 0;
  const chars = [...value].length;

  let segments: number;
  if (chars === 0) {
    segments = 0;
  } else if (isUcs2) {
    segments = chars <= 70 ? 1 : Math.ceil(chars / 67);
  } else {
    segments = gsmLength <= 160 ? 1 : Math.ceil(gsmLength / 153);
  }

  return {
    chars,
    segments,
    encoding: isUcs2 ? "UCS-2" : "GSM-7",
    ucs2Culprits: [...culprits]
  };
};
