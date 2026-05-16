const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const { auditMiddleware } = require('./middleware/auditMiddleware');

const app = express();
app.use(cors());
app.use(express.json());
app.use(auditMiddleware); // attach req.writeAudit on every request

// Routes
app.use('/api/goals',    require('./routes/goals'));
app.use('/api/checkins', require('./routes/checkins'));
app.use('/api/admin',    require('./routes/admin'));

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// DB + Server
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/atomquest';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ DB connection error:', err.message);
    process.exit(1);
  });
