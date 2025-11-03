# Deployment to Render.com Guide

This guide will help you deploy your Screen Sharing app to Render and make it work on **any device, anywhere**.

## Prerequisites

1. A GitHub account
2. A Firebase account (free tier available)
3. A Render account (free tier available)

## Step 1: Set Up Firebase

### 1.1 Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click **"Add project"** or select an existing project
3. Follow the setup wizard (disable Google Analytics if you want)

### 1.2 Enable Realtime Database

1. In your Firebase project, go to **"Realtime Database"** in the left sidebar
2. Click **"Create Database"**
3. Choose your preferred location (closest to your users)
4. Select **"Start in test mode"** (we'll secure it later)

### 1.3 Get Firebase Configuration

1. Go to **Project Settings** (gear icon) → **General** tab
2. Scroll down to **"Your apps"** section
3. Click the `</>` (web) icon to add a web app
4. Register app (you can skip hosting setup)
5. Copy the `firebaseConfig` object that appears

### 1.4 Set Database Rules

Go to **Realtime Database** → **Rules** tab and paste:

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

Click **"Publish"**.

## Step 2: Configure Firebase in Your Code

1. Open `firebase-config.js` in your project
2. Replace all the placeholder values with your actual Firebase config:

```javascript
const FIREBASE_CONFIG = {
    apiKey: "AIzaSy...your-actual-key",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};
```

3. **Save the file**

## Step 3: Push to GitHub

1. Initialize git (if not already done):
```bash
git init
git add .
git commit -m "Initial commit - Screen Sharing App"
```

2. Create a new repository on GitHub:
   - Go to https://github.com/new
   - Name it (e.g., "screen-sharing-app")
   - **Don't** initialize with README
   - Click "Create repository"

3. Push your code:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## Step 4: Deploy to Render

### 4.1 Create New Static Site

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Static Site"**
3. Connect your GitHub account if not already connected
4. Select your repository

### 4.2 Configure Deployment

- **Name**: `screen-sharing-app` (or your preferred name)
- **Branch**: `main` (or your default branch)
- **Root Directory**: `/` (leave empty if root)
- **Build Command**: Leave empty (no build needed)
- **Publish Directory**: Leave empty

### 4.3 Deploy

1. Click **"Create Static Site"**
2. Render will automatically deploy your site
3. Wait for deployment to complete (usually 1-2 minutes)

### 4.4 Get Your Live URL

Once deployed, you'll get a URL like:
`https://your-app-name.onrender.com`

## Step 5: Test Cross-Device Functionality

1. **Open the main app** on one device:
   - Go to `https://your-app-name.onrender.com/index.html`
   - Click "Start Sharing"
   - Allow screen sharing permissions

2. **Open viewvideo.html on another device** (phone, tablet, different computer):
   - Go to `https://your-app-name.onrender.com/viewvideo.html`
   - You should see the live stream! 🎉

## Important Notes

### Security

- The database rules allow public read/write for the `screenShare` path
- For production, consider adding authentication or restricting access
- Firebase free tier has generous limits for small-medium usage

### HTTPS Requirement

- Render automatically provides HTTPS
- Screen sharing **requires HTTPS** to work in modern browsers
- This is automatically handled by Render

### Custom Domain (Optional)

1. In Render dashboard → Your static site → Settings
2. Add your custom domain
3. Follow Render's DNS instructions

## Troubleshooting

### Firebase Not Working

- Check browser console for errors
- Verify `firebase-config.js` has correct values
- Ensure Firebase Realtime Database is enabled
- Check database rules allow read/write

### Stream Not Showing

- Make sure screen sharing is started on index.html
- Check that Firebase is configured correctly
- Look for errors in browser console (F12)
- Try refreshing viewvideo.html

### Deployment Issues

- Check Render build logs
- Ensure all files are committed to GitHub
- Verify `firebase-config.js` is in the repository

## Files Included

- `index.html` - Main screen sharing interface
- `viewvideo.html` - Video viewer page (works on any device)
- `firebase-config.js` - Firebase configuration (update with your credentials)
- `script.js` - Main application logic
- `styles.css` - Styling
- `sw.js` - Service worker (optional)

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify Firebase configuration
3. Check Render deployment logs
4. Ensure all files are properly deployed

---

**Your app is now live and accessible from anywhere! 🚀**

Share the `viewvideo.html` URL with anyone to let them view your screen share in real-time!

