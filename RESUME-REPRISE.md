# GroupeCG — résumé de reprise

> Dernière mise à jour : 2026-09-28. **Point d'entrée unique pour reprendre le projet sur n'importe quel PC ou dans un nouveau chat Claude.** Lire ce fichier, puis le plan pertinent (voir « Documents du repo »).

## Repo
https://github.com/SebastienOuellet/GroupeCG (branche `main`)

## Documents du repo (tous à la racine)
| Fichier | Rôle |
|---|---|
| `RESUME-REPRISE.md` | Ce fichier : état actuel, démarrage, reste à faire, règles de travail |
| `PLAN-ORIGINAL.md` | Plan initial (phases 1-5), **entièrement implémenté** — référence du modèle de données et des décisions |
| `PLAN-ROUTES-GOOGLE.md` | Chantier en cours : optimisation des routes avec Google Route Optimization API — **R1 (ordre des arrêts) livrée**, R0/R2+ à faire |

Ces fichiers sont aussi copiés dans les docs du projet claude.ai « GroupeCG ». **Le repo fait foi** : en cas d'écart, c'est la version sur `main` qui est la bonne.

## État du code

### Plan initial : les 5 phases sont TERMINÉES et poussées
1. `db00e0a` — Fondations du domaine (clients, contrats, adresses, routes, locataires)
2. `b4b3661` — Moteur de notifications + conformité Loi 25/LCAP
3. `f469f6c` — Portail public libre-service
4. `a377a54` — Facturation simple + rappels automatiques
5. `79e7210` — Vue opérateur mobile

Chaque phase a été vérifiée par script (13 à 25 tests métier par phase, tous passés) + build Angular propre.

### Ajouts après le plan initial (26-27 septembre)
- `efe92dd` — Gestion des utilisateurs par l'admin : création, rôles, mots de passe, assignation des opérateurs
- `92fd1fd` / `4aefbe5` — Création rapide de client et d'adresse + **recherche de client** dans le formulaire de contrat (réglé : la liste déroulante qui affichait tous les clients)
- `c578273` / `0110ed8` — Interface admin et portail responsive (téléphone en cabine), barre latérale réductible
- `7e799fc` — Adresses de service : **recherche Google (Places autocomplete)**, vue Street View de l'entrée, type d'entrée (`DrivewaySurface`), `Latitude`/`Longitude` enregistrées
- `62852ae` — Contrats multi-éléments (`ContractItems`), contrat faisant office de facture, factures de service, taxes
- `2c6a829` / `4515577` — Envoi du contrat au client : aperçu PDF, courriel, téléchargement ; conditions du contrat papier dans le PDF
- `b5153a8` / `7cad038` — Conditions du contrat modifiables par l'admin (Paramètres › Contrat, table `Settings`) + aperçu d'un contrat d'exemple
- `53baf82` / `a63bbe0` — Locataires gérés depuis la fiche client, respect des désinscriptions, validation courriel/téléphone, logo dans le PDF

