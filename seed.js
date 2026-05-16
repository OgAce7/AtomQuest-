const mongoose = require('mongoose');
const User = require('./models/User'); 
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/atomquest';

const seedUsers = [
  { _id: new mongoose.Types.ObjectId('64a1b2c3d4e5f6a7b8c9d001'), name: 'Priya Sharma', email: 'priya@co.in', password: '123', role: 'employee', department: 'Engineering' },
  { _id: new mongoose.Types.ObjectId('64a1b2c3d4e5f6a7b8c9d002'), name: 'Arjun Mehta', email: 'arjun@co.in', password: '123', role: 'employee', department: 'Engineering' },
  { _id: new mongoose.Types.ObjectId('64a1b2c3d4e5f6a7b8c9d003'), name: 'Sneha Iyer', email: 'sneha@co.in', password: '123', role: 'employee', department: 'Product' },
  { _id: new mongoose.Types.ObjectId('64a1b2c3d4e5f6a7b8c9d004'), name: 'Kavita Nair', email: 'kavita@co.in', password: '123', role: 'manager', department: 'Engineering' },
  { _id: new mongoose.Types.ObjectId('64a1b2c3d4e5f6a7b8c9d005'), name: 'Rahul Joshi', email: 'rahul@co.in', password: '123', role: 'admin', department: 'HR' }
];

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('🌱 Connected to MongoDB...');
    await User.deleteMany({}); 
    const users = await User.insertMany(seedUsers);

    // Link employees to the manager (Kavita)
    await User.updateMany({ role: 'employee' }, { managerId: '64a1b2c3d4e5f6a7b8c9d004' });
    console.log('✅ Users seeded and hierarchy linked!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding database:', err);
    process.exit(1);
  }
}
run();