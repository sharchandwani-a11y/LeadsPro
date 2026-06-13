const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306
};

const pool = mysql.createPool(dbConfig);

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL Connected perfectly with Promises!');
    connection.release();
  } catch (err) {
    console.log('❌ DB Connection Failed:', err.message);
  }
})();

module.exports = pool;