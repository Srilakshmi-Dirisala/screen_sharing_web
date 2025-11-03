// Firebase Configuration
// Replace these values with your Firebase project credentials
// Get them from: https://console.firebase.google.com → Project Settings → General → Your apps

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDDGZfgRj0FDz-Bm-1Qe5-Dkxe657HQBX0",
  authDomain: "testing-8d695.firebaseapp.com",
  databaseURL: "https://testing-8d695-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "testing-8d695",
  storageBucket: "testing-8d695.firebasestorage.app",
  messagingSenderId: "1027496688952",
  appId: "1:1027496688952:web:793d8e7a40080809ba55cd",
  measurementId: "G-GEJ3S3Q22D"
};
// Helper function to check if Firebase is configured
function isFirebaseConfigured() {
    return FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY_HERE" && 
           FIREBASE_CONFIG.databaseURL !== "YOUR_DATABASE_URL_HERE";
}
