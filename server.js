const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const morgan = require('morgan');
const methodOverride = require('method-override');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const Company = require('./models/Company');
const authRoutes = require('./routes/auth');
const talentRoutes = require('./routes/talent');

// gemini api key load kar rahe hain command line arguments se
const geminiArg = process.argv.find((arg) =>
  arg.startsWith('--geminiKey=') || arg.startsWith('--gemini-key=')
);

if (geminiArg) {
  const [, value] = geminiArg.split('=');
  if (value) {
    process.env.GEMINI_API_KEY = value;
    console.log('Gemini API key command line se mil gaya.');
  }
}

const app = express();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gg';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret_change_me';
const PORT = process.env.PORT || 3000;

// mongo db se connect kar rahe hain
mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connect ho gaya!');

    // agar koi company nahi hai to sample data dal rahe hain
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
      console.log('Sample companies database mein daal diye.');
    }
  })
  .catch((err) => console.error('MongoDB connection mein error aaya:', err));

// view engine set kar rahe hain
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// middleware config kar rahe hain
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(morgan('dev'));

// static files serve kar rahe hain
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// rate limiting lagarahe hain safety ke liye
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

// session maintain kar rahe hain
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
    store: MongoStore.create({ mongoUrl: MONGODB_URI })
  })
);

// current user local variables mein set kar rahe hain
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// csrf token placeholder set kar rahe hain
app.use((req, res, next) => {
  res.locals.csrfToken = '';
  next();
});

// basic routes define kar rahe hain
app.get('/', (req, res) => {
  res.render('landing');
});

app.get('/login', (req, res) => {
  res.render('auth/login');
});

app.get('/signup', (req, res) => {
  res.render('auth/signup', { error: null, old: null });
});

// routes file use kar rahe hain
app.use('/auth', authRoutes);
app.use('/', talentRoutes);

// news api proxy bana rahe hain
app.get('/api/news', async (req, res) => {
  const category = req.query.category || 'technology';
  try {
    const apiUrl = `${INSHORTS_API_BASE_URL}/news?category=${encodeURIComponent(category)}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      return res.status(502).json({ error: 'News fetch nahi hua' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'News load nahi ho paaya' });
  }
});

// server start kar rahe hain
app.listen(PORT, () => {
  console.log(`Server start ho gaya: http://localhost:${PORT}`);
  console.log(`Browser mein yeh URL open karein!`);
});
