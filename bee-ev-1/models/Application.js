// Application model - when a student applies to a company
const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    status: {
      type: String,
      enum: ['applied', 'shortlisted', 'rejected', 'selected'],
      default: 'applied',
    },
    // Snapshot of resume text at the time of application (for quick view)
    resumeSnapshot: { type: String, default: '' },

    // Interview / scheduling info (set by admin)
    interviewDate: { type: Date },
    interviewMode: { type: String, enum: ['online', 'offline', ''], default: '' },
    interviewLocation: { type: String, default: '' },
    interviewLink: { type: String, default: '' },
  },
  { timestamps: true }
);

// Ensure one student can apply to a specific company only once
applicationSchema.index({ student: 1, company: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
