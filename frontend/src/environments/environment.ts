export const environment = {
  production: true,
  apiUrl: 'https://deneigement-be-app-ccytc.ondigitalocean.app/api',
  googleMapsApiKey: 'AIzaSyCAd2AZi7voXa--h8dQ7pLJfQMmerlxZlA',
  googleMapsMapId: '',
  /**
   * Avis aux clients sur l'espace client (/portail). enabled: true → le message remplace le
   * formulaire de connexion (avant la mise en service, panne, fin de saison…). Le lien
   * « Accès employés » et la page de désinscription restent accessibles. Rebuild + redéploiement requis.
   */
  clientNotice: {
    enabled: true,
    title: 'Bientôt disponible',
    message: "Chers clients, vous recevrez bientôt l'information sur le fonctionnement du système de notification.",
  },
  firebase: {
    apiKey: 'AIzaSyBGoCSp5UUVuBF4l2qQWKZ2J9GFbmEEGTg',
    authDomain: 'groupecg-fbe5b.firebaseapp.com',
    projectId: 'groupecg-fbe5b',
    storageBucket: 'groupecg-fbe5b.firebasestorage.app',
    messagingSenderId: '803113434763',
    appId: '1:803113434763:web:23c3d34821fd057bff5e8e',
  },
};
