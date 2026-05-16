const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // What was changed
  goalId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', required: true },
  ownerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Who did it
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role:      { type: String, enum: ['employee','manager','admin'], required: true },

  // What changed (field-level diff)
  action:    { type: String, enum: ['checkin','edit','comment','approve','reject','push'], required: true },
  field:     { type: String, default: null },          // e.g. "achieved", "target", "weightage"
  oldValue:  { type: mongoose.Schema.Types.Mixed, default: null },
  newValue:  { type: mongoose.Schema.Types.Mixed, default: null },

  // Free-text note (e.g. manager comment)
  note:      { type: String, trim: true, default: '' },

  // Quarter context
  quarter:   { type: String, default: () => {
    const m = new Date().getMonth();
    return `Q${Math.ceil((m + 1) / 3)}-${new Date().getFullYear()}`;
  }},

  // Was this change made after the goal was locked?
  postLock:  { type: Boolean, default: false },
}, { timestamps: true });

// Index for fast queries per goal / per user
auditLogSchema.index({ goalId: 1, createdAt: -1 });
auditLogSchema.index({ ownerId: 1, createdAt: -1 });
auditLogSchema.index({ changedBy: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
