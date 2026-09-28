# Plan — Géolocalisation des tracteurs (suivi en direct, « Fait » automatique)

> Statut (2026-09-28) : **G1, G2 et G3 livrées sur la branche `GPS`** (pas encore fusionnée dans `main`) = V1 complète, plus une carte du trajet dans la vue opérateur ; G4 à G6 et le journal de passage à faire. Rédigé à partir du code sur `main` (commit `776503a`, après R0-R3 de `PLAN-ROUTES-GOOGLE.md`).
>
> Pour reprendre : lire `RESUME-REPRISE.md` (état du code, démarrage, travail sur deux postes), puis ce plan. Commencer par la phase G1.

## Contexte

Objectif : quand l'opérateur démarre sa route, on sait où est le tracteur. L'admin le voit sur une carte, le client aussi (dans le portail), et les arrêts se cochent « Fait » tout seuls quand le tracteur repart d'une entrée.

**Décisions de Sébastien (2026-09-28) :**
- **Connexion cellulaire** : forfaits prépayés bas de gamme (carte SIM ou cellulaire à petit prix), ou partage de données du téléphone de l'opérateur. Pas de maillage Wi-Fi ni de LoRa : portée insuffisante sur une ville, et infrastructure à entretenir.
- **Le client peut voir la carte** : les pancartes affichent déjà qui est client, voir le tracteur chez le voisin ne révèle rien de nouveau.
- **V1 : aucun SMS automatique d'arrivée.** On accumule d'abord des données réelles (durées de déneigement, temps de trajet) pour régler les durées dans les Paramètres. Le préavis « 15 min avant » vient plus tard, sur des durées calibrées.
- **« Fait » automatique par géolocalisation** : oui, en V1.
- Tracteur Case avec balise **FieldOps** : connecteur optionnel, en dernier.

Ce qui existe déjà et sert ici : `RouteRuns` / `RouteRunStops` (ordre figé `Sequence`, `Status`, `DoneAt`), `ServiceAddresses.Latitude/Longitude` (+ pins corrigés à la main), Settings `route_optimization` (durées par revêtement, facteurs de taille, heure de départ), lien « Naviguer » dans la vue opérateur, portail avec jeton `X-Portal-Token`.

---

## 1. Sources de position

Une seule porte d'entrée côté serveur, plusieurs sources. Même principe que `src/notifications/providers/` et `src/routing/` : le reste du système ne sait pas d'où vient la position.

| Source | Matériel | Remarques |
|---|---|---|
| **A. Téléphone dans le tracteur + Traccar Client** (recommandé pour démarrer) | Android bas de gamme + forfait prépayé, ou le téléphone de l'opérateur | App libre et gratuite, **tourne en arrière-plan** (le GPS continue quand l'opérateur ouvre « Naviguer »). Envoie en protocole OsmAnd vers une URL configurable. Zéro firmware à écrire. |
| **B. ESP32 + GPS** | ESP32 **avec modem cellulaire** (SIM7600, A7670, SIM7080…) + SIM prépayée ; ou ESP32 Wi-Fi sur le partage de données du téléphone | Même protocole OsmAnd que A → aucun code serveur de plus. Alimenté par le 12 V, démarre avec le contact. Une SIM seule ne suffit pas : l'ESP32 doit avoir le modem. |
| **C. Navigateur (vue opérateur)** | Aucun | `watchPosition` pendant la tournée. Repli sans installation. **S'arrête dès que la page passe en arrière-plan** (« Naviguer », écran verrouillé) : dépannage seulement. |
| **D. FieldOps (Case)** | Balise existante | Interrogation périodique de l'API CNH (OAuth 2.0, EULA à accepter dans FieldOps). Fréquence de rafraîchissement à mesurer. Phase G6. |

Pourquoi le protocole OsmAnd : c'est un simple `GET`/`POST` avec des paramètres (`id`, `lat`, `lon`, `timestamp`, `speed`, `bearing`, `accuracy`, `batt`). Traccar Client le parle nativement, et c'est 10 lignes côté ESP32. Un seul endpoint couvre A et B.

