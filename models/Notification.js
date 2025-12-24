const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    // kiske liye notification hai wo yahan batayenge
    audience: { type: String, default: 'all' },
    // agar kisi specific bande ko bhejna ho to
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
