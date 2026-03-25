require('dotenv').config();
const bcrypt = require('bcryptjs');
const oracledb = require('oracledb');

async function seed() {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECTION_STRING,
    });

    const hash = await bcrypt.hash('admin123', 10);
    await conn.execute(
      `INSERT INTO USERS (NAME, EMAIL, PASSWORD, ROLE) VALUES (:name, :email, :password, :role)`,
      { name: 'Admin', email: 'admin@shop.com', password: hash, role: 'Admin' }
    );
    await conn.commit();
    console.log('Admin user created: admin@shop.com / admin123');
  } catch (err) {
    if (err.errorNum === 1) console.log('Admin user already exists');
    else throw err;
  } finally {
    if (conn) await conn.close();
  }
}

seed();
