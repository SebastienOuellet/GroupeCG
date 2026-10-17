# firebaseConfig

Déposez ici le fichier JSON du service account Firebase (Project Settings → Service accounts → Generate new private key).

Puis référencez son nom exact dans `backend/.env` :

```
FIREBASE_CREDENTIAL_FILE=votre-fichier-firebase-adminsdk.json
```

Ce dossier est ignoré par git (voir `.gitignore` à la racine) — seul ce README y est versionné.

## En prod (App Platform, Docker)

Ce dossier n'est pas déployé (fichiers ignorés par git). Mettre le **contenu** du JSON dans la variable `FIREBASE_SERVICE_ACCOUNT_JSON` (cochée *Encrypt*), de préférence encodé en base64 pour éviter les problèmes de guillemets et de `\n` :

```bash
# macOS / Linux
base64 -i votre-fichier-firebase-adminsdk.json | tr -d '\n'
# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("votre-fichier-firebase-adminsdk.json"))
```

La variable est prioritaire sur `FIREBASE_CREDENTIAL_FILE`. Sans aucun des deux, les routes authentifiées répondent 500 « Firebase n'est pas configuré sur le serveur ».
