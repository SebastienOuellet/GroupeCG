export const environment = {
  production: true,
  apiUrl: 'https://api.groupecg.com/api',
  /**
   * Clé Google Maps (APIs « Maps JavaScript » + « Places API (New) »), restreinte par référent HTTP.
   * Vide = autocomplete et Street View désactivés, saisie manuelle seulement.
   */
  googleMapsApiKey: 'AIzaSyCAd2AZi7voXa--h8dQ7pLJfQMmerlxZlA',
  firebase: {
    apiKey: 'AIzaSyBGoCSp5UUVuBF4l2qQWKZ2J9GFbmEEGTg',
    authDomain: 'groupecg-fbe5b.firebaseapp.com',
    projectId: 'groupecg-fbe5b',
    storageBucket: 'groupecg-fbe5b.firebasestorage.app',
    messagingSenderId: '803113434763',
    appId: '1:803113434763:web:23c3d34821fd057bff5e8e',
  },
};
