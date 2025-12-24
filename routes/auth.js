const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const router = express.Router();

const SECRET_KEY = 'my-secret-key-2025!';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

function makePasswordStrong(password) {
    return password + SECRET_KEY;
}

// brute force rokne ke liye limiter laga rahe hain
const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// user ke liye jwt token bana rahe hain
function generateJwtForUser(user) {
    const payload = {
        id: user._id.toString(),
        role: user.role,
        fullName: user.fullName,
        email: user.email,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// purane urls ko redirect kar rahe hain
router.get('/login', (req, res) => {
    res.redirect('/login');
});

router.get('/signup', (req, res) => {
    res.redirect('/signup');
});

// signup route define kar rahe hain
router.post('/signup', async (req, res) => {
    const { role, fullName, email, password, gender = '', location = '' } = req.body;

    // check kar rahe hain saare fields hain ya nahi
    if (!role || !fullName || !email || !password) {
        return res.status(400).render('auth/signup', {
            error: 'All fields required',
            old: req.body
        });
    }

    try {
        // check kar rahe hain user pehle se hai kya
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).render('auth/signup', {
                error: 'Email already registered',
                old: req.body
            });
        }

        // password hash kar rahe hain
        const strongPassword = makePasswordStrong(password);
        const hashedPassword = await bcrypt.hash(strongPassword, 10);

        // naya user database mein daal rahe hain
        const user = await User.create({
            role,
            fullName,
            email: email.toLowerCase(),
            passwordHash: hashedPassword,
            gender,
            location
        });

        // session mein user save kar rahe hain
        req.session.user = {
            id: user._id.toString(),
            role: user.role,
            fullName: user.fullName,
            email: user.email
        };

        // dashboard par bhej rahe hain
        const dashboard = user.role === 'recruiter' ? '/admin/companies' : '/student/home';
        res.redirect(dashboard);

    } catch (err) {
        return res.status(400).render('auth/signup', {
            error: 'Something went wrong',
            old: req.body
        });
    }
});

// login route define kar rahe hain
router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;

    try {
        // user dhoond rahe hain database mein
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(400).render('auth/login', {
                error: 'Invalid email or password'
            });
        }

        // password match kar rahe hain
        const strongPassword = makePasswordStrong(password);
        const isPasswordCorrect = await bcrypt.compare(strongPassword, user.passwordHash);

        if (!isPasswordCorrect) {
            return res.status(400).render('auth/login', {
                error: 'Invalid email or password'
            });
        }

        // session regenerate kar rahe hain security ke liye
        req.session.regenerate((err) => {
            if (err) {
                return res.status(400).render('auth/login', {
                    error: 'Login failed, please try again'
                });
            }

            // user session mein store kar rahe hain
            req.session.user = {
                id: user._id.toString(),
                role: user.role,
                fullName: user.fullName,
                email: user.email
            };

            // api request hai to json bhej rahe hain
            const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
            if (acceptsJson || req.xhr) {
                const token = generateJwtForUser(user);
                return res.json({
                    token,
                    user: {
                        id: user._id.toString(),
                        role: user.role,
                        fullName: user.fullName,
                        email: user.email,
                    },
                });
            }

            // dashboard par redirect kar rahe hain
            const dashboard = user.role === 'recruiter' ? '/admin/companies' : '/student/home';
            res.redirect(dashboard);
        });

    } catch (err) {
        return res.status(400).render('auth/login', {
            error: 'Something went wrong'
        });
    }
});

// logout route define kar rahe hain
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.clearCookie('connect.sid');
            return res.status(500).send('Logout failed');
        }
        res.redirect('/');
    });
});

module.exports = router;
