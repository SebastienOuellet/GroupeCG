# Compte de service Google (Route Optimization API)

Déposer ici le JSON du compte de service Google Cloud (rôle *Route Optimization Editor*),
puis dans `backend/.env` :

```
GOOGLE_CLOUD_PROJECT_ID=<id du projet GCP>
GOOGLE_ROUTE_OPTIMIZATION_CREDENTIAL_FILE=<nom-du-fichier>.json
ROUTE_OPTIMIZATION_DRY_RUN=false
# Optionnel : valider la requête sans la résoudre ni la facturer
# ROUTE_OPTIMIZATION_VALIDATE_ONLY=true
```

Les `*.json` de ce dossier sont ignorés par git : ne jamais committer ce fichier.
Voir `PLAN-ROUTES-GOOGLE.md`, phase R0.
