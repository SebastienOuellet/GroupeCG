# Plan — Optimisation des routes avec Google (Route Optimization API)

> Statut (2026-09-28) : **R0, R1, R2, R3 faites** ; trajet routier réel sur la carte ajouté. **R4 et R5 abandonnées** (décision de Sébastien). Purge serveur des coordonnées Google expirées : non faite (serveur de dev, jugée inutile pour l'instant). Rédigé le 2026-09-27 à partir du code sur `main` (commit `a63bbe0`, après les phases 1-5 de `PLAN-ORIGINAL.md` et les ajouts du 26-27 septembre).
>
> Pour reprendre : lire `RESUME-REPRISE.md` (état du code, démarrage, travail en parallèle), puis ce plan. Commencer par la section 7 (questions ouvertes), puis la phase R0.

## Contexte

Objectif : l'admin clique sur « Optimiser » pour une route. Le système propose l'ordre de passage le plus court. L'admin valide ou ajuste l'ordre, et l'opérateur fait ses arrêts dans cet ordre. Le but est de sauver de l'essence et, surtout, du temps avant 7 h.

Outil retenu : **Google Maps Platform — Route Optimization API** (ex-*Cloud Fleet Routing* / *Cloud Optimization AI*). Ce n'est pas un modèle de langage, c'est un solveur de tournées de véhicules (VRP). Entrées : des visites, des véhicules et des contraintes. Sorties : l'ordre des visites, les km, les durées et l'heure d'arrivée estimée (ETA) par arrêt.

Principe clé : **les routes de déneigement sont stables toute la saison.** On optimise quand la composition d'une route change, pas à chaque tempête. Le volume d'appels reste donc minime.

---

## 0. Ce que le code actuel a déjà, et ce qui manque

| Élément | État actuel | Impact |
|---|---|---|
| `ServiceAddresses.Latitude/Longitude` | ✅ Existent, remplies par l'autocomplete Google Places (New) côté Angular | Pas de géocodage à construire, mais question de conditions d'utilisation (voir §6) |
| `ServiceAddresses.PlaceId` | ❌ Absent | À ajouter : c'est la seule donnée Google stockable indéfiniment |
| `GoogleMapsService` (Angular) | ✅ Charge l'API Maps JS avec `@googlemaps/js-api-loader` (Places + Street View) | Réutilisable pour la carte d'aperçu |
| Ordre des contrats dans une route | ❌ Aucun. `getRouteContracts` trie par `Reference` | Aucun concept de séquence |
| `RouteRunStops` | ❌ Aucun ordre. Créés via `bulkCreate` dans l'ordre de `Contract.findAll` sans `order` | **Aujourd'hui, l'opérateur voit ses arrêts dans un ordre arbitraire.** Ce bug existe même sans Google |
| Point de départ (cour, garage) | ❌ Absent | Requis par l'optimiseur |
| `DrivewaySurface` | ✅ Existe | Utile pour estimer la durée de chaque arrêt |
| Table `Settings` (clé/valeur JSONB) | ✅ Existe (`SETTING_KEYS`) | Pour stocker le dépôt par défaut |

---

## 1. Concepts à comprendre

### Correspondance entre le vocabulaire Google et GroupeCG

| Route Optimization | GroupeCG |
|---|---|
| `Shipment` avec une seule `delivery` (`VisitRequest`) | Un **contrat actif** de la route (une entrée à déneiger) |
| `Waypoint` (`placeId` **ou** `location` lat/lng, + `sideOfRoad`) | L'adresse de service |
| `VisitRequest.duration` | Temps de déneigement de l'entrée (selon la surface et la taille) |
| `VisitRequest.timeWindows` | « Commercial avant 6 h 30 » (phase R3) |
| `Vehicle` (`startWaypoint`, `endWaypoint`, `costPerKilometer`, `costPerHour`) | Le camion de la route, qui part de la cour et y revient |
| `label` (sur Shipment et Vehicle) | `ContractId` et `RouteId`, pour relier la réponse à nos données |

### Deux problèmes distincts

1. **Ordre *dans* une route** : 1 véhicule. SKU *Single Vehicle Routing*. C'est le MVP.
2. **Découpage *entre* les routes** : plusieurs véhicules. SKU *Fleet Routing*. On le fait plus tard, 1 ou 2 fois par saison.

### Appel technique

- Endpoint : `POST https://routeoptimization.googleapis.com/v1/projects/{projectId}:optimizeTours`
- Client Node officiel : `@googlemaps/routeoptimization`
- **Authentification : compte de service Google Cloud (OAuth / Application Default Credentials), pas une clé API.** Même principe que le fichier de service account Firebase déjà en place.
- Mode `VALIDATE_ONLY` : valide la requête sans facturer. Pratique en dev.

---

## 2. Modèle de données (migrations `.cjs`)

**ServiceAddresses**
- `PlaceId` STRING null : identifiant Google de l'adresse, stockable indéfiniment. Rempli par l'autocomplete (le `place.id` est déjà disponible dans `resolveSuggestion`).
- `LocationSource` STRING null : `google_autocomplete` / `manual_pin` (constantes). Un pin corrigé à la main en rang rural est notre propre donnée.
- `LocationUpdatedAt` DATE null : pour gérer le rafraîchissement des coordonnées (voir §6).

**Contracts**
- `RouteSequence` INTEGER null : position dans la route (1, 2, 3…). `null` = pas encore ordonné, affiché à la fin.
- Le **rollover** de saison doit copier `RouteSequence` en même temps que `RouteId` (`contract.service.js`, là où `RouteId: source.RouteId` est déjà copié).
- Index `(RouteId, RouteSequence)`.

**Routes**
- `SequenceUpdatedAt` DATE null, `SequenceUpdatedByUserId` FK null, `SequenceSource` (`manual` / `optimized`) : traçabilité de l'ordre en vigueur.
- (Plus tard) `StartPlaceId` / `StartLatitude` / `StartLongitude` null : dépôt propre à la route si l'opérateur part de chez lui.

**RouteRunStops**
- `Sequence` INTEGER not null : **copie figée de l'ordre au démarrage de la tournée.** Si l'admin réordonne pendant une tempête, la tournée en cours ne bouge pas.

**Settings**
- Nouvelle clé `SETTING_KEYS.ROUTE_DEPOT` : `{ label, placeId, latitude, longitude }`, le dépôt par défaut.
- Nouvelle clé `SETTING_KEYS.ROUTE_OPTIMIZATION` : `{ defaultVisitMinutes: { asphalt: 4, gravel: 5, … }, costPerKm, costPerHour }`. Réglable par l'admin sans redéployer.

**Pas de table d'historique des optimisations au MVP** : on ne stocke pas les km, polylignes ni ETA de Google (voir §6). On garde seulement l'ordre retenu, qui est une décision de l'admin.

---

## 3. Backend

### Config (`src/config/default.js` + `.env`)
```
GOOGLE_CLOUD_PROJECT_ID=...
GOOGLE_ROUTE_OPTIMIZATION_CREDENTIAL_FILE=googleConfig/<service-account>.json   # non versionné, comme firebaseConfig/
ROUTE_OPTIMIZATION_DRY_RUN=true            # dev : optimiseur local, aucun appel Google
ROUTE_OPTIMIZATION_TIMEOUT_SECONDS=30
```

### Abstraction fournisseur (même pattern que `src/notifications/providers/`)
```
src/routing/
  RouteOptimizer.js               # base : async optimize({ depot, stops[], vehicle }) → { orderedStopIds[], metrics }
  GoogleRouteOptimizer.js         # @googlemaps/routeoptimization, compte de service
  NearestNeighborOptimizer.js     # dev/dry-run : plus proche voisin à vol d'oiseau (Haversine), gratuit, sans réseau
  routeOptimizerFactory.js        # choix selon ROUTE_OPTIMIZATION_DRY_RUN — point de swap (VROOM/OSRM plus tard)
```
Pourquoi : on peut développer et tester tout le parcours sans compte Google ni facturation, et on peut changer de fournisseur si les conditions Google bloquent un jour. C'est la même logique que Twilio/DryRun.

### Composant `routeOptimization/` (ou extension de `route/`)

| Route | Action | Accès |
|---|---|---|
| `GET /api/route/:id/contracts` | **Modifié** : tri `RouteSequence ASC NULLS LAST`, puis `Reference` | admin |
| `PUT /api/route/:id/sequence` | Corps `{ contractIds: [..] }` → réécrit `RouteSequence` en transaction. Refus si un id n'appartient pas à la route. `SequenceSource=manual` | admin |
| `POST /api/route/:id/optimize` | Construit la requête (contrats `ACTIVE` de la route + dépôt), appelle l'optimiseur et renvoie une **proposition non sauvegardée** : `{ orderedContractIds, totalDistanceKm, totalDurationMin, polyline?, skipped[] }` | admin |
| `POST /api/route/:id/optimize/apply` | Enregistre l'ordre proposé (`SequenceSource=optimized`) | admin |

Règles du service :
- Adresse sans `PlaceId` ni coordonnées → exclue et renvoyée dans `skipped[]` avec la raison. Jamais d'échec silencieux.
- **Minimisation Loi 25** : la requête vers Google ne contient que `placeId` ou lat/lng, la durée de visite et `label = ContractId`. **Jamais de nom, téléphone, courriel ni numéro de client.**
- Erreurs typées : `BadRequestError` (route vide, pas de dépôt configuré), `ServiceUnavailableError` (timeout ou quota Google). Aucune écriture en DB en cas d'échec.
- Log winston : nombre d'arrêts, durée d'appel, SKU. Pas d'adresses dans les logs.

### `routeRun.service.js#startRouteRun`
- `Contract.findAll({ order: [["RouteSequence", "ASC NULLS LAST"], ["Reference", "ASC"]] })`, puis `Sequence: index + 1` dans le `bulkCreate`.
- `stopInclude` trié par `Stops.Sequence`.

---

## 4. Frontend (Angular 21, signals)

**Admin — nouvelle page `/routes/:id`** (aujourd'hui il n'y a que `routes-list`) :
- Liste ordonnée des contrats avec **glisser-déposer** (CDK `DragDrop`) → `PUT /sequence`.
- **Carte Google** (réutilise `GoogleMapsService`, ajoute la librairie `maps` + `marker`) : pins numérotés dans l'ordre, dépôt distinct.
- Bouton **« Optimiser »** → aperçu côte à côte : ordre actuel vs proposé, km et durée proposés, polyligne sur la carte, liste des adresses exclues. Boutons **Appliquer** / **Annuler**.
- Badge « Ordre optimisé le … » ou « Ordre manuel ».
- Attribution Google visible (logo, déjà inclus dans la carte Google).

**Admin — fiche adresse** :
- Sauvegarder `PlaceId` depuis l'autocomplete.
- Mode **« Corriger le pin »** : marqueur déplaçable sur la carte → `LocationSource=manual_pin`. Essentiel en milieu rural.

**Paramètres** : onglet « Routes » avec le dépôt (autocomplete) et les durées de visite par surface.

**Opérateur — `route-run-page`** :
- Arrêts dans l'ordre `Sequence`, numéro visible (« 12/48 »).
- Mise en évidence du **prochain arrêt** `pending`.
- Bouton **« Naviguer »** → lien Google Maps : `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=driving` (ou `destination_place_id=`). Gratuit, sans clé, ouvre l'app GPS du téléphone.

---

## 5. Phases de construction

### Phase R0 — Préparation Google Cloud (~1 h, aucun code)
- Dans le **même projet GCP** que la clé Maps actuelle : activer *Route Optimization API* (et *Maps JavaScript API* si ce n'est pas déjà fait).
- Créer un compte de service avec le rôle *Route Optimization Editor*, télécharger le JSON → `backend/googleConfig/` (ajouter au `.gitignore`).
- **Alerte de budget** (ex. 10 $) et **quota** quotidien plafonné sur Route Optimization.
- Vérifier que la clé frontend est restreinte par référent HTTP et limitée aux API Maps JS et Places.

### Phase R1 — Ordre des arrêts, sans Google (~2 soirées)
Migrations `RouteSequence`, `RouteRunStops.Sequence`, `PlaceId`, `LocationSource`, dépôt dans les Settings ; `PUT /sequence` ; tri dans `startRouteRun` ; page `/routes/:id` avec glisser-déposer et carte ; bouton « Naviguer » opérateur.
→ *Livrable : l'ordre de passage existe et l'opérateur le suit. Ça corrige le problème d'ordre arbitraire, même si on n'allait jamais plus loin.*
→ *Vérif : réordonner → démarrer une tournée → les arrêts sont dans l'ordre ; réordonner pendant une tournée → la tournée en cours ne change pas ; rollover → `RouteSequence` copié ; lien « Naviguer » testé sur téléphone.*

**✅ Livré le 2026-09-28** (`da771fc`, `7b3342b`). Écarts et ajouts par rapport au plan :
- Migration `20260928100001-route-sequence.cjs` : `Contracts.RouteSequence` (+ index), `RouteRunStops.Sequence` (tournées existantes renumérotées par ordre de création), `ServiceAddresses.PlaceId/LocationSource/LocationUpdatedAt` (coordonnées existantes marquées `google_places`), `Routes.SequenceSource/SequenceUpdatedAt/SequenceUpdatedByUserId/BaseLocation`.
- `LocationSource` : `google_places` (autocomplete **et** recherche texte) / `manual_pin`. Géré par le serveur : coordonnées inchangées → rien ne bouge (un pin manuel reste manuel).
- Rafraîchissement des coordonnées Google > 30 jours : fait **à l'ouverture de la page de la route** (Place Details par PlaceId, côté navigateur), pas par un cron serveur (pas de clé serveur avant R0). Une adresse jamais ouverte peut donc garder des coordonnées plus vieilles : purge serveur à prévoir en R2 avec le compte de service.
- Contrat qui change de route → `RouteSequence = null` (« à placer », affiché à la fin). `RouteSequence` n'est modifiable que par `PUT /route/:id/sequence`.
- Page `/routes/:id` : filtre par saison (actifs + brouillons), saisie directe de la position, « Inverser », distance à vol d'oiseau indicative, correction des pins sur la carte, garde de sortie si non enregistré.
- Carte : marqueurs avancés → **Map ID requis** (`environment.googleMapsMapId`, vide = `DEMO_MAP_ID`, à remplacer par un vrai Map ID en prod).
- Vérifié : 38 tests métier sur Postgres jetable + tests HTTP (droits admin/opérateur). Test navigateur à faire après `npm run migrate` sur la DB DigitalOcean.

### Phase R2 — Optimisation Google (~2-3 soirées)
`src/routing/` (factory + NearestNeighbor + Google) ; `optimize` / `apply` ; aperçu avant/après dans `/routes/:id`.
→ *Livrable : un clic → proposition → validation.*
→ *Vérif : `ROUTE_OPTIMIZATION_DRY_RUN=true` → parcours complet sans réseau ; requête Google en `VALIDATE_ONLY` (non facturée) ; puis vraie requête sur une route de test de 10 adresses ; adresse sans coordonnées → dans `skipped` ; inspecter la requête sortante (aucune donnée nominative) ; timeout simulé → erreur propre, DB intacte.*

**✅ Livré le 2026-09-28** (`ba8dc31` backend + frontend suivant). Écarts et ajouts :
- `src/routing/` : `RouteOptimizer` (contrat), `LocalRouteOptimizer` (plus proche voisin **+ 2-opt + Or-opt**, pas seulement le plus proche voisin : optimum exact sur 30/30 cas de 7 arrêts, ~50 ms pour 100 arrêts), `GoogleRouteOptimizer`, `routeOptimizerFactory` (+ `setRouteOptimizer` pour les tests), `geo.js`.
- Endpoints dans le composant `route/` (`routeOptimization.service.js`) : `POST /route/:id/optimize` corps `{ seasonYear }` (actifs + brouillons de la saison), `POST /route/:id/optimize/apply` corps `{ contractIds }`.
- Comparaison équitable : l'aperçu donne **l'ordre enregistré et l'ordre proposé à vol d'oiseau** (même mesure), plus km/durée routiers quand c'est Google.
- Durée de visite par revêtement en constantes (`DEFAULT_VISIT_SECONDS_BY_SURFACE`, 4-5 min) ; réglage admin reporté en R3.
- Pin manuel → coordonnées envoyées à Google (pas le PlaceId) ; sinon PlaceId quand on l'a.
- `ROUTE_OPTIMIZATION_VALIDATE_ONLY=true` : Google valide la requête sans la résoudre ni la facturer.
- UI : bouton « ⚡ Optimiser » → la proposition remplace l'ordre à l'écran (non enregistrée), ancien ordre en pointillé gris sur la carte, gain en %, arrêts non placés listés et laissés à la fin. « Appliquer la proposition » → `SequenceSource=optimized` ; retouchée à la main → enregistrée comme ordre manuel.
- Vérifié : 38 tests (qualité/perf de l'optimiseur local, requête Google inspectée et encodée en protobuf, réponse Google simulée, 503 propre, aucune donnée nominative sortante, DB intacte en cas d'échec). **Pas encore d'appel Google réel** : dépend de R0.
- Pour passer à Google : R0, puis `backend/googleConfig/README.md`.

**= MVP complet (R0 + R1 + R2), ~5 soirées.**

### Trajet routier sur la carte (ajout du 2026-09-28, `d9a7bc1`)
- Google **Routes API** depuis le navigateur (`Route.computeRoutes`, librairie `routes` de Maps JS), tronçons de 25 arrêts intermédiaires ; tracé bleu avec le sens, km et minutes de route. Recalculé 1,2 s après un changement d'ordre, cache par ordre, jamais stocké.
- Bascules 🚜 Trajet routier / 🐦 Vol d'oiseau ; aperçu d'optimisation sur les deux mesures, avertissement si plus court à vol d'oiseau mais plus long par la route.
- Requiert **Routes API** activée et permise pour la clé du navigateur.

### Phase R3 — Contraintes propres au déneigement (production, ~2 soirées)

**✅ Livré le 2026-09-28** (`6585e62` backend + frontend suivant), sans les heures limites :
- Settings `route_optimization` (Paramètres › Routes) : minutes par revêtement (+ « non précisé »), facteur par taille d'entrée, heure de départ. Défauts dans `DEFAULT_ROUTE_OPTIMIZATION_SETTINGS`, fusion clé par clé.
- `ServiceAddresses.DrivewaySize` (simple/double/triple/grande) — migration `20260928100002`. Sélecteur dans la fiche adresse, pastille « Entrée double » côté admin et opérateur.
- Google reçoit `globalStartTime` (prochaine occurrence de l'heure de départ, heure de l'Est) ; la proposition renvoie départ, retour estimé, total du déneigement. La page de la route affiche « Départ 03:30 → retour ≈ … » (route Google + déneigement).
- Liste des routes : colonne « Ordre de passage » (x à placer — réordonner / optimisé ou manuel le … / jamais ordonnée), via `UnplacedCount`.
- **Pas fait** (pas de besoin actuel) : heures limites (`ServiceDeadline` → `timeWindows`), `sideOfRoad`.

Plan d'origine :
- Durée de visite selon `DrivewaySurface` et une taille d'entrée (nouveau champ optionnel).
- **Fenêtres horaires** : `Contracts.ServiceDeadline` (ex. `06:30`) pour les commerces → `timeWindows`.
- Heure de départ réelle d'une tournée type (ex. 3 h 30) comme `globalStartTime`.
- `sideOfRoad` si ça s'avère utile sur le terrain.
- Suggestion « Cette route a changé (3 contrats ajoutés) — réoptimiser ? » dans la liste des routes.

### Phase R4 — Découpage des routes (scalable) — ❌ abandonnée le 2026-09-28
Fleet Routing : tous les contrats actifs × tous les camions → proposition de réaffectation (« 7 contrats passeraient de la route A à la route B »), puis validation par l'admin. À faire une fois par saison, après le rollover.

### Phase R5 — Heure estimée dans les SMS (scalable) — ❌ abandonnée le 2026-09-28
Au « Démarrer la route », appel d'évaluation de l'ordre figé → ETA par arrêt → variable `{{heure_estimee}}` dans le gabarit `route_start` (« entre 5 h 30 et 6 h 00 »). Il faut que `enqueueBatch` supporte des variables propres à chaque destinataire (aujourd'hui, c'est un seul corps interpolé). Fourchette large volontairement : une tempête fausse les ETA.

---

## 6. Points d'attention et risques

1. **Conditions d'utilisation Google — à régulariser, y compris dans l'existant.**
   - Les politiques de Places et Route Optimization interdisent le cache des contenus Google, **sauf le `place_id`, stockable indéfiniment**. Les lat/lng venant de Places ne peuvent être gardées que temporairement (limite de 30 jours dans les conditions spécifiques de Places, à confirmer dans l'entente en vigueur).
   - **Aujourd'hui, `Latitude/Longitude` sont stockées de façon permanente** : c'est à corriger avec cette phase. Stratégie : `PlaceId` devient la référence. Les coordonnées Google sont un cache rafraîchi (`LocationUpdatedAt` > 30 j → re-fetch par `PlaceId`) et on envoie `placeId` à l'optimiseur quand il existe. Un pin corrigé à la main (`manual_pin`) est notre donnée.
   - Résultats de Route Optimization : **affichage sur carte Google seulement**, avec attribution. On ne stocke que l'ordre retenu par l'admin, pas les km ni les polylignes (interprétation prudente, à valider).
2. **Loi 25** : on communique des lieux associés à des clients à un tiers hors Québec. Il faut documenter une **EFVP** courte, minimiser (placeId/coords + `ContractId` seulement) et mentionner le sous-traitant dans la politique de confidentialité.
3. **Géocodage rural** (rangs, chemins, Cookshire-Eaton) : un pin au centre du village fausse tout. Correction manuelle obligatoire, et l'aperçu doit rendre ces erreurs visibles (pin hors de la route = suspect).
4. **L'algorithme ne connaît pas le déneigement** (côtes glacées, demi-tours impossibles avec une gratte, côté de rue, entrées où il faut reculer). L'optimisation reste une **proposition** ; le glisser-déposer manuel a toujours le dernier mot.
5. **Coûts** (grille publique actuelle) : Single Vehicle 5 000 événements gratuits par mois puis 10 $ US / 1 000 ; Fleet 1 000 gratuits puis 30 $ US / 1 000. Pour 3 routes × 80 adresses, ça reste dans le palier gratuit. La phase R5 (appel à chaque tournée) ajoute environ 240 événements par tempête : surveiller le compteur.
6. **Quota et latence** : 60 requêtes/min. Une optimisation prend quelques secondes ; timeout de 30 s côté backend avec un état de chargement clair côté UI.
7. **Pas d'optimisation pendant une tournée en cours** : la séquence figée dans `RouteRunStops.Sequence` le garantit.

---

## 7. Questions ouvertes — tranchées le 2026-09-28

| Question | Réponse | Conséquence |
|---|---|---|
| Dépôt unique ou départ de chez l'opérateur ? | **Dépôt unique : 200 rue des Villas, Sherbrooke.** | `Settings.route_depot`, réglé dans Paramètres › Routes. |
| Volumes réels ? | Ordre de grandeur d'un autre client FolloSOFT : **~50 routes, jusqu'à 100 adresses par route** (~5 000 arrêts). | Séquence écrite en une requête (`unnest`), saisie directe de la position en plus du glisser-déposer. **Coûts R2/R5 à revoir** : une optimisation complète de toutes les routes ≈ 5 000 événements *Single Vehicle* (tout le palier gratuit mensuel) ; R5 (ETA à chaque tempête) ≈ 5 000 événements par tempête → payant (~50 $ US/tempête au tarif public). Optimiser route par route, seulement quand elle change. |
| Clients prioritaires avec heure limite ? | Non pour l'instant, **mais possible plus tard**. | Rien en R1 ; `Contracts.ServiceDeadline` + `timeWindows` restent en R3. |
| L'opérateur réordonne-t-il depuis son téléphone ? | **Non, admin seulement.** | `PUT /route/:id/sequence` réservé à l'admin ; la vue opérateur affiche l'ordre figé. |
| Retour au dépôt ? | **Oui**, mais une route peut avoir un **point d'attache propre** (ex. tracteur stationné ailleurs). | `Routes.BaseLocation` (JSONB) : départ **et** retour ; null = dépôt. En R2 : `startWaypoint = endWaypoint = BaseLocation ?? dépôt`. |

---

Sources : [Route Optimization — Usage and Billing](https://developers.google.com/maps/documentation/route-optimization/usage-and-billing) · [Pricing list](https://developers.google.com/maps/billing-and-pricing/pricing) · [Route Optimization — Policies](https://developers.google.com/maps/documentation/route-optimization/policies) · [Geocoding — Policies](https://developers.google.com/maps/documentation/geocoding/policies) · [Référence ShipmentModel](https://developers.google.com/maps/documentation/route-optimization/reference/rest/v1/ShipmentModel) · [Client libraries](https://developers.google.com/maps/documentation/route-optimization/client-libraries)
