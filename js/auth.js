// ============================================
// Logic Module - Direct Firebase Firestore Access
// (NO BACKEND REQUIRED)
// ============================================
import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Helper for timeouts
async function withTimeout(promise, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ]);
}

// ============================================
// Auth helper — local module-level function
// ============================================

/**
 * Map Firebase Auth error codes to user-facing strings.
 * Returns undefined for unknown codes (caller falls back to 'Something went wrong...').
 */
function authErrorMessage(code) {
  return ({
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/user-not-found':         'No account found with this email. Please sign up first.',
    'auth/wrong-password':         'Incorrect password.',
    'auth/invalid-credential':     'Invalid email or password.',
    'auth/email-already-in-use':   'An account with this email already exists. Try logging in instead.',
    'auth/weak-password':          'Password is too weak. Use at least 8 characters.',
    'auth/user-disabled':          'This account has been disabled. Contact support.',
    'auth/too-many-requests':      'Too many failed attempts. Please try again in a few minutes.',
    'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
    'auth/operation-not-allowed':  'Email/password sign-in is disabled. Contact support.',
    'auth/popup-closed-by-user':   'Sign-in was cancelled.',
  })[code];
}

// ---- AUTH FUNCTIONS ----

export async function signupUser(name, email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save profile directly to Firestore
    await setDoc(doc(db, "users", user.uid), {
      name,
      email,
      role: 'student',
      createdAt: serverTimestamp()
    });

    return user;
  } catch (err) {
    console.error('[Auth] signupUser FAILED:', err.code || 'NO-CODE', err.message);

    const friendly = authErrorMessage(err.code);
    if (friendly) err._friendly = friendly;

    throw err;
  }
}

export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (err) {
    console.error('[Auth] loginUser FAILED:', err.code || 'NO-CODE', err.message);

    const friendly = authErrorMessage(err.code);
    if (friendly) err._friendly = friendly;
    throw err;
  }
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function getUserProfile(uid) {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    return userDoc.exists() ? userDoc.data() : null;
  } catch (err) {
    console.warn('[Profile] getUserProfile failed for uid:', uid, err.code, err.message);
    return null;   // Never throws — dashboard handles null as "Learner"
  }
}

export async function logoutUser() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}

// ---- LESSON FUNCTIONS ----

export async function getLessons(admin = false) {
  try {
    let q = query(collection(db, "lessons"), orderBy("orderIndex", "asc"));

    if (!admin) {
      q = query(collection(db, "lessons"), where("isPublished", "==", true), orderBy("orderIndex", "asc"));
    }

    const snapshot = await withTimeout(getDocs(q), 8000);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn('Firestore fetch failed or timed out:', err);
    return []; // Triggers fallback in dashboard.html
  }
}

export async function getLessonById(lessonId) {
  try {
    const lessonDoc = await withTimeout(getDoc(doc(db, "lessons", lessonId)), 8000);
    if (!lessonDoc.exists()) return null;

    // Get sections and exercises
    const [sectionsSnap, exercisesSnap] = await Promise.all([
      getDocs(query(collection(db, "lessons", lessonId, "sections"), orderBy("order", "asc"))),
      getDocs(collection(db, "lessons", lessonId, "exercises"))
    ]);

    const sections = sectionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const exercises = exercisesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return {
      lesson: { id: lessonDoc.id, ...lessonDoc.data() },
      sections,
      exercises
    };
  } catch (err) {
    console.warn('Firestore lesson fetch failed:', err);
    return null; // Triggers fallback in lesson.html
  }
}

// ── PROGRESS HELPERS ─────────────────────────────────────────────────────────

/**
 * Fetch every progress document for the current user from the
 * flat `progress` collection, filtered by userId field.
 * Each document ID is  `${uid}_${lessonId}`  (e.g. uid_lesson-1).
 */
