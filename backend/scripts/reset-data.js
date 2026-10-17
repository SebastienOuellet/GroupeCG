/* eslint-disable no-console -- script CLI */
/**
 * Remise à zéro des données d'exploitation, avant la mise en service (ou d'une base de dev).
 * Efface les clients, adresses, locataires, contrats, factures, tournées, positions GPS,
 * envois de notifications et journaux de consentement (et les routes, sauf --keep-routes).
 * Les numéros repartent du début : références 26-1001, factures, Id.
 *
 * GARDE : utilisateurs, paramètres (dépôt, conditions du contrat, durées), modèles de
 * notification, véhicules (et leurs jetons d'appareil), et la liste STOP / désinscriptions
 * (SuppressedContacts, preuve LCAP), sauf --include-suppressions.
 *
 *   node scripts/reset-data.js                          # aperçu : compte ce qui serait effacé, ne touche à rien
 *   node scripts/reset-data.js --confirm=<DB_NAME>      # efface pour vrai (nom de la base en garde-fou)
 *   ... --keep-routes                                   # garde les routes (vide seulement leur ordre de passage)
 *   ... --include-suppressions                          # efface aussi la liste STOP (numéros de test)
 *
 * La base DigitalOcean est partagée entre les postes ET la prod : faire une sauvegarde avant
 * (DigitalOcean › Databases › Backups, ou pg_dump). Après la mise en service, ne plus utiliser
 * ce script sur cette base : il efface les vrais clients.
 */
import db from "../models/index.js";

const { sequelize } = db;

/** Tables d'exploitation, effacées ensemble (TRUNCATE multi-tables : les FK entre elles ne gênent pas). */
const OPERATIONAL_TABLES = [
  "VehiclePositions",
  "RouteRunStops",
  "RouteRuns",
  "NotificationDeliveries",
  "NotificationBatches",
  "InvoiceLines",
  "Invoices",
  "ContractItems",
  "Contracts",
  "Tenants",
  "ServiceAddresses",
  "Clients",
  "ConsentLogs"
];
const ROUTES_TABLE = "Routes";
const SUPPRESSIONS_TABLE = "SuppressedContacts";
const KEPT_TABLES = ["Users", "Settings", "NotificationTemplates", "Vehicles"];

const quote = (table) => `"${table}"`;

const countRows = async (tables) => {
  const counts = {};
  for (const table of tables) {
    const [[row]] = await sequelize.query(`SELECT COUNT(*)::int AS n FROM ${quote(table)}`);
    counts[table] = row.n;
  }
  return counts;
};

const printCounts = (title, counts) => {
  console.log(title);
  for (const [table, n] of Object.entries(counts)) console.log(`  ${table.padEnd(24)} ${String(n).padStart(6)}`);
};

const main = async () => {
  const args = process.argv.slice(2);
  const keepRoutes = args.includes("--keep-routes");
  const includeSuppressions = args.includes("--include-suppressions");
  const confirm = args.find((a) => a.startsWith("--confirm="))?.slice("--confirm=".length);

  const { database, host } = sequelize.config;
  const toWipe = [...OPERATIONAL_TABLES, ...(keepRoutes ? [] : [ROUTES_TABLE]), ...(includeSuppressions ? [SUPPRESSIONS_TABLE] : [])];
  const toKeep = [...KEPT_TABLES, ...(keepRoutes ? [ROUTES_TABLE] : []), ...(includeSuppressions ? [] : [SUPPRESSIONS_TABLE])];

  console.log(`Base : ${database} @ ${host}\n`);
  printCounts("À EFFACER :", await countRows(toWipe));
  printCounts("\nGARDÉ :", await countRows(toKeep));
  if (keepRoutes) console.log("  (routes gardées : ordre de passage remis à vide)");

  if (confirm === undefined) {
    console.log(`\nAperçu seulement, rien n'a été effacé. Pour effacer : node scripts/reset-data.js --confirm=${database}${keepRoutes ? " --keep-routes" : ""}${includeSuppressions ? " --include-suppressions" : ""}`);
    return;
  }
  if (confirm !== database) {
    throw new Error(`--confirm=${confirm} ne correspond pas à la base connectée (${database}). Rien n'a été effacé.`);
  }

  await sequelize.transaction(async (transaction) => {
    // Sans CASCADE : si une table non listée référence l'une d'elles, Postgres refuse au lieu d'effacer en douce.
    await sequelize.query(`TRUNCATE ${toWipe.map(quote).join(", ")} RESTART IDENTITY`, { transaction });
    if (keepRoutes) {
      await sequelize.query(
        `UPDATE "Routes" SET "SequenceSource" = NULL, "SequenceUpdatedAt" = NULL, "SequenceUpdatedByUserId" = NULL`,
        { transaction }
      );
    }
  });

  printCounts("\nEffacé. Restant :", await countRows(toWipe));
};

main()
  .catch((error) => {
    console.error(`ÉCHEC : ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
