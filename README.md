# EZ Programming

EZ Programming is a beginner-friendly interactive Python learning platform, designed to run directly on **GitHub Pages** with **Firebase Auth** + **Firestore** — no backend server required.

## Live Demo

`https://zainasghar294-sudo.github.io/EZ-Programming/`

## Architecture

| Layer | Technology |
|---|---|
| Hosting | GitHub Pages |
| Auth | Firebase Authentication (email / password) |
| Database | Firebase Firestore (progress tracking, lessons CRUD) |
| Code Execution | Pyodide (Python compiled to WebAssembly) |
| Code Editor | Monaco Editor |
| CSS | Custom vanilla CSS (no framework) |

## Project Files

```
index.html          Home / landing page
signup.html         New user registration
login.html          Existing user login
dashboard.html      Lesson browser + progress cards
lesson.html         Lesson reader + code editor
admin.html          Lesson authoring (admin-only)
js/
  auth.js           All Firebase business logic
  firebase-config.js  Firebase SDK initialisation
  navbar.js         Shared navbar / footer / toast components
css/style.css       All styles
firestore.rules     Firestore security rules
```

## Firestore Data Model

```
progress/{uid}_{lessonId}
  ├── userId   string   — UID of the learner
  ├── lessonId string   — e.g. "lesson-1"
  ├── status   string   — "completed" | "in-progress" | ""
  ├── updatedAt timestamp
  └── completedAt timestamp  (only when status === "completed")
```

## Firestore Security Rules

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    // Users
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    // Lessons (public read; admin write)
    match /lessons/{id} {
      allow read, list: if true;
      allow write: delete: if request.auth != null
        && get(/databases/$(db)/documents/users/$(auth.uid)).data.role == 'admin';
    }
    // Progress — user can only access their own docs
    match /progress/{docId} {
      allow list, get: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow update, delete: if request.auth != null
        && request.auth.uid == resource.data.userId;
    }
  }
}
```

## Local Development

```bash
# Python's built-in server avoids ES module CORS issues
python -m http.server 3000
# open http://localhost:3000
```
