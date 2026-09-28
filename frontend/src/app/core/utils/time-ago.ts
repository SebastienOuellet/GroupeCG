/** « à l'instant », « il y a 42 s », « il y a 5 min », « il y a 3 h », sinon la date. */
export const timeAgo = (value: string | Date | null | undefined, now = Date.now()): string => {
  if (!value) return "jamais";
  const date = value instanceof Date ? value : new Date(value);
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (seconds < 5) return "à l'instant";
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `le ${date.toLocaleDateString("fr-CA")}`;
};
