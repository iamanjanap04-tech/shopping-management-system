const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const { auth } = require('../middleware/auth');


// ============================================
// POST /payments
// ============================================
router.post('/', auth, async (req, res) => {
  try {
    const db = getDB();
    const { orderId, amount } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({
        error: 'Order ID and amount required'
      });
    }

    await db.query(
      `INSERT INTO PAYMENTS (ORDER_ID, AMOUNT, STATUS)
       VALUES (?, ?, 'COMPLETED')`,
      [orderId, amount]
    );

    res.status(201).json({ message: 'Payment recorded' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Payment failed' });
  }
});

module.exports = router;