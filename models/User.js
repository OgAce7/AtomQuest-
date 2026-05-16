const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['employee', 'manager', 'admin'], default: 'employee' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  department: { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
