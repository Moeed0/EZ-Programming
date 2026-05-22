// ============================================
// Progress Routes
// ============================================
import express from 'express';
import { getProgress, updateProgress } from '../controllers/progressController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/progress - Get all progress for logged-in user
router.get('/', verifyToken, getProgress);

// POST /api/progress/update - Update progress for a lesson
router.post('/update', verifyToken, updateProgress);

export default router;
