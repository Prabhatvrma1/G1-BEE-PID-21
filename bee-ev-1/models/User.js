// Mongoose ko bulao, Database se baat karne ke liye
const mongoose = require('mongoose');

// User ka blueprint banayenge, matlab kaun sa data store karna hai
const userSchema = new mongoose.Schema(
  {
    // Role batayega ki user kaun hai - recruiter ya phir job dhundne wala
    // Yahan sirf do choice hai, kuch aur nahi chalega :P
    role: { type: String, enum: ['candidate', 'recruiter'], required: true },
    
    // Poora naam - ye toh required hai boss!
    fullName: { type: String, required: true },
    
    // Email unique hona chahiye, duplicate nahi chalega
    // Index add kiya hai taaki searching fast ho jaye
    email: { type: String, required: true, unique: true, index: true },
    
    // Password ko hash karke rakhenge, security first! 
    // Kisi ko direct password nahi dikhega
    passwordHash: { type: String, required: true },
    
    // Gender optional hai, nahi batana hai toh mat batao
    // Male/Female/Others me se choose karo, ya khali chodo
    gender: { type: String, enum: ['male', 'female', 'others', ''], default: '' },
    
    // Location bhi optional hai
    // Ghar ka address nahi, bass city ya state :P
    location: { type: String, default: '' },

    // Student profile specific fields (optional for recruiters)
    branch: { type: String, default: '' }, // e.g. CSE, IT, ECE
    graduationYear: { type: Number },
    cgpa: { type: Number, min: 0, max: 10 },
    skills: [{ type: String }],
  },
  // Time stamps automatic add honge
  // Pata chalega kab account bana aur kab update hua
  { timestamps: true }
);

// User model ko export karo, taaki doosri files me use kar sake
// Ab ye User model ready hai, kahi bhi use karo!
module.exports = mongoose.model('User', userSchema);


