/* eslint-disable no-console -- script CLI */
/**
 * Données de TEST pour les routes (phase R1/R2) : 20 clients fictifs, une adresse chacun
 * dans le secteur Boisjoli / Parc Central (Sherbrooke, J1N), un contrat actif par client
 * (400 $ à 550 $), tous sur la route « Route test — Boisjoli », volontairement non ordonnés.
 *
 *   node scripts/seed-test-route.js          # crée (refuse si les données test existent déjà)
 *   node scripts/seed-test-route.js --reset  # supprime les données test puis les recrée
 *   node scripts/seed-test-route.js --remove # supprime seulement
 *
 * Aucune coordonnée n'est écrite : sur la page de la route, « Localiser avec Google » les
 * trouve et enregistre le PlaceId (ça teste aussi ce parcours). Aucun courriel/téléphone :
 * démarrer la tournée n'envoie rien à personne. Refuse de tourner en production.
 */
import db from "../models/index.js";
import * as clientService from "../src/components/client/client.service.js";
import * as contractService from "../src/components/contract/contract.service.js";
import { CONTRACT_STATUS } from "../src/components/contract/contract.constants.js";
import { DRIVEWAY_SURFACES } from "../src/components/serviceAddress/serviceAddress.constants.js";
import { NodeEnv } from "../src/enum/NodeEnv.js";

const { Route, Client, ServiceAddress, sequelize, Sequelize } = db;
const { Op } = Sequelize;

const TEST_MARKER = "[TEST-R1]";
const ROUTE_NAME = "Route test — Boisjoli";
const SEASON = 2026;
const CITY = "Sherbrooke";

/** Rues visibles sur la carte du secteur ; numéros plausibles (le géocodage Google interpole). */
const ADDRESSES = [
  ["1045", "Rue Beausoleil", "J1N4G6"],
  ["1100", "Rue Beaudin", "J1N4C2"],
  ["938", "Rue Flamand", "J1N2K3"],
  ["1052", "Rue Frédéric", "J1N2A1"],
  ["1025", "Rue Fleurie", "J1N2A5"],
  ["960", "Rue Fabien", "J1N2K1"],
  ["945", "Rue Farrand", "J1N2K5"],
  ["975", "Rue Francheville", "J1N2K7"],
  ["1080", "Rue du Curé", "J1N2L1"],
  ["1015", "Rue Beauchamp", "J1N4C5"],
  ["1070", "Rue Bastien", "J1N4G2"],
  ["1035", "Rue Florent", "J1N4C8"],
  ["1150", "Rue Bégon", "J1N4H1"],
  ["1165", "Rue Boivin", "J1N4H3"],
  ["1180", "Rue Henri-Bourassa", "J1N2B4"],
  ["1210", "Rue de la Frontière", "J1N2B8"],
  ["1195", "Rue de Forillon", "J1N2C1"],
  ["1230", "Rue de la Falaise", "J1N2C3"],
  ["1130", "Rue du Président-Kennedy", "J1N2L5"],
  ["1085", "Rue Faribault", "J1N2A9"]
];

const FIRST_NAMES = ["Martin", "Julie", "Stéphane", "Nathalie", "Éric", "Isabelle", "Patrick", "Mélanie", "François", "Chantal",
  "Mathieu", "Geneviève", "Sylvain", "Karine", "Luc", "Annie", "Pierre-Luc", "Caroline", "Guillaume", "Josée"];
const LAST_NAMES = ["Tremblay", "Gagnon", "Roy", "Côté", "Bouchard", "Gauthier", "Morin", "Lavoie", "Fortin", "Gagné",
  "Ouellet", "Pelletier", "Bélanger", "Lévesque", "Bergeron", "Leblanc", "Paquette", "Girard", "Simard", "Boucher"];

/** Prix entre 400 $ et 550 $, arrondi à 5 $, reproductible (graine fixe). */
let seed = 42;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const priceFor = () => 400 + Math.round((random() * 150) / 5) * 5;

