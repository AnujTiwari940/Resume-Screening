import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  connectDB,
  User,
  Job,
  Candidate,
  ScreeningSession,
  Analytics,
  getDatabaseStats,
} from '../database/database.js';

// Configuration
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// File upload configuration
const upload = multer({
  dest: path.join(__dirname, '../uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, PNG, and JPG allowed.'));
    }
  },
});

/**
 * ===============================
 * AUTHENTICATION MIDDLEWARE
 * ===============================
 */

// Generate JWT Token
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

// Verify JWT Token
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * ===============================
 * UTILITY FUNCTIONS
 * ===============================
 */

// Extract keywords from text
function extractKeywords(text) {
  const stopwords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
    'the', 'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they',
    'have', 'had', 'what', 'when', 'where', 'who', 'which', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  ]);

  const words = text.toLowerCase().match(/[a-z][a-z0-9+.#-]{1,}/g) || [];
  const freq = {};
  
  for (const w of words) {
    if (stopwords.has(w) || w.length < 3) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  
  return Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a])
    .slice(0, 50);
}

// Calculate match score
function calculateMatchScore(resumeText, jobKeywords) {
  const lower = resumeText.toLowerCase();
  const matched = jobKeywords.filter(k => lower.includes(k));
  const score = Math.round((matched.length / jobKeywords.length) * 100);
  
  return {
    score: Math.min(100, score),
    matched,
    missing: jobKeywords.filter(k => !matched.includes(k)),
  };
}

// Log analytics event
async function logAnalytics(userId, eventType, eventData) {
  try {
    await Analytics.create({
      userId,
      eventType,
      eventData,
    });
  } catch (error) {
    console.error('Failed to log analytics:', error);
  }
}

/**
 * ===============================
 * AUTHENTICATION ROUTES
 * ===============================
 */

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, company } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      company,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        company: user.company,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        company: user.company,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user
app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ===============================
 * JOB ROUTES
 * ===============================
 */

