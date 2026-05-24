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
  serverTimestamp,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ---------- timeout helper ----------
function timeoutFn(fn) {
  return new Promise(function(resolve, reject) {
    var timer = setTimeout(function() {
      reject(new Error('[Timeout] Operation took longer than 10 000ms'));
    }, 10000);
    fn().then(function(v) {
      clearTimeout(timer);
      resolve(v);
    }).catch(function(e) {
      clearTimeout(timer);
      reject(e);
    });
  });
}

// ---------- auth error message table ----------
var authErrorMessages = {
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
  'auth/popup-closed-by-user':   'Sign-in was cancelled.'
};

// ============================================
// AUTH FUNCTIONS
// ============================================
export async function signupUser(name, email, password) {
  try {
    var cred  = await createUserWithEmailAndPassword(auth, email, password);
    var user  = cred.user;

    await setDoc(doc(db, "users", user.uid), {
      name:  name,
      email: email,
      role:  'student',
      createdAt: serverTimestamp()
    });

    // Verify the profile was written before returning
    var snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) {
      console.warn('[Auth] Profile write verification failed after signup — retrying once...');
      await new Promise(function(r) { setTimeout(r, 800); });
      snap = await getDoc(doc(db, 'users', user.uid));
      if (!snap.exists()) {
        console.warn('[Auth] Profile still missing after retry — calling createUserProfileIfMissing as final fallback');
        await createUserProfileIfMissing(user.uid);
      } else {
        console.log('[Auth] Profile confirmed on retry for uid:', user.uid);
      }
    } else {
      console.log('[Auth] Profile confirmed for uid:', user.uid);
    }

    return user;
  } catch(err) {
    console.error('[Auth] signupUser FAILED:', err.code || 'NO-CODE', err.message);
    var friendly = authErrorMessages[err.code];
    if (friendly) err._friendly = friendly;
    throw err;
  }
}

