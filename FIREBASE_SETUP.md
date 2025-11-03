# Firebase Setup for Cross-Device Streaming

To enable `viewvideo.html` to work from **anywhere and any device**, you need to set up Firebase Realtime Database.

## Quick Setup Steps

1. **Create a Firebase Project**
   - Go to https://console.firebase.google.com
   - Click "Add project" or select an existing project
   - Follow the setup wizard

2. **Enable Realtime Database**
   - In your Firebase project, go to "Realtime Database" in the left sidebar
   - Click "Create Database"
   - Choose your location
   - Start in **test mode** (for development) or set up proper rules (for production)

3. **Get Your Firebase Configuration**
   - Go to Project Settings (gear icon) → General tab
   - Scroll down to "Your apps" section
   - Click the `</>` (web) icon to add a web app
   - Copy the `firebaseConfig` object

4. **Update the Configuration in Your Code**

   Open `firebase-config.js` and replace the placeholder values:
   
   ```javascript
   const FIREBASE_CONFIG = {
       apiKey: "YOUR_API_KEY_HERE",           // Replace with your actual API key
       authDomain: "YOUR_AUTH_DOMAIN_HERE",   // Replace with your auth domain
       databaseURL: "YOUR_DATABASE_URL_HERE", // Replace with your database URL
       projectId: "YOUR_PROJECT_ID_HERE",     // Replace with your project ID
       storageBucket: "YOUR_STORAGE_BUCKET_HERE", // Replace with your storage bucket
       messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE", // Replace with your sender ID
       appId: "YOUR_APP_ID_HERE"              // Replace with your app ID
   };
   ```
   
   **That's it!** The config file is automatically loaded by both `index.html` and `viewvideo.html`.

5. **Set Database Rules (Important for Security)**
   
   In Firebase Console → Realtime Database → Rules:
   
   For **development/testing**:
   ```json
   {
     "rules": {
       "screenShare": {
         ".read": true,
         ".write": true
       }
     }
   }
   ```
   
   For **production** (more secure):
   ```json
   {
     "rules": {
       "screenShare": {
         ".read": true,
         ".write": true,
         ".validate": "newData.hasChildren(['frameData', 'timestamp'])"
       }
     }
   }
   ```

## How It Works

- **index.html** captures screen sharing frames and sends them to Firebase Realtime Database
- **viewvideo.html** listens to Firebase and displays frames in real-time
- Works across **any device, any network, anywhere** - as long as both devices have internet access
- Falls back to BroadcastChannel if Firebase is not configured (same-device only)

## Benefits

✅ View from any device (phone, tablet, another computer)  
✅ Works across different networks  
✅ Real-time live streaming experience  
✅ Smooth 30fps playback  
✅ No server setup required (Firebase handles it)  

## Fallback Mode

If Firebase is not configured, the app automatically falls back to BroadcastChannel, which only works when:
- Both pages are open in the **same browser**
- On the **same device**

For true cross-device access, Firebase setup is required.