// Create job
app.post('/api/jobs', verifyToken, async (req, res) => {
  try {
    const { title, description, department, location, yearsOfExperience } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description required' });
    }

    const keywords = extractKeywords(description);
    const job = await Job.create({
      userId: req.userId,
      title,
      description,
      keywords,
      department,
      location,
      yearsOfExperience,
    });

    await logAnalytics(req.userId, 'job-created', { jobId: job._id, title });

    res.status(201).json({ success: true, job });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get jobs
app.get('/api/jobs', verifyToken, async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, jobs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single job
app.get('/api/jobs/:id', verifyToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job || job.userId.toString() !== req.userId.toString()) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update job
app.put('/api/jobs/:id', verifyToken, async (req, res) => {
  try {
    const { title, description, status } = req.body;
    
    const job = await Job.findById(req.params.id);
    if (!job || job.userId.toString() !== req.userId.toString()) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (title) job.title = title;
    if (description) {
      job.description = description;
      job.keywords = extractKeywords(description);
    }
    if (status) job.status = status;
    
    job.updatedAt = new Date();
    await job.save();

    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete job
app.delete('/api/jobs/:id', verifyToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job || job.userId.toString() !== req.userId.toString()) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Delete associated candidates
    await Candidate.deleteMany({ jobId: job._id });

    await Job.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Job deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ===============================
 * RESUME & SCREENING ROUTES
 * ===============================
 */

// Upload and screen resume
app.post('/api/screen/upload', verifyToken, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { candidateName, jobId } = req.body;
    const filePath = req.file.path;

    let resumeText = '';

    // Extract text from PDF
    if (req.file.mimetype === 'application/pdf') {
      const fileBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(fileBuffer);
      resumeText = pdfData.text;
    } else {
      // For images, send back a message that image processing needs Tesseract
      resumeText = '[Image upload detected - OCR required]';
    }

    // Clean up temp file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      resumeText: resumeText.trim(),
      fileName: req.file.originalname,
    });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

// Screen candidates
app.post('/api/screen', verifyToken, async (req, res) => {
  try {
    const { jobId, jobDescription, candidates } = req.body;

    if (!jobDescription || !candidates || candidates.length === 0) {
      return res.status(400).json({ error: 'Job description and candidates required' });
    }

    const keywords = extractKeywords(jobDescription);

    // Score candidates
    const scored = candidates.map((candidate, index) => {
      const { score, matched, missing } = calculateMatchScore(
        candidate.text,
        keywords
      );

      return {
        ...candidate,
        score,
        matched,
        missing,
        rank: index + 1,
      };
    }).sort((a, b) => b.score - a.score);

    // Update ranks
    scored.forEach((candidate, index) => {
      candidate.rank = index + 1;
    });

    // Save screening session
    const session = await ScreeningSession.create({
      userId: req.userId,
      jobId: jobId || null,
      jobDescription,
      extractedKeywords: keywords,
      totalCandidates: candidates.length,
    });

    // Save candidates to database
    const savedCandidates = [];
    for (const candidate of scored) {
      const savedCandidate = await Candidate.create({
        jobId: jobId || null,
        userId: req.userId,
        name: candidate.name,
        resumeText: candidate.text,
        resumeFileName: candidate.fileName || 'resume.txt',
        extractedKeywords: candidate.keywords || [],
        matchScore: candidate.score,
        matchedSkills: candidate.matched,
        missingSkills: candidate.missing,
        rank: candidate.rank,
      });
      savedCandidates.push(savedCandidate);
    }

    await logAnalytics(req.userId, 'screening-completed', {
      sessionId: session._id,
      candidateCount: candidates.length,
    });

    res.json({
      success: true,
      sessionId: session._id,
      keywordsDetected: keywords.length,
      candidates: scored,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get screening results
app.get('/api/screen/session/:sessionId', verifyToken, async (req, res) => {
  try {
    const session = await ScreeningSession.findById(req.params.sessionId);
    
    if (!session || session.userId.toString() !== req.userId.toString()) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const candidates = await Candidate.find({ jobId: session.jobId });

    res.json({
      success: true,
      session,
      candidates: candidates.sort((a, b) => a.rank - b.rank),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ===============================
 * CANDIDATE ROUTES
 * ===============================
 */

// Get candidates for a job
app.get('/api/jobs/:jobId/candidates', verifyToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    
    if (!job || job.userId.toString() !== req.userId.toString()) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const candidates = await Candidate.find({ jobId: req.params.jobId })
      .sort({ rank: 1 });

    res.json({ success: true, candidates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update candidate status
app.put('/api/candidates/:id', verifyToken, async (req, res) => {
  try {
    const { status, feedback, rating } = req.body;

    const candidate = await Candidate.findById(req.params.id);
    
    if (!candidate || candidate.userId.toString() !== req.userId.toString()) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    if (status) candidate.status = status;
    if (feedback) candidate.feedback = feedback;
    if (rating) {
      candidate.ratings = {
        ...candidate.ratings,
        ...rating,
      };
    }

    candidate.updatedAt = new Date();
    await candidate.save();

    if (status) {
      await logAnalytics(req.userId, 'candidate-rated', {
        candidateId: candidate._id,
        status,
      });
    }

    res.json({ success: true, candidate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export candidates
app.post('/api/candidates/export/:jobId', verifyToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    
    if (!job || job.userId.toString() !== req.userId.toString()) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const candidates = await Candidate.find({ jobId: req.params.jobId });

    // Format for export
    const exportData = candidates.map(c => ({
      rank: c.rank,
      name: c.name,
      email: c.email,
      matchScore: c.matchScore + '%',
      status: c.status,
      matchedSkills: c.matchedSkills.join(', '),
      missingSkills: c.missingSkills.join(', '),
    }));

    await logAnalytics(req.userId, 'export', { jobId: req.params.jobId });

    res.json({ success: true, data: exportData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ===============================
 * ANALYTICS & ADMIN ROUTES
 * ===============================
 */

// Get dashboard stats
app.get('/api/stats', verifyToken, async (req, res) => {
  try {
    const jobs = await Job.countDocuments({ userId: req.userId });
    const candidates = await Candidate.countDocuments({ userId: req.userId });
    const sessions = await ScreeningSession.countDocuments({ userId: req.userId });

    const recentScreenings = await ScreeningSession.find({ userId: req.userId })
      .limit(5)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      stats: {
        totalJobs: jobs,
        totalCandidates: candidates,
        totalScreenings: sessions,
        recentScreenings,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get database stats (admin only)
app.get('/api/admin/stats', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const stats = await getDatabaseStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ===============================
 * HEALTH & INFO ROUTES
 * ===============================
 */

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// API info
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Sift API',
    version: '1.0.0',
    description: 'Smart Resume Screening & Candidate Ranking API',
  });
});

/**
 * ===============================
 * ERROR HANDLING
 * ===============================
 */

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
});

/**
 * ===============================
 * SERVER INITIALIZATION
 * ===============================
 */

async function startServer() {
  try {
    // Connect to database
    await connectDB();

    // Start server
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════╗
║  SIFT Server Started             ║
║  ${`http://localhost:${PORT}`.padEnd(29)} ║
║  Environment: ${process.env.NODE_ENV || 'development'.padEnd(20)} ║
╚══════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
