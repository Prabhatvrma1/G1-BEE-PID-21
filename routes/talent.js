const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mammoth = require('mammoth');
const fetch = require('node-fetch');
const Groq = require('groq-sdk');
const nodemailer = require('nodemailer');

const Company = require('../models/Company');
const Notification = require('../models/Notification');
const Resume = require('../models/Resume');
const Application = require('../models/Application');
const User = require('../models/User');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// resumes save karne ke liye folder bana rahe hain
const uploadDir = path.join(__dirname, '..', 'uploads', 'resumes');
fs.mkdirSync(uploadDir, { recursive: true });

// file upload config kar rahe hain
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
    // sirf docx files allow kar rahe hain
    const allowed = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Sirf DOCX files hi allowed hain'));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// jwt verify karne wala middleware
function authenticateJwt(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header gayab hai' });
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Invalid format hai' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Token galat ya expire ho gaya' });
    }
    req.apiUser = decoded;
    next();
  });
}

// role check karne wala middleware
function requireRole(role) {
  return (req, res, next) => {
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

    if (req.apiUser) {
      if (req.apiUser.role !== role) {
        return res.status(403).json({ message: 'Is role ke liye allowed nahi hai' });
      }
      return next();
    }

    return res.status(401).json({ message: 'Login karna padega' });
  };
}

// api se profile lene ke liye
router.get('/api/student/profile', authenticateJwt, requireRole('candidate'), async (req, res) => {
  try {
    const user = await User.findById(req.apiUser.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User nahi mila' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Kuch gadbad ho gayi' });
  }
});

// student ka home page load kar rahe hain
router.get('/student/home', requireRole('candidate'), async (req, res) => {
  try {
    const { q, location, upcoming } = req.query;

    const filter = {};
    if (q) filter.role = { $regex: q, $options: 'i' };
    if (location) filter.location = { $regex: location, $options: 'i' };
    if (upcoming === '1') filter.visitDate = { $gte: new Date() };

    const companies = await Company.find(filter).sort({ visitDate: 1, createdAt: -1 }).limit(50);

    // notifications fetch kar rahe hain
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

    const existingApps = await Application.find({ student: req.session.user.id }).select('company');
    const appliedCompanyIds = new Set(existingApps.map((a) => a.company.toString()));

    const eligibilityByCompanyId = {};
    const user = await User.findById(req.session.user.id);
    if (user && user.cgpa != null) {
      companies.forEach((company) => {
        if (!company.eligibilityCriteria) return;
        const match = company.eligibilityCriteria.match(/cgpa\s*>=?\s*(\d+(\.\d+)?)/i);
        if (match) {
          const requiredCgpa = parseFloat(match[1]);
          eligibilityByCompanyId[company._id.toString()] = user.cgpa >= requiredCgpa ? 'eligible' : 'not-eligible';
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
    res.status(500).send('Kuch galat ho gaya');
  }
});

// profile view kar rahe hain
router.get('/student/profile', requireRole('candidate'), async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    res.render('student/profile', { user });
  } catch (err) {
    res.status(500).send('Kuch galat ho gaya');
  }
});

// profile update kar rahe hain
router.post('/student/profile', requireRole('candidate'), async (req, res) => {
  try {
    const { branch = '', graduationYear, cgpa, skills = '' } = req.body;
    const skillsList = skills.split(',').map((s) => s.trim()).filter(Boolean);

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
    res.status(500).send('Kuch galat ho gaya');
  }
});

// company details dikha rahe hain
router.get('/companies/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).send('Company nahi mili');
    }

    let eligibleStatus = null;
    if (req.session && req.session.user && req.session.user.role === 'candidate') {
      const user = await User.findById(req.session.user.id);
      if (user && user.cgpa != null) {
        const match = company.eligibilityCriteria.match(/cgpa\s*>=?\s*(\d+(\.\d+)?)/i);
        if (match) {
          const requiredCgpa = parseFloat(match[1]);
          eligibleStatus = user.cgpa >= requiredCgpa ? 'eligible' : 'not-eligible';
        }
      }
    }

    res.render('companies/show', { company, eligibleStatus });
  } catch (err) {
    res.status(500).send('Kuch galat ho gaya');
  }
});

