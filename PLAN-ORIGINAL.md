# Plan — GroupeCG : gestion de contrats de déneigement

## Contexte

GroupeCG doit devenir un « FolloSOFT propre et lean » pour petits déneigeurs québécois : gestion de clients, contrats saisonniers, adresses de service, routes de déneigement, locataires (tenants) à notifier par SMS/courriel, avec conformité Loi 25 / LCAP (désabonnement obligatoire). Le scaffold existant (backend Express/Sequelize/Firebase + frontend Angular 21) sert de base ; le projet **ProfilsJardins** (`E:\DEV\ProfilsJardins`) sert de référence de patterns — en corrigeant ses défauts connus (file de notifications en mémoire perdue au redémarrage, SID Twilio hardcodé, magic numbers de statut, routes non authentifiées).

**Décisions confirmées avec l'utilisateur :**
- Une seule entreprise pour l'instant (FK conçues pour ajouter `EntrepriseId` plus tard).
- Canaux : SMS (Twilio) + courriel (SMTP2GO/nodemailer déjà en place). Voix : abstraction prévue, non implémentée. **Fournisseur swappable obligatoire** (abstraction provider).
- Français seulement.
- Déclencheurs de notifications : envoi manuel admin **et** opérateur qui démarre sa route.
- Comptes : admin + opérateur (Firebase). Les clients ne se connectent pas — portail public libre-service via **référence client `YY-XXXX` + numéro de contrat** (pas le code postal).
- Référence style FolloSOFT : un client reçoit un code stable de 4-5 chiffres à sa création (ex. `1001`), agrémenté de l'année en cours → référence `26-1001` pour la saison 2026-2027, `27-1001` la suivante. Chaque contrat a en plus son propre numéro de contrat chaque année.
- Scope MVP : gestion + notifications + rappels de renouvellement + facturation simple (sans passerelle de paiement).
- Rôle opérateur modélisé dès maintenant, interface mobile en phase 5.

---

## 1. Modèle de données

Style existant : PK `Id` INTEGER autoincrement, colonnes PascalCase, `createdAt`/`updatedAt`. Modèles dans `backend/src/components/<feature>/<feature>.model.js` (chargement dynamique par glob déjà en place dans `backend/models/index.js`, incluant le hook `associate`).

### Tables

**Clients** — `client/client.model.js`
- `ClientNumber` INTEGER **unique** not null (code stable de 4-5 chiffres assigné à la création, ex. `1001` ; généré MAX+1 en transaction, séquence démarrée à 1000)
- `FirstName`, `LastName`, `CompanyName` null, `Email` null, `Phone` null (E.164)
- `SmsConsent`/`EmailConsent` BOOLEAN default true, `VoiceConsent` default false
- `Notes` TEXT, `IsActive` BOOLEAN default true

**ServiceAddresses** — `serviceAddress/serviceAddress.model.js`
- `ClientId` FK not null (un client, plusieurs adresses)
- `CivicNumber`, `Street`, `City` not null, `PostalCode` STRING(7) not null (normalisé `H0H0H0`)
- `Notes` TEXT (accès, bornes), `IsActive`

**Routes** — `route/route.model.js`
- `Name` unique not null, `Description`, `OperatorUserId` FK → Users null, `SortOrder`, `IsActive`

**Contracts** — `contract/contract.model.js`
- `Reference` STRING **unique** not null : `YY-XXXX` (`String(SeasonStartYear).slice(-2) + "-" + ClientNumber`, ex. `26-1001`). 2e contrat même saison (multi-adresses) : suffixe `-2`.
- `ContractNumber` INTEGER **unique** not null — numéro de contrat propre à chaque contrat/année (séquence MAX+1 en transaction) ; sert de champ de validation au portail
- `ClientId` FK not null, `ServiceAddressId` FK not null (UNE adresse), `RouteId` FK null
- `SeasonStartYear` INTEGER not null, `StartDate`/`EndDate` DATEONLY, `Price` DECIMAL(10,2)
- `Status` : `draft`/`active`/`completed`/`cancelled` — **constantes dans `contract.constants.js`**, jamais de magic number
- `RenewedFromContractId` FK → Contracts null, `RenewalNoticeSentAt` DATE null (anti-double-rappel), `Notes`
- Index unique `(ServiceAddressId, SeasonStartYear)`

