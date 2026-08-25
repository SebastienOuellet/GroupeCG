# firebaseConfig

Déposez ici le fichier JSON du service account Firebase (Project Settings → Service accounts → Generate new private key).

Puis référencez son nom exact dans `backend/.env` :

```
FIREBASE_CREDENTIAL_FILE=votre-fichier-firebase-adminsdk.json
```

Ce dossier est ignoré par git (voir `.gitignore` à la racine) — seul ce README y est versionné.
