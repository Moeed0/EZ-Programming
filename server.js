// ============================================
// EZ Programming - Main Express Server
// ============================================
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './server/routes/authRoutes.js';
import lessonRoutes from './server/routes/lessonRoutes.js';
import progressRoutes from './server/routes/progressRoutes.js';

// Load environment variables
dotenv.config();

// __dirname workaround for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Middleware ----
app.use(cors());
app.use(express.json());

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// ---- API Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/progress', progressRoutes);

// ---- Fallback: serve index.html for unknown routes ----
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- Start Server ----
app.listen(PORT, () => {
  console.log(`EZ Programming server running at http://localhost:${PORT}`);
});