**Tenants** — `tenant/tenant.model.js`
- `ServiceAddressId` FK not null, `FirstName`, `LastName`, `Phone` null (E.164), `Email` null (lowercase)
- `SmsConsent`/`EmailConsent`/`VoiceConsent`, `ConsentSource` (`admin`/`self_service`/`import`), `IsActive`

**SuppressedContacts** — `consent/suppressedContact.model.js` (survit à la suppression des enregistrements)
- `Channel` (`sms`/`email`/`voice`), `Address` (tél E.164 ou courriel), `Reason` (`stop_keyword`/`unsubscribe_link`/`manual`/`complaint`)
- **unique (Channel, Address)** — toute requête de destinataires exclut cette table

**ConsentLogs** — `consent/consentLog.model.js` (audit Loi 25, append-only)
- `PersonType` (`client`/`tenant`/`unknown`), `PersonId` null, `Channel`, `Address`, `Action` (`granted`/`revoked`), `Method` (`sms_stop`/`sms_start`/`email_unsubscribe`/`self_service`/`admin`), `ActorUserId` FK null, `IpAddress` null, `Metadata` JSONB

**NotificationTemplates** — `template/template.model.js`
- `Name` unique, `Type` (`storm`/`route_start`/`renewal`/`custom`), `SmsBody`, `EmailSubject`, `EmailBody`, `IsActive`
- Variables `{{prenom}}`, `{{adresse}}`, `{{reference}}` interpolées à la mise en file

**NotificationBatches** — `notification/notificationBatch.model.js`
- `Type` (`manual`/`route_start`/`renewal_reminder`), `TargetType` (`route`/`contract`/`all`), `TargetId` null, `TemplateId` null, `SmsBody`, `EmailSubject`, `EmailBody`, `UseSms`, `UseEmail`, `Status` (`pending`/`processing`/`completed`/`failed`), `CreatedByUserId` null (null = cron), `TotalCount`/`SentCount`/`FailedCount`/`SkippedCount`, `CompletedAt`

