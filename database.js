import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * DATABASE CONNECTION
 * Establishes connection to MongoDB
 */
export async function connectDB() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sift';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log('✓ MongoDB connected successfully');
    return mongoose.connection;
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

/**
 * DISCONNECT FROM DATABASE
 */
export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('✓ MongoDB disconnected');
  } catch (error) {
    console.error('✗ Failed to disconnect from MongoDB:', error.message);
  }
}

/**
 * USER SCHEMA
 * Stores user account information
 */
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,
  },
  role: {
    type: String,
    enum: ['recruiter', 'admin', 'user'],
    default: 'recruiter',
  },
  company: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * JOB DESCRIPTION SCHEMA
 * Stores job postings and requirements
 */
const jobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: [true, 'Please provide a job title'],
    trim: true,
    maxlength: [200, 'Job title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    required: [true, 'Please provide a job description'],
  },
  requiredSkills: [{
    type: String,
    trim: true,
  }],
  keywords: [{
    type: String,
    trim: true,
  }],
  status: {
    type: String,
    enum: ['active', 'closed', 'draft'],
    default: 'active',
  },
  department: {
    type: String,
    trim: true,
  },
  location: {
    type: String,
    trim: true,
  },
  salaryRange: {
    min: Number,
    max: Number,
  },
  yearsOfExperience: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * CANDIDATE SCHEMA
 * Stores candidate information and resumes
 */
const candidateSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Please provide candidate name'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
  },
  phone: {
    type: String,
    trim: true,
  },
  resumeText: {
    type: String,
    required: [true, 'Resume text is required'],
  },
  resumeFileName: {
    type: String,
    trim: true,
  },
  resumeUrl: {
    type: String,
  },
  extractedKeywords: [{
    type: String,
    trim: true,
  }],
  skills: [{
    type: String,
    trim: true,
  }],
  matchScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  matchedSkills: [{
    type: String,
    trim: true,
  }],
  missingSkills: [{
    type: String,
    trim: true,
  }],
  rank: {
    type: Number,
  },
  status: {
    type: String,
    enum: ['screened', 'shortlisted', 'rejected', 'pending'],
    default: 'pending',
  },
  feedback: {
    type: String,
  },
  yearsOfExperience: {
    type: Number,
  },
  education: [{
    degree: String,
    field: String,
    institution: String,
    graduationYear: Number,
  }],
  workExperience: [{
    company: String,
    position: String,
    startDate: Date,
    endDate: Date,
    description: String,
  }],
  ratings: {
    technicalSkills: {
      type: Number,
      min: 0,
      max: 5,
    },
    communication: {
      type: Number,
      min: 0,
      max: 5,
    },
    cultureFit: {
      type: Number,
      min: 0,
      max: 5,
    },
  },
  notes: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  screenedAt: {
    type: Date,
  },
});

/**
 * SCREENING SESSION SCHEMA
 * Stores screening results and history
 */
const screeningSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
  },
  candidates: [{
    candidateId: mongoose.Schema.Types.ObjectId,
    matchScore: Number,
    rank: Number,
  }],
  totalCandidates: {
    type: Number,
    default: 0,
  },
  jobDescription: {
    type: String,
  },
  extractedKeywords: [{
    type: String,
  }],
  screeningMethod: {
    type: String,
    enum: ['keyword-match', 'ml-based', 'hybrid'],
    default: 'keyword-match',
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'archived'],
    default: 'completed',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
});

/**
 * ANALYTICS SCHEMA
 * Tracks platform usage and metrics
 */
const analyticsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  eventType: {
    type: String,
    enum: ['resume-uploaded', 'job-created', 'screening-completed', 'candidate-rated', 'export'],
    required: true,
  },
  eventData: mongoose.Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now,
  },
  ipAddress: String,
  userAgent: String,
});

/**
 * Create Mongoose Models
 */
export const User = mongoose.model('User', userSchema);
export const Job = mongoose.model('Job', jobSchema);
export const Candidate = mongoose.model('Candidate', candidateSchema);
export const ScreeningSession = mongoose.model('ScreeningSession', screeningSessionSchema);
export const Analytics = mongoose.model('Analytics', analyticsSchema);

/**
 * DATABASE UTILITY FUNCTIONS
 */

/**
 * Clear all collections (for testing)
 */
export async function clearDatabase() {
  try {
    await User.deleteMany({});
    await Job.deleteMany({});
    await Candidate.deleteMany({});
    await ScreeningSession.deleteMany({});
    await Analytics.deleteMany({});
    console.log('✓ Database cleared');
  } catch (error) {
    console.error('✗ Failed to clear database:', error.message);
  }
}

/**
 * Seed database with sample data
 */
export async function seedDatabase() {
  try {
    // Check if data already exists
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('Database already seeded');
      return;
    }

    // Create sample user
    const user = await User.create({
      name: 'John Recruiter',
      email: 'recruiter@example.com',
      password: 'hashedpassword123',
      role: 'recruiter',
      company: 'Tech Corp',
    });

    // Create sample job
    const job = await Job.create({
      userId: user._id,
      title: 'Senior Backend Engineer',
      description: 'We are looking for an experienced backend engineer with expertise in Python, Django, PostgreSQL, and AWS.',
      requiredSkills: ['Python', 'Django', 'PostgreSQL', 'AWS', 'REST API', 'Docker'],
      department: 'Engineering',
      location: 'San Francisco, CA',
      yearsOfExperience: 5,
    });

    console.log('✓ Database seeded successfully');
  } catch (error) {
    console.error('✗ Failed to seed database:', error.message);
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  try {
    const stats = {
      users: await User.countDocuments(),
      jobs: await Job.countDocuments(),
      candidates: await Candidate.countDocuments(),
      sessions: await ScreeningSession.countDocuments(),
      events: await Analytics.countDocuments(),
    };
    return stats;
  } catch (error) {
    console.error('✗ Failed to get database stats:', error.message);
    return null;
  }
}

export default {
  connectDB,
  disconnectDB,
  clearDatabase,
  seedDatabase,
  getDatabaseStats,
  User,
  Job,
  Candidate,
  ScreeningSession,
  Analytics,
};
