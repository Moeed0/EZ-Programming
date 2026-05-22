// ============================================
// Auth Routes
// ============================================
import express from 'express';
import { signup, getProfile } from '../controllers/authController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/signup - Create user profile in Firestore
router.post('/signup', signup);

// GET /api/auth/me - Get current user profile (requires auth)
router.get('/me', verifyToken, getProfile);

export default router;
