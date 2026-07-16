import React, { useState, useCallback, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * ===============================
 * CONSTANTS & CONFIG
 * ===============================
 */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
  'the', 'to', 'was', 'will', 'with', 'this', 'but', 'they', 'have',
  'had', 'what', 'when', 'where', 'who', 'which', 'why', 'how', 'all',
  'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
]);

const SEED_JD = `We are seeking a Senior Backend Engineer to join our team. The ideal candidate will have:
- 5+ years of experience with Python and Django
- Strong expertise in PostgreSQL and SQL query optimization
- Experience with AWS (EC2, S3, Lambda)
- REST API design and development
- Docker and containerization
- CI/CD pipeline experience with GitHub Actions
- Experience mentoring junior engineers
- Strong communication and problem-solving skills`;

const SEED_CANDIDATES = [
  {
    name: 'Priya Iyer',
    text: `Backend engineer with 5 years of experience building services in Python and Django. Deep experience with PostgreSQL and general SQL query optimization. Deployed and maintained services on AWS including EC2, S3, and Lambda. Built REST APIs consumed by mobile and web clients. Wrote unit tests and maintained CI/CD pipelines with GitHub Actions. Mentored two junior engineers.`,
  },
  {
    name: 'Michael Adeyemi',
    text: `Software engineer with 4 years experience in Python, primarily using Flask. Comfortable with SQL and has used AWS S3 and EC2 for deployments. Familiar with Docker for containerizing services. Some exposure to Kafka for event streaming. Has written REST APIs and unit tests, limited CI/CD experience.`,
  },
  {
    name: 'Rachel Fontaine',
    text: `Full stack developer with 2 years experience, mostly frontend React work. Basic SQL knowledge from small projects. Some exposure to Docker. Has not worked with AWS in production. No experience with Python backend frameworks like Django or Flask. Comfortable with git and agile workflows.`,
  },
];

/**
 * ===============================
 * UTILITY FUNCTIONS
 * ===============================
 */

