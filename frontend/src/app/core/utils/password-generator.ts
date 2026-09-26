const WORDS = [
  "Neige", "Flocon", "Glace", "Hiver", "Sapin", "Pelle", "Tuque", "Mitaine",
  "Erable", "Traineau", "Poudrerie", "Verglas", "Bottes", "Foyer", "Castor", "Orignal"
];

const randomInt = (max: number): number => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
};

/**
 * Génère un mot de passe facile à dicter ou à écrire pour un utilisateur peu technique
 * (ex. « Flocon-Sapin-4827 ») : deux mots sans accent + 4 chiffres.
 */
export const generateReadablePassword = (): string => {
  const first = WORDS[randomInt(WORDS.length)];
  let second = WORDS[randomInt(WORDS.length)];
  while (second === first) {
    second = WORDS[randomInt(WORDS.length)];
  }
  const digits = String(randomInt(10000)).padStart(4, "0");
  return `${first}-${second}-${digits}`;
};
