# GroupeCG — résumé de reprise

## Repo
https://github.com/SebastienOuellet/GroupeCG (branche `main`, à jour)

## État : les 5 phases du plan initial sont TERMINÉES et poussées
1. `db00e0a` — Fondations du domaine (clients, contrats, adresses, routes, locataires)
2. `b4b3661` — Moteur de notifications + conformité Loi 25/LCAP
3. `f469f6c` — Portail public libre-service
4. `a377a54` — Facturation simple + rappels automatiques
5. `79e7210` — Vue opérateur mobile

Chaque phase a été vérifiée par script (13 à 25 tests métier par phase, tous passés) + build Angular propre. Détails complets dans l'historique de commits.

## Pour redémarrer sur un autre PC
```bash
git clone https://github.com/SebastienOuellet/GroupeCG.git
cd GroupeCG/backend && npm install
cd ../frontend && npm install
```

**Fichiers à recréer manuellement (non versionnés) :**
- `backend/.env` — voir `backend/src/config/default.js` pour la liste des variables. Contient : connexion DB PostgreSQL DigitalOcean, `FIREBASE_CREDENTIAL_FILE`, `NOTIFICATIONS_DRY_RUN=true` (garder `true` tant que Twilio n'est pas configuré), `PUBLIC_BASE_URL`, `UNSUBSCRIBE_SECRET`, `PORTAL_TOKEN_SECRET`, `RENEWAL_REMINDER_DAYS=45`, `TWILIO_VALIDATE_SIGNATURE=false` (dev seulement).
- `backend/firebaseConfig/<fichier>.json` — service account Firebase (voir `backend/firebaseConfig/README.md`).
- `frontend/public/images/logo.png` — le logo Groupe CG.
- Config Firebase web dans `frontend/src/environments/environment.development.ts` (déjà remplie dans le repo actuellement — vérifier qu'elle est bien présente après clone, car c'est un fichier normal versionné, pas un secret).

**Démarrage :**
```bash
cd backend && npm run dev     # port 5011, nodemon
cd frontend && npm start      # port 4200
```

## Reste à faire (hors plan initial, à décider avec l'utilisateur)
- Valider visuellement le parcours opérateur complet dans le navigateur (créer un compte Firebase avec Role="operator" en DB, assigner une route, tester démarrer/cocher/terminer).
- Configurer un vrai compte Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`) et passer `NOTIFICATIONS_DRY_RUN=false` quand prêt à envoyer de vrais SMS/courriels.
- Configurer le webhook Twilio STOP vers `/api/webhook/twilio/sms` en prod (avec `TWILIO_VALIDATE_SIGNATURE=true`).
- Déploiement (aucune infra de prod configurée pour l'instant — DB DigitalOcean existe déjà, backend/frontend à héberger).
- Rien d'urgent niveau dette technique : lint backend propre à chaque phase, pas de TODO connu.

## Conventions du projet (pour repartir vite)
- Backend : Express/Sequelize ESM, pattern composant `src/components/<feature>/<feature>.{controller,service,model}.js`, erreurs typées (`src/errors/Errors.js`), `requireRole()` middleware, migrations `.cjs` dans `backend/migrations/`.
- Frontend : Angular 21 standalone/signals, pages sous `frontend/src/app/pages/{admin,public,operator}/`, services API sous `core/services/`.
- Couleurs de marque : `--color-primary: #052261`, `--color-secondary: #2f3840`.
- Le plan détaillé complet (contexte produit, modèle de données, décisions) est dans `C:\Users\sebas\.claude\plans\cettte-nuit-j-aimerai-que-cheerful-stallman.md` — **local à cette machine**, à copier/coller dans le nouveau chat si besoin du détail complet.