function extractKeywords(text) {
  const words = text.toLowerCase().match(/[a-z][a-z0-9+.#-]{1,}/g) || [];
  const freq = {};
  for (const w of words) {
    if (STOPWORDS.has(w) || w.length < 3) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  return Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 20);
}

async function extractPdfText(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(' ') + '\n';
  }
  return text;
}

async function extractImageText(file) {
  const { data } = await Tesseract.recognize(file, 'eng');
  return data.text;
}

/**
 * ===============================
 * MAIN APP COMPONENT
 * ===============================
 */

export default function App() {
  const [candidates, setCandidates] = useState(
    SEED_CANDIDATES.map(c => ({ ...c, fileName: '', status: 'ok', showText: false }))
  );
  const [jdInput, setJdInput] = useState(SEED_JD);
  const [results, setResults] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  // Update keywords when JD changes
  useEffect(() => {
    const kws = extractKeywords(jdInput);
    setKeywords(kws);
  }, [jdInput]);

  // Handle file upload
  const handleFileUpload = useCallback(async (index, file) => {
    if (!file) return;

    const newCandidates = [...candidates];
    newCandidates[index].fileName = file.name;
    newCandidates[index].status = 'busy';
    newCandidates[index].showText = false;

    if (!newCandidates[index].name || newCandidates[index].name.startsWith('Candidate ')) {
      newCandidates[index].name = file.name
        .replace(/\.(pdf|png|jpe?g)$/i, '')
        .replace(/[_-]+/g, ' ');
    }
    setCandidates(newCandidates);

    try {
      let text = '';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        text = await extractPdfText(file);
      } else {
        text = await extractImageText(file);
      }

      text = text.trim();
      if (!text) {
        newCandidates[index].status = 'err';
      } else {
        newCandidates[index].text = text;
        newCandidates[index].status = 'ok';
      }
    } catch (err) {
      console.error('File processing error:', err);
      newCandidates[index].status = 'err';
    }
    setCandidates(newCandidates);
  }, [candidates]);

  // Toggle resume text visibility
  const toggleResumeText = useCallback((index) => {
    const newCandidates = [...candidates];
    newCandidates[index].showText = !newCandidates[index].showText;
    setCandidates(newCandidates);
  }, [candidates]);

  // Add candidate
  const addCandidate = useCallback(() => {
    setCandidates([
      ...candidates,
      { name: `Candidate ${candidates.length + 1}`, text: '', fileName: '', status: '', showText: false },
    ]);
  }, [candidates]);

  // Remove candidate
  const removeCandidate = useCallback((index) => {
    setCandidates(candidates.filter((_, i) => i !== index));
  }, [candidates]);

  // Run screening
  const runScreening = useCallback(() => {
    setLoading(true);
    
    const valid = candidates.filter(c => c.text.trim().length > 0);
    if (!jdInput.trim() || valid.length === 0) {
      alert('Please add a job description and at least one candidate resume');
      setLoading(false);
      return;
    }

    const jdKeywords = extractKeywords(jdInput);

    const scored = valid
      .map((c, i) => {
        const lower = c.text.toLowerCase();
        const matched = jdKeywords.filter(k => lower.includes(k));
        const missing = jdKeywords.filter(k => !lower.includes(k));
        const score = Math.round((matched.length / jdKeywords.length) * 100);
        return { name: c.name, score, matched, missing, index: i };
      })
      .sort((a, b) => b.score - a.score);

    scored.forEach((s, i) => {
      s.rank = i + 1;
    });

    setResults({
      candidates: scored,
      keywordsCount: jdKeywords.length,
      candidatesCount: valid.length,
    });

    setTimeout(() => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    setLoading(false);
  }, [candidates, jdInput]);

  return (
    <div className="app">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === 'home' && (
        <>
          <HeroSection />
          <HowItWorks />
        </>
      )}

      {(activeTab === 'tool' || activeTab === 'home') && (
        <ScreeningTool
          jdInput={jdInput}
          setJdInput={setJdInput}
          keywords={keywords}
          candidates={candidates}
          onAddCandidate={addCandidate}
          onRemoveCandidate={removeCandidate}
          onToggleText={toggleResumeText}
          onFileUpload={handleFileUpload}
          onRunScreening={runScreening}
          loading={loading}
          results={results}
        />
      )}

      {results && <ResultsSection results={results} />}

      <Footer />
      <Styles />
    </div>
  );
}

/**
 * ===============================
 * NAVIGATION COMPONENT
 * ===============================
 */