### Routes — phase R1 : ordre des arrêts (28 septembre)
- `da771fc` — Backend : `Contracts.RouteSequence`, `RouteRunStops.Sequence` figée au démarrage, `PUT /route/:id/sequence` (admin), dépôt `Settings.route_depot`, point d'attache `Routes.BaseLocation`, `ServiceAddresses.PlaceId/LocationSource/LocationUpdatedAt`
- `7b3342b` — Frontend : page `/routes/:id` (glisser-déposer + position directe, carte, point d'attache, correction des pins), Paramètres › Routes (dépôt), vue opérateur ordonnée avec « Prochain arrêt » et « Naviguer »
- `0184748` — Script de données de test `backend/scripts/seed-test-route.js` (20 clients fictifs, secteur Boisjoli, `--reset` / `--remove`)

### Routes — phase R2 : optimiseur (28 septembre)
- `ba8dc31` — Backend : `src/routing/` (optimiseur local 2-opt/Or-opt par défaut, Google Route Optimization prêt), `POST /route/:id/optimize` et `/optimize/apply`
- Frontend : bouton « ⚡ Optimiser » sur `/routes/:id`, aperçu avant/après (gain %, ancien tracé en pointillé), « Appliquer la proposition »
- Tourne **sans Google** (`ROUTE_OPTIMIZATION_DRY_RUN=true` par défaut). Pour Google : phase R0 puis `backend/googleConfig/README.md`.

- Session admin/opérateur : token Firebase obtenu frais à chaque requête (`AuthStore.getIdToken`, `onIdTokenChanged`), 401 → token forcé et requête rejouée une fois, 401 persistant → déconnexion et `/login`. Plus de « Token d'authentification invalide ou expiré » après 1 h ou une mise en veille.

- ⚠️ **Migration `20260928100001-route-sequence` à exécuter sur la DB DigitalOcean** (`npm run migrate`) si ce n'est pas déjà fait — sans elle, les tournées plantent (colonne `Sequence` absente).

Détails complets : `git log` (messages de commit en français, avec le pourquoi).

## Pour redémarrer sur un autre PC
```bash
git clone https://github.com/SebastienOuellet/GroupeCG.git
cd GroupeCG/backend && npm install
cd ../frontend && npm install
```
Si le repo est déjà cloné : `git pull` sur `main` **avant toute chose**.

**Fichiers à recréer manuellement (non versionnés) :**
- `backend/.env` — liste complète des variables dans `backend/src/config/default.js`. Contient : connexion DB PostgreSQL DigitalOcean (`DB_*`), `FIREBASE_CREDENTIAL_FILE`, SMTP2GO (`SMTPGO_*`, `NO_REPLY_EMAIL`), `NOTIFICATIONS_DRY_RUN=true` (garder `true` tant que Twilio n'est pas configuré), `CONTRACT_EMAIL_DRY_RUN`, `PUBLIC_BASE_URL`, `UNSUBSCRIBE_SECRET`, `PORTAL_TOKEN_SECRET`, `RENEWAL_REMINDER_DAYS=45`, `TWILIO_VALIDATE_SIGNATURE=false` (dev seulement), infos entreprise pour le PDF (`COMPANY_*`, numéros TPS/TVQ).
- `backend/firebaseConfig/<fichier>.json` — service account Firebase (voir `backend/firebaseConfig/README.md`).
- `frontend/public/images/logo.png` — le logo Groupe CG (si absent après clone).
- Config Firebase web et `googleMapsApiKey` dans `frontend/src/environments/environment*.ts` : fichiers versionnés (clés web publiques par nature). **La clé Google Maps doit rester restreinte par référent HTTP** dans la console Google Cloud.

**Démarrage :**
```bash
cd backend && npm run dev     # port 5011, nodemon
cd frontend && npm start      # port 4200
```
Migrations : `npm run migrate` dans `backend/` (la DB DigitalOcean est partagée entre les PC — voir les règles plus bas).

## Reste à faire

### Chantier en cours : optimisation des routes (voir `PLAN-ROUTES-GOOGLE.md`)
- Questions ouvertes **tranchées** (§7 du plan) : dépôt unique au 200 rue des Villas, ~50 routes × ≤100 adresses, pas d'heure limite pour l'instant, réordonnancement admin seulement, retour au point d'attache (dépôt ou point propre à la route).
- **Phases R1 et R2 livrées** (R2 en optimiseur local). Reste à valider dans le navigateur : dépôt à saisir (Paramètres › Routes), réordonner une route, démarrer une tournée comme opérateur, tester « Naviguer » sur un téléphone.
- Créer un **Map ID** Google (console Cloud › Map Management) et le mettre dans `googleMapsMapId` des fichiers `environment*.ts` avant la prod (sinon `DEMO_MAP_ID`).
- **Phase R0** : préparation Google Cloud (Route Optimization API, compte de service → `backend/googleConfig/`, alerte de budget, quota), puis tester en `ROUTE_OPTIMIZATION_VALIDATE_ONLY=true` avant la première vraie requête. Attention au volume (~5 000 arrêts) : optimiser route par route, seulement quand elle change.
- Purge serveur des coordonnées Google expirées (aujourd'hui rafraîchies seulement à l'ouverture de la page d'une route).
- Phases R3-R5 selon le plan (R5 coûteux à ce volume, voir §7).

### Autres
- Valider visuellement le parcours opérateur complet dans le navigateur (compte Firebase avec Role="operator", route assignée, démarrer/cocher/terminer).
- Configurer un vrai compte Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`) et passer `NOTIFICATIONS_DRY_RUN=false` quand prêt.
- Configurer le webhook Twilio STOP vers `/api/webhook/twilio/sms` en prod (avec `TWILIO_VALIDATE_SIGNATURE=true`).
- Déploiement (aucune infra de prod configurée — DB DigitalOcean existe déjà, backend/frontend à héberger).
- Rien d'urgent niveau dette technique : lint backend propre, pas de TODO connu.

## Travailler sur deux PC / deux chats en même temps
Les deux postes partagent **le même repo `main` et la même base de données DigitalOcean**. Règles pour ne pas se marcher dessus :

1. **`git pull` avant de commencer, `git pull --rebase` avant chaque push.** Petits commits, poussés souvent.
2. **Un chantier par poste.** Ex. PC A = phase R1 des routes ; PC B = Twilio / déploiement / corrections UI. Éviter que les deux touchent les mêmes fichiers (`contract.service.js`, `routeRun.service.js`, `app.routes.ts`, `Routes.js`).
3. **Migrations = zone à risque (DB partagée).**
   - Nommer avec la date du jour et un suffixe propre au poste pour éviter les collisions de nom : `20260928100001-...` sur un PC, `20260928200001-...` sur l'autre.
   - Pousser la migration **tout de suite** après l'avoir exécutée : l'autre poste doit l'avoir dans son code avant son prochain `npm run migrate`, sinon Sequelize voit une migration inconnue dans `SequelizeMeta`.
   - Ne jamais faire `migrate:undo` sur une migration créée par l'autre poste.
4. **Nouveau chat Claude** : lui demander de lire `RESUME-REPRISE.md` puis le plan du chantier visé, et préciser lequel des deux chantiers il prend.
5. **En fin de session** : mettre à jour ce fichier (section « État du code » et « Reste à faire ») dans le même commit que le travail, pour que l'autre poste le voie au prochain `git pull`.

## Conventions du projet (pour repartir vite)
- Backend : Express/Sequelize ESM, pattern composant `src/components/<feature>/<feature>.{controller,service,model}.js`, erreurs typées (`src/errors/Errors.js`), `requireRole()` middleware, constantes de statut (jamais de magic strings/numbers), migrations `.cjs` dans `backend/migrations/`.
- Fournisseurs externes derrière une abstraction avec mode dry-run (`src/notifications/providers/` ; même pattern prévu pour `src/routing/`).
- Frontend : Angular 21 standalone/signals, pages sous `frontend/src/app/pages/{admin,public,operator}/`, services API sous `core/services/`. Accès Google Maps centralisé dans `core/services/google-maps.service.ts`.
- Couleurs de marque : `--color-primary: #052261`, `--color-secondary: #2f3840`.
- Vérifier réellement avant de dire que ça marche (script jetable ou test navigateur), lint backend propre, build Angular sans erreur, puis commit + push sur `main` avec un message en français qui explique le pourquoi. Aucun secret commité.