export async function loginUser(email, password) {
  try {
    var cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch(err) {
    console.error('[Auth] loginUser FAILED:', err.code || 'NO-CODE', err.message);
    var friendly = authErrorMessages[err.code];
    if (friendly) err._friendly = friendly;
    throw err;
  }
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function getUserProfile(uid) {
  try {
    var snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch(err) {
    console.warn('[Profile] getUserProfile failed for uid:', uid, err.code, err.message);
    return null;
  }
}

/**
 * Read the `role` field from this user's Firestore profile.
 * Returns 'student' if the record is missing.
 */
export async function getUserRole() {
  var uid = getCurrentUser() && getCurrentUser().uid;
  if (!uid) return 'student';
  try {
    var snap = await getDoc(doc(db, 'users', uid));
    var role  = snap.exists() ? String(snap.data().role || '') : '';
    return role === 'admin' ? 'admin' : 'student';
  } catch(_) {
    return 'student';
  }
}

/**
 * Ensure the users/{uid} document exists in Firestore.
 * If it is missing, write a default profile (role = 'student').
 */
export async function createUserProfileIfMissing(uid) {
  try {
    var snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) return snap.data();

    var au    = getCurrentUser();
    var email = au ? au.email : '';
    await setDoc(doc(db, 'users', uid), {
      name:  email ? email.split('@')[0] : 'Learner',
      email: email,
      role:  'student',
      createdAt: serverTimestamp()
    });
    console.log('[Auth] Created missing users/' + uid + ' doc');
    return { name: 'Learner', email: email, role: 'student' };
  } catch(err) {
    console.error('[Auth] createUserProfileIfMissing FAILED for uid:', uid, err.code, err.message);
    return null;
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

// ============================================
// LESSON FUNCTIONS
// ============================================

/**
 * Shared sample-lessons list in plain JS objects.
 */
const _sampleLessons = [
  {id:'lesson-1',title:'Hello World in Python',topic:'Introduction',difficulty:'beginner',orderIndex:1,isPublished:true,isHidden:false},
  {id:'lesson-2',title:'Variables and Data Types',topic:'Basics',difficulty:'beginner',orderIndex:2,isPublished:true,isHidden:false},
  {id:'lesson-3',title:'Conditional Statements',topic:'Control Flow',difficulty:'beginner',orderIndex:3,isPublished:true,isHidden:false},
  {id:'lesson-4',title:'Loops - For and While',topic:'Control Flow',difficulty:'intermediate',orderIndex:4,isPublished:true,isHidden:false},
  {id:'lesson-5',title:'Functions in Python',topic:'Functions',difficulty:'intermediate',orderIndex:5,isPublished:true,isHidden:false},
  {id:'lesson-6',title:'Lists and Tuples',topic:'Data Structures',difficulty:'intermediate',orderIndex:6,isPublished:true,isHidden:false},
  {id:'lesson-7',title:'Dictionaries (Key-Value)',topic:'Data Structures',difficulty:'intermediate',orderIndex:7,isPublished:true,isHidden:false},
  {id:'lesson-8',title:'List Comprehensions',topic:'Advanced Basics',difficulty:'intermediate',orderIndex:8,isPublished:true,isHidden:false},
  {id:'lesson-9',title:'Error Handling (Try/Except)',topic:'Error Handling',difficulty:'intermediate',orderIndex:9,isPublished:true,isHidden:false},
  {id:'lesson-10',title:'File I/O Basics',topic:'File Handling',difficulty:'advanced',orderIndex:10,isPublished:true,isHidden:false}
];

export async function getLessons(admin, defaultLessons) {
  admin = !!admin;
  try {
    var q;
    if (admin) {
      q = query(collection(db, "lessons"), orderBy("orderIndex", "asc"));
    } else {
      q = query(collection(db, "lessons"),
                 where("isPublished", "==", true),
                 where("isHidden",    "==", false),
                 orderBy("orderIndex", "asc"));
    }
    var snap = await timeoutFn(function() { return getDocs(q); });
    var lessons = snap.docs.map(function(d) { return { id: d.id, ...d.data() }; });
    return lessons.length > 0 || (admin && !defaultLessons) ? lessons
         : defaultLessons || _sampleLessons;
  } catch(err) {
    console.warn('Firestore getLessons failed:', err);
    return (defaultLessons || _sampleLessons).slice(0);
  }
}

export async function getLessonById(lessonId) {
  try {
    var docSnap = await timeoutFn(function() { return getDoc(doc(db, "lessons", lessonId)); });
    if (!docSnap.exists()) return null;

    var data = docSnap.data();
    return {
      lesson:    { id: docSnap.id, ...data },
      sections:  Array.isArray(data.sections)  ? data.sections  : [],
      exercises: Array.isArray(data.exercises) ? data.exercises : []
    };
  } catch(err) {
    console.warn('[Lesson] getLessonById failed:', err);
    return null;
  }
}

// ============================================
// PROGRESS FUNCTIONS
// ============================================
/**
 * Read ALL progress docs from Firestore, filter by userId in JavaScript.
 * Returns a plain array of {lessonId, userId, status, ...} objects.
 */
export async function getProgress() {
  var user    = getCurrentUser();
  var uid     = user ? String(user.uid).trim() : '';
  var lKey    = 'progress_' + uid;
  var lData;
  try { lData = JSON.parse(localStorage.getItem(lKey) || '[]'); } catch(_) { lData = []; }

  console.log('[Progress] getProgress START | uid:', uid, '| localData:', lData.length, 'items');

  if (!user) {
    console.warn('[Progress] getProgress: not authenticated — returning []');
    return [];
  }

  try {
    // Read ALL docs from the progress collection (avoids composite-index + query-rule issues)
    var allSnap  = await timeoutFn(function() { return getDocs(collection(db, "progress")); });
    var allCount = allSnap.size;
    var matched  = 0;

    console.log('[Progress] total docs in progress collection:', allCount);

    var mine = [];
    allSnap.forEach(function(docSnap) {
      var docId  = String(docSnap.id);
      var docUid = String(docSnap.get('userId') || '');
      var isMine = docUid === uid;

      if (!isMine && matched === 0 && docUid) {
        console.log('[Progress] non-matching doc | id:', docId, '| stored userId:', docUid, '| expected uid:', uid);
      }
      if (isMine) {
        matched++;
        var data     = docSnap.data();
        var lessonId = String(data.lessonId || docId.replace(uid + '_', ''));
        mine.push({
          lessonId:   lessonId,
          userId:     docUid,
          status:     String(data.status || ''),
          completedAt: data.completedAt || null,
          _docId:     docId
        });
      }
    });

    console.log('[Progress] matched', matched, 'docs for uid:', uid,
                mine.length ? '| lessons:' + mine.map(function(m) { return m.lessonId + ':' + m.status; }).join(', ') : '');

    if (matched === 0 && lData.length > 0) {
      console.warn('[Progress] Firestore 0 but localStorage has', lData.length, 'items — rules or index issue. Using local.');
    }

    // Merge Firestore data with localStorage fallback
    var merged = mine.slice(0);
    lData.forEach(function(lp) {
      var has = merged.find(function(m) { return m.lessonId === lp.lessonId || m._docId === lp.docId; });
      if (!has) merged.push(lp);
    });

    localStorage.setItem(lKey, JSON.stringify(merged));
    console.log('[Progress] getProgress END — returning', merged.length, 'items');
    return merged;
  } catch(err) {
    console.error('[Progress] getProgress CATCH:', err.code || '', err.message);
    return lData.length ? lData.slice(0) : [];
  }
}

export async function updateProgress(lessonId, status) {
  var user = getCurrentUser();
  if (!user) {
    console.warn('[Progress] updateProgress: no authenticated user');
    return;
  }

  var lessonIdStr = String(lessonId);
  var statusStr   = String(status);

  // Composite doc ID — uid_lessonId is unique per user+lesson
  var docId = user.uid + '_' + lessonIdStr;

  // 1. Optimistic write to localStorage
  var localProgress;
  try { localProgress = JSON.parse(localStorage.getItem('progress_' + user.uid) || '[]'); } catch(_) { localProgress = []; }
  var idx = localProgress.findIndex(function(p) { return p.lessonId === lessonIdStr; });
  if (idx > -1) {
    localProgress[idx] = { lessonId: lessonIdStr, status: statusStr, userId: user.uid, updatedAt: new Date().toISOString() };
  } else {
    localProgress.push({ lessonId: lessonIdStr, status: statusStr, userId: user.uid, updatedAt: new Date().toISOString() });
  }
  localStorage.setItem('progress_' + user.uid, JSON.stringify(localProgress));

  // 2. Save to Firestore
  try {
    var dbData = {
      userId:   user.uid,
      lessonId: lessonIdStr,
      status:   statusStr,
      updatedAt: serverTimestamp()
    };
    if (statusStr === 'completed') dbData.completedAt = serverTimestamp();

    await setDoc(doc(db, "progress", docId), dbData, { merge: true });
    console.log('[Progress] updateProgress — saved | doc:', docId, '→', statusStr);
  } catch(err) {
    console.error('[Progress] updateProgress — Firestore write FAILED:', err.code, err.message);
    // restore localStorage to pre-write state so the optimistic UI doesn't lie
    localStorage.setItem('progress_' + user.uid, JSON.stringify(localProgress));
    throw err;
  }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================
export async function createLesson(data) {
  var docRef = await addDoc(collection(db, "lessons"), {
    title:        data.title,
    topic:        data.topic,
    difficulty:   data.difficulty       || 'beginner',
    orderIndex:   data.orderIndex       || 0,
    isPublished:  data.isPublished      || false,
    isHidden:     data.isHidden         || false,
    content:      data.content          || '',
    starterCode:  data.starterCode      || '',
    hint:         data.hint             || '',
    sections:     Array.isArray(data.sections)  ? data.sections  : [],
    exercises:    Array.isArray(data.exercises) ? data.exercises : [],
    createdAt:    serverTimestamp(),
    updatedAt:    serverTimestamp()
  });
  return docRef.id;
}

export async function updateLesson(lessonId, data) {
  await updateDoc(doc(db, "lessons", lessonId), { ...data, updatedAt: serverTimestamp() });
}

/**
 * Migrate: add isHidden:false to any lesson that is missing that field.
 * Idempotent — safe to call multiple times.
 */
export async function backfillIsHiddenOnLessons() {
  var total  = 0;
  var fixed  = 0;
  var BATCH  = 450;
  var snap   = await timeoutFn(function() { return getDocs(collection(db, 'lessons')); });
  var toUpdate = [];
  snap.forEach(function(docSnap) {
    total++;
    if (!docSnap.data().hasOwnProperty('isHidden')) {
      toUpdate.push({ id: docSnap.id, ref: docSnap.ref });
    }
  });
  for (var i = 0; i < toUpdate.length; i += BATCH) {
    var chunk = toUpdate.slice(i, i + BATCH);
    if (chunk.length === 0) break;
    var b = db.batch ? db.batch() : null;
    if (b) {
      chunk.forEach(function(item) { b.update(item.ref, { isHidden: false, updatedAt: serverTimestamp() }); });
      await b.commit();
    } else {
      await Promise.all(chunk.map(function(item) {
        return updateDoc(item.ref, { isHidden: false, updatedAt: serverTimestamp() });
      }));
    }
  }
  fixed = toUpdate.length;
  console.log('[Migration] backfillIsHiddenOnLessons — scanned', total, 'updated', fixed);
  return { scanned: total, updated: fixed };
}

/**
 * Toggle isHidden flag on a lesson.
 * Pass true to hide, false to un-hide.
 */
export async function hideLesson(lessonId, isHidden) {
  await updateDoc(doc(db, "lessons", lessonId), {
    isHidden: !!isHidden,
    updatedAt: serverTimestamp()
  });
}

export async function deleteLesson(lessonId) {
  // 1. Delete the lesson document
  await deleteDoc(doc(db, "lessons", lessonId));
  // 2. Purge every progress record for this lesson across ALL users
  await deleteLessonProgress(lessonId);
}

/**
 * Remove all progress docs whose lessonId field matches `lessonId`.
 * Scans the entire `progress` collection once and deletes in batches of 450.
 */
export async function deleteLessonProgress(lessonId) {
  var lessonIdStr = String(lessonId);
  var snap = await timeoutFn(function() { return getDocs(collection(db, "progress")); });
  var toDelete = [];
  snap.forEach(function(docSnap) {
    var stored = String(docSnap.get('lessonId') || '');
    if (stored === lessonIdStr) toDelete.push(docSnap.ref);
  });
  console.log('[Admin] deleteLessonProgress | deleting', toDelete.length, 'progress docs for lesson:', lessonIdStr);
  // Delete in batches of 450 (Firestore limit per write batch)
  var BATCH = 450;
  for (var i = 0; i < toDelete.length; i += BATCH) {
    var batchArr = toDelete.slice(i, i + BATCH);
    var batch = db.batch ? db.batch() : null;
    if (batch) {
      batchArr.forEach(function(ref) { batch.delete(ref); });
      await batch.commit();
    } else {
      await Promise.all(batchArr.map(function(ref) { return deleteDoc(ref); }));
    }
  }
  console.log('[Admin] deleteLessonProgress DONE — removed', toDelete.length, 'records');
}

// ============================================
// API ROUTER (legacy compatibility)
// ============================================
export async function apiRequest(endpoint, options) {
  options = options || {};
  var method = options.method, body = options.body;
  var parsedBody = body ? JSON.parse(body) : {};

  if (endpoint === '/api/auth/signup')                             return { message: 'Success' };
  if (endpoint === '/api/lessons'        && method === 'POST')     return { lessonId: await createLesson(parsedBody) };
  if (endpoint === '/api/lessons?admin=true') {
    console.log('[API] GET /api/lessons?admin=true  → fetch all lessons');
    return { lessons: await getLessons(true) };
  }
  if (endpoint === '/api/lessons') {
    console.log('[API] GET /api/lessons  → fetch published, visible lessons for regular users');
    return { lessons: await getLessons(false) };
  }
  if (endpoint.indexOf('/api/lessons/') === 0) {
    var id = endpoint.split('/api/lessons/')[1];

    // POST  /api/lessons/{id}  body: {isHidden:true|false}  → toggle visibility
    if (method === 'POST' && typeof parsedBody.isHidden === 'boolean') {
      await hideLesson(id, !!parsedBody.isHidden);
      return { message: 'Success' };
    }

    // DELETE /api/lessons/{id}                         → remove lesson + its progress
    if (method === 'DELETE') { await deleteLesson(id); return { message: 'Success' }; }

    // PUT     /api/lessons/{id}                        → update lesson metadata
    if (method === 'PUT')    { await updateLesson(id, parsedBody); return { message: 'Success' }; }

    // GET     /api/lessons/{id}                        → fetch one lesson
    var ldata = await getLessonById(id);
    if (!ldata) throw new Error('Lesson not found');
    return ldata;
  }

  // ── Progress ─────────────────────────────────────────────────────────────
  // When method is missing (GET) or explicitly === 'GET'
  if (endpoint === '/api/progress' && (!method || method === 'GET')) {
    var progressData = await getProgress();
    return { progress: progressData };
  }

  if (endpoint === '/api/progress/update' && method === 'POST') {
    await updateProgress(parsedBody.lessonId, parsedBody.status);
    return { message: 'Success' };
  }

  throw new Error('Endpoint ' + endpoint + ' not supported in Serverless mode.');
}
