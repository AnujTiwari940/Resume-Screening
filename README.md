# Sift - Smart Resume Screening & Candidate Ranking

A modern, AI-powered platform for intelligent resume screening and candidate ranking. Sift leverages keyword matching, skill detection, and scoring algorithms to help recruiters quickly identify the best candidates.

## Landing Page
![image alt](https://github.com/AnujTiwari940/Resume-Screening/blob/4054e5acabf3b6603cb762df657373fe69cd022b/Landing%20Page.png)
## Features

✨ **Smart Resume Screening**
- Upload resumes in PDF, PNG, or JPG format
- Automatic text extraction using Tesseract OCR and PDF.js
- Intelligent keyword extraction from job descriptions
- Real-time candidate ranking based on skill match

🎯 **Skill Matching**
- Extract and detect required skills from job descriptions
- Match candidate resumes against job requirements
- Visual indicators for matched and missing skills
- Percentage-based compatibility scoring

📊 **Candidate Management**
- Add multiple candidates
- View extracted resume text
- Edit candidate information
- Sort and filter results by match percentage

🔐 **Secure & Fast**
- Client-side resume processing (privacy-first)
- No data stored on servers
- Real-time scoring and ranking
- Responsive design for desktop and mobile

## Tech Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **Tesseract.js** - OCR for images
- **PDF.js** - PDF text extraction
- **Custom CSS** - Responsive design with CSS variables

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **MongoDB** - Database (optional, for user accounts)
- **Multer** - File upload handling
- **JWT** - Authentication

### Database
- **MongoDB** - NoSQL database
- **Mongoose** - ODM for MongoDB

## Installation

### Prerequisites
- Node.js >= 16.0.0
- npm >= 8.0.0
- MongoDB (optional, for backend features)

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/AnujTiwari940/sift.git
cd sift
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Create a `.env` file in the root directory:
```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sift
JWT_SECRET=your_jwt_secret_key_here
```

4. **Start the development server**
```bash
# Backend
npm run dev

# Frontend (in another terminal)
npm run dev:frontend
```

The application will be available at `http://localhost:3000`

## Usage

### For Job Seekers / Recruiters
1. Enter a job description in the JD input field
2. Add candidate resumes by:
   - Uploading PDF, PNG, or JPG files
   - Pasting resume text directly
3. Click "Screen Candidates"
4. Review ranked results with matched/missing skills

### For Developers

#### Frontend Development
```bash
cd frontend
npm run dev      # Start Vite dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

#### Backend Development
```bash
cd backend
npm run dev      # Start with nodemon
npm start        # Start normally
```

## Project Structure

```
sift/
├── frontend/
│   ├── App.jsx              # Main React component
│   ├── index.html           # HTML entry point
│   ├── main.jsx             # React entry point
│   ├── styles/              # CSS files
│   └── components/          # Reusable components
│
├── backend/
│   ├── server.js            # Express server setup
│   ├── routes/              # API routes
│   ├── controllers/         # Route handlers
│   ├── middleware/          # Custom middleware
│   └── utils/               # Helper functions
│
├── database/
│   ├── database.js          # Database connection
│   ├── models/              # Mongoose schemas
│   └── seeds/               # Sample data
│
├── README.md
├── package.json
└── .env.example
```

## API Endpoints

### Resume Screening
- `POST /api/screen` - Screen candidates against a job description
- `POST /api/upload` - Upload resume files
- `GET /api/candidates` - Get all candidates

### Authentication (if using backend)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

### Jobs
- `GET /api/jobs` - Get all job postings
- `POST /api/jobs` - Create new job posting
- `PUT /api/jobs/:id` - Update job posting

## Configuration

### Frontend (Vite)
- Dev server: `localhost:5173`
- Build output: `dist/`
- Environment files: `.env`, `.env.production`

### Backend (Express)
- Server port: `5000` (configurable via .env)
- Database: MongoDB (optional)
- File upload limit: 10MB (configurable)

## Supported File Formats

- **PDFs**: .pdf
- **Images**: .png, .jpg, .jpeg

Maximum file size: 10MB

## Performance Considerations

- Resume text extraction happens client-side for privacy
- Large PDFs (50+ pages) may take longer to process
- Scoring algorithm is optimized for up to 100+ candidates
- Real-time updates for responsive user experience

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Code Style

We use ESLint and Prettier for code formatting:
```bash
npm run lint    # Check code style
npm run format  # Format code
```

## Testing

```bash
npm test              # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

## Security

- Resumes are processed client-side and not stored
- No personal data is sent to servers
- JWT tokens for API authentication
- Environment variables for sensitive data
- CORS enabled for specified origins only

## Performance Metrics

- Initial load time: ~2-3 seconds
- Resume processing: ~500ms - 2s per file (depends on size)
- Candidate screening: ~100ms for 10+ candidates
- Search/filter: Real-time, <50ms

## Troubleshooting

### OCR Not Working
- Ensure Tesseract.js is properly loaded
- Check browser console for errors
- Try a different image format

### Resume Extraction Fails
- Verify PDF is not corrupted
- Try uploading as image instead
- Check file size doesn't exceed 10MB

### Port Already in Use
```bash
# Change port in .env
PORT=5001
```

### MongoDB Connection Error
- Ensure MongoDB is running
- Check MONGODB_URI in .env
- Verify database credentials

## Roadmap

- [ ] Advanced filtering and sorting options
- [ ] Batch resume processing
- [ ] Integration with ATS systems
- [ ] Custom scoring algorithms
- [ ] Team collaboration features
- [ ] Analytics dashboard
- [ ] Email notifications
- [ ] API rate limiting

## Acknowledgments

- PDF.js for PDF text extraction
- Tesseract.js for OCR capabilities
- React and Vite communities
- All contributors and users

---

**Made with ❤️ by the Sift Team**