// ats resume page load kar rahe hain
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
    res.status(500).send('Kuch galat ho gaya');
  }
});

// groq api se ats score nikal rahe hain
async function getGroqAtsScore(resumeText, jobText) {
  if (!GROQ_API_KEY) return null;

  const prompt = `You are an expert ATS (Applicant Tracking System) analyzer. Analyze this resume against the job description.
Job Description:
${jobText}
Resume:
${resumeText}
Provide your analysis as a JSON object with the following structure:
{
  "score": <number between 0-100>,
  "explanation": "<2-3 sentences explaining the match quality and key strengths/weaknesses>",
  "missing_keywords": ["<list of important missing skills/keywords from job description>"]
}
Return ONLY the JSON object, avoid any markdown formatting or surrounding text.`;

  try {
    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        result = JSON.parse(content.substring(jsonStart, jsonEnd + 1));
      } else {
        return null;
      }
    }

    if (!result || typeof result.score !== 'number') return null;

    return {
      score: Math.max(0, Math.min(100, Math.round(result.score))),
      explanation: result.explanation || "No explanation provided.",
      missingKeywords: Array.isArray(result.missing_keywords) ? result.missing_keywords.slice(0, 10) : []
    };

  } catch (error) {
    console.error('Groq ATS API fail ho gaya:', error);
    return null;
  }
}

// resume save kar rahe hain aur ats score nikal rahe hain
router.post('/student/resume', requireRole('candidate'), async (req, res) => {
  try {
    const { headline, skills = '', education = '', projects = '', experience = '', links = '', atsCompanyId } = req.body;
    const skillList = skills.split(',').map((s) => s.trim()).filter(Boolean);

    const resume = await Resume.findOneAndUpdate(
      { owner: req.session.user.id },
      { $set: { headline, skills: skillList, education, projects, experience, links } },
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

        // groq api call kar rahe hain
        const atsResult = await getGroqAtsScore(resumeText, jobText);
        if (atsResult && atsResult.score != null) {
          atsScore = atsResult.score;
          atsMissingKeywords = atsResult.missingKeywords || [];
          atsExplanation = atsResult.explanation || '';
        } else {
          atsScore = 0;
          atsMissingKeywords = ['Analyze nahi ho paya'];
          atsExplanation = 'ATS analysis fail ho gaya.';
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
    res.status(500).send('Kuch galat ho gaya');
  }
});

// resume upload aur ats score calculate kar rahe hain
router.post('/student/resume/upload', requireRole('candidate'), upload.single('resumeFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('File nahi mili');
    }

    const atsCompanyId = req.body.atsCompanyId || null;
    let extractedText = '';

    if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ path: req.file.path });
      extractedText = result.value || '';
    }

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

    if (atsCompanyId && extractedText.trim()) {
      const company = await Company.findById(atsCompanyId);
      if (company) {
        const resumeText = extractedText || '';
        const jobText = `${company.role} ${company.description} ${company.eligibilityCriteria}`;

        const atsResult = await getGroqAtsScore(resumeText, jobText);
        if (atsResult && atsResult.score != null) {
          atsScore = atsResult.score;
          atsMissingKeywords = atsResult.missingKeywords || [];
          atsExplanation = atsResult.explanation || '';
        } else {
          atsScore = 0;
          atsMissingKeywords = ['Analyze nahi ho paya'];
          atsExplanation = 'ATS analysis fail ho gaya.';
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
    res.status(500).send('Kuch galat ho gaya: ' + err.message);
  }
}
);

