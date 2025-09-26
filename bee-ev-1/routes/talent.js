// Import required modules
const express = require('express');
const Talent = require('../models/Talent');

// Create router for talent-related routes
const router = express.Router();

// Function to check if user has the correct role
function requireRole(role) {
  return (req, res, next) => {
    // Check if user is logged in
    if (!req.session.user) {
      return res.redirect('/login');
    }
    
    // Check if user has the correct role
    if (req.session.user.role !== role) {
      return res.status(403).render('no-access', { 
        userRole: req.session.user.role,
        requiredRole: role,
        currentUser: req.session.user
      });
    }
    next();
  };
}

// CANDIDATE ROUTES

// Show candidate dashboard with their talents
router.get('/dashboard/candidate', requireRole('candidate'), async (req, res) => {
  try {
    // Find all talents created by this candidate
    const talents = await Talent.find({ owner: req.session.user.id }).sort({ createdAt: -1 });
    
    // Render the candidate dashboard page
    res.render('dashboard/candidate_dashboard', { talents });
  } catch (err) {
    console.error('Error loading candidate dashboard:', err);
    res.status(500).send('Something went wrong');
  }
});

// Create a new talent profile
router.post('/talent', requireRole('candidate'), async (req, res) => {
  try {
    // Get form data
    const { title, skills = '', bio = '', location = '' } = req.body;
    
    // Convert skills string to array (split by commas)
    const skillList = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean); // Remove empty strings
    
    // Create new talent in database
    await Talent.create({ 
      owner: req.session.user.id, 
      title, 
      skills: skillList, 
      bio, 
      location 
    });
    
    // Redirect back to dashboard
    res.redirect('/dashboard/candidate');
  } catch (err) {
    console.error('Error creating talent:', err);
    res.status(500).send('Something went wrong');
  }
});

// Update existing talent profile
router.post('/talent/:id', requireRole('candidate'), async (req, res) => {
  try {
    // Get form data
    const { title, skills = '', bio = '', location = '' } = req.body;
    
    // Convert skills string to array
    const skillList = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    
    // Update talent in database (only if owned by current user)
    await Talent.updateOne(
      { _id: req.params.id, owner: req.session.user.id }, 
      { $set: { title, skills: skillList, bio, location } }
    );
    
    // Redirect back to dashboard
    res.redirect('/dashboard/candidate');
  } catch (err) {
    console.error('Error updating talent:', err);
    res.status(500).send('Something went wrong');
  }
});

// Delete talent profile
router.post('/talent/:id/delete', requireRole('candidate'), async (req, res) => {
  try {
    // Delete talent from database (only if owned by current user)
    await Talent.deleteOne({ _id: req.params.id, owner: req.session.user.id });
    
    // Redirect back to dashboard
    res.redirect('/dashboard/candidate');
  } catch (err) {
    console.error('Error deleting talent:', err);
    res.status(500).send('Something went wrong');
  }
});

// RECRUITER ROUTES

// Show recruiter dashboard with all talents
router.get('/dashboard/recruiter', requireRole('recruiter'), async (req, res) => {
  try {
    // Find all talents from all candidates
    const talents = await Talent.find({})
      .populate('owner', 'fullName email location')
      .sort({ createdAt: -1 });
    
    // Render the recruiter dashboard page
    res.render('dashboard/recruiter_dashboard', { talents });
  } catch (err) {
    console.error('Error loading recruiter dashboard:', err);
    res.status(500).send('Something went wrong');
  }
});

// Export the router so it can be used in other files
module.exports = router;


