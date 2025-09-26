const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');

const morgan = require('morgan');

const methodOverride = require('method-override');

const csrf = require('csurf');

const authRoutes = require('./routes/auth');
const talentRoutes = require('./routes/talent');

//require('dotenv').config();

const app = express();

const MONGODB_URI = 'mongodb://127.0.0.1:27017/gg';
const SESSION_SECRET = 'dev_secret_change_me';
const PORT = 3000;
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(methodOverride('_method'));

app.use(morgan('dev'));

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

const csrfProtection = csrf();
app.use(csrfProtection);

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
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

app.listen(PORT, () => {
  console.log(` Server start ho gaya: http://localhost:${PORT}`);
  console.log(` Browser mein yeh URL open karein!`);
});