// interview page dikha rahe hain
router.get('/student/interview', requireRole('candidate'), async (req, res) => {
  try {
    const companies = await Company.find({}).sort({ createdAt: -1 });
    res.render('student/interview', {
      companies,
      interviewQuestions: null,
      selectedCompanyId: null,
      companyName: null
    });
  } catch (err) {
    res.status(500).send('Kuch galat ho gaya');
  }
});

// interview questions generate kar rahe hain ai se
router.post('/student/interview', requireRole('candidate'), async (req, res) => {
  try {
    const { companyId } = req.body;
    const company = await Company.findById(companyId);

    if (!company) {
      return res.redirect('/student/interview');
    }

    let questions = [];
    if (GROQ_API_KEY) {
      const groq = new Groq({ apiKey: GROQ_API_KEY });
      const prompt = `Generate 5 interview questions for a candidate applying to:
      Role: ${company.role}
      Company: ${company.name}
      Description: ${company.description}
      Include a mix of:
      - 2 Technical questions specific to the role
      - 2 Behavioral/HR questions
      - 1 Problem-solving/Situational question
      Return a JSON array where each object has:
      {
        "type": "Technical" | "Behavioral" | "Situational",
        "question": "The question text",
        "hint": "A short hint or key topics to mention in the answer"
      }
      Return ONLY the JSON.`;

      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            questions = parsed;
          } else if (parsed.questions && Array.isArray(parsed.questions)) {
            questions = parsed.questions;
          }
        } catch (e) {
          console.error("Parse fail ho gaya:", e);
        }
      }
    }

    if (questions.length === 0) {
      questions = [
        { type: "Behavioral", question: "Tell me about yourself and your projects.", hint: "Focus on recent work." },
        { type: "Technical", question: "Explain a challenging bug you fixed recently.", hint: "STAR method." },
        { type: "Situational", question: "How do you handle tight deadlines?", hint: "Prioritization." }
      ];
    }

    const companies = await Company.find({}).sort({ createdAt: -1 });
    res.render('student/interview', {
      companies,
      interviewQuestions: questions,
      selectedCompanyId: company._id,
      companyName: company.name
    });

  } catch (err) {
    res.status(500).send('Kuch galat ho gaya');
  }
});

// company mein apply kar rahe hain
router.post('/student/companies/:id/apply', requireRole('candidate'), async (req, res) => {
  try {
    const companyId = req.params.id;
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).send('Company nahi mili');
    }

    const existing = await Application.findOne({
      student: req.session.user.id,
      company: company._id,
    });
    if (existing) {
      return res.redirect('/student/applications');
    }

    const resume = await Resume.findOne({ owner: req.session.user.id });
    let snapshot = '';
    if (resume) {
      if (resume.rawText) {
        snapshot = resume.rawText;
      } else {
        snapshot = `${resume.headline || ''}\n${(resume.skills || []).join(', ')}\n${resume.education || ''}\n${resume.projects || ''}\n${resume.experience || ''}`;
      }
    }

    await Application.create({
      student: req.session.user.id,
      company: company._id,
      resumeSnapshot: snapshot,
    });

    res.redirect('/student/applications');
  } catch (err) {
    res.status(500).send('Kuch galat ho gaya');
  }
});

// student applications list dekh raha hai
router.get('/student/applications', requireRole('candidate'), async (req, res) => {
  try {
    const { status, sort } = req.query;
    const query = { student: req.session.user.id };
    const allowedStatuses = ['applied', 'shortlisted', 'rejected', 'selected'];
    const statusFilter = allowedStatuses.includes(status) ? status : '';
    if (statusFilter) query.status = statusFilter;

    let sortOption = { createdAt: -1 };
    let sortLabel = 'newest';
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
      sortLabel = 'oldest';
    }

    const applications = await Application.find(query).populate('company', 'name role visitDate').sort(sortOption);

    res.render('student/applications', {
      applications,
      filters: { status: statusFilter, sort: sortLabel },
    });
  } catch (err) {
    res.status(500).send('Kuch galat ho gaya');
  }
});

