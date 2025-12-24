const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['candidate', 'recruiter'], required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },

    // gender optional field hai
    gender: {
      type: String,
      enum: ['male', 'female', 'nonbinary', 'others', ''],
      default: '',
    },

    location: { type: String, default: '' },

    // student profile ke extra fields
    branch: { type: String, default: '' },
    graduationYear: { type: Number },
    cgpa: { type: Number, min: 0, max: 10 },
    skills: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
