# G1-BEE-PID-21
bee simple MEN project with bcrypt 


# 🎓 TalentPipeline
### Intelligent Campus Recruitment & Placement Automation System

**TalentPipeline** is a comprehensive web-based platform designed to bridge the gap between campus talent and recruiters. Unlike traditional placement portals that only list jobs, TalentPipeline integrates **Generative AI** to actively assist candidates in their preparation journey.

---

## ✨ Key Features

### 🤖 **AI-Powered Features**
- **AI-Driven ATS Scorer**: Analyzes student resumes against specific Job Descriptions using LLMs (Llama 3.3 via Groq API)
  - Provides a Match Score (0-100)
  - Highlights missing keywords and skills
  - Offers detailed explanations of strengths and weaknesses
  
- **AI Mock Interviewer**: Generates context-aware interview questions tailored to specific companies and roles
  - Technical questions specific to the role
  - Behavioral/HR questions
  - Problem-solving/Situational questions
  - Includes hints for each question

### 📋 **Student Features**
- **Profile Management**: Maintain detailed profile with skills, CGPA, branch, graduation year
- **Resume Management**: Upload DOCX resumes or create resumes within the platform
- **Company Discovery**: Search and filter companies by role, location, and visit date
- **Smart Application System**: Apply to companies with automatic eligibility checking based on CGPA
- **Application Tracking**: Monitor application status (Applied → Shortlisted → Selected/Rejected)
- **Real-time Notifications**: Get instant updates on application status changes and new job postings

### 👔 **Recruiter Features**
- **Company Management**: Add and manage company job postings
- **Applicant Dashboard**: View all applicants for each job posting
- **Resume Access**: Download and review student resumes
- **Application Management**: Update application statuses
- **Automated Notifications**: System automatically notifies students of status changes via in-app notifications and email

### 📧 **Notification System**
- In-app notifications for students and recruiters
- Email notifications for application status updates (via Nodemailer + Zoho SMTP)
- Supports targeted notifications (all users, students only, or specific recipients)

---

## 🛠️ Tech Stack

### **Backend**
- **Runtime**: Node.js
- **Framework**: Express.js (v5.x)
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Session-based (express-session + connect-mongo) with bcryptjs password hashing
- **API Authentication**: JWT (jsonwebtoken)

### **AI/ML Integration**
- **Groq SDK**: Llama 3.3 70B model for ATS scoring and interview question generation
- **Google GenAI**: (@google/genai) for additional AI capabilities

### **File Processing**
- **Multer**: File upload handling
- **Mammoth**: DOCX text extraction
- **pdf-parse**: PDF processing support

### **Email**
- **Nodemailer**: Email notifications via Zoho SMTP

### **Security & Rate Limiting**
- **express-rate-limit**: API rate limiting (200 requests per 15 minutes globally, 20 login attempts per 10 minutes)
- **CSRF Protection**: csurf middleware
- **Session Management**: Secure session handling with MongoDB store

### **Template Engine**
- **EJS**: Server-side rendering

### **Development Tools**
- **Nodemon**: Auto-restart during development
- **Morgan**: HTTP request logging
- **dotenv**: Environment variable management

---

## 📁 Project Structure

```
G1-BEE-PID-21/
├── models/                    # Database schemas
│   ├── Application.js         # Job application model
│   ├── Company.js             # Company/job posting model
│   ├── Notification.js        # Notification model
│   ├── Resume.js              # Resume model
│   ├── Talent.js              # Talent profile model
│   └── User.js                # User authentication model
├── routes/
│   ├── auth.js                # Authentication routes (login, signup, logout)
│   └── talent.js              # Main application routes (student & admin)
├── views/                     # EJS templates
│   ├── admin/                 # Recruiter views
│   ├── auth/                  # Login/signup pages
│   ├── companies/             # Company detail pages
│   ├── dashboard/             # Dashboard views
│   ├── student/               # Student-specific views
│   ├── partials/              # Reusable components
│   ├── landing.ejs            # Landing page
│   └── no-access.ejs          # Access denied page
├── uploads/
│   └── resumes/               # Uploaded resume storage
├── server.js                  # Main application entry point
├── package.json               # Dependencies and scripts
├── PROJECT_DESCRIPTION.md     # Project overview
└── README.md                  # This file
```

