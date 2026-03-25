const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { getDB } = require('../config/db');


// ============================================
// POST /signup
// ============================================
router.post('/signup', async (req, res) => {
  try {
    const db = getDB();
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        error: 'All fields required: name, email, password, role'
      });
    }

    if (!['Customer', 'Admin'].includes(role)) {
      return res.status(400).json({
        error: 'Role must be Customer or Admin'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO USERS (NAME, EMAIL, PASSWORD, ROLE)
       VALUES (?, ?, ?, ?)`,
      [name, email, hashedPassword, role]
    );

    res.status(201).json({ message: 'User registered successfully' });

  } catch (err) {
    // MySQL duplicate email error
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email already exists' });
    }

    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});


// ============================================
// POST /login
// ============================================
router.post('/login', async (req, res) => {
  try {
    const db = getDB();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password required'
      });
    }

    const [rows] = await db.query(
      `SELECT USER_ID, NAME, EMAIL, PASSWORD, ROLE
       FROM USERS WHERE EMAIL = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];

    const valid = await bcrypt.compare(password, user.PASSWORD);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.USER_ID, role: user.ROLE },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.USER_ID,
        name: user.NAME,
        email: user.EMAIL,
        role: user.ROLE,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;