// admin applicants dekh raha hai
router.get('/admin/companies/:id/applicants', requireRole('recruiter'), async (req, res) => {
  try {
    const companyId = req.params.id;
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).send('Company nahi mili');

    const applications = await Application.find({ company: companyId }).populate('student', 'fullName email location').sort({ createdAt: -1 });

    const studentIds = applications.map((a) => (a.student ? a.student._id : null)).filter((id, idx, arr) => id && arr.indexOf(id) === idx);

    let resumeByStudentId = {};
    if (studentIds.length > 0) {
      const resumes = await Resume.find({ owner: { $in: studentIds } }).select('owner fileOriginalName fileUrl uploadedAt');
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
    res.status(500).send('Kuch galat ho gaya');
  }
});

// admin application update kar raha hai
router.post('/admin/applications/:id/status', requireRole('recruiter'), async (req, res) => {
  try {
    const appId = req.params.id;
    const { status } = req.body;

    if (!['applied', 'shortlisted', 'rejected', 'selected'].includes(status)) {
      return res.status(400).send('Status galat hai');
    }

    const application = await Application.findByIdAndUpdate(appId, { status }, { new: true });
    if (!application) return res.status(404).send('Application nahi mili');

    try {
      const company = await Company.findById(application.company).select('name role');
      if (company && application.student) {
        let title = 'Application update';
        if (status === 'selected') title = '🎉 You have been selected!';
        else if (status === 'shortlisted') title = 'You have been shortlisted';
        else if (status === 'rejected') title = 'Application not shortlisted';

        const message = `Your application for ${company.name} - ${company.role} is now marked as "${status}".`;

        await Notification.create({
          title,
          message,
          company: company._id,
          audience: 'student',
          recipient: application.student,
        });

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
          try {
            const studentUser = await User.findById(application.student);
            if (studentUser && studentUser.email) {
              const transporter = nodemailer.createTransport({
                host: 'smtp.zoho.in',
                port: 465,
                secure: true,
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
              });

              await transporter.sendMail({
                from: `"CampusHire" <${process.env.EMAIL_USER}>`,
                to: studentUser.email,
                subject: `Update: ${title}`,
                html: `
                        <div style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                            <h2 style="color: #4f46e5;">Application Update</h2>
                            <p>Hi <strong>${studentUser.fullName || 'Candidate'}</strong>,</p>
                            <p>There is an update on your application for <strong>${company.name}</strong> (${company.role}).</p>
                            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0; font-weight: bold;">New Status: <span style="color: #4f46e5; text-transform: capitalize;">${status}</span></p>
                                <p style="margin: 5px 0 0 0;">${message}</p>
                            </div>
                            <p>Log in to the portal to view full details.</p>
                            <a href="http://localhost:3000/login" style="display: inline-block; background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Portal</a>
                        </div>
                        `
              });
              console.log(`Email bhej diya ${studentUser.email} ko`);
            }
          } catch (emailErr) {
            console.error("Email fail hua:", emailErr);
          }
        }
      }
    } catch (notifyErr) {
      console.error('Notification mein error aaya:', notifyErr);
    }

    res.redirect(`/admin/companies/${application.company}/applicants`);
  } catch (err) {
    res.status(500).send('Kuch galat ho gaya');
  }
});

// admin dashboard route
router.get('/admin/companies', requireRole('recruiter'), async (req, res) => {
  try {
    const companies = await Company.find({}).sort({ visitDate: 1, createdAt: -1 });
    res.render('admin/companies', { companies });
  } catch (err) {
    res.status(500).send('Kuch galat ho gaya');
  }
});

// nayi company add kar rahe hain
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

    await Notification.create({
      title: `New company: ${company.name}`,
      message: `${company.name} is hiring for ${company.role}. Check eligibility and apply!`,
      company: company._id,
      audience: 'all',
    });

    res.redirect('/admin/companies');
  } catch (err) {
    res.status(500).send('Kuch galat ho gaya');
  }
});

module.exports = router;