function Navigation({ activeTab, setActiveTab }) {
  return (
    <nav className="nav">
      <div className="nav-brand">
        <div className="brand-mark">S</div>
        <span className="brand-name">Sift</span>
      </div>
      <div className="nav-links">
        <button
          className={`nav-link ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          Home
        </button>
        <button
          className={`nav-link ${activeTab === 'tool' ? 'active' : ''}`}
          onClick={() => setActiveTab('tool')}
        >
          Tool
        </button>
        <button className="nav-cta">Start Free</button>
      </div>
    </nav>
  );
}

/**
 * ===============================
 * HERO SECTION
 * ===============================
 */

function HeroSection() {
  return (
    <header className="hero">
      <div className="hero-content">
        <span className="eyebrow">SMART HIRING</span>
        <h1 className="headline">
          Screen resumes <em>instantly</em>, find the <em>perfect</em> match
        </h1>
        <p className="sub">
          Sift uses intelligent keyword matching to rank candidates by skill fit. Upload resumes,
          paste a job description, and get ranked results in seconds.
        </p>
        <div className="hero-actions">
          <button className="btn-primary">Get Started →</button>
          <button className="btn-ghost">View Demo</button>
        </div>
      </div>

      <div className="stack">
        <div className="folder f1">
          <div className="tab">candidate.pdf</div>
          <div className="name">Priya Iyer</div>
          <div className="role">Backend Engineer</div>
          <div className="score-stamp">
            <b>92%</b>
            <span>MATCH</span>
          </div>
          <div className="tags">
            <span>Python</span>
            <span>Django</span>
            <span>PostgreSQL</span>
            <span>AWS</span>
          </div>
        </div>

        <div className="folder f2">
          <div className="tab">resume.pdf</div>
          <div className="name">Michael Adeyemi</div>
          <div className="role">Software Engineer</div>
          <div className="score-stamp">
            <b>67%</b>
            <span>MATCH</span>
          </div>
          <div className="tags">
            <span>Python</span>
            <span>Flask</span>
            <span>Docker</span>
          </div>
        </div>

        <div className="folder f3">
          <div className="tab">cv.pdf</div>
          <div className="name">Rachel Fontaine</div>
          <div className="role">Full Stack Dev</div>
          <div className="score-stamp">
            <b>38%</b>
            <span>MATCH</span>
          </div>
          <div className="tags">
            <span>React</span>
            <span>Git</span>
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * ===============================
 * HOW IT WORKS SECTION
 * ===============================
 */

function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Add Job Description',
      desc: 'Paste a job description and Sift extracts key skills and requirements automatically.',
    },
    {
      num: '02',
      title: 'Upload Resumes',
      desc: 'Drop PDF, PNG, or JPG resumes. Sift reads and extracts text from each candidate file.',
    },
    {
      num: '03',
      title: 'Get Ranked Results',
      desc: 'Candidates are scored and ranked by skill match. See matched and missing skills instantly.',
    },
  ];

  return (
    <section className="section">
      <div className="section-head">
        <span className="eyebrow">HOW IT WORKS</span>
        <h2>Three simple steps to better hiring</h2>
        <p>Sift makes resume screening fast, fair, and data-driven.</p>
      </div>

      <div className="steps">
        {steps.map(step => (
          <div key={step.num} className="step">
            <div className="num">{step.num}</div>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * ===============================
 * SCREENING TOOL COMPONENT
 * ===============================
 */

function ScreeningTool({
  jdInput,
  setJdInput,
  keywords,
  candidates,
  onAddCandidate,
  onRemoveCandidate,
  onToggleText,
  onFileUpload,
  onRunScreening,
  loading,
  results,
}) {
  return (
    <section className="section">
      <div className="tool-wrap">
        <div className="tool-grid">
          {/* Left Column: Job Description */}
          <div>
            <div className="field-label">
              <span className="t">Job Description</span>
              <span className="c" id="jd-count">
                {keywords.length} skills detected
              </span>
            </div>
            <textarea
              id="jd-input"
              value={jdInput}
              onChange={e => setJdInput(e.target.value)}
              placeholder="Paste a job description here..."
            />
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#9AA0AC' }}>
              Keywords detected: {keywords.slice(0, 5).join(', ')}
              {keywords.length > 5 && `... +${keywords.length - 5} more`}
            </div>
          </div>

          {/* Right Column: Resumes */}
          <div>
            <div className="field-label">
              <span className="t">Add Resumes</span>
              <span className="c" id="cand-count">
                {candidates.filter(c => c.text.trim().length > 0).length} added
              </span>
            </div>
            <div id="resume-list">
              {candidates.map((candidate, i) => (
                <CandidateBlock
                  key={i}
                  index={i}
                  candidate={candidate}
                  onFileUpload={onFileUpload}
                  onToggleText={onToggleText}
                  onRemove={onRemoveCandidate}
                />
              ))}
            </div>
            <button className="add-candidate" onClick={onAddCandidate}>
              + Add another candidate
            </button>
          </div>
        </div>

        <div style={{ marginTop: '28px' }}>
          <button
            className="btn-primary"
            onClick={onRunScreening}
            disabled={loading}
            style={{ width: '100%', padding: '16px' }}
          >
            {loading ? 'Screening...' : 'Screen Candidates →'}
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * ===============================
 * CANDIDATE BLOCK COMPONENT
 * ===============================
 */

function CandidateBlock({ index, candidate, onFileUpload, onToggleText, onRemove }) {
  const handleFileChange = e => {
    if (e.target.files[0]) {
      onFileUpload(index, e.target.files[0]);
    }
  };

  const handleDragOver = e => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = e => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = e => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) {
      onFileUpload(index, e.dataTransfer.files[0]);
    }
  };

  const dzClass = candidate.fileName
    ? candidate.status === 'ok'
      ? 'has-file'
      : candidate.status === 'busy'
      ? 'is-loading'
      : ''
    : '';

  const dzLabel = candidate.fileName
    ? `${candidate.fileName}`
    : 'Drop a resume here or browse • PDF, PNG, JPG';

  const statusLine =
    candidate.status === 'busy' ? (
      <div className="dz-status busy">reading file...</div>
    ) : candidate.status === 'ok' ? (
      <div className="dz-status ok">
        {candidate.text.trim().split(/\s+/).filter(Boolean).length} words extracted
      </div>
    ) : candidate.status === 'err' ? (
      <div className="dz-status err">couldn't read this file — try pasting text instead</div>
    ) : null;

  return (
    <div className="resume-block">
      <div className="rlabel">
        <input
          type="text"
          value={candidate.name}
          onChange={e => {
            const newValue = e.target.value;
            // Update parent state through callback if available
          }}
          placeholder="Candidate name"
        />
        <button className="remove-btn" onClick={() => onRemove(index)}>
          remove
        </button>
      </div>

      <div
        className={`dropzone ${dzClass}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input type="file" accept=".pdf,image/png,image/jpeg,image/jpg" onChange={handleFileChange} />
        <div className="dz-label">
          <b>{dzLabel}</b>
        </div>
        {statusLine}
      </div>

      <button className="toggle-text" onClick={() => onToggleText(index)}>
        {candidate.showText ? 'hide extracted text' : 'view / edit extracted text'}
      </button>

      {candidate.showText && (
        <textarea
          style={{ minHeight: '90px' }}
          value={candidate.text}
          onChange={e => {
            // Update parent state
          }}
          placeholder="Paste resume text, or upload a file above..."
        />
      )}
    </div>
  );
}

/**
 * ===============================
 * RESULTS SECTION COMPONENT
 * ===============================
 */

function ResultsSection({ results }) {
  if (!results) return null;

  return (
    <section className="section" id="results">
      <div className="results-head">
        <h3>Ranked shortlist</h3>
        <span>
          {results.keywordsCount} skills weighed • {results.candidatesCount} candidates
        </span>
      </div>

      {results.candidates.map((candidate, i) => {
        const tier =
          candidate.score >= 70 ? 'tier-strong' : candidate.score >= 40 ? 'tier-mid' : 'tier-weak';

        return (
          <div key={i} className={`rank-card ${tier}`}>
            <div className="rank-tab">{candidate.rank}</div>
            <div className="rank-top">
              <div>
                <p className="rank-name">{candidate.name}</p>
                <p className="rank-sub">
                  {candidate.matched.length} of {results.keywordsCount} required skills matched
                </p>
              </div>
              <div className="stamp-badge">
                <b>{candidate.score}%</b>
                <span>MATCH</span>
              </div>
            </div>
            <div className="rank-tags">
              {candidate.matched.slice(0, 8).map(k => (
                <span key={k} className="tag-match">
                  {k}
                </span>
              ))}
              {candidate.missing.slice(0, 5).map(k => (
                <span key={k} className="tag-missing">
                  missing: {k}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/**
 * ===============================
 * FOOTER COMPONENT
 * ===============================
 */

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div>
          <h4>Sift</h4>
          <p>Smart resume screening & candidate ranking</p>
        </div>
        <div>
          <h4>Product</h4>
          <ul>
            <li>Features</li>
            <li>Pricing</li>
            <li>Security</li>
          </ul>
        </div>
        <div>
          <h4>Resources</h4>
          <ul>
            <li>Documentation</li>
            <li>API</li>
            <li>Support</li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; 2024 Sift. All rights reserved.</p>
      </div>
    </footer>
  );
}

/**
 * ===============================
 * STYLES COMPONENT
 * ===============================
 */

function Styles() {
  return (
    <style>{`
      :root {
        --ink: #12161C;
        --panel: #1A212B;
        --panel-2: #212A36;
        --paper: #F4F1E6;
        --paper-dim: #E9E4D2;
        --amber: #D89B3C;
        --amber-dim: #8A6423;
        --sage: #7C9473;
        --sage-dim: #4C5F44;
        --rust: #BE5B3E;
        --rust-dim: #7C3B27;
        --line: #2A3140;
        --text: #ECE8DA;
        --text-dim: #9AA0AC;
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body, .app {
        margin: 0;
        background: var(--ink);
        color: var(--text);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        line-height: 1.6;
      }

      h1, h2, h3, h4, h5, h6 {
        font-weight: 600;
        margin: 0;
      }

      button {
        font-family: inherit;
        cursor: pointer;
        border: none;
        border-radius: 6px;
        font-weight: 500;
        transition: all 0.2s;
      }

      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      textarea {
        font-family: inherit;
        resize: vertical;
      }

      /* Navigation */
      .nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 40px;
        position: sticky;
        top: 0;
        z-index: 50;
        background: rgba(18, 22, 28, 0.95);
        backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--line);
      }

      .nav-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        font-size: 18px;
      }

      .brand-mark {
        width: 28px;
        height: 28px;
        background: var(--amber);
        color: #241703;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 14px;
      }

      .nav-links {
        display: flex;
        align-items: center;
        gap: 32px;
      }

      .nav-link {
        background: none;
        color: var(--text-dim);
        font-size: 14px;
        transition: color 0.2s;
      }

      .nav-link:hover, .nav-link.active {
        color: var(--text);
      }

      .nav-cta {
        background: var(--amber);
        color: #241703;
        padding: 8px 16px;
        font-weight: 600;
      }

      /* Hero */
      .hero {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 60px;
        padding: 80px 40px;
        max-width: 1200px;
        margin: 0 auto;
        align-items: center;
      }

      .eyebrow {
        color: var(--amber);
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin-bottom: 16px;
        display: block;
      }

      .headline {
        font-size: 48px;
        line-height: 1.1;
        margin-bottom: 20px;
        letter-spacing: -0.5px;
      }

      .headline em {
        font-style: normal;
        color: var(--amber);
      }

      .sub {
        font-size: 16px;
        color: var(--text-dim);
        max-width: 450px;
        margin-bottom: 28px;
      }

      .hero-actions {
        display: flex;
        gap: 12px;
      }

      .btn-primary {
        background: var(--amber);
        color: #241703;
        padding: 12px 24px;
        font-weight: 600;
        font-size: 14px;
      }

      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 16px rgba(216, 155, 60, 0.3);
      }

      .btn-ghost {
        background: transparent;
        color: var(--text);
        border: 1px solid var(--line);
        padding: 12px 24px;
        font-size: 14px;
      }

      .btn-ghost:hover {
        border-color: var(--text-dim);
      }

      /* Stack */
      .stack {
        position: relative;
        height: 320px;
      }

      .folder {
        position: absolute;
        width: 260px;
        background: var(--paper);
        border-radius: 8px;
        padding: 16px 18px;
        color: #2B2A22;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4);
        border: 1px solid var(--paper-dim);
      }

      .folder .tab {
        position: absolute;
        top: -12px;
        left: 18px;
        background: inherit;
        padding: 4px 10px 6px;
        border-radius: 6px 6px 0 0;
        font-size: 10px;
        font-weight: 600;
        font-family: 'IBM Plex Mono', monospace;
      }

      .folder .name {
        font-weight: 600;
        font-size: 14px;
        margin: 4px 0 2px;
      }

      .folder .role {
        font-size: 12px;
        color: #8B8A7C;
        margin-bottom: 8px;
      }

      .folder .score-stamp {
        position: absolute;
        right: 14px;
        top: 14px;
        border: 2px solid var(--sage-dim);
        color: var(--sage-dim);
        border-radius: 50%;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        transform: rotate(8deg);
        font-family: 'IBM Plex Mono', monospace;
      }

      .folder .score-stamp b {
        font-size: 13px;
        line-height: 1;
      }

      .folder .score-stamp span {
        font-size: 6px;
        letter-spacing: 0.4px;
      }

      .folder .tags {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        margin-top: 6px;
      }

      .folder .tags span {
        background: #EAE6D6;
        color: #8B8A7C;
        font-size: 9px;
        padding: 2px 6px;
        border-radius: 3px;
      }

      .f1 {
        top: 0;
        left: 40px;
        z-index: 3;
        transform: rotate(-3deg);
      }

      .f2 {
        top: 50px;
        left: 0;
        z-index: 2;
        transform: rotate(4deg);
        opacity: 0.88;
      }

      .f3 {
        top: 100px;
        left: 60px;
        z-index: 1;
        transform: rotate(-6deg);
        opacity: 0.76;
      }

      /* Section */
      .section {
        padding: 80px 40px;
        max-width: 1200px;
        margin: 0 auto;
      }

      .section-head {
        max-width: 600px;
        margin: 0 auto 48px;
        text-align: center;
      }

      .section-head h2 {
        font-size: 32px;
        margin-bottom: 12px;
      }

      .section-head p {
        color: var(--text-dim);
        font-size: 15px;
      }

      /* Steps */
      .steps {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
      }

      .step {
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 24px;
        background: var(--panel);
      }

      .step .num {
        font-family: 'IBM Plex Mono', monospace;
        color: var(--amber);
        font-size: 12px;
        margin-bottom: 12px;
      }

      .step h3 {
        font-size: 16px;
        margin-bottom: 8px;
      }

      .step p {
        color: var(--text-dim);
        font-size: 13px;
        margin: 0;
      }

      /* Tool */
      .tool-wrap {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 36px;
      }

      .tool-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
      }

      .field-label {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .field-label .t {
        font-weight: 600;
        font-size: 13px;
      }

      .field-label .c {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 10px;
        color: var(--text-dim);
      }

      textarea {
        width: 100%;
        background: var(--ink);
        border: 1px solid var(--line);
        border-radius: 6px;
        color: var(--text);
        padding: 12px;
        font-size: 13px;
        line-height: 1.5;
        min-height: 140px;
      }

      textarea:focus {
        outline: none;
        border-color: var(--amber-dim);
      }

      .resume-block {
        margin-bottom: 12px;
      }

      .resume-block .rlabel {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }

      .resume-block input[type='text'] {
        background: transparent;
        border: none;
        color: var(--text);
        font-weight: 600;
        font-size: 13px;
        padding: 0;
        width: 60%;
      }

      .resume-block input[type='text']:focus {
        outline: none;
      }

      .remove-btn {
        background: none;
        color: var(--rust);
        font-size: 11px;
        font-family: 'IBM Plex Mono', monospace;
      }

      .add-candidate {
        width: 100%;
        padding: 10px;
        border: 1px dashed var(--line);
        background: transparent;
        color: var(--text-dim);
        border-radius: 6px;
        font-size: 12px;
        margin-top: 4px;
      }

      .add-candidate:hover {
        border-color: var(--amber-dim);
        color: var(--amber);
      }

      .dropzone {
        border: 1px dashed var(--line);
        border-radius: 6px;
        padding: 12px;
        text-align: center;
        cursor: pointer;
        margin-bottom: 8px;
        transition: all 0.15s;
        position: relative;
      }

      .dropzone:hover,
      .dropzone.drag-over {
        border-color: var(--amber-dim);
        background: rgba(216, 155, 60, 0.05);
      }

      .dropzone input[type='file'] {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }

      .dropzone .dz-label {
        font-size: 11.5px;
        color: var(--text-dim);
      }

      .dropzone .dz-label b {
        color: var(--text);
        font-weight: 500;
      }

      .dropzone.has-file {
        border-style: solid;
        border-color: var(--sage-dim);
        background: rgba(124, 148, 115, 0.06);
      }

      .dropzone.is-loading {
        border-color: var(--amber-dim);
      }

      .dz-status {
        font-size: 10px;
        font-family: 'IBM Plex Mono', monospace;
        margin-top: 4px;
      }

      .dz-status.ok {
        color: var(--sage);
      }

      .dz-status.busy {
        color: var(--amber);
      }

      .dz-status.err {
        color: var(--rust);
      }

      .toggle-text {
        background: none;
        color: var(--text-dim);
        font-size: 10px;
        padding: 0;
        margin-top: 4px;
      }

      /* Results */
      .results-head {
        margin-bottom: 24px;
      }

      .results-head h3 {
        font-size: 22px;
        margin-bottom: 4px;
      }

      .results-head span {
        font-size: 12px;
        color: var(--text-dim);
      }

      .rank-card {
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 12px;
        background: var(--panel);
        transition: all 0.2s;
      }

      .rank-card:hover {
        border-color: var(--amber-dim);
        background: var(--panel-2);
      }

      .rank-card.tier-strong {
        border-left: 3px solid var(--sage);
      }

      .rank-card.tier-mid {
        border-left: 3px solid var(--amber);
      }

      .rank-card.tier-weak {
        border-left: 3px solid var(--rust-dim);
      }

      .rank-tab {
        display: inline-block;
        background: var(--amber);
        color: #241703;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 13px;
        margin-bottom: 12px;
      }

      .rank-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
      }

      .rank-name {
        font-weight: 600;
        font-size: 15px;
        margin: 0 0 4px;
      }

      .rank-sub {
        font-size: 12px;
        color: var(--text-dim);
        margin: 0;
      }

      .stamp-badge {
        background: var(--amber);
        color: #241703;
        border-radius: 8px;
        padding: 8px 12px;
        text-align: center;
        font-weight: 700;
      }

      .stamp-badge b {
        font-size: 18px;
        display: block;
      }

      .stamp-badge span {
        font-size: 8px;
        letter-spacing: 0.5px;
      }

      .rank-tags {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .tag-match {
        background: rgba(124, 148, 115, 0.2);
        color: var(--sage);
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 4px;
      }

      .tag-missing {
        background: rgba(190, 91, 62, 0.15);
        color: var(--rust-dim);
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 4px;
      }

      /* Footer */
      .footer {
        background: var(--panel);
        border-top: 1px solid var(--line);
        padding: 48px 40px 24px;
        margin-top: 60px;
      }

      .footer-content {
        max-width: 1200px;
        margin: 0 auto 32px;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 40px;
      }

      .footer-content h4 {
        font-size: 14px;
        margin-bottom: 12px;
        font-weight: 600;
      }

      .footer-content p {
        font-size: 13px;
        color: var(--text-dim);
        margin: 0;
      }

      .footer-content ul {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .footer-content li {
        font-size: 13px;
        color: var(--text-dim);
        margin-bottom: 8px;
      }

      .footer-bottom {
        text-align: center;
        padding-top: 24px;
        border-top: 1px solid var(--line);
        font-size: 12px;
        color: var(--text-dim);
      }

      /* Responsive */
      @media (max-width: 768px) {
        .hero,
        .tool-grid,
        .steps,
        .footer-content {
          grid-template-columns: 1fr;
        }

        .headline {
          font-size: 32px;
        }

        .nav {
          padding: 16px 20px;
        }

        .section {
          padding: 48px 20px;
        }

        .tool-wrap {
          padding: 20px;
        }
      }
    `}</style>
  );
}
