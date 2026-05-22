// ============================================
// Progress Controller - Track user lesson progress
// ============================================
import { db } from '../config/firebase.js';

/**
 * GET /api/progress
 * Get all progress records for the logged-in user
 */
export const getProgress = async (req, res) => {
  try {
    const uid = req.user.uid;

    const snapshot = await db.collection('progress')
      .where('userId', '==', uid)
      .get();

    const progress = [];
    snapshot.forEach(doc => {
      progress.push({ id: doc.id, ...doc.data() });
    });

    res.json({ progress });
  } catch (error) {
    console.error('Get progress error:', error.message);
    res.status(500).json({ error: 'Failed to fetch progress.' });
  }
};

/**
 * POST /api/progress/update
 * Create or update progress for a specific lesson
 */
export const updateProgress = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { lessonId, status } = req.body;

    if (!lessonId || !status) {
      return res.status(400).json({ error: 'lessonId and status are required.' });
    }

    // Check if progress record already exists
    const existingSnapshot = await db.collection('progress')
      .where('userId', '==', uid)
      .where('lessonId', '==', lessonId)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      // Update existing progress
      const docRef = existingSnapshot.docs[0].ref;
      const updateData = {
        status,
        updatedAt: new Date().toISOString()
      };

      // Set completedAt only when marking as completed
      if (status === 'completed') {
        updateData.completedAt = new Date().toISOString();
      }

      await docRef.update(updateData);
    } else {
      // Create new progress record
      await db.collection('progress').add({
        userId: uid,
        lessonId,
        status,
        startedAt: new Date().toISOString(),
        completedAt: status === 'completed' ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      });
    }

    res.json({ message: 'Progress updated successfully.' });
  } catch (error) {
    console.error('Update progress error:', error.message);
    res.status(500).json({ error: 'Failed to update progress.' });
  }
};
