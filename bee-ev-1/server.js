const path = require('path');
const express = require('express');
const session = require('express-session');

 require('dotenv').config();
//import karta hae section  
const MongoStore = require('connect-mongo');

//connecting mongo to acess schemas/models
const mongoose = require('mongoose');
const Company = require('./models/Company');
// Using built-in fetch from Node 18+

// req loger middle ware for debugging
const morgan = require('morgan');


const methodOverride = require('method-override');

const csrf = require('csurf');

const authRoutes = require('./routes/auth');
const talentRoutes = require('./routes/talent');
const rateLimit = require('express-rate-limit');

//require('dotenv').config();

const app = express();

// In real projects, move these to environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gg';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret_change_me';
const PORT = process.env.PORT || 3000;

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected successfully!');

    // Seed a few sample companies if none exist (for demo/development)
    const count = await Company.countDocuments();
    if (count === 0) {
      await Company.insertMany([
        {
          name: 'Google',
          role: 'Software Engineer (SWE-I)',
          location: 'Bangalore / Hyderabad',
          visitDate: new Date(),
          ctc: '18-25 LPA',
          eligibilityCriteria: 'CSE/IT, CGPA >= 8.0, no active backlogs',
          description: 'Backend + distributed systems, strong DS & Algo, coding rounds + interviews.',
        },
        {
          name: 'Microsoft',
          role: 'Software Engineer',
          location: 'Hyderabad',
          visitDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ctc: '20-28 LPA',
          eligibilityCriteria: 'All CS branches, CGPA >= 7.5',
          description: 'Systems + product engineering role, focuses on problem solving and design.',
        },
        {
          name: 'TCS Digital',
          role: 'Graduate Trainee',
          location: 'PAN India',
          visitDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          ctc: '7 LPA',
          eligibilityCriteria: 'All branches, CGPA >= 6.0, no more than 1 backlog',
          description: 'Entry-level role with training, good for freshers exploring IT careers.',
        },
      ]);
      console.log('Seeded sample companies into the database.');
    }
  })
  .catch((err) => console.error('MongoDB connection error:', err));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(methodOverride('_method'));

app.use(morgan('dev'));

// Serve uploaded files (e.g. resumes) statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic global rate limiter for all routes (good default protection)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // max 200 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
    store: MongoStore.create({ mongoUrl: MONGODB_URI })
  })
);

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// NOTE: CSRF protection is disabled for now to keep the demo simple.
// All forms still send a _csrf field, but the server does not validate it.
app.use((req, res, next) => {
  res.locals.csrfToken = '';
  next();
});

app.get('/', (req, res) => {
  res.render('landing');
});

app.get('/login', (req, res) => {
  res.render('auth/login');
});

app.get('/signup', (req, res) => {
  res.render('auth/signup', { error: null, old: null });
});

app.use('/auth', authRoutes);
app.use('/', talentRoutes);

// Simple backend proxy for Inshorts News API to avoid browser CORS issues
// GET /api/news?category=technology
app.get('/api/news', async (req, res) => {
  const category = req.query.category || 'technology';
  try {
    const apiUrl = `${INSHORTS_API_BASE_URL}/news?category=${encodeURIComponent(category)}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error('Inshorts API error status:', response.status, response.statusText);
      return res.status(502).json({ error: 'Failed to fetch news from upstream API' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error in /api/news proxy:', err);
    res.status(500).json({ error: 'Unable to load news right now' });
  }
});

app.listen(PORT, () => {
  console.log(` Server start ho gaya: http://localhost:${PORT}`);
  console.log(` Browser mein yeh URL open karein!`);
});


