// Database ke liye mongoose
const mongoose = require('mongoose');

// Talent ka structure - profile ka khaka
const talentSchema = new mongoose.Schema(
  {
    // Kis user ka profile hai
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Job title, jaise "Full Stack Dev" ya "UI Designer"
    title: { type: String, required: true },
    
    // Skills ka array - ["React", "Node.js", etc.]
    skills: [{ type: String }],
    
    // Bio optional hai - apne baare me kuch lines
    bio: { type: String, default: '' },
    
    // Location bhi optional - city ya state
    location: { type: String, default: '' }
  },
  // Time stamp auto add hoga
  { timestamps: true }
);

// Talent model ko export karo - ab ye kahi bhi use kar sakte hai
module.exports = mongoose.model('Talent', talentSchema);


