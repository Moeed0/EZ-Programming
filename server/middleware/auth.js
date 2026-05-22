// ============================================
// Auth Middleware - Verify Firebase ID Tokens
// ============================================
import { admin } from '../config/firebase.js';

/**
 * Middleware: Verify that the request has a valid Firebase ID token
 */
export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

/**
 * Middleware: Check if the authenticated user has admin role
 */
export const verifyAdmin = async (req, res, next) => {
  try {
    const { db } = await import('../config/firebase.js');
    const userDoc = await db.collection('users').doc(req.user.uid).get();

    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    next();
  } catch (error) {
    console.error('Admin check failed:', error.message);
    return res.status(500).json({ error: 'Server error during authorization.' });
  }
};
