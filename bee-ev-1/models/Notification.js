// Notification model - simple student-facing notifications
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    // Who should see this notification: 'all', 'students', 'recruiters', etc.
    audience: { type: String, default: 'all' }, // later: year/branch specific
    // Optional specific recipient (for per-candidate updates like selection/rejection)
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
