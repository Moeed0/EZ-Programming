// ============================================
// Logic Module - Direct Firebase Firestore Access
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
  serverTimestamp,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ============================================
// AUTH
// ============================================

export async function signupUser(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  await setDoc(doc(db, "users", cred.user.uid), {
    name,
    email,
    role: "student",
    createdAt: serverTimestamp()
  });

  return cred.user;
}

export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logoutUser() {
  await signOut(auth);
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export function onAuthChange(callback) {
  onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}

// ============================================
// USER PROFILE
// ============================================

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function createUserProfileIfMissing(uid) {
  const snap = await getDoc(doc(db, "users", uid));

  if (snap.exists()) {
    return snap.data();
  }

  const user = auth.currentUser;

  await setDoc(doc(db, "users", uid), {
    name: user?.email?.split('@')[0] || "Learner",
    email: user?.email || "",
    role: "student",
    createdAt: serverTimestamp()
  });

  return {
    role: "student"
  };
}

// ============================================
// LESSONS
// ============================================

export async function getLessons(admin = false) {

  let q;

  if (admin) {
    q = query(
      collection(db, "lessons"),
      orderBy("orderIndex", "asc")
    );
  } else {
    q = query(
      collection(db, "lessons"),
      where("isPublished", "==", true),
      where("isHidden", "==", false),
      orderBy("orderIndex", "asc")
    );
  }

  const snap = await getDocs(q);

  return snap.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

export async function getLessonById(lessonId) {

  const snap = await getDoc(doc(db, "lessons", lessonId));

  if (!snap.exists()) {
    return null;
  }

  const data = snap.data();

  return {
    lesson: {
      id: snap.id,
      ...data
    }
  };
}

// ============================================
// CREATE LESSON
// ============================================

export async function createLesson(data) {

  const lessonData = {
    title: data.title || "",
    topic: data.topic || "",
    difficulty: data.difficulty || "beginner",
    orderIndex: Number(data.orderIndex || 0),

    isPublished: !!data.isPublished,
    isHidden: !!data.isHidden,

    content: data.content || "",
    starterCode: data.starterCode || "",
    hint: data.hint || "",

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(
    collection(db, "lessons"),
    lessonData
  );

  return docRef.id;
}

// ============================================
// UPDATE LESSON
// ============================================

export async function updateLesson(lessonId, data) {

  await updateDoc(doc(db, "lessons", lessonId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

// ============================================
// HIDE LESSON
// ============================================

export async function hideLesson(lessonId, isHidden) {

  await updateDoc(doc(db, "lessons", lessonId), {
    isHidden: !!isHidden,
    updatedAt: serverTimestamp()
  });
}

// ============================================
// DELETE LESSON
// ============================================

export async function deleteLesson(lessonId) {

  await deleteDoc(doc(db, "lessons", lessonId));
}

// ============================================
// PROGRESS
// ============================================

export async function getProgress() {

  const user = getCurrentUser();

  if (!user) {
    return [];
  }

  const snap = await getDocs(collection(db, "progress"));

  const results = [];

  snap.forEach(docSnap => {

    const data = docSnap.data();

    if (data.userId === user.uid) {
      results.push({
        id: docSnap.id,
        ...data
      });
    }
  });

  return results;
}

export async function updateProgress(lessonId, status) {

  const user = getCurrentUser();

  if (!user) {
    return;
  }

  const progressId = `${user.uid}_${lessonId}`;

  await setDoc(
    doc(db, "progress", progressId),
    {
      userId: user.uid,
      lessonId,
      status,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

// ============================================
// BACKFILL
// ============================================

export async function backfillIsHiddenOnLessons() {

  const snap = await getDocs(collection(db, "lessons"));

  let updated = 0;

  for (const lessonDoc of snap.docs) {

    const data = lessonDoc.data();

    if (data.isHidden === undefined) {

      await updateDoc(lessonDoc.ref, {
        isHidden: false
      });

      updated++;
    }
  }

  return {
    scanned: snap.size,
    updated
  };
}

// ============================================
// API ROUTER
// ============================================

export async function apiRequest(endpoint, options = {}) {

  const method = options.method || "GET";

  const body = options.body
    ? JSON.parse(options.body)
    : {};

  // ========================================
  // LESSONS
  // ========================================

  if (endpoint === '/api/lessons' && method === 'GET') {

    return {
      lessons: await getLessons(false)
    };
  }

  if (endpoint === '/api/lessons?admin=true') {

    return {
      lessons: await getLessons(true)
    };
  }

  if (endpoint === '/api/lessons' && method === 'POST') {

    const lessonId = await createLesson(body);

    return {
      lessonId
    };
  }

  // ========================================
  // LESSON BY ID
  // ========================================

  if (endpoint.startsWith('/api/lessons/')) {

    const lessonId = endpoint.split('/api/lessons/')[1];

    // GET
    if (method === 'GET') {

      return await getLessonById(lessonId);
    }

    // PUT
    if (method === 'PUT') {

      await updateLesson(lessonId, body);

      return {
        success: true
      };
    }

    // DELETE
    if (method === 'DELETE') {

      await deleteLesson(lessonId);

      return {
        success: true
      };
    }

    // POST = hide/unhide
    if (method === 'POST') {

      await hideLesson(lessonId, body.isHidden);

      return {
        success: true
      };
    }
  }

  // ========================================
  // PROGRESS
  // ========================================

  if (endpoint === '/api/progress') {

    return {
      progress: await getProgress()
    };
  }

  if (endpoint === '/api/progress/update' && method === 'POST') {

    await updateProgress(body.lessonId, body.status);

    return {
      success: true
    };
  }

  throw new Error(`Unsupported endpoint: ${endpoint}`);
}