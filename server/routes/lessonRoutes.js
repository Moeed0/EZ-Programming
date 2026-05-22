// ============================================
// Lesson Routes
// ============================================
import express from 'express';
import {
  getLessons,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson
} from '../controllers/lessonController.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/lessons - Get all lessons (public)
router.get('/', getLessons);

// GET /api/lessons/:id - Get single lesson with sections and exercises
router.get('/:id', getLessonById);

// POST /api/lessons - Create a lesson (admin only)
router.post('/', verifyToken, verifyAdmin, createLesson);

// PUT /api/lessons/:id - Update a lesson (admin only)
router.put('/:id', verifyToken, verifyAdmin, updateLesson);

// DELETE /api/lessons/:id - Delete a lesson (admin only)
router.delete('/:id', verifyToken, verifyAdmin, deleteLesson);

export default router;