const removeTestData = async () => {
  const clients = await Client.findAll({ where: { Notes: { [Op.like]: `${TEST_MARKER}%` } }, attributes: ["Id"] });
  const clientIds = clients.map((c) => c.Id);
  if (!clientIds.length) return 0;
  await sequelize.transaction(async (transaction) => {
    const q = (sql) => sequelize.query(sql, { replacements: { clientIds }, transaction });
    const contractIds = `SELECT "Id" FROM "Contracts" WHERE "ClientId" IN (:clientIds)`;
    await q(`DELETE FROM "NotificationDeliveries" WHERE "ContractId" IN (${contractIds})`);
    await q(`DELETE FROM "RouteRunStops" WHERE "ContractId" IN (${contractIds})`);
    await q(`DELETE FROM "InvoiceLines" WHERE "InvoiceId" IN (SELECT "Id" FROM "Invoices" WHERE "ClientId" IN (:clientIds) OR "ContractId" IN (${contractIds}))`);
    await q(`DELETE FROM "Invoices" WHERE "ClientId" IN (:clientIds) OR "ContractId" IN (${contractIds})`);
    await q(`DELETE FROM "ContractItems" WHERE "ContractId" IN (${contractIds})`);
    await q(`UPDATE "Contracts" SET "RenewedFromContractId" = NULL WHERE "RenewedFromContractId" IN (${contractIds})`);
    await q(`DELETE FROM "Contracts" WHERE "ClientId" IN (:clientIds)`);
    await q(`DELETE FROM "Tenants" WHERE "ServiceAddressId" IN (SELECT "Id" FROM "ServiceAddresses" WHERE "ClientId" IN (:clientIds))`);
    await q(`DELETE FROM "ServiceAddresses" WHERE "ClientId" IN (:clientIds)`);
    await q(`DELETE FROM "Clients" WHERE "Id" IN (:clientIds)`);
  });
  // Tournées devenues vides sur la route test
  const route = await Route.findOne({ where: { Name: ROUTE_NAME } });
  if (route) {
    await sequelize.query(`DELETE FROM "RouteRuns" r WHERE r."RouteId" = :routeId AND NOT EXISTS (SELECT 1 FROM "RouteRunStops" s WHERE s."RouteRunId" = r."Id")`, { replacements: { routeId: route.Id } });
    await route.update({ SequenceSource: null, SequenceUpdatedAt: null, SequenceUpdatedByUserId: null });
  }
  return clientIds.length;
};

const createTestData = async () => {
  const [route] = await Route.findOrCreate({
    where: { Name: ROUTE_NAME },
    defaults: { Description: `${TEST_MARKER} Secteur Boisjoli / Parc Central — données de test`, SortOrder: 99, IsActive: true }
  });
  if (!route.IsActive) await route.update({ IsActive: true });

  // Ordre de création mélangé : la route démarre « à placer », dans le désordre
  const order = ADDRESSES.map((_, i) => i).sort(() => random() - 0.5);
  let total = 0;
  for (const [n, i] of order.entries()) {
    const [civic, street, postal] = ADDRESSES[i];
    const client = await clientService.createClient({
      FirstName: FIRST_NAMES[i],
      LastName: LAST_NAMES[i],
      SmsConsent: false,
      EmailConsent: false,
      VoiceConsent: false,
      Notes: `${TEST_MARKER} Client fictif pour tester les routes`,
      ServiceAddress: {
        CivicNumber: civic,
        Street: street,
        City: CITY,
        PostalCode: postal,
        DrivewaySurface: DRIVEWAY_SURFACES[Math.floor(random() * DRIVEWAY_SURFACES.length)]
      }
    });
    const address = await ServiceAddress.findOne({ where: { ClientId: client.Id } });
    const price = priceFor();
    total += price;
    const contract = await contractService.createContract({
      ClientId: client.Id,
      ServiceAddressId: address.Id,
      RouteId: route.Id,
      SeasonStartYear: SEASON,
      StartDate: `${SEASON}-11-01`,
      EndDate: `${SEASON + 1}-04-30`,
      Status: CONTRACT_STATUS.ACTIVE,
      Items: [{ Description: "Déneigement saisonnier", Quantity: 1, UnitPrice: price }],
      Notes: n % 5 === 0 ? "Attention au Tempo à gauche de l'entrée." : null
    });
    console.log(`  ${contract.Reference.padEnd(10)} ${`${civic} ${street}`.padEnd(32)} ${price} $`);
  }
  return { route, total };
};

const main = async () => {
  if ((process.env.NODE_ENV || NodeEnv.DEVELOPMENT) === NodeEnv.PRODUCTION) {
    throw new Error("Refusé : NODE_ENV=production. Ce script crée des données de test.");
  }
  const args = new Set(process.argv.slice(2));

  if (args.has("--reset") || args.has("--remove")) {
    console.log(`Suppression des données test : ${await removeTestData()} client(s).`);
    if (args.has("--remove")) return;
  } else if (await Client.count({ where: { Notes: { [Op.like]: `${TEST_MARKER}%` } } })) {
    throw new Error("Des données test existent déjà. Utilisez --reset pour les recréer ou --remove pour les supprimer.");
  }

  console.log(`Création de ${ADDRESSES.length} clients test (saison ${SEASON}-${SEASON + 1}) :`);
  const { route, total } = await createTestData();
  console.log(`\nOK — route « ${route.Name} » (#${route.Id}), ${ADDRESSES.length} contrats actifs, ${total} $ avant taxes.`);
  console.log(`Ensuite : Paramètres › Routes (dépôt), puis /routes/${route.Id} › « Localiser avec Google ».`);
};

main()
  .catch((error) => {
    console.error(`ÉCHEC : ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
