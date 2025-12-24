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
    // resume snapshot save kar rahe hain taki bad mein dekh sake
    resumeSnapshot: { type: String, default: '' },

    // interview ki details yahan aayengi
    interviewDate: { type: Date },
    interviewMode: { type: String, enum: ['online', 'offline', ''], default: '' },
    interviewLocation: { type: String, default: '' },
    interviewLink: { type: String, default: '' },
  },
  { timestamps: true }
);

// ek student ek company mein ek hi baar apply kar sakta hai
applicationSchema.index({ student: 1, company: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
