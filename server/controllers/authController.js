// ============================================
// Auth Controller - Handle user authentication
// ============================================
import { db } from '../config/firebase.js';

/**
 * POST /api/auth/signup
 * Save new user profile to Firestore after Firebase Auth signup
 */
export const signup = async (req, res) => {
  try {
    const { uid, name, email } = req.body;

    if (!uid || !name || !email) {
      return res.status(400).json({ error: 'Missing required fields: uid, name, email' });
    }

    // Save user document in Firestore
    await db.collection('users').doc(uid).set({
      name: name,
      email: email,
      role: 'student',       // Default role
      createdAt: new Date().toISOString()
    });

    res.status(201).json({ message: 'User profile created successfully.' });
  } catch (error) {
    console.error('Signup error:', error.message);
    res.status(500).json({ error: 'Failed to create user profile.' });
  }
};

/**
 * GET /api/auth/me
 * Get current user profile from Firestore
 */
export const getProfile = async (req, res) => {
  try {
    const uid = req.user.uid;
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    res.json({ user: { uid, ...userDoc.data() } });
  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
};
