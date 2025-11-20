// Student recruitment platform routes
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mammoth = require('mammoth');
const fetch = require('node-fetch');

const Company = require('../models/Company');
const Notification = require('../models/Notification');
const Resume = require('../models/Resume');
const Application = require('../models/Application');
const User = require('../models/User');

const router = express.Router();

// Keep JWT secret consistent with auth routes (for future API usage)
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

// Gemini API key (ATS scoring). Set this in your environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Setup upload directory for resumes
const uploadDir = path.join(__dirname, '..', 'uploads', 'resumes');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
      cb(null, `${req.session.user.id}_${Date.now()}_${base}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only DOCX files are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Middleware: JWT verify for API (if you need it later)
function authenticateJwt(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Invalid Authorization header format' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    req.apiUser = decoded;
    next();
  });
}

// Generic role checker (session or JWT)
function requireRole(role) {
  return (req, res, next) => {
    // Web: session-based user
    if (req.session && req.session.user) {
      if (req.session.user.role !== role) {
        return res.status(403).render('no-access', {
          userRole: req.session.user.role,
          requiredRole: role,
          currentUser: req.session.user,
        });
      }
      return next();
    }

    // API: JWT-based user
    if (req.apiUser) {
      if (req.apiUser.role !== role) {
        return res.status(403).json({ message: 'Not allowed for this role' });
      }
      return next();
    }

    return res.status(401).json({ message: 'Authentication required' });
  };
}

// ---------- API ROUTES (JWT protected) ----------

// Example: Get current candidate profile as JSON using JWT token
// Usage:
// 1) POST /auth/login with Accept: application/json to get a JWT token
// 2) Call this endpoint with header: Authorization: Bearer <token>
router.get('/api/student/profile', authenticateJwt, requireRole('candidate'), async (req, res) => {
  try {
    const user = await User.findById(req.apiUser.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Error in /api/student/profile:', err);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// ---------- STUDENT PAGES ----------

// Student home: upcoming companies + notifications + search/filters
router.get('/student/home', requireRole('candidate'), async (req, res) => {
  try {
    const { q, location, upcoming } = req.query;

    const filter = {};
    if (q) {
      filter.role = { $regex: q, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }
    if (upcoming === '1') {
      filter.visitDate = { $gte: new Date() };
    }

    const companies = await Company.find(filter)
      .sort({ visitDate: 1, createdAt: -1 })
      .limit(50);

    // Personal + global notifications for this student
    const notifications = await Notification.find({
      $or: [
        { audience: 'all' },
        { audience: 'student' },
        { recipient: req.session.user.id },
      ],
    })
      .populate('company', 'name role')
      .sort({ createdAt: -1 })
      .limit(20);

    // Find which companies the current student has already applied to
    const existingApps = await Application.find({ student: req.session.user.id }).select('company');
    const appliedCompanyIds = new Set(existingApps.map((a) => a.company.toString()));

    // Compute simple eligibility based on CGPA vs company criteria, if profile has CGPA
    const eligibilityByCompanyId = {};
    const user = await User.findById(req.session.user.id);
    if (user && user.cgpa != null) {
      companies.forEach((company) => {
        if (!company.eligibilityCriteria) return;
        const match = company.eligibilityCriteria.match(/cgpa\s*>=?\s*(\d+(\.\d+)?)/i);
        if (match) {
          const requiredCgpa = parseFloat(match[1]);
          eligibilityByCompanyId[company._id.toString()] =
            user.cgpa >= requiredCgpa ? 'eligible' : 'not-eligible';
        }
      });
    }

    res.render('student/home', {
      companies,
      notifications,
      appliedCompanyIds,
      eligibilityByCompanyId,
      search: {
        q: q || '',
        location: location || '',
        upcoming: upcoming === '1',
      },
    });
  } catch (err) {
    console.error('Error loading student home:', err);
    res.status(500).send('Something went wrong');
  }
});

// Student profile view/edit
router.get('/student/profile', requireRole('candidate'), async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    res.render('student/profile', { user });
  } catch (err) {
    console.error('Error loading profile:', err);
    res.status(500).send('Something went wrong');
  }
});

router.post('/student/profile', requireRole('candidate'), async (req, res) => {
  try {
    const { branch = '', graduationYear, cgpa, skills = '' } = req.body;

    const skillsList = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await User.updateOne(
      { _id: req.session.user.id },
      {
        $set: {
          branch,
          graduationYear: graduationYear ? Number(graduationYear) : undefined,
          cgpa: cgpa ? Number(cgpa) : undefined,
          skills: skillsList,
        },
      }
    );

    const user = await User.findById(req.session.user.id);
    res.render('student/profile', { user });
  } catch (err) {
    console.error('Error saving profile:', err);
    res.status(500).send('Something went wrong');
  }
});

// Public company detail page
router.get('/companies/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).send('Company not found');
    }

    let eligibleStatus = null;
    if (req.session && req.session.user && req.session.user.role === 'candidate') {
      const user = await User.findById(req.session.user.id);
      if (user && user.cgpa != null) {
        // Very simple eligibility check: if criteria mentions CGPA and user.cgpa < number, mark not eligible
        const match = company.eligibilityCriteria.match(/cgpa\s*>=?\s*(\d+(\.\d+)?)/i);
        if (match) {
          const requiredCgpa = parseFloat(match[1]);
          eligibleStatus = user.cgpa >= requiredCgpa ? 'eligible' : 'not-eligible';
        }
      }
    }

    res.render('companies/show', {
      company,
      eligibleStatus,
    });
  } catch (err) {
    console.error('Error loading company details:', err);
    res.status(500).send('Something went wrong');
  }
});

// ATS resume checker page
router.get('/student/resume', requireRole('candidate'), async (req, res) => {
  try {
    const resume = await Resume.findOne({ owner: req.session.user.id });
    const companies = await Company.find({}).sort({ createdAt: -1 }).limit(20);

    res.render('student/resume', {
      resume,
      atsScore: null,
      atsMissingKeywords: [],
      companies,
      selectedCompanyId: null,
    });
  } catch (err) {
    console.error('Error loading resume page:', err);
    res.status(500).send('Something went wrong');
  }
});

// Helper: very simple ATS scoring based on keyword overlap
function computeAtsScore(resumeText, jobText) {
  const tokenize = (text) =>
    (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3);

  const resumeWords = new Set(tokenize(resumeText));
  const jobWords = Array.from(new Set(tokenize(jobText)));

  if (jobWords.length === 0) {
    return { score: 0, missingKeywords: [] };
  }

  let matched = 0;
  const missing = [];
  for (const word of jobWords) {
    if (resumeWords.has(word)) {
      matched++;
    } else {
      missing.push(word);
    }
  }

  const score = Math.round((matched / jobWords.length) * 100);
  return { score, missingKeywords: missing.slice(0, 15) };
}

// Helper: AI-based ATS scoring using Gemini (Google Generative Language API)
// Returns: { score: number, missingKeywords: string[], explanation: string } | null on failure
async function getGeminiAtsScore(resumeText, jobText) {
  if (!GEMINI_API_KEY) {
    console.error('Gemini ATS: GEMINI_API_KEY is not set');
    return null;
  }

  const prompt = `You are acting as an Applicant Tracking System (ATS) for campus hiring.
Given a job description and a student's resume text:
- Return an integer match score from 0 to 100 (0 = not relevant, 100 = perfect match).
- Provide a brief explanation (2-4 sentences) of why.
- List 5-15 important skills/keywords that are missing or weak in the resume.

Respond ONLY in strict JSON with this format:
{
  "score": number,
  "explanation": string,
  "missing_keywords": string[]
}

Do not include any extra text before or after the JSON.

JOB DESCRIPTION:
${jobText}

RESUME:
${resumeText}`.trim();

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
        encodeURIComponent(GEMINI_API_KEY),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini ATS API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const firstCandidate = data && data.candidates && data.candidates[0];
    const parts = firstCandidate && firstCandidate.content && firstCandidate.content.parts;
    const text = parts && parts[0] && parts[0].text;

    if (!text || typeof text !== 'string') {
      console.error('Gemini ATS: unexpected response structure', data);
      return null;
    }

    // Gemini sometimes wraps JSON in extra text or code fences. Try to extract the JSON object.
    let jsonText = text.trim();

    // Strip Markdown code fences if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```[a-zA-Z]*\n?/,'').replace(/```$/,'').trim();
    }

    // Try to locate the first '{' and last '}' to isolate the JSON object
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.substring(firstBrace, lastBrace + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (jsonErr) {
      console.error('Gemini ATS: failed to parse JSON from text:', jsonErr, '\nRaw text:', text);
      return null;
    }

    const score = typeof parsed.score === 'number' ? Math.round(parsed.score) : null;
    const explanation =
      typeof parsed.explanation === 'string' ? parsed.explanation : '';
    const missingKeywords = Array.isArray(parsed.missing_keywords)
      ? parsed.missing_keywords
          .filter((w) => typeof w === 'string')
          .slice(0, 20)
      : [];

    if (score === null) {
      console.error('Gemini ATS: parsed JSON missing numeric score', parsed);
      return null;
    }

    return { score, explanation, missingKeywords };
  } catch (err) {
    console.error('Error calling Gemini ATS API:', err);
    return null;
  }
}

// Save resume via form + optionally calculate ATS score vs a chosen company
router.post('/student/resume', requireRole('candidate'), async (req, res) => {
  try {
    const { headline, skills = '', education = '', projects = '', experience = '', links = '', atsCompanyId } = req.body;

    const skillList = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const update = {
      headline,
      skills: skillList,
      education,
      projects,
      experience,
      links,
    };

    const resume = await Resume.findOneAndUpdate(
      { owner: req.session.user.id },
      { $set: update },
      { new: true, upsert: true }
    );

    let atsScore = null;
    let atsMissingKeywords = [];
    let atsExplanation = '';
    let selectedCompanyId = atsCompanyId || null;

    if (atsCompanyId) {
      const company = await Company.findById(atsCompanyId);
      if (company) {
        const resumeText = `${headline} ${skills} ${education} ${projects} ${experience}`;
        const jobText = `${company.role} ${company.description} ${company.eligibilityCriteria}`;

        // Try AI-based ATS via Gemini first
        const aiResult = await getGeminiAtsScore(resumeText, jobText);
        if (aiResult && aiResult.score != null) {
          atsScore = aiResult.score;
          atsMissingKeywords = aiResult.missingKeywords || [];
          atsExplanation = aiResult.explanation || '';
        } else {
          // Fallback to simple keyword-based ATS
          const basic = computeAtsScore(resumeText, jobText);
          atsScore = basic.score;
          atsMissingKeywords = basic.missingKeywords;
          atsExplanation =
            'Score computed using simple keyword matching (AI service unavailable or misconfigured). Check GEMINI_API_KEY and server logs.';
        }
      }
    }

    const companies = await Company.find({}).sort({ createdAt: -1 }).limit(20);

    res.render('student/resume', {
      resume,
      atsScore,
      atsMissingKeywords,
      atsExplanation,
      companies,
      selectedCompanyId,
    });
  } catch (err) {
    console.error('Error saving resume:', err);
    res.status(500).send('Something went wrong');
  }
});

// Upload PDF/DOCX resume and compute ATS vs a selected company
router.post(
  '/student/resume/upload',
  requireRole('candidate'),
  upload.single('resumeFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send('No file uploaded');
      }

      const atsCompanyId = req.body.atsCompanyId || null;
      let extractedText = '';

      if (
        req.file.mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const result = await mammoth.extractRawText({ path: req.file.path });
        extractedText = result.value || '';
      }

      // Build a web-accessible URL for the uploaded resume file
      const fileName = path.basename(req.file.path);
      const fileUrl = `/uploads/resumes/${fileName}`;

      const resume = await Resume.findOneAndUpdate(
        { owner: req.session.user.id },
        {
          $set: {
            fileOriginalName: req.file.originalname,
            filePath: req.file.path,
            fileMimeType: req.file.mimetype,
            uploadedAt: new Date(),
            fileUrl,
            rawText: extractedText,
          },
        },
        { new: true, upsert: true }
      );

      let atsScore = null;
      let atsMissingKeywords = [];
      let atsExplanation = '';
      let selectedCompanyId = atsCompanyId;

      if (atsCompanyId) {
        const company = await Company.findById(atsCompanyId);
        if (company) {
          const resumeText = extractedText || '';
          const jobText = `${company.role} ${company.description} ${company.eligibilityCriteria}`;

          const aiResult = await getGeminiAtsScore(resumeText, jobText);
          if (aiResult && aiResult.score != null) {
            atsScore = aiResult.score;
            atsMissingKeywords = aiResult.missingKeywords || [];
            atsExplanation = aiResult.explanation || '';
          } else {
            const basic = computeAtsScore(resumeText, jobText);
            atsScore = basic.score;
            atsMissingKeywords = basic.missingKeywords;
            atsExplanation =
              'Score computed using simple keyword matching (AI service unavailable or misconfigured). Check GEMINI_API_KEY and server logs.';
          }
        }
      }

      const companies = await Company.find({}).sort({ createdAt: -1 }).limit(20);

      res.render('student/resume', {
        resume,
        atsScore,
        atsMissingKeywords,
        atsExplanation,
        companies,
        selectedCompanyId,
      });
    } catch (err) {
      console.error('Error uploading resume:', err);
      res.status(500).send('Something went wrong');
    }
  }
);

// ---------- APPLICATIONS ----------

// Student applies to a company using their current resume data
router.post('/student/companies/:id/apply', requireRole('candidate'), async (req, res) => {
  try {
    const companyId = req.params.id;
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).send('Company not found');
    }

    // Prevent duplicate applications from the same student to the same company
    const existing = await Application.findOne({
      student: req.session.user.id,
      company: company._id,
    });
    if (existing) {
      // Already applied – just send them to applications page
      return res.redirect('/student/applications');
    }

    const resume = await Resume.findOne({ owner: req.session.user.id });

    let snapshot = '';
    if (resume) {
      if (resume.rawText) {
        snapshot = resume.rawText;
      } else {
        snapshot = `${resume.headline || ''}\n${(resume.skills || []).join(', ')}\n${
          resume.education || ''
        }\n${resume.projects || ''}\n${resume.experience || ''}`;
      }
    }

    await Application.create({
      student: req.session.user.id,
      company: company._id,
      resumeSnapshot: snapshot,
    });

    res.redirect('/student/applications');
  } catch (err) {
    console.error('Error applying to company:', err);
    res.status(500).send('Something went wrong');
  }
});

// Student can see all their applications with filters and sorting
router.get('/student/applications', requireRole('candidate'), async (req, res) => {
  try {
    const { status, sort } = req.query;

    const query = { student: req.session.user.id };
    const allowedStatuses = ['applied', 'shortlisted', 'rejected', 'selected'];
    const statusFilter = allowedStatuses.includes(status) ? status : '';
    if (statusFilter) {
      query.status = statusFilter;
    }

    let sortOption = { createdAt: -1 }; // default: newest first
    let sortLabel = 'newest';
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
      sortLabel = 'oldest';
    }

    const applications = await Application.find(query)
      .populate('company', 'name role visitDate')
      .sort(sortOption);

    res.render('student/applications', {
      applications,
      filters: {
        status: statusFilter,
        sort: sortLabel,
      },
    });
  } catch (err) {
    console.error('Error loading applications:', err);
    res.status(500).send('Something went wrong');
  }
});

// Admin: view applicants for a company
router.get('/admin/companies/:id/applicants', requireRole('recruiter'), async (req, res) => {
  try {
    const companyId = req.params.id;
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).send('Company not found');
    }

    const applications = await Application.find({ company: companyId })
      .populate('student', 'fullName email location')
      .sort({ createdAt: -1 });

    // Load latest resume info for each applicant (if available)
    const studentIds = applications
      .map((a) => (a.student ? a.student._id : null))
      .filter((id, idx, arr) => id && arr.indexOf(id) === idx);

    let resumeByStudentId = {};
    if (studentIds.length > 0) {
      const resumes = await Resume.find({ owner: { $in: studentIds } })
        .select('owner fileOriginalName fileUrl uploadedAt');
      resumes.forEach((r) => {
        resumeByStudentId[r.owner.toString()] = {
          fileOriginalName: r.fileOriginalName,
          fileUrl: r.fileUrl,
          uploadedAt: r.uploadedAt,
        };
      });
    }

    res.render('admin/applicants', { company, applications, resumeByStudentId });
  } catch (err) {
    console.error('Error loading applicants:', err);
    res.status(500).send('Something went wrong');
  }
});

// Admin: update application status (applied/shortlisted/rejected/selected)
router.post('/admin/applications/:id/status', requireRole('recruiter'), async (req, res) => {
  try {
    const appId = req.params.id;
    const { status } = req.body;

    if (!['applied', 'shortlisted', 'rejected', 'selected'].includes(status)) {
      return res.status(400).send('Invalid status');
    }

    const application = await Application.findByIdAndUpdate(appId, { status }, { new: true });
    if (!application) {
      return res.status(404).send('Application not found');
    }

    // Create a per-candidate notification about this status change
    try {
      const company = await Company.findById(application.company).select('name role');
      if (company && application.student) {
        let title = 'Application update';
        if (status === 'selected') {
          title = '🎉 You have been selected!';
        } else if (status === 'shortlisted') {
          title = 'You have been shortlisted';
        } else if (status === 'rejected') {
          title = 'Application not shortlisted';
        }

        const message = `Your application for ${company.name} - ${company.role} is now marked as "${status}".`;

        await Notification.create({
          title,
          message,
          company: company._id,
          audience: 'student',
          recipient: application.student,
        });
      }
    } catch (notifyErr) {
      console.error('Error creating status notification:', notifyErr);
    }

    // Redirect back to that company's applicants list
    res.redirect(`/admin/companies/${application.company}/applicants`);
  } catch (err) {
    console.error('Error updating application status:', err);
    res.status(500).send('Something went wrong');
  }
});

// ---------- ADMIN / PLACEMENT PAGES ----------

// Manage companies (list + create)
router.get('/admin/companies', requireRole('recruiter'), async (req, res) => {
  try {
    const companies = await Company.find({}).sort({ visitDate: 1, createdAt: -1 });
    res.render('admin/companies', { companies });
  } catch (err) {
    console.error('Error loading companies page:', err);
    res.status(500).send('Something went wrong');
  }
});

router.post('/admin/companies', requireRole('recruiter'), async (req, res) => {
  try {
    const { name, role, location = '', visitDate = '', ctc = '', eligibilityCriteria = '', description = '' } = req.body;

    const company = await Company.create({
      name,
      role,
      location,
      visitDate: visitDate ? new Date(visitDate) : undefined,
      ctc,
      eligibilityCriteria,
      description,
    });

    // Auto-create notification for students
    await Notification.create({
      title: `New company: ${company.name}`,
      message: `${company.name} is hiring for ${company.role}. Check eligibility and apply!`,
      company: company._id,
      audience: 'all',
    });

    res.redirect('/admin/companies');
  } catch (err) {
    console.error('Error creating company:', err);
    res.status(500).send('Something went wrong');
  }
});

module.exports = router;


