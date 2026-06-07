const mysql = require('mysql2/promise'); // promise wrapper use kiya hai
require('dotenv').config();

// Connection Configuration
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'leadspro',
  port: 3306
};

// Promise-based connection pooling setup (best practice for production/dev)
const pool = mysql.createPool(dbConfig);

// Connection check karne ke liye ek immediate test function
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL Connected perfectly with Promises!');
    connection.release(); // connection test karke free kiya
  } catch (err) {
    console.log('❌ DB Connection Failed:', err.message);
  }
})();

module.exports = pool;