**Consommation de données** : une position aux 10 s ≈ quelques Mo par nuit de tempête. N'importe quel petit forfait suffit. Vérifier seulement que le forfait prépayé ne coupe pas les connexions « machine » et ne suspend pas la ligne après inactivité (certains prépayés expirent après 90 jours sans recharge : à mettre au calendrier).

---

## 2. Modèle de données (migrations `.cjs`)

**Vehicles** — `vehicle/vehicle.model.js`
- `Name` unique not null (« Tracteur 1 », « Case »), `Notes`, `IsActive`
- `DeviceKey` STRING unique null : identifiant envoyé par l'appareil (`id` OsmAnd, VIN FieldOps)
- `DeviceTokenHash` STRING null : SHA-256 du jeton de l'appareil (le jeton n'est affiché qu'une fois, à la création ou au renouvellement)
- `SourceType` : `osmand` / `fieldops` (constantes `VEHICLE_SOURCE`)
- `LastPositionAt` DATE, `LastLatitude`/`LastLongitude` DECIMAL(9,6), `LastSpeedKmh`, `LastHeading` : dernière position connue, pour la carte sans balayer l'historique

**Routes**
- `DefaultVehicleId` FK → Vehicles null : tracteur proposé au démarrage

**RouteRuns**
- `VehicleId` FK → Vehicles null : confirmé par l'opérateur au démarrage (défaut : celui de la route). Null = suivi par le navigateur seulement.

