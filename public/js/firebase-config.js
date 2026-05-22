// ============================================
// Firebase Client-Side Configuration
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCMOBfLbC-BJnOhv5HnQCCh1oxUdEBl93I",
  authDomain: "ez-programming.firebaseapp.com",
  projectId: "ez-programming",
  storageBucket: "ez-programming.firebasestorage.app",
  messagingSenderId: "904672440138",
  appId: "1:904672440138:web:0373f911dedfd3f02cdbb3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

export { app, auth, firestore };
