// Company model - campus recruitment company/drive info
const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String, required: true }, // e.g. Software Engineer
    location: { type: String, default: '' },
    visitDate: { type: Date }, // date when company comes to campus
    ctc: { type: String, default: '' }, // CTC / package info
    eligibilityCriteria: { type: String, default: '' }, // e.g. CGPA, branches allowed
    description: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
