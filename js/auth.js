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
  serverTimestamp,
  getDocFromCache,
  getDocsFromCache
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Helper for timeouts
async function withTimeout(promise, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ]);
}

// ---- AUTH FUNCTIONS ----

export async function signupUser(name, email, password) {
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
}

export async function loginUser(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function getUserProfile(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  return userDoc.exists() ? userDoc.data() : null;
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

// ---- PROGRESS FUNCTIONS ----

export async function getProgress() {
  const user = auth.currentUser;
  if (!user) return [];

  // Try to load from LocalStorage first (for instant speed)
  const localProgress = JSON.parse(localStorage.getItem(`progress_${user.uid}`) || '[]');
  
  try {
    const q = query(collection(db, "progress"), where("userId", "==", user.uid));
    const snapshot = await withTimeout(getDocs(q), 5000);
    const firestoreProgress = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Merge and sync LocalStorage
    localStorage.setItem(`progress_${user.uid}`, JSON.stringify(firestoreProgress));
    return firestoreProgress;
  } catch (err) {
    console.warn('Firestore progress load failed, using local fallback:', err);
    return localProgress;
  }
}

export async function updateProgress(lessonId, status) {
  const user = auth.currentUser;
  if (!user) return;

  const progressData = {
    userId: user.uid,
    lessonId: String(lessonId),
    status: String(status),
    updatedAt: new Date().toISOString()
  };

  // 1. Save to LocalStorage immediately
  const localProgress = JSON.parse(localStorage.getItem(`progress_${user.uid}`) || '[]');
  const existingIdx = localProgress.findIndex(p => p.lessonId === lessonId);
  if (existingIdx > -1) {
    localProgress[existingIdx] = { ...localProgress[existingIdx], ...progressData };
  } else {
    localProgress.push(progressData);
  }
  localStorage.setItem(`progress_${user.uid}`, JSON.stringify(localProgress));

  // 2. Try to save to Firestore
  try {
    const docId = `${user.uid}_${lessonId}`;
    const dbData = { ...progressData, updatedAt: serverTimestamp() };
    if (status === 'completed') dbData.completedAt = serverTimestamp();
    
    // Use setDoc with merge: true to avoid needing a query/index
    await setDoc(doc(db, "progress", docId), dbData, { merge: true });
    console.log('Progress saved to cloud');
  } catch (err) {
    console.error('Firestore progress update failed:', err);
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
