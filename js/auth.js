// ============================================
// Direct Firebase Firestore Access
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
// AUTH FUNCTIONS
// ============================================

export async function signupUser(name, email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", cred.user.uid), {
      name: name || "Learner",
      email,
      role: "student",
      createdAt: serverTimestamp()
    });

    return cred.user;
  } catch (error) {
    console.error("Signup Error:", error);
    throw error;
  }
}

export async function loginUser(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (error) {
    console.error("Login Error:", error);
    throw error;
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout Error:", error);
    throw error;
  }
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Reset Password Error:", error);
    throw error;
  }
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}

// ============================================
// USER PROFILE
// ============================================

export async function getUserProfile(uid) {
  try {
    if (!uid) return null;
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error("Get User Profile Error:", error);
    return null;
  }
}

export async function createUserProfileIfMissing(uid) {
  try {
    if (!uid) return null;

    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) return snap.data();

    const user = auth.currentUser;
    const profileData = {
      name: user?.email?.split("@")[0] || "Learner",
      email: user?.email || "",
      role: "student",
      createdAt: serverTimestamp()
    };

    await setDoc(userRef, profileData);
    return profileData;
  } catch (error) {
    console.error("Create User Profile Error:", error);
    throw error;
  }
}

// ============================================
// LESSONS - FIXED QUERY
// ============================================

export async function getLessons(admin = false) {
  try {
    let q;

    if (admin) {
      // Admin sees everything (including hidden and unpublished)
      q = query(
        collection(db, "lessons"),
        orderBy("orderIndex", "asc")
      );
    } else {
      // Students: Only published lessons (we'll filter hidden in JS)
      q = query(
        collection(db, "lessons"),
        where("isPublished", "==", true),
        orderBy("orderIndex", "asc")
      );
    }

    const snap = await getDocs(q);
    const lessons = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();

      // For students: skip if explicitly hidden
      if (!admin && data.isHidden === true) {
        return;
      }

      lessons.push({
        id: docSnap.id,
        ...data
      });
    });

    return lessons;

  } catch (error) {
    console.error("Get Lessons Error:", error);
    return [];
  }
}

export async function getLessonById(lessonId) {
  try {
    if (!lessonId) return null;

    const snap = await getDoc(doc(db, "lessons", lessonId));

    if (!snap.exists()) return null;

    const data = snap.data();

    return {
      lesson: {
        id: snap.id,
        ...data
      }
    };
  } catch (error) {
    console.error("Get Lesson Error:", error);
    return null;
  }
}

// ============================================
// CREATE LESSON
// ============================================

export async function createLesson(data) {
  try {
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

    const docRef = await addDoc(collection(db, "lessons"), lessonData);
    return docRef.id;
  } catch (error) {
    console.error("Create Lesson Error:", error);
    throw error;
  }
}

// ============================================
// UPDATE LESSON
// ============================================

export async function updateLesson(lessonId, data) {
  try {
    await updateDoc(doc(db, "lessons", lessonId), {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Update Lesson Error:", error);
    throw error;
  }
}

// ============================================
// HIDE / UNHIDE LESSON
// ============================================

export async function hideLesson(lessonId, isHidden) {
  try {
    await updateDoc(doc(db, "lessons", lessonId), {
      isHidden: !!isHidden,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Hide Lesson Error:", error);
    throw error;
  }
}

// ============================================
// DELETE LESSON
// ============================================

export async function deleteLesson(lessonId) {
  try {
    await deleteDoc(doc(db, "lessons", lessonId));
  } catch (error) {
    console.error("Delete Lesson Error:", error);
    throw error;
  }
}

// ============================================
// PROGRESS
// ============================================

export async function getProgress() {
  try {
    const user = getCurrentUser();
    if (!user) return [];

    const q = query(
      collection(db, "progress"),
      where("userId", "==", user.uid)
    );

    const snap = await getDocs(q);

    return snap.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (error) {
    console.error("Get Progress Error:", error);
    return [];
  }
}

export async function updateProgress(lessonId, status) {
  try {
    const user = getCurrentUser();
    if (!user) throw new Error("User not logged in");
    if (!lessonId) throw new Error("lessonId is required");

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

    // Optional: trigger refresh
    try {
      localStorage.setItem('progress_updated', Date.now().toString());
    } catch (e) { }

    return true;
  } catch (error) {
    console.error("Update Progress Error:", error);
    throw error;
  }
}

// ============================================
// BACKFILL isHidden FIELD (Run once)
// ============================================

export async function backfillIsHiddenOnLessons() {
  try {
    const snap = await getDocs(collection(db, "lessons"));
    let updated = 0;

    for (const lessonDoc of snap.docs) {
      const data = lessonDoc.data();
      if (data.isHidden === undefined) {
        await updateDoc(lessonDoc.ref, { isHidden: false });
        updated++;
      }
    }

    console.log(`Backfill complete. Updated ${updated} lessons.`);
    return { scanned: snap.size, updated };
  } catch (error) {
    console.error("Backfill Error:", error);
    throw error;
  }
}

// ============================================
// API ROUTER
// ============================================

export async function apiRequest(endpoint, options = {}) {
  try {
    const method = options.method || "GET";
    let body = {};

    if (options.body) {
      try {
        body = JSON.parse(options.body);
      } catch (e) {
        console.warn("Invalid JSON body");
      }
    }

    // LESSONS
    if (endpoint === '/api/lessons' && method === 'GET') {
      return { lessons: await getLessons(false) };
    }

    if (endpoint === '/api/lessons?admin=true') {
      return { lessons: await getLessons(true) };
    }

    if (endpoint === '/api/lessons' && method === 'POST') {
      const lessonId = await createLesson(body);
      return { success: true, lessonId };
    }

    // LESSON BY ID
    if (endpoint.startsWith('/api/lessons/')) {
      const lessonId = endpoint.replace('/api/lessons/', '');

      if (method === 'GET') {
        const lesson = await getLessonById(lessonId);
        if (!lesson) throw new Error("Lesson not found");
        return lesson;
      }

      if (method === 'PUT') {
        await updateLesson(lessonId, body);
        return { success: true };
      }

      if (method === 'DELETE') {
        await deleteLesson(lessonId);
        return { success: true };
      }

      if (method === 'POST') {
        await hideLesson(lessonId, body.isHidden);
        return { success: true };
      }
    }

    // PROGRESS
    if (endpoint === '/api/progress' && method === 'GET') {
      return { progress: await getProgress() };
    }

    if (endpoint === '/api/progress/update' && method === 'POST') {
      await updateProgress(body.lessonId, body.status);
      return { success: true };
    }

    throw new Error(`Unsupported endpoint: ${endpoint}`);

  } catch (error) {
    console.error("API Request Error:", endpoint, error);
    throw error;
  }
}