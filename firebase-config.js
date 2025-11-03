// Firebase Configuration
// Replace these values with your Firebase project credentials
// Get them from: https://console.firebase.google.com → Project Settings → General → Your apps

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
// Helper function to check if Firebase is configured
function isFirebaseConfigured() {
    return !!FIREBASE_CONFIG.apiKey && 
           !!FIREBASE_CONFIG.authDomain &&
           !!FIREBASE_CONFIG.databaseURL &&
           !!FIREBASE_CONFIG.projectId &&
           !!FIREBASE_CONFIG.storageBucket &&
           !!FIREBASE_CONFIG.messagingSenderId &&
           !!FIREBASE_CONFIG.appId;
}
