// Jaruri libraries ko import kar rahe hain
const express = require('express');  // Express framework for routing
const bcrypt = require('bcryptjs'); // Password ko hash karne ke liye
const User = require('../models/User'); // User model database operations ke liye
const router = express.Router();

// Password ko aur strong banane ke liye ek secret key
// WARNING: Production mein ise environment variable mein rakhna chahiye
const SECRET_KEY = 'my-secret-key-2025!';

// Password ko strong banane ke liye function
// Isme hum password ke saath secret key add karte hain
function makePasswordStrong(password) {
    return password + SECRET_KEY;
}

// User signup ke liye POST route
// Yeh async function hai kyunki database operations time lete hain
router.post('/signup', async (req, res) => {
    // Form se saari details nikaal rahe hain
    // Agar gender aur location nahi mile toh empty string use karenge
    const { role, fullName, email, password, gender = '', location = '' } = req.body;
    
    // Check karo ki saare jaruri fields bhare gaye hain ya nahi
    if (!role || !fullName || !email || !password) {
        return res.status(400).render('auth/signup', { 
            error: 'All fields required', // Error message dikhayenge
            old: req.body // Form mein pehle bhara hua data wapas bhejenge
        });
    }
    
    try {
        // Check karenge ki email pehle se registered toh nahi hai
        // toLowerCase() se uppercase/lowercase ka fark nahi padega
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).render('auth/signup', { 
                error: 'Email already registered', 
                old: req.body // Purana data wapas bhejenge
            });
        }
        
        // Ab password ko strong banayenge aur hash karenge
        // makePasswordStrong secret key add karta hai
        const strongPassword = makePasswordStrong(password);
        // bcrypt password ko hash karta hai, 10 rounds of salting
        const hashedPassword = await bcrypt.hash(strongPassword, 10);
        
        // Database mein naya user create karenge
        const user = await User.create({
            role, // recruiter ya candidate
            fullName, // user ka naam
            email: email.toLowerCase(), // email lowercase mein save karenge
            passwordHash: hashedPassword, // hashed password save karenge
            gender, // optional field
            location // optional field
        });
        
        // User ko automatically login karayenge
        // Session mein user ki details save karenge
        req.session.user = {
            id: user._id.toString(), // Database ID string mein convert karenge
            role: user.role, // User ka role
            fullName: user.fullName, // User ka naam
            email: user.email // User ka email
        };
        
        // Role ke hisaab se sahi dashboard par bhejenge
        const dashboard = user.role === 'recruiter' ? '/dashboard/recruiter' : '/dashboard/candidate';
        res.redirect(dashboard);
        
    } catch (err) {
        // Agar koi error aaya toh user ko wapas signup page par bhejenge
        return res.status(400).render('auth/signup', { 
            error: 'Something went wrong', 
            old: req.body // Purana data wapas bhejenge
        });
    }
});

// Login route - user ko login karane ke liye
router.post('/login', async (req, res) => {
    // Login form se email aur password lenge
    const { email, password } = req.body;
    
    try {
        // Database mein check karenge ki yeh email exists karta hai ya nahi
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Security ke liye specific error nahi batayenge
            // Ki email exist nahi karta ya password galat hai
            return res.status(400).render('auth/login', { 
                error: 'Invalid email or password' 
            });
        }
        
        // Ab password check karenge
        // Pehle password ko strong banayenge by adding secret key
        const strongPassword = makePasswordStrong(password);
        // Fir bcrypt se compare karenge stored hash se
        const isPasswordCorrect = await bcrypt.compare(strongPassword, user.passwordHash);
        
        if (!isPasswordCorrect) {
            // Agar password galat hai toh error message
            return res.status(400).render('auth/login', { 
                error: 'Invalid email or password' 
            });
        }
        
        // Security ke liye new session create karenge
        // Purani session ko destroy karke nayi banayenge
        req.session.regenerate((err) => {
            if (err) {
                return res.status(400).render('auth/login', { 
                    error: 'Login failed, please try again' 
                });
            }
            
            // New session mein user ki details save karenge
            req.session.user = {
                id: user._id.toString(), // Database ID
                role: user.role, // User role
                fullName: user.fullName, // User ka naam
                email: user.email // User ka email
            };
            
            // Role ke hisaab se sahi dashboard par redirect karenge
            const dashboard = user.role === 'recruiter' ? '/dashboard/recruiter' : '/dashboard/candidate';
            res.redirect(dashboard);
        });
        
    } catch (err) {
        // Koi bhi error aane par login page par wapas bhejenge
        return res.status(400).render('auth/login', { 
            error: 'Something went wrong' 
        });
    }
});

// Logout route - user ko logout karane ke liye
router.post('/logout', (req, res) => {
    // Session ko destroy karenge
    req.session.destroy((err) => {
        if (err) {
            // Agar session destroy nahi hui toh kam se kam cookie toh delete karenge
            // connect.sid Express session ki default cookie hai
            res.clearCookie('connect.sid');
            return res.status(500).send('Logout failed');
        }
        // Logout ke baad home page par wapas bhejenge
        res.redirect('/');
    });
});

// Router ko export karenge taki doosri files import kar sakein
module.exports = router;


