const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USERNAME || 'student',
  password: process.env.DB_PASSWORD || 'student666',
  database: process.env.DB_DATABASE || 'fitness',
  // 如果需要 SSL 連線可以根據環境變數開關
  ssl: process.env.DB_ENABLE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

/**
 * 測試資料庫連線
 */
const checkConnection = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('Successfully connected to PostgreSQL Database.');
    return true;
  } catch (err) {
    console.error('Failed to connect to PostgreSQL Database:', err.message);
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
};

module.exports = {
  pool,
  checkConnection,
  // 封裝一個通用的 query 函式
  query: (text, params) => pool.query(text, params),
};
