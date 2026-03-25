const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const { auth, adminOnly, customerOnly } = require('../middleware/auth');


// ============================================
// POST /orders (checkout using MySQL procedure)
// ============================================
router.post('/', auth, customerOnly, async (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.userId;

    // Check if cart is empty
    const [cartRows] = await db.query(
      `SELECT COUNT(*) AS CNT FROM CART WHERE USER_ID = ?`,
      [userId]
    );

    if (cartRows[0].CNT === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Call MySQL procedure
    await db.query(`CALL PLACE_ORDER(?, @order_id)`, [userId]);

    // Get OUT value
    const [outResult] = await db.query(`SELECT @order_id AS orderId`);
    const orderId = outResult[0].orderId;

    // Get total
    const [orderRows] = await db.query(
      `SELECT TOTAL_AMOUNT FROM ORDERS WHERE ORDER_ID = ?`,
      [orderId]
    );

    const total = orderRows[0]?.TOTAL_AMOUNT || 0;

    res.status(201).json({
      message: 'Order placed',
      orderId,
      total
    });

  } catch (err) {
    if (err.message && err.message.includes('Insufficient stock')) {
      return res.status(400).json({ error: err.message });
    }

    console.error(err);
    res.status(500).json({ error: 'Checkout failed' });
  }
});


// ============================================
// GET /orders
// ============================================
router.get('/', auth, async (req, res) => {
  try {
    const db = getDB();
    let rows;

    if (req.user.role === 'Admin') {
      const [result] = await db.query(
        `SELECT o.*, u.NAME AS CUSTOMER_NAME, u.EMAIL
         FROM ORDERS o
         JOIN USERS u ON o.USER_ID = u.USER_ID
         ORDER BY o.ORDER_ID DESC`
      );
      rows = result;
    } else {
      const [result] = await db.query(
        `SELECT * FROM ORDERS WHERE USER_ID = ? ORDER BY ORDER_ID DESC`,
        [req.user.userId]
      );
      rows = result;
    }

    // Fetch items for each order
    const ordersWithItems = await Promise.all(
      rows.map(async (order) => {
        const [items] = await db.query(
          `SELECT oi.*, p.NAME
           FROM ORDER_ITEMS oi
           JOIN PRODUCTS p ON oi.PRODUCT_ID = p.PRODUCT_ID
           WHERE oi.ORDER_ID = ?`,
          [order.ORDER_ID]
        );

        return { ...order, items };
      })
    );

    res.json(ordersWithItems);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});


// ============================================
// PUT /orders/:id/status
// ============================================
router.put('/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();
    const { status } = req.body;

    const valid = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const [result] = await db.query(
      `UPDATE ORDERS SET STATUS = ? WHERE ORDER_ID = ?`,
      [status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Status updated' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;