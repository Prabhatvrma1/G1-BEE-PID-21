// Resume model - basic student resume/profile information
const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    headline: { type: String, default: '' }, // e.g. "Final year CSE student | Web Developer"
    skills: [{ type: String }],
    education: { type: String, default: '' }, // simple rich text for now
    projects: { type: String, default: '' },
    experience: { type: String, default: '' },
    links: { type: String, default: '' }, // portfolio, GitHub, LinkedIn etc.

    // Optional uploaded resume file info (PDF/DOCX)
    fileOriginalName: { type: String, default: '' },
    filePath: { type: String, default: '' },
    fileMimeType: { type: String, default: '' },
    uploadedAt: { type: Date },
    // Public URL for accessing the uploaded file from the browser
    fileUrl: { type: String, default: '' },

    // Raw text extracted from uploaded file (used for ATS)
    rawText: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resume', resumeSchema);
