const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Frontend static files serve karo
app.use(express.static(path.join(__dirname, '../frontend')));

// DB connect
require('./config/db');

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/leads',     require('./routes/leads'));
app.use('/api/meetings',  require('./routes/meetings'));
app.use('/api/followups', require('./routes/followups'));

// Root — login page pe redirect
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'routes/frontend/login.html'));
});

// 404 handler
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }
  res.sendFile(path.join(__dirname, 'routes/frontend/login.html'));
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