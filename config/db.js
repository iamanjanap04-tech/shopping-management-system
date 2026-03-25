const mysql = require('mysql2/promise');

let pool;

async function initialize() {
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
  });

  console.log("✅ MySQL Connected");
}

function getPool() {
  return pool;
}

module.exports = { initialize, getPool };