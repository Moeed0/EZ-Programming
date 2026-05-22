# EZ Programming (GitHub Pages Version)

EZ Programming is a beginner-friendly interactive Python learning platform. This version is designed to run directly on **GitHub Pages** without any backend server.

## 🚀 Live Demo
Once you enable GitHub Pages in your repo settings, your site will be live at:
`https://your-username.github.io/EZ-Programming/`

## 🛠️ How it works
- **Frontend-only**: All logic runs in the browser. 
- **Firebase**: Uses Firebase Firestore directly for database operations and Firebase Auth for user management.
- **Python in Browser**: Powered by Pyodide and Monaco Editor.

## ⚠️ Required Setup: Firebase Security Rules
Since there is no backend, you **must** configure your Firestore Security Rules to allow the frontend to safely read/write data.

Go to **Firebase Console > Firestore > Rules** and paste this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own progress
    match /progress/{docId} {
      allow read, update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
    
    // Anyone can read lessons
    match /lessons/{lessonId} {
      allow read: if true;
      allow write: if request.auth != null; // Allow you to use the Admin panel
    }
    
    match /lessons/{lessonId}/sections/{sectionId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /lessons/{lessonId}/exercises/{exerciseId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // User profiles
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Local Development
Since this uses ES Modules and Firestore, you may need to run a local server to avoid CORS issues:
```bash
# If you have python installed
python -m http.server 3000
```
Then open `http://localhost:3000`.
