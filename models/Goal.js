const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  thrustArea: {
    type: String,
    required: true,
    enum: ['Revenue', 'Cost', 'Quality', 'People', 'Customer', 'Innovation', 'Compliance', 'Other'],
  },

  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 500 },

  uom: {
    type: String,
    required: true,
    enum: ['Numeric', 'Percentage', 'Timeline', 'Zero-based'],
  },

  target: { type: Number, required: true },
  achieved: { type: Number, default: null },

  // 'min' = higher achieved is better (default); 'max' = lower achieved is better (cost goals)
  direction: { type: String, enum: ['min', 'max'], default: 'min' },

  // Quarter tag for filtering, e.g. "Q2-2025"
  quarter: { type: String, default: null },

  // Per-quarter check-in history
  checkins: [{
    quarter:   { type: String },
    achieved:  { type: Number },
    note:      { type: String, default: '' },
    loggedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    loggedAt:  { type: Date, default: Date.now },
    isComment: { type: Boolean, default: false },
  }],

  weightage: {
    type: Number,
    required: true,
    min: [10, 'Minimum weightage is 10%'],
    max: [100, 'Maximum weightage is 100%'],
  },

  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'rejected', 'revision'],
    default: 'draft',
  },

  isLocked: { type: Boolean, default: false },

  // Manager feedback during review
  managerComment: { type: String, trim: true, default: '' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },

  // Shared/pushed goal flag
  isPushed: { type: Boolean, default: false },
  pushedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// Pre-save: auto-lock when approved
goalSchema.pre('save', function (next) {
  if (this.status === 'approved') this.isLocked = true;
  next();
});

module.exports = mongoose.model('Goal', goalSchema);