**VehiclePositions** — `tracking/vehiclePosition.model.js` (données brutes, purgées)
- `VehicleId` FK null, `RouteRunId` FK not null, `Latitude`, `Longitude`, `SpeedKmh` null, `Heading` null, `AccuracyM` null, `Source` (`osmand`/`browser`/`fieldops`), `RecordedAt` (heure de l'appareil), `createdAt`
- Index `(RouteRunId, RecordedAt)`
- **Aucune position enregistrée hors tournée `in_progress`** : l'appareil peut émettre en permanence, le serveur jette ce qui n'appartient pas à une tournée en cours (Loi 25 : pas de suivi hors quart de travail).

**RouteRunStops** (données dérivées, **conservées** : c'est ce qui sert à calibrer)
- `ArrivedAt` DATE null, `DepartedAt` DATE null
- `ServiceSeconds` INTEGER null : `DepartedAt - ArrivedAt`
- `TravelSeconds` INTEGER null : départ de l'arrêt précédent (ou début de tournée) → `ArrivedAt`
- `DoneSource` : `manual` / `auto_gps` (constantes `STOP_DONE_SOURCE`)

**Settings** — nouvelle clé `SETTING_KEYS.TRACKING`, défauts dans `DEFAULT_TRACKING_SETTINGS`, fusion clé par clé comme `route_optimization` :
```
autoCompleteStops: true        // « Fait » automatique au départ d'une entrée
geofenceRadiusM: 35            // rayon d'arrivée autour du pin
exitMarginM: 25                // hystérésis : sortie = rayon + marge
minDwellSeconds: 45            // en dessous : passage, pas un déneigement
lookaheadStops: 3              // arrêts « pending » candidats (voir §3)
positionRetentionDays: 30      // purge des positions brutes
portalTrackingEnabled: true    // carte visible dans le portail
```

---

## 3. Détection d'arrivée et « Fait » automatique

Calcul **côté serveur, à la réception de chaque position** d'une tournée en cours. Aucun appel externe, quelques millisecondes.

1. **Candidats** : les `lookaheadStops` premiers arrêts `pending` dans l'ordre `Sequence`, plus l'arrêt « en cours » (arrivé, pas reparti). On ne regarde pas toute la route : deux entrées voisines de 10 m ne doivent pas se confondre avec un arrêt 40 positions plus loin.
2. **Arrivée** : 2 positions consécutives à moins de `geofenceRadiusM` du pin d'un candidat → `ArrivedAt` = heure de la 1re. Si plusieurs candidats sont dans le rayon, on prend le plus proche ; à égalité, le plus tôt dans la séquence.
3. **Départ** : après une arrivée, 2 positions consécutives au-delà de `geofenceRadiusM + exitMarginM` → `DepartedAt`, `ServiceSeconds`.
   - Si `ServiceSeconds ≥ minDwellSeconds` et `autoCompleteStops` → `Status = done`, `DoneAt = DepartedAt`, `DoneSource = auto_gps`.
   - Sinon → simple passage : on efface `ArrivedAt`, rien d'autre ne change.
4. **Arrêt coché à la main** : `DoneSource = manual`, et on garde `ArrivedAt`/`DepartedAt` si le GPS les avait. L'opérateur a toujours le dernier mot : il peut décocher un « Fait » automatique (`pending`, champs GPS effacés).
5. **Arrêt sauté** (le tracteur passe à l'arrêt k+1 sans s'être arrêté à k) : k reste `pending`. On ne le marque jamais « sauté » automatiquement.

**Précision des pins** : un pin Google tombe souvent sur la maison ou la rue, pas sur l'entrée. 35 m absorbe ça en ville ; en rang, un pin corrigé à la main reste nécessaire. La page de la route montrera les arrêts où le tracteur ne « rentre » jamais dans le rayon (pin suspect).

---

## 4. Backend

### Composants

| Composant | Route | Accès |
|---|---|---|
| vehicle | `/api/vehicle` : CRUD, `POST /:id/token` (génère et affiche une fois le jeton ; l'ancien cesse de fonctionner) | admin |
| tracking | `GET/POST /api/tracking/osmand/:token` : réception OsmAnd (sources A et B). Jeton inconnu → 401 générique. Rate limit par jeton. | `authRequired: false` |
| tracking | `POST /api/route-run/:id/positions` : lot de positions du navigateur (source C) | operator (sa propre tournée) |
| tracking | `GET /api/tracking/live` : tournées en cours, dernière position, traînée des 30 dernières minutes, état des arrêts | admin |
| tracking | `GET /api/tracking/runs/:id` : tracé complet d'une tournée (tant que les positions ne sont pas purgées) | admin |
| portal | `GET /api/portal/tracking` : si une tournée en cours contient le contrat du jeton → position du tracteur, nombre d'arrêts avant lui, état de son arrêt | jeton portail |
| routeRun | `POST /start` accepte `{ routeId, vehicleId? }` | operator |

- Services : `tracking.service.js#ingestPositions(vehicle|run, positions[])` → rattache à la tournée en cours du véhicule, insère, met à jour `Vehicles.Last*`, appelle `geofence.js#processPositions(run, positions)`.
- `src/tracking/` (transversal, comme `src/routing/`) : `geo.js` (réutiliser la distance Haversine de `src/routing/geo.js`), `geofence.js`, `osmandParser.js`, `providers/FieldOpsPoller.js` (G6).
- Positions en retard (appareil hors couverture qui vide son tampon) : triées par `RecordedAt` avant le géorepérage ; une position plus vieille que la dernière traitée est enregistrée mais n'influence pas l'arrivée et le départ.

### Points de sécurité
- **Jeton dans l'URL** (exigé par Traccar Client) : ne jamais journaliser l'URL de cet endpoint (vérifier le logger HTTP) ; HTTPS obligatoire ; jeton aléatoire de 32 octets, haché en base.
- Positions : validation stricte (lat/lng dans des bornes plausibles, précision > 100 m ignorée pour le géorepérage mais gardée pour la carte).

### Cron (`cronJobs.js`)
| Tâche | Horaire | Action |
|---|---|---|
| Purge des positions | 04:15 quotidien | `VehiclePositions` plus vieilles que `positionRetentionDays` → suppression. Les champs dérivés de `RouteRunStops` restent. |
| Poller FieldOps (G6) | chaque minute, seulement s'il y a une tournée en cours sur un véhicule `fieldops` | lecture de la dernière position → `ingestPositions` |

---

## 5. Frontend

**Admin — nouvelle page `/suivi`** (lien dans la barre latérale, visible surtout pendant une tempête)
- Carte Google avec chaque tournée en cours : tracteur (icône orientée selon le cap), traînée récente, arrêts colorés (à faire / en cours / fait / fait auto).
- Panneau latéral : route, opérateur, avancement « 23/48 », dernière position il y a X s. **Alerte si aucune position depuis 2 min** (appareil éteint, zone morte).
- Rafraîchissement par interrogation toutes les 10 s (pas de WebSocket en V1).

**Admin — Paramètres › Véhicules** : liste, création, association d'une route par défaut, génération du jeton avec l'URL complète à copier dans Traccar Client (et un code QR, pratique à scanner depuis le téléphone du tracteur).

**Admin — Paramètres › Suivi** : réglages de la clé `tracking`.

**Admin — page de la route `/routes/:id`** : pour une tournée terminée, rejouer le tracé ; pastille sur les arrêts dont le pin semble mal placé.

**Opérateur — `route-run-page`**
- Au démarrage : choix du tracteur (présélectionné).
- Indicateur « 📡 Suivi actif » (dernière position reçue il y a X s) ou « ⚠️ Aucune position ».
- Arrêt coché automatiquement → mise en évidence discrète « Fait (auto) » avec bouton annuler.
- Case « Utiliser le GPS de ce téléphone » (source C) si le tracteur n'a pas d'appareil.

**Portail — `/portail/gestion`**
- Pendant une tournée en cours qui inclut le contrat : carte avec le tracteur et l'adresse du client, « Il reste 5 arrêts avant le vôtre », puis « Votre entrée est déneigée ✅ à 5 h 42 ».
- **Pas d'heure estimée en V1** (pas encore calibrée). Rafraîchissement toutes les 30 s.

---

## 6. Phases

### Phase G1 — Réception des positions + carte admin (~3 soirées)
Migrations `Vehicles`, `VehiclePositions`, `Routes.DefaultVehicleId`, `RouteRuns.VehicleId` ; composants `vehicle` et `tracking` (OsmAnd + navigateur + `live`) ; choix du tracteur au démarrage ; Paramètres › Véhicules ; page `/suivi` ; cron de purge.
→ *Livrable : l'admin voit les tracteurs en direct pendant une tempête.*
→ *Vérif : script qui rejoue une trace GPS (fichier de coordonnées le long de la route de test Boisjoli, `seed-test-route.js`) en OsmAnd → positions en base, `Vehicles.Last*` à jour ; positions reçues hors tournée → jetées ; mauvais jeton → 401 ; Traccar Client réel sur un téléphone en voiture ; « Naviguer » ouvert → le suivi continue ; purge → seules les positions récentes restent.*

**✅ Livrée le 2026-09-28 sur la branche `GPS`** (`d9ecc8e` backend + frontend suivant). Écarts et ajouts :
- Migration `20260928300001-gps-vehicles-positions.cjs` (suffixe 3000xx : troisième poste). `Vehicles` a aussi `DeviceTokenCreatedAt` et `LastBatteryPercent`.
- Jeton de l'appareil accepté **dans le champ « Identifiant de l'appareil » de Traccar Client** (`id` / `device_id`) avec l'URL `…/api/tracking/osmand` : le jeton reste hors de l'URL en JSON. `…/osmand/<jeton>` fonctionne aussi. Formats reçus : paramètres GET/POST (vitesse en nœuds) et JSON Traccar 9 (m/s, `location` simple ou tableau).
- GPS du navigateur : `POST /api/tracking/runs/:id/positions` (plutôt que sous `/route-run`), envoi groupé aux 15 s, Wake Lock, reprise après rechargement de la page. Coupé en quittant la page.
- Limite de débit par appareil (120/min, clé = hash du jeton), pas par IP.
- Un tracteur déjà en tournée sur une autre route est refusé au démarrage (409) ; désactiver un tracteur en tournée aussi.
- Réglages `Settings.tracking` (`positionRetentionDays`, `liveTrailMinutes`) : API faite (`GET/PUT /setting/tracking`), écran prévu avec G2.
- `/suivi` : actualisation aux 10 s (en pause onglet caché), marqueurs mis à jour sur place ; au-delà de 400 arrêts, seuls ceux de la tournée sélectionnée s'affichent.
- Pas de code QR pour le jeton (copier-coller suffit pour l'instant).
- Vérifié : 56 tests backend (Postgres jetable) + 21 tests navigateur headless (frontend compilé, auth Firebase simulée, géolocalisation simulée). **La carte Google n'a pas pu être testée ici** (pas d'accès à Google depuis le poste de test) : à valider dans ton navigateur, ainsi que Traccar Client sur un vrai téléphone (URL publique requise).

### Phase G2 — Arrivées, départs et « Fait » automatique (~2-3 soirées)
Champs `RouteRunStops` (`ArrivedAt`, `DepartedAt`, `ServiceSeconds`, `TravelSeconds`, `DoneSource`) ; `geofence.js` ; Settings `tracking` ; affichage opérateur « Fait (auto) » + annuler.
→ *Livrable : l'opérateur n'a plus besoin de cocher ; chaque arrêt a ses vraies durées.*
→ *Vérif (trace simulée) : arrêt de 2 min → `done` + `auto_gps` + durées ; passage sans arrêt de 20 s → rien ; deux entrées voisines à 15 m → la bonne est cochée ; arrêt sauté → reste `pending` ; décocher un auto → champs GPS effacés ; positions en retard mélangées → même résultat ; `autoCompleteStops=false` → durées enregistrées, pas de « Fait ». Puis un vrai test en voiture sur 3-4 adresses.*

**✅ Livrée le 2026-09-28 sur la branche `GPS`** (`925049b` backend + frontend suivant). Écarts et ajouts :
- Migration `20260928300002-gps-stop-arrivals.cjs` : champs `RouteRunStops` du plan + `RouteRuns.GeofenceState` (JSONB) : l'état de la détection est mémorisé entre deux envois, chaque position ne sert qu'une fois.
- `src/tracking/geofence.js` : fonction pure (testable sans base). 2 positions consécutives pour confirmer une arrivée ou un départ (filtre les sauts GPS) ; positions à plus de 100 m de précision ignorées pour la détection ; verrou de ligne sur la tournée (appareil + téléphone en même temps).
- Une position plus vieille que la dernière traitée ne compte pas pour la détection (elle reste sur la carte). Un tampon envoyé d'un bloc est trié avant traitement.
- `TravelSeconds` part du dernier vrai départ : un simple passage devant une adresse ne le remet pas à zéro.
- Réglages (Paramètres › Véhicules) : Fait auto on/off, rayon, marge de sortie, durée minimale, arrêts surveillés, conservation, traînée. `PUT /setting/tracking` est partiel.
- Vue opérateur : actualisation aux 15 s, « 📍 Sur place depuis 5 h 42 », « Fait (GPS) ✓ » avec l'heure, Annuler efface les données GPS.
- **Ajout demandé par Sébastien : carte du trajet dans la vue opérateur.** Bascule 📋 Liste / 🗺️ Carte et trajet sur téléphone (choix mémorisé), les deux côte à côte sur grand écran. Arrêts numérotés par état, départ/retour, tracteur (position du téléphone s'il envoie, sinon la dernière reçue). Trajet routier Google par tronçon (fait en gris, prochain tronçon en évidence), calculé une seule fois par ouverture de la page (≈ 1 requête Routes API par 25 arrêts) ; lignes droites si Routes API est indisponible. Sous la carte, fiche de l'arrêt touché (ou du prochain) avec Naviguer / Passer / Fait.
- Vérifié : 31 tests de géorepérage (dont entrées voisines, passage, tampon désordonné, envois simultanés) + 56 tests G1 relancés + 17 tests navigateur headless. **Carte Google et trajet routier non testables ici** : à valider dans ton navigateur et sur téléphone.

### Phase G3 — Suivi dans le portail client (~2 soirées)
`GET /api/portal/tracking` ; carte et « X arrêts avant le vôtre » dans `/portail/gestion` ; réglage `portalTrackingEnabled`.
→ *Vérif : contrat hors tournée en cours → rien d'affiché ; tournée en cours → nombre d'arrêts juste ; jeton expiré → 401 ; aucune donnée d'un autre client dans la réponse (seulement la position du tracteur et l'état de SON arrêt).*

**✅ Livrée le 2026-09-28 sur la branche `GPS`.** Écarts et ajouts :
- `GET /api/portal/tracking` (jeton portail, limite dédiée de 120 requêtes / 15 min par IP) : la tournée en cours qui passe chez le client, sinon sa dernière visite des **12 dernières heures** (`PORTAL_RECENT_VISIT_HOURS`) pour « Votre entrée a été déneigée à 5 h 42 ».
- Réponse volontairement minimale : état de SON arrêt, nombre d'arrêts avant le sien, position du tracteur **seulement tant que son entrée reste à faire**, son adresse. Ni ordre de la route, ni autres adresses, ni nom d'opérateur, de tracteur ou de route.
- États affichés : « Déneigement en cours dans votre secteur — il reste X arrêts », « Vous êtes le prochain arrêt », « Le déneigeur est chez vous », « Votre entrée a été déneigée à … (passage confirmé par le GPS du tracteur) », « Passage reporté ».
- Carte (tracteur + maison) seulement pendant l'attente. La page s'actualise aux 30 s, y compris avant le départ de la tournée (une page ouverte d'avance voit le tracteur arriver).
- Réglage « Montrer le tracteur aux clients » (`portalTrackingEnabled`) dans Paramètres › Véhicules.
- Limite connue : le jeton du portail expire après 30 min ; un client qui suit plus longtemps doit se reconnecter.
- Vérifié : 20 tests API (confidentialité incluse) + 8 tests navigateur headless ; G1 (56) et G2 (31) relancés sans régression. Carte Google non testable ici.

### Phase G4 — Statistiques et calibration des durées (~2 soirées, après quelques tempêtes)
Page Paramètres › Routes › « Durées réelles » : médiane de `ServiceSeconds` par revêtement × taille d'entrée, nombre d'échantillons, écart avec les réglages actuels, bouton « Appliquer les durées suggérées » ; par route, trajet réel vs estimé par l'optimiseur.
→ *Vérif : données simulées sur 3 tournées → médianes justes, arrêts `manual` sans `ArrivedAt` exclus, valeurs aberrantes (> 30 min) exclues.*

### Phase G5 — ESP32 cellulaire (en parallèle, indépendante du code serveur)
Firmware : GPS (TinyGPS++) → OsmAnd HTTPS vers l'URL du véhicule toutes les 10 s en mouvement / 60 s à l'arrêt ; tampon circulaire hors couverture vidé au retour du réseau ; démarrage avec le contact. Variante Wi-Fi sur le partage de données du téléphone.
→ *Vérif : même tests que G1 avec l'ESP32 à la place de Traccar Client ; couper la couverture 5 min → les positions arrivent en retard, dans l'ordre.*

### Phase G6 — Connecteur FieldOps pour le Case (optionnelle)
Compte développeur CNH (courriel de domaine d'entreprise), EULA accepté pour le VIN, OAuth 2.0 ; `FieldOpsPoller` ; `Vehicles.SourceType = fieldops`, `DeviceKey = VIN`.
→ *Avant d'écrire du code : mesurer la fréquence réelle des positions de l'API. Si c'est aux minutes, le géorepérage ne sera pas fiable pour ce tracteur : garder la carte, désactiver le « Fait » auto pour ce véhicule, ou lui ajouter un téléphone/ESP32.*

**= V1 complète : G1 + G2 + G3, ~7-8 soirées.** G4 dès qu'il y a assez de données.

### Plus tard — Journal de passage (preuve de service)
Demandé par Sébastien le 2026-09-28, reporté après G3. Aujourd'hui, **Annuler efface** ArrivedAt/DepartedAt/DoneSource, et les positions brutes sont purgées après 30 jours : un « Fait (GPS) » peut donc disparaître sans trace. À faire :
- table append-only `RouteRunStopEvents` (comme `ConsentLogs`) : arrivée, départ, fait auto, coché/passé/annulé à la main (par qui), avec heure, source et la position GPS du moment (précision incluse) ; rien n'est jamais effacé, l'annulation devient une ligne ;
- historique de passage dans la fiche du contrat (une ligne par tempête : arrivée, départ, durée, source, opérateur, tracteur ; trace sur la carte tant qu'elle existe) ;
- conservation réglable (12 mois par défaut : saison + contestation, Loi 25) ; plus tard, preuve de passage en PDF.
- Limite à garder en tête : prouve la présence du tracteur, pas la qualité du déneigement ; un pin mal placé affaiblit la preuve.

### Plus tard (hors V1) — Préavis « 15 min avant » par SMS
Prérequis : G4 appliqué, durées réelles sur plusieurs tempêtes.
- Heure d'arrivée prévue = position actuelle → prochain arrêt + somme des (`TravelSeconds` + `ServiceSeconds`) calibrés jusqu'à l'arrêt visé. Calcul local, aucun appel Google en continu.
- `RouteRunStops.EstimatedArrivalAt`, `ApproachNotifiedAt` ; lot `route_approaching` ciblé sur le contrat (le ciblage par contrat existe déjà dans `enqueueBatch`) ; consentement et suppressions respectés par `recipientResolver`.
- Préférence **optionnelle par client** (volume de SMS par tempête), message en fourchette (« dans 15 à 20 minutes »), un seul envoi par arrêt.

---

## 7. Points d'attention

1. **Loi 25 — employés.** La position du tracteur est aussi celle de l'opérateur. Politique écrite remise aux opérateurs ; suivi **seulement pendant une tournée en cours** (le serveur jette le reste) ; positions brutes purgées après 30 jours ; données dérivées (durées par arrêt) sans trace GPS. Si l'opérateur utilise son propre téléphone, c'est l'app qu'il démarre et arrête lui-même.
2. **Loi 25 — clients.** Le portail n'expose que la position du tracteur et l'état de l'arrêt du client connecté, jamais la liste des autres adresses.
3. **Faux « Fait »** (entrées collées, tracteur qui attend dans la rue). Mitigation : fenêtre de candidats limitée, durée minimale, l'opérateur peut annuler. À mesurer en G2 ; si c'est trop bruyant, `autoCompleteStops=false` garde quand même la collecte des durées.
4. **Zones mortes cellulaires en rang** : les positions arrivent en retard. Traccar Client et le firmware ESP32 doivent garder un tampon ; le serveur trie par heure de l'appareil.
5. **Prépayés** : expiration de la ligne sans recharge, suspension pour usage « non téléphone ». Choisir un forfait avec données et une date de renouvellement connue.
6. **Batterie** : téléphone ou ESP32 toujours branché sur le 12 V du tracteur. Un téléphone au froid dans la cabine perd sa batterie vite.
7. **Clé Google Maps** : la carte du portail est publique → la clé doit rester restreinte par référent HTTP (déjà le cas) ; surveiller le volume de chargements de carte si beaucoup de clients suivent la tournée en même temps.
