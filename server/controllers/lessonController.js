// ============================================
// Lesson Controller - CRUD for lessons
// ============================================
import { db } from '../config/firebase.js';

/**
 * GET /api/lessons
 * Get all published lessons (or all for admin)
 */
export const getLessons = async (req, res) => {
  try {
    const isAdmin = req.query.admin === 'true';
    let query = db.collection('lessons').orderBy('orderIndex', 'asc');

    // Non-admin users only see published lessons
    if (!isAdmin) {
      query = query.where('isPublished', '==', true);
    }

    const snapshot = await query.get();
    const lessons = [];

    snapshot.forEach(doc => {
      lessons.push({ id: doc.id, ...doc.data() });
    });

    res.json({ lessons });
  } catch (error) {
    console.error('Get lessons error:', error.message);
    res.status(500).json({ error: 'Failed to fetch lessons.' });
  }
};

/**
 * GET /api/lessons/:id
 * Get a single lesson with its sections and exercises
 */
export const getLessonById = async (req, res) => {
  try {
    const lessonId = req.params.id;
    const lessonDoc = await db.collection('lessons').doc(lessonId).get();

    if (!lessonDoc.exists) {
      return res.status(404).json({ error: 'Lesson not found.' });
    }

    // Get lesson sections
    const sectionsSnapshot = await db.collection('lessons').doc(lessonId)
      .collection('sections').orderBy('order', 'asc').get();
    const sections = [];
    sectionsSnapshot.forEach(doc => {
      sections.push({ id: doc.id, ...doc.data() });
    });

    // Get lesson exercises
    const exercisesSnapshot = await db.collection('lessons').doc(lessonId)
      .collection('exercises').get();
    const exercises = [];
    exercisesSnapshot.forEach(doc => {
      exercises.push({ id: doc.id, ...doc.data() });
    });

    res.json({
      lesson: { id: lessonDoc.id, ...lessonDoc.data() },
      sections,
      exercises
    });
  } catch (error) {
    console.error('Get lesson error:', error.message);
    res.status(500).json({ error: 'Failed to fetch lesson.' });
  }
};

/**
 * POST /api/lessons
 * Create a new lesson (admin only)
 */
export const createLesson = async (req, res) => {
  try {
    const { title, topic, difficulty, orderIndex, content, starterCode, hint } = req.body;

    if (!title || !topic) {
      return res.status(400).json({ error: 'Title and topic are required.' });
    }

    const lessonData = {
      title,
      topic,
      difficulty: difficulty || 'beginner',
      orderIndex: orderIndex || 0,
      isPublished: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const lessonRef = await db.collection('lessons').add(lessonData);

    // If content is provided, add it as a section
    if (content) {
      await lessonRef.collection('sections').add({
        heading: title,
        content: content,
        order: 0
      });
    }

    // If exercise data is provided, add it
    if (starterCode) {
      await lessonRef.collection('exercises').add({
        prompt: `Practice: ${title}`,
        starterCode: starterCode || '',
        hint: hint || 'Try reading the lesson content for help.',
        expectedOutput: ''
      });
    }

    res.status(201).json({
      message: 'Lesson created successfully.',
      lessonId: lessonRef.id
    });
  } catch (error) {
    console.error('Create lesson error:', error.message);
    res.status(500).json({ error: 'Failed to create lesson.' });
  }
};

/**
 * PUT /api/lessons/:id
 * Update a lesson (admin only)
 */
export const updateLesson = async (req, res) => {
  try {
    const lessonId = req.params.id;
    const updates = req.body;
    updates.updatedAt = new Date().toISOString();

    await db.collection('lessons').doc(lessonId).update(updates);

    res.json({ message: 'Lesson updated successfully.' });
  } catch (error) {
    console.error('Update lesson error:', error.message);
    res.status(500).json({ error: 'Failed to update lesson.' });
  }
};

/**
 * DELETE /api/lessons/:id
 * Delete a lesson (admin only)
 */
export const deleteLesson = async (req, res) => {
  try {
    const lessonId = req.params.id;

    // Delete subcollections first
    const sectionsSnapshot = await db.collection('lessons').doc(lessonId).collection('sections').get();
    const exercisesSnapshot = await db.collection('lessons').doc(lessonId).collection('exercises').get();

    const batch = db.batch();
    sectionsSnapshot.forEach(doc => batch.delete(doc.ref));
    exercisesSnapshot.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('lessons').doc(lessonId));

    await batch.commit();

    res.json({ message: 'Lesson deleted successfully.' });
  } catch (error) {
    console.error('Delete lesson error:', error.message);
    res.status(500).json({ error: 'Failed to delete lesson.' });
  }
};
