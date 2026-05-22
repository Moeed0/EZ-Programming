// ============================================
// Auth Module - Client-side authentication
// ============================================
import { auth } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const API_BASE = '/api';

/**
 * Sign up a new user with email and password
 */
export async function signupUser(name, email, password) {
  // Create user in Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Save user profile to backend (Firestore)
  await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid: user.uid,
      name: name,
      email: email
    })
  });

  return user;
}

/**
 * Log in an existing user
 */
export async function loginUser(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

/**
 * Log out the current user
 */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * Get the current user's ID token for API calls
 */
export async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken();
}

/**
 * Listen for auth state changes
 */
export function onAuthChange(callback) {
  onAuthStateChanged(auth, callback);
}

/**
 * Get current user object
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Make an authenticated API request
 */
export async function apiRequest(url, options = {}) {
  const token = await getIdToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}