**NotificationDeliveries** — `notification/notificationDelivery.model.js` (**la file d'attente EST cette table** — remplace la file mémoire de ProfilsJardins)
- `BatchId` FK, `Channel` (`sms`/`email`), `RecipientType` (`client`/`tenant`), `RecipientId`, `ContactAddress` (snapshot), `ContractId` null
- `Status` : `queued`/`sending`/`sent`/`failed`/`skipped_no_consent`/`suppressed`
- `Attempts` default 0, `NextAttemptAt` default now, `LastError`, `ProviderMessageId` (SID Twilio), `SentAt`
- Index `(Status, NextAttemptAt)` et `(BatchId)`

**Invoices** — `invoice/invoice.model.js`
- `ContractId` FK, `InvoiceNumber` **unique** (`FAC-2026-0001`, séquence par année), `Amount`, `Status` (`draft`/`sent`/`paid`/`overdue`/`cancelled`), `IssuedAt`/`DueDate`/`PaidAt` DATEONLY null, `Notes`

**RouteRuns / RouteRunStops** — `routeRun/` (modélisés maintenant, construits phase 5)
- RouteRuns : `RouteId`, `OperatorUserId`, `Status` (`in_progress`/`completed`/`cancelled`), `StartedAt`, `CompletedAt`, `NotificationBatchId` null
- RouteRunStops : `RouteRunId`, `ContractId`, `Status` (`pending`/`done`/`skipped`), `DoneAt`, `Notes`

**Users** (existant) : `Role` prend `admin`/`operator`/`user` — constantes dans `user/user.constants.js`.

### Migrations (`backend/migrations/`, style .cjs existant)
```
20260826000001-create-Clients.cjs        ... 20260826000013-create-RouteRunStops.cjs
```
Une par table, dans l'ordre des dépendances FK (Clients → ServiceAddresses → Routes → Contracts → Tenants → consent → notifications → Invoices → RouteRuns).

---

## 2. Backend — composants et routes

### Nouveaux middlewares (`backend/src/middlewares/`)
- `requireRole.js` — factory `requireRole("admin")` : lit `req.user.Role`, lance `ForbiddenError`. S'utilise dans `middleware: [requireRole("admin"), handler]`.
- `rateLimit.js` — wrapper `express-rate-limit` : `portalRateLimit` (10 req/15 min/IP sur login portail), `publicRateLimit` (60/15 min).
- `verifyTwilioSignature.js` — `twilio.webhook()` sur les webhooks publics (pattern ProfilsJardins `be/src/components/sms/sms.routes.js`).

### Ajouts config (`src/config/default.js` + `.env`)
```
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID  (jamais hardcodé)
NOTIFICATIONS_DRY_RUN=true          (dev : log au lieu d'envoyer)
PUBLIC_BASE_URL=http://localhost:4200
UNSUBSCRIBE_SECRET, PORTAL_TOKEN_SECRET
RENEWAL_REMINDER_DAYS=45
```
Dépendances npm backend : `twilio`, `node-cron`, `express-rate-limit`.

### Composants (agrégés dans `src/routes/Routes.js`)

| Composant | Préfixe | Routes clés | Accès |
|---|---|---|---|
| client | `/api/client` | CRUD (delete = soft `IsActive=false`) | admin |
| serviceAddress | `/api/service-address` | CRUD + `?clientId=` | admin |
| route | `/api/route` | CRUD + GET `/:id/contracts` | admin |
| contract | `/api/contract` | CRUD, filtres `?seasonYear=&status=&routeId=`, POST `/rollover` (contrats actifs → contrats `draft` saison suivante : nouvelle Reference, `RenewedFromContractId`, prix reporté) | admin |
| tenant | `/api/tenant` | CRUD `?serviceAddressId=` — chaque changement de consentement écrit un ConsentLog | admin |
| template | `/api/template` | CRUD | admin |
| notification | `/api/notification` | POST `/send` (cible route/contrat/tous + canaux + corps ou template → Batch + Deliveries), GET `/batches`, `/batches/:id`, `/batches/:id/deliveries` | admin |
| invoice | `/api/invoice` | CRUD, POST `/:id/mark-paid`, filtres | admin |
| consent | `/api/consent` | GET `/logs?address=`, GET/POST/DELETE `/suppressed` (ré-abonnement documenté → ConsentLog) | admin |
| portal | `/api/portal` | **public** : POST `/login` {reference, contractNumber} (ex. `26-1001` + `4482`) → token HMAC stateless `{contractId, exp +30min}` (`PORTAL_TOKEN_SECRET`) ; puis header `X-Portal-Token` : GET `/me`, POST/PUT/DELETE `/tenants`, PUT `/preferences`. Réponse d'erreur générique (jamais préciser quel champ est faux), rate limit strict | `authRequired: false` |
| webhook | `/api/webhook` | **public** : POST `/twilio/sms` (ARRET/STOP/ARRÊT → SuppressedContacts + révocation SmsConsent des Clients/Tenants correspondants + ConsentLog ; START/OUI → retrait + ConsentLog ; réponse TwiML FR), POST `/twilio/status` (maj Delivery via ProviderMessageId). Signature Twilio validée | `authRequired: false` |
| unsubscribe | `/api/unsubscribe` | **public** : GET `?e=<email>&t=<hmac>`, POST `/confirm` → suppression + révocation EmailConsent + ConsentLog. Token = `HMAC-SHA256(email, UNSUBSCRIBE_SECRET)`, stateless | `authRequired: false` |
| routeRun | `/api/route-run` | (phase 5) GET `/my-routes`, POST `/start` {routeId} → RouteRun + Stops + Batch `route_start`, PUT `/stops/:id`, POST `/:id/complete` | admin+operator |

### Abstraction fournisseurs — `backend/src/notifications/` (infrastructure transversale, comme `src/config/`)

```
providers/
  SmsProvider.js              # base : async send({to, body}) → {providerMessageId}
  TwilioSmsProvider.js        # SDK twilio, SID depuis configService, statusCallback → webhook
  EmailProvider.js            # base : async send({to, subject, html, text})
  NodemailerEmailProvider.js  # SMTP2GO via config existante (SMTPGO_*), from = NO_REPLY_EMAIL
  DryRunSmsProvider.js        # log winston seulement
  DryRunEmailProvider.js
  VoiceProvider.js            # base définie, aucune implémentation
providerFactory.js            # getSmsProvider()/getEmailProvider() selon config — POINT DE SWAP futur
MessageBuilder.js             # SMS : tronque ~450 car. + "\nRépondez ARRET pour vous désabonner."
                              # Email : gabarit HTML FR + lien "Se désabonner" → PUBLIC_BASE_URL/desabonnement?e=&t=
                              # Interpolation {{prenom}} {{adresse}} {{reference}}
recipientResolver.js          # requête centrale : cible → clients + locataires des contrats CONTRACT_STATUS.ACTIVE
                              # AVEC consentement du canal ET absent de SuppressedContacts ET IsActive
NotificationWorker.js         # voir pipeline
```

---

## 3. Pipeline de notifications

1. **Mise en file** (`notification.service.js#enqueueBatch`, transactionnel) : crée Batch `pending`, résout les destinataires, insère une Delivery par (destinataire × canal) avec snapshot `ContactAddress`. Les non-consentants/supprimés sont insérés directement en `skipped_no_consent`/`suppressed` (traçabilité). Batch → `processing`.
2. **Worker** (démarré dans `app.js` après connexion DB) : `setInterval` 10 s ; `SELECT ... WHERE Status='queued' AND NextAttemptAt <= now() ORDER BY Id LIMIT 20 FOR UPDATE SKIP LOCKED` → `sending` → provider → `sent` ou échec.
3. **Retry** : `Attempts++` ; si < 3 → `queued` avec `NextAttemptAt = now + 2^Attempts min` ; sinon `failed` + `LastError`.
4. **Résilience** : au démarrage du worker, `sending` > 5 min → `queued`. Rien n'est perdu au redémarrage.
5. **Clôture** : plus de `queued`/`sending` pour le batch → `completed` + compteurs.
6. **Callback Twilio** `/api/webhook/twilio/status` enrichit delivered/undelivered (bonus).

---

## 4. Frontend (Angular 21, standalone, signals)

Nouveau `core/auth/role.guard.ts` : factory `roleGuard("admin")`. **Prérequis** : étendre `auth.store.ts` avec un signal `dbUser` chargé via `GET /api/user/me` après login (le Role vient de la DB, pas de Firebase).

Routage (`app.routes.ts`) :
```
/login                      guestGuard (existant)
/                           authGuard → redirection selon rôle (admin → /clients, operator → /operateur)
--- Admin (authGuard + roleGuard('admin'), layout AdminShell : sidebar FR, #052261/#2f3840) ---
/clients                    liste + recherche (numéro, nom)
/clients/:id                fiche : infos, consentements, adresses, locataires, contrats, historique
/contrats                   liste filtrable + bouton « Roulement de saison »
/contrats/:id               détail + factures liées
/routes                     liste + détail (contrats assignés, opérateur)
/modeles                    modèles de notifications
/notifications              composer (cible, canaux, aperçu avec pied de désabonnement) + historique
/notifications/:batchId     journal des livraisons par destinataire
/factures                   liste, filtres, marquer payée
/parametres                 utilisateurs et rôles
--- Public (aucun guard) ---
/portail                    connexion : référence client YY-XXXX + numéro de contrat
/portail/gestion            gestion locataires + préférences (token sessionStorage, header X-Portal-Token)
/desabonnement              confirmation désabonnement courriel
--- Opérateur (authGuard + roleGuard('operator'), mobile-first, phase 5) ---
/operateur                  mes routes
/operateur/route/:id        arrêts, « Démarrer la route », cocher terminé
```

Services API dans `core/services/`, modèles TS dans `core/models/`.

---

## 5. Tâches cron (`backend/src/cron/cronJobs.js`, node-cron, `America/Toronto`)

| Tâche | Horaire | Action |
|---|---|---|
| Rappels renouvellement | 08:00 quotidien | contrats `active`, `EndDate <= today + RENEWAL_REMINDER_DAYS`, `RenewalNoticeSentAt IS NULL` → batch `renewal_reminder` aux clients + tamponner `RenewalNoticeSentAt` |
| Factures en retard | 06:00 quotidien | `sent` avec `DueDate < today` → `overdue` |
| Récupération file | horaire | `sending` > 5 min → `queued` |
| Fin de saison | 06:05 quotidien | `active` avec `EndDate < today - 30j` → `completed` |

---

## 6. Phases de construction (soirées/fins de semaine, solo)

**Phase 1 — Fondations du domaine (~4-6 soirées)**
Migrations + modèles Clients/ServiceAddresses/Routes/Contracts/Tenants ; CRUD + `requireRole` + génération ClientNumber/Reference + rollover. FE : `role.guard`, AdminShell, pages clients/contrats/routes.
→ *Livrable : l'admin gère tout le domaine ; roulement de saison fonctionnel.*
→ *Vérif : `npm run migrate` + rollback propre ; curl/REST-client sur chaque route ; unicité Reference + cas multi-adresses (`-2`) ; rollover → contrats `27-XXXX` en draft.*

**Phase 2 — Moteur de notifications + conformité (~5-7 soirées)**
Migrations consent/templates/batches/deliveries ; `src/notifications/` complet ; composants notification/template/consent/webhook/unsubscribe ; FE `/modeles`, `/notifications`. Deps : twilio, express-rate-limit.
→ *Livrable : envoi ciblé avec file en DB, journal par destinataire, STOP SMS et désabonnement courriel opérationnels.*
→ *Vérif : `NOTIFICATIONS_DRY_RUN=true` → pipeline complet sans envoi (pied « Répondez ARRET… » vérifié dans les logs) ; credentials test Twilio avec magic numbers (`+15005550006` succès, `+15005550001` invalide → retry puis `failed`) ; webhook STOP via ngrok ou POST simulé (signature désactivable en dev) ; courriel réel SMTP2GO vers soi-même → lien désabonnement → SuppressedContacts + ConsentLog ; kill backend en plein batch → redémarrage → la file reprend.*

**Phase 3 — Portail public libre-service (~3-4 soirées)**
Composant portal (token HMAC, rate limit) ; FE `/portail`, `/portail/gestion`, `/desabonnement`.
→ *Livrable : un client gère ses locataires sans compte.*
→ *Vérif : mauvaise référence/numéro de contrat → message générique + rate limit à la 11e tentative ; expiration token 30 min ; ajout locataire → ConsentLog `self_service` ; envoi dry-run → nouveau locataire destinataire.*

**Phase 4 — Facturation + rappels (~2-3 soirées)**
Composant invoice + numérotation FAC-YYYY-NNNN ; cron jobs ; FE `/factures` + section facture dans `/contrats/:id`.
→ *Vérif : jobs déclenchables manuellement (fonctions exportées) ; contrat EndDate proche → batch renewal dry-run → pas de double envoi ; facture échue → `overdue`.*

**Phase 5 — Vue opérateur mobile (~3-4 soirées)**
Composant routeRun ; FE `/operateur` mobile-first ; « Démarrer la route » → batch `route_start`.
→ *Vérif : compte `operator` → 403 sur routes admin ; double démarrage refusé (`in_progress` existant) ; test réel sur téléphone.*

---

## 7. Garde-fous (leçons ProfilsJardins)

- Aucun SID/secret hardcodé — tout via `configService`.
- Aucun magic number — constantes par composant (`CONTRACT_STATUS.ACTIVE`, etc.).
- Routes publiques explicites et limitées (portal/webhook/unsubscribe), toutes rate-limitées, webhooks signés.
- File d'attente = table PostgreSQL, jamais en mémoire.
- Chaque envoi filtre : contrat actif + consentement canal + hors liste de suppression.

## Fichiers critiques existants (au moment de la conception, avant implémentation)

- `backend/src/routes/Routes.js` — agrégation des nouveaux composants
- `backend/src/server/Server.js` — injection middlewares/authRequired
- `backend/src/config/default.js` — nouvelles variables env
- `backend/models/index.js` — chargement dynamique (hook `associate` déjà présent)
- `frontend/src/app/app.routes.ts` — routage avec guards de rôle
- `frontend/src/app/core/auth/auth.store.ts` — à étendre avec `dbUser`/Role

---

## Note : ce plan est maintenant ENTIÈREMENT IMPLÉMENTÉ (phases 1 à 5)

Ce document est le plan ORIGINAL tel qu'approuvé avant le début du travail. Pour l'état réel du code après implémentation (qui a suivi ce plan de très près, avec deux corrections de bugs découvertes en cours de route), voir `RESUME-REPRISE.md` à la racine du repo et l'historique des commits `main`.
