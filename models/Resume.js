const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    headline: { type: String, default: '' },
    skills: [{ type: String }],
    education: { type: String, default: '' },
    projects: { type: String, default: '' },
    experience: { type: String, default: '' },
    links: { type: String, default: '' },

    // file upload ki details yahan hain
    fileOriginalName: { type: String, default: '' },
    filePath: { type: String, default: '' },
    fileMimeType: { type: String, default: '' },
    uploadedAt: { type: Date },
    fileUrl: { type: String, default: '' },

    // ats analysis ke liye raw text yahan store hoga
    rawText: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resume', resumeSchema);
