// ============================================
// Firebase Admin SDK Configuration
// ============================================
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';

// Initialize Firebase Admin only if service account exists
if (existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized with service account.');
} else {
  // Initialize without service account (limited functionality)
  admin.initializeApp({
    projectId: 'ez-programming'
  });
  console.log('Firebase Admin initialized without service account (limited mode).');
}

// Firestore database reference
const db = admin.firestore();

export { admin, db };
