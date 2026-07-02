const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Frontend static files serve karo


// DB connect
require('./config/db');

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/leads',     require('./routes/leads'));
app.use('/api/meetings',  require('./routes/meetings'));
app.use('/api/followups', require('./routes/followups'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/revenue',  require('./routes/revenue'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/domains', require('./routes/domains'));

// Root — login page pe redirect
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'LeadsPro Backend Running'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
