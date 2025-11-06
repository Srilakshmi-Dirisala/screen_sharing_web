// Firebase Configuration
// Replace these values with your Firebase project credentials
// Get them from: https://console.firebase.google.com → Project Settings → General → Your apps

// const FIREBASE_CONFIG = {
//   apiKey: "AIzaSyDDGZfgRj0FDz-Bm-1Qe5-Dkxe657HQBX0",
//   authDomain: "testing-8d695.firebaseapp.com",
//   databaseURL: "https://testing-8d695-default-rtdb.asia-southeast1.firebasedatabase.app",
//   projectId: "testing-8d695",
//   storageBucket: "testing-8d695.firebasestorage.app",
//   messagingSenderId: "1027496688952",
//   appId: "1:1027496688952:web:793d8e7a40080809ba55cd",
//   measurementId: "G-GEJ3S3Q22D"
// // };

// const FIREBASE_CONFIG = {
//   apiKey: "AIzaSyA6O0geJ_6Xnj7e0rgPgXI0vpeBuJXXMg0",
//   authDomain: "first-project-df178.firebaseapp.com",
//   databaseURL: "https://first-project-df178-default-rtdb.firebaseio.com",
//   projectId: "first-project-df178",
//   storageBucket: "first-project-df178.firebasestorage.app",
//   messagingSenderId: "227578117259",
//   appId: "1:227578117259:web:99f1bfb85f8d44ec95288e",
//   measurementId: "G-GKD4JKJ938"
// };


const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAZdQWP1NVDlkRyXAh9ZorTIbVfshOLo7k",
  authDomain: "data-196c9.firebaseapp.com",
  projectId: "data-196c9",
  storageBucket: "data-196c9.firebasestorage.app",
  messagingSenderId: "1047325471659",
  appId: "1:1047325471659:web:a52f980e821c96da0a18ee",
  measurementId: "G-JNPXS8F9QN"
};

// Check if Firebase is already initialized to avoid duplicate initialization
if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded. Make sure to include Firebase scripts before this file.');
} else if (firebase.apps.length === 0) {
    try {
        // Initialize Firebase
        firebase.initializeApp(FIREBASE_CONFIG);
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Error initializing Firebase:', error);
    }
}

// Function to check if Firebase is properly configured
function isFirebaseConfigured() {
    return FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY_HERE" && 
           FIREBASE_CONFIG.databaseURL !== "YOUR_DATABASE_URL_HERE";
}