---

## 🚀 Installation & Setup

### **Prerequisites**
- Node.js (v14 or higher)
- MongoDB (local or Atlas connection)
- Groq API Key (for AI features)
- Zoho SMTP credentials (optional, for email notifications)

### **Step 1: Clone the Repository**
```bash
git clone <your-repo-url>
cd G1-BEE-PID-21
```

### **Step 2: Install Dependencies**
```bash
npm install
```

### **Step 3: Configure Environment Variables**
Create a `.env` file in the root directory:

```env
# Database
MONGODB_URI=mongodb://127.0.0.1:27017/gg
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/talentpipeline

# Session Secret
SESSION_SECRET=your_super_secret_session_key_here

# JWT Secret
JWT_SECRET=your_jwt_secret_key_here

# Groq API (Required for AI features)
GROQ_API_KEY=your_groq_api_key_here

# Google Gemini API (Optional)
GEMINI_API_KEY=your_gemini_api_key_here

# Email Configuration (Optional - for email notifications)
EMAIL_USER=your_email@zoho.com
EMAIL_PASS=your_zoho_app_password

# Server Port
PORT=3000
```

### **Step 4: Start MongoDB**
If using local MongoDB:
```bash
mongod
```

### **Step 5: Run the Application**

**Development Mode** (with auto-restart):
```bash
npm run dev
```

**Production Mode**:
```bash
npm start
```

**With Gemini API via Command Line**:
```bash
node server.js --geminiKey=YOUR_GEMINI_KEY
```

The server will start at: `http://localhost:3000`

---

## 📖 Usage Guide

### **For Students**

1. **Sign Up**: Navigate to `/signup` and create an account with role "candidate"
2. **Complete Profile**: Add your branch, CGPA, graduation year, and skills
3. **Upload Resume**: Go to "Resume" section and upload your DOCX resume
4. **Test ATS Score**: Select a company to see how your resume scores against their job description
5. **Browse Companies**: Explore job postings, filter by role/location
6. **Apply**: Click "Apply" on job postings (system checks eligibility automatically)
7. **Track Applications**: Monitor your application status in the "My Applications" section
8. **Interview Prep**: Use the AI Mock Interviewer to practice for specific companies

### **For Recruiters**

1. **Sign Up**: Create an account with role "recruiter"
2. **Add Companies**: Post new job openings with details (role, CTC, eligibility, etc.)
3. **View Applicants**: Click on any job posting to see all applicants
4. **Review Resumes**: Download and review student resumes
5. **Update Status**: Change application status (Applied/Shortlisted/Selected/Rejected)
6. **Automatic Notifications**: Students receive instant notifications and emails

---

## 🔐 Authentication & Security

### **Password Security**
- Passwords are salted and hashed using bcryptjs (10 rounds)
- Additional secret key appended before hashing for extra security
- Session regeneration on login to prevent session fixation attacks

### **Rate Limiting**
- Global: 200 requests per 15 minutes
- Login endpoint: 20 attempts per 10 minutes (prevents brute force)

### **Session Management**
- Sessions stored in MongoDB (persistent across server restarts)
- 7-day session expiry
- Secure cookie settings

### **Role-Based Access Control**
- Middleware enforces role requirements (candidate vs recruiter)
- Separate dashboards and permissions

---

## 🔌 API Endpoints

### **Authentication**
- `POST /auth/signup` - Register new user
- `POST /auth/login` - Login (returns JWT for API clients, session for web)
- `POST /auth/logout` - Logout and destroy session

### **Student API (Requires JWT)**
- `GET /api/student/profile` - Get student profile
- `GET /student/home` - Student dashboard
- `GET /student/profile` - View/edit profile
- `POST /student/profile` - Update profile
- `GET /student/resume` - Resume management page
- `POST /student/resume` - Save resume & get ATS score
- `POST /student/resume/upload` - Upload DOCX resume
- `GET /student/interview` - AI interview prep page
- `POST /student/interview` - Generate interview questions
- `GET /student/applications` - View all applications
- `POST /student/companies/:id/apply` - Apply to a company