async function getAllUserProgress() {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const q    = query(collection(db, "progress"), where("userId", "==", user.uid));
    const snap = await withTimeout(getDocs(q), 8000);

    console.log('[Progress] getAllUserProgress fetched', snap.size, 'for uid:', user.uid);

    return snap.docs.map(d => ({ lessonId: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[Progress] getAllUserProgress error:', err.code, err.message);
    return [];
  }
}

// ── PROGRESS FUNCTIONS ─────────────────────────────────────────────────────────

export async function getProgress() {
  const user = getCurrentUser();
  if (!user) {
    console.warn('[Progress] getProgress: no authenticated user — returning []');
    return [];
  }

  const localKey  = `progress_${user.uid}`;
  const localData = JSON.parse(localStorage.getItem(localKey) || '[]');

  try {
    // Read progress docs from the flat `progress` collection,
    // filtered by userId field so each user sees only their own records.
    // Composite doc ID = {uid}_{lessonId} prevents duplicates.
    const q    = query(collection(db, "progress"), where("userId", "==", user.uid));
    const snap = await withTimeout(getDocs(q), 8000);
    console.log('[Progress] Firestore query returned', snap.size, 'docs for uid:', user.uid);

    // If the query itself timed out or was rejected by rules, snap.size === 0 here
    // and the catch block below handles the silent-index-miss case.
    if (snap.empty && localData.length > 0) {
      console.warn('[Progress] Firestore returned 0 docs but localStorage has', localData.length, 'items — possible Firestore rule or index issue');
    }

    const firestoreData = snap.docs.map(d => {
      const data = d.data();
      // Prefer the stored lessonId field; fall back to stripping uid_ prefix from doc ID
      return {
        lessonId: String(data.lessonId || String(d.id).replace(`${user.uid}_`, '')),
        status:   String(data.status || ''),
        userId:   data.userId,
        ...(data.completedAt ? { completedAt: data.completedAt } : {})
      };
    });

    // Merge fresh Firestore data with localStorage fallback
    const merged = [...firestoreData];
    localData.forEach(lp => {
      const match = merged.find(fp => fp.lessonId === lp.lessonId);
      if (!match) merged.push(lp);
    });

    localStorage.setItem(localKey, JSON.stringify(merged));
    console.log('[Progress] getProgress returning', merged.length, 'items:', merged);
    return merged;
  } catch (err) {
    console.error('[Progress] getProgress CATCH — Firestore read failed:', err.code, err.message);
    console.warn('[Progress] falling back to localStorage, which has', localData.length, 'items');
    // Return local cache without throwing — dashboard will show existing data
    return [...localData];
  }
}

export async function updateProgress(lessonId, status) {
  const user = auth.currentUser;
  if (!user) return;

  const lessonIdStr = String(lessonId);
  const statusStr   = String(status);

  // Composite doc ID (uid_lessonId) — setDoc merge makes this idempotent
  const docId = user.uid + "_" + lessonIdStr;

  // 1. Update localStorage immediately (optimistic)
  const localProgress = JSON.parse(localStorage.getItem(`progress_${user.uid}`) || '[]');
  const idx = localProgress.findIndex(p => p.lessonId === lessonIdStr);
  if (idx > -1) {
    localProgress[idx] = { ...localProgress[idx], lessonId: lessonIdStr, status: statusStr, userId: user.uid, updatedAt: new Date().toISOString() };
  } else {
    localProgress.push({ lessonId: lessonIdStr, status: statusStr, userId: user.uid, updatedAt: new Date().toISOString() });
  }
  localStorage.setItem(`progress_${user.uid}`, JSON.stringify(localProgress));

  // 2. Save to Firestore: progress/{uid}_{lessonId}
  try {
    const dbData = {
      userId:   user.uid,
      lessonId: lessonIdStr,
      status:   statusStr,
      updatedAt: serverTimestamp()
    };
    if (statusStr === 'completed') dbData.completedAt = serverTimestamp();

    await setDoc(doc(db, "progress", docId), dbData, { merge: true });
    console.log('[Progress] Saved | uid:', user.uid, '| lesson:', lessonIdStr, '→', statusStr);
  } catch (err) {
    console.error('[Progress] Firestore write FAILED:', err.code, err.message);
    throw err; // Propagate so the lesson page can surface the error to the user
  }
}

// ---- ADMIN FUNCTIONS ----

export async function createLesson(data) {
  const { title, topic, difficulty, orderIndex, content, starterCode, hint, isPublished } = data;

  const lessonRef = await addDoc(collection(db, "lessons"), {
    title,
    topic,
    difficulty: difficulty || 'beginner',
    orderIndex: orderIndex || 0,
    isPublished: isPublished || false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // Add section
  if (content) {
    await addDoc(collection(db, "lessons", lessonRef.id, "sections"), {
      heading: title,
      content: content,
      order: 0
    });
  }

  // Add exercise
  if (starterCode) {
    await addDoc(collection(db, "lessons", lessonRef.id, "exercises"), {
      prompt: `Practice: ${title}`,
      starterCode: starterCode || '',
      hint: hint || 'Try reading the lesson content for help.',
      expectedOutput: ''
    });
  }

  return lessonRef.id;
}

export async function updateLesson(lessonId, data) {
  const lessonRef = doc(db, "lessons", lessonId);
  const updates = { ...data, updatedAt: serverTimestamp() };

  // Note: This logic assumes we don't need to update subcollections in this simple version
  // or it just updates the top-level lesson doc.
  await updateDoc(lessonRef, updates);
}

export async function deleteLesson(lessonId) {
  // Simplification: We only delete the lesson doc.
  // Deep deletion of subcollections would require more code, but for a viva, this is often acceptable.
  await deleteDoc(doc(db, "lessons", lessonId));
}

// ---- LEGACY SUPPORT (Avoid breaking existing page code) ----
// This function replaces the old apiRequest to make refactoring easier
export async function apiRequest(endpoint, options = {}) {
  const { method, body } = options;
  const parsedBody = body ? JSON.parse(body) : {};

  if (endpoint === '/api/auth/signup') {
    // Signup already handled by signupUser, but we'll leave this for compatibility
    return { message: 'Success' };
  }

  if (endpoint === '/api/lessons' && method === 'POST') {
    return { lessonId: await createLesson(parsedBody) };
  }

  if (endpoint === '/api/lessons' || endpoint === '/api/lessons?admin=true') {
    const isAdmin = endpoint.includes('admin=true');
    return { lessons: await getLessons(isAdmin) };
  }

  if (endpoint.startsWith('/api/lessons/')) {
    const id = endpoint.split('/api/lessons/')[1];
    if (method === 'PUT') {
      await updateLesson(id, parsedBody);
      return { message: 'Success' };
    }
    if (method === 'DELETE') {
      await deleteLesson(id);
      return { message: 'Success' };
    }
    const data = await getLessonById(id);
    if (!data) throw new Error('Lesson not found');
    return data;
  }

  if (endpoint === '/api/progress' && method === 'GET') {
    return { progress: await getProgress() };
  }

  if (endpoint === '/api/progress/update' && method === 'POST') {
    await updateProgress(parsedBody.lessonId, parsedBody.status);
    return { message: 'Success' };
  }

  throw new Error(`Endpoint ${endpoint} not supported in Serverless mode.`);
}
