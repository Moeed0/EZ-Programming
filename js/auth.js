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
    return null;
  }
}

/**
 * Read the `role` field from this user's Firestore profile.
 * Returns 'student' if the record is missing or role is not set.
 * Used to gate admin page access.
 */
export async function getUserRole() {
  const uid = getCurrentUser()?.uid;
  if (!uid) return 'student';
  try {
    const doc    = await getDoc(doc(db, 'users', uid));
    const role   = doc.exists() ? String(doc.data().role || '') : '';
    return role === 'admin' ? 'admin' : 'student';
  } catch {
    return 'student';
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
  const user = getCurrentUser();
  if (!user) return [];

  const uid = String(user.uid).trim();
  try {
    // Fetch ALL progress docs, filter in JS (avoids composite-index + list-rule issues)
    const snap = await withTimeout(getDocs(collection(db, "progress")), 10000);
    const mine = snap.docs
      .filter(d => String(d.get('userId') || '') === uid)
      .map(d => ({ lessonId: d.id, ...d.data() }));

    console.log('[Progress] getAllUserProgress fetched', mine.length, 'docs for uid:', uid,
                '| total in collection:', snap.size);
    return mine;
  } catch (err) {
    console.error('[Progress] getAllUserProgress error:', err.code, err.message);
    return [];
  }
}

// ── PROGRESS FUNCTIONS ─────────────────────────────────────────────────────────

export async function getProgress() {
  const user = getCurrentUser();
  const uid  = user ? String(user.uid).trim() : '';
  const localKey  = 'progress_' + uid;
  const localData = (() => { try { return JSON.parse(localStorage.getItem(localKey) || '[]'); } catch (_) { return []; } })();

  console.log('[Progress] getProgress START | uid:', uid, '| localData:', localData.length, 'items');

  if (!user) {
    console.warn('[Progress] getProgress: not authenticated — returning []');
    return [];
  }

  try {
    // ── Fetch ALL progress docs, filter in JS (no composite index / query rule needed) ──
    const allSnap  = await withTimeout(getDocs(collection(db, "progress")), 10000);
    const allCount = allSnap.size;
    let   matched  = 0;

    console.log('[Progress] getProgress | Firestore TOTAL docs in progress collection:', allCount);

    const mine = [];
    allSnap.forEach(docSnap => {
      const docId   = String(docSnap.id);
      const docUid  = String(docSnap.get('userId') || '');
      const match   = docUid === uid;

      if (!match && matched === 0 && docUid) {
        // Log first non-matching doc to understand the mismatch
        console.log('[Progress] getProgress | non-matching doc | id:', docId, '| stored userId:', docUid, '| expected uid:', uid);
      }

      if (match) {
        matched++;
        const data = docSnap.data();
        const lessonId = String(data.lessonId || docId.replace(uid + '_', ''));
        mine.push({
          lessonId,
          userId:   docUid,
          status:   String(data.status || ''),
          completedAt: data.completedAt || null,
          _docId:   docId
        });
      }
    });

    console.log('[Progress] getProgress | matched', matched, 'docs for uid:', uid,
                mine.length ? '| lessons:' + mine.map(m => m.lessonId + ':' + m.status).join(', ') : '');

    // If Firestore returned 0 for THIS user but localData is non-empty
    if (matched === 0 && localData.length > 0) {
      console.warn('[Progress] getProgress | Firestore 0 but localStorage has',
                   localData.length, 'items — Firestore rule or sync issue. Falling back to local.');
    }

    const merged = [...mine];
    localData.forEach(lp => {
      const has = merged.find(m => m.lessonId === lp.lessonId || m._docId === lp.docId);
      if (!has) merged.push(lp);
    });

    localStorage.setItem(localKey, JSON.stringify(merged));
    console.log('[Progress] getProgress END | returning', merged.length, 'items');
    return merged;
  } catch (err) {
    console.error('[Progress] getProgress CATCH:', err.code || '', err.message);
    return localData.length ? [...localData] : [];
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

  if (endpoint === '/api/progress' && (!method || method === 'GET')) {
    return { progress: await getProgress() };
  }

  if (endpoint === '/api/progress/update' && method === 'POST') {
    await updateProgress(parsedBody.lessonId, parsedBody.status);
    return { message: 'Success' };
  }

  throw new Error(`Endpoint ${endpoint} not supported in Serverless mode.`);
}
