const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String, required: true },
    location: { type: String, default: '' },
    visitDate: { type: Date },
    ctc: { type: String, default: '' },
    eligibilityCriteria: { type: String, default: '' },
    description: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
