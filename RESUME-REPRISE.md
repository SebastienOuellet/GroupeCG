# GroupeCG — résumé de reprise

> Dernière mise à jour : 2026-09-28 (plan GPS ajouté). **Point d'entrée unique pour reprendre le projet sur n'importe quel PC ou dans un nouveau chat Claude.** Lire ce fichier, puis le plan pertinent (voir « Documents du repo »).

## Repo
https://github.com/SebastienOuellet/GroupeCG (branche `main`)

## Documents du repo (tous à la racine)
| Fichier | Rôle |
|---|---|
| `RESUME-REPRISE.md` | Ce fichier : état actuel, démarrage, reste à faire, règles de travail |
| `PLAN-ORIGINAL.md` | Plan initial (phases 1-5), **entièrement implémenté** — référence du modèle de données et des décisions |
| `PLAN-ROUTES-GOOGLE.md` | Chantier en cours : optimisation des routes avec Google Route Optimization API — **R1 (ordre des arrêts) livrée**, R0/R2+ à faire |
| `PLAN-GPS-TRACTEURS.md` | Chantier en cours sur la branche **`GPS`** : géolocalisation des tracteurs — **V1 livrée (G1 positions et `/suivi`, G2 « Fait » automatique et carte du trajet opérateur, G3 suivi dans le portail client)**, G4+ et journal de passage à faire |

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

### Routes — trajet routier et phase R3 (28 septembre)
- `d9a7bc1` — Trajet routier réel (Google Routes API) sur la carte 🚜 en plus du vol d'oiseau 🐦, km et minutes de route, comparaison sur les deux mesures dans l'aperçu d'optimisation
- `6585e62` — R3 backend : réglages de l'optimiseur (durées par revêtement, facteur par taille d'entrée, heure de départ), `ServiceAddresses.DrivewaySize`, `globalStartTime` Google, `UnplacedCount` dans la liste des routes
- R3 frontend : Paramètres › Routes (durées), taille d'entrée dans la fiche adresse, colonne « Ordre de passage » dans la liste, heure de retour estimée sur la page de la route
- Optimisation Google validée par Sébastien dans son navigateur (compte de service en place, `ROUTE_OPTIMIZATION_DRY_RUN=false` sur son poste).

- ⚠️ **Migrations `20260928100001-route-sequence` et `20260928100002-add-DrivewaySize-to-ServiceAddresses` à exécuter sur la DB DigitalOcean** (`npm run migrate`) si ce n'est pas déjà fait — sans elles, les tournées et les adresses plantent (colonnes absentes).

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

### Routes : chantier essentiellement terminé (voir `PLAN-ROUTES-GOOGLE.md`)
- Fait : R0 (Google Cloud), R1 (ordre des arrêts), R2 (optimiseur local + Google), trajet routier sur la carte, R3 (durées, taille d'entrée, départ/retour, routes à réordonner).
- **Abandonné** (décision du 28 septembre) : R4 (découpage entre routes), R5 (heure estimée dans les SMS), purge serveur des coordonnées Google expirées (serveur de dev).
- Reste : valider dans le navigateur la page de la route (trajet 🚜, heure de retour), Paramètres › Routes (durées), la taille d'entrée, et le parcours opérateur (« Naviguer » sur téléphone).
- Avant la prod : **Routes API** activée et permise pour la clé du navigateur, **Map ID** Google dans `googleMapsMapId`, alerte de budget + quota sur Route Optimization et Routes API.
- Plus tard si besoin : heures limites (`ServiceDeadline` → `timeWindows`) pour commerces/garderies.

### Géolocalisation des tracteurs (voir `PLAN-GPS-TRACTEURS.md`)
- **Branche `GPS`** (pas encore dans `main`). G1 livrée : véhicules et jetons (Paramètres › Véhicules), réception OsmAnd (Traccar Client / ESP32), GPS du téléphone en repli, page `/suivi`, choix du tracteur au démarrage, purge nocturne des positions.
- G2 : arrivées/départs détectés par GPS, « Fait » automatique (réglable dans Paramètres › Véhicules), durées réelles par arrêt ; carte du trajet dans la vue opérateur (bascule Liste / Carte).
- ⚠️ Migrations `20260928300001-gps-vehicles-positions` et `20260928300002-gps-stop-arrivals` à exécuter sur la DB DigitalOcean avant de tester la branche (`npm run migrate`). Elles n'existent pas sur `main` : ne pas lancer `migrate` depuis `main` ensuite sans la branche.
- À valider dans le navigateur : la carte Google de `/suivi` (non testable depuis le poste de Claude), Traccar Client sur un téléphone (URL publique du serveur requise, ou tunnel ngrok).
- À valider sur le terrain : la carte et le trajet de la vue opérateur (Routes API), un vrai « Fait » automatique en voiture (rayon 35 m, 45 s minimum).
- G3 : le client voit dans le portail « il reste X arrêts avant le vôtre », le tracteur sur une carte, puis « Votre entrée a été déneigée à … ». Désactivable dans Paramètres › Véhicules.
- Suite : journal de passage non modifiable (preuve de service, demandé et reporté), G4 (calibration des durées) après quelques tempêtes, fusion de `GPS` dans `main` une fois validée sur le terrain.
- V1 = G1 + G2 (« Fait » automatique) + G3 (suivi dans le portail). Pas de SMS automatique d'arrivée avant d'avoir calibré les durées (G4).

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