### **Recruiter/Admin**
- `GET /admin/companies` - Company dashboard
- `POST /admin/companies` - Add new company
- `GET /admin/companies/:id/applicants` - View applicants
- `POST /admin/applications/:id/status` - Update application status

### **Public**
- `GET /` - Landing page
- `GET /companies/:id` - View company details

---

## 🎯 Key Workflows

### **ATS Resume Scoring Workflow**
1. Student uploads DOCX resume or fills resume form
2. Student selects target company
3. System extracts resume text using Mammoth
4. System sends resume text + job description to Groq API (Llama 3.3)
5. AI returns match score, explanation, and missing keywords
6. Results displayed to student with actionable feedback

### **AI Interview Preparation Workflow**
1. Student selects company for interview prep
2. System sends company name, role, and description to Groq API
3. AI generates 5 context-aware questions:
   - 2 Technical (role-specific)
   - 2 Behavioral/HR
   - 1 Problem-solving/Situational
4. Each question includes hints for better preparation

### **Application Status Update Workflow**
1. Recruiter changes application status
2. System creates in-app notification
3. System sends email notification (if configured)
4. Student sees update in dashboard and inbox

---

## 🌐 Environment Variables Reference

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `MONGODB_URI` | Yes | MongoDB connection string | `mongodb://127.0.0.1:27017/gg` |
| `SESSION_SECRET` | Yes | Secret for session encryption | `dev_secret_change_me` |
| `JWT_SECRET` | Yes | Secret for JWT signing | `dev_jwt_secret_change_me` |
| `GROQ_API_KEY` | **Required for AI** | Groq API key for Llama 3.3 | - |
| `GEMINI_API_KEY` | Optional | Google Gemini API key | - |
| `EMAIL_USER` | Optional | Zoho email address | - |
| `EMAIL_PASS` | Optional | Zoho app password | - |
| `PORT` | No | Server port | `3000` |

---

## 🧪 Sample Data

The application automatically seeds sample companies on first run:
- **Google** - Software Engineer (SWE-I) - 18-25 LPA
- **Microsoft** - Software Engineer - 20-28 LPA
- **TCS Digital** - Graduate Trainee - 7 LPA

---

## 🐛 Troubleshooting

### **MongoDB Connection Issues**
- Ensure MongoDB is running: `mongod`
- Check `MONGODB_URI` in `.env`
- For Atlas: whitelist your IP address

### **AI Features Not Working**
- Verify `GROQ_API_KEY` is set correctly
- Check API quota/limits on Groq dashboard
- Review server logs for API errors

### **Email Notifications Not Sending**
- Ensure `EMAIL_USER` and `EMAIL_PASS` are configured
- For Zoho: use app-specific password
- Check SMTP settings (host: smtp.zoho.in, port: 465)

### **File Upload Errors**
- Only DOCX files are supported
- Maximum file size: 5MB
- Check `uploads/resumes/` directory permissions

---

## 📝 Development Notes

### **Code Style**
- Comments are written in Hinglish for better readability
- Consistent spacing and formatting throughout
- Modular route organization

### **Database Models**
- **User**: Stores authentication and profile data
- **Company**: Job postings with eligibility criteria
- **Application**: Links students to companies with status tracking
- **Resume**: Stores resume data (form or uploaded file)
- **Notification**: In-app notification system
- **Talent**: Extended talent profile (optional)

### **Middleware Chain**
1. Body parsing (urlencoded, json)
2. Method override (for PUT/DELETE via POST)
3. Morgan logging
4. Static file serving
5. Rate limiting
6. Session management
7. User locals (currentUser for all views)
8. Route-specific authentication/authorization

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the ISC License.

---

## 👨‍💻 Author

Developed as part of the G1-BEE-PID-21 project.

---

## 🙏 Acknowledgments

- **Groq** for providing high-speed LLM inference
- **MongoDB** for robust database solutions
- **Node.js & Express.js** community

---

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Check the troubleshooting section above
- Review server logs for detailed error messages

---

**Happy Recruiting! 🎉**
