const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const { auth } = require('../middleware/auth');


// ============================================
// POST /cart (Add to cart)
// ============================================
router.post('/', auth, async (req, res) => {
  try {
    const db = getDB();
    const { productId, quantity } = req.body;
    const userId = req.user.userId;

    if (!productId || !quantity) {
      return res.status(400).json({ error: 'Product ID and quantity required' });
    }

    // Check stock
    const [stockRows] = await db.query(
      `SELECT STOCK FROM PRODUCTS WHERE PRODUCT_ID = ?`,
      [productId]
    );

    if (stockRows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const availableStock = stockRows[0].STOCK;

    if (quantity > availableStock) {
      return res.status(400).json({ error: `Only ${availableStock} items in stock` });
    }

    // Check if already in cart
    const [existingRows] = await db.query(
      `SELECT CART_ID, QUANTITY FROM CART WHERE USER_ID = ? AND PRODUCT_ID = ?`,
      [userId, productId]
    );

    if (existingRows.length > 0) {
      const newQty = existingRows[0].QUANTITY + parseInt(quantity);

      if (newQty > availableStock) {
        return res.status(400).json({ error: `Cannot exceed stock of ${availableStock}` });
      }

      await db.query(
        `UPDATE CART SET QUANTITY = ? WHERE CART_ID = ?`,
        [newQty, existingRows[0].CART_ID]
      );

    } else {
      await db.query(
        `INSERT INTO CART (USER_ID, PRODUCT_ID, QUANTITY) VALUES (?, ?, ?)`,
        [userId, productId, parseInt(quantity)]
      );
    }

    res.json({ message: 'Added to cart' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});


// ============================================
// GET /cart
// ============================================
router.get('/', auth, async (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.userId;

    const [rows] = await db.query(
      `SELECT c.CART_ID, c.PRODUCT_ID, c.QUANTITY,
              p.NAME, p.PRICE, p.DISCOUNT, p.STOCK, p.IMAGE_URL,
              ROUND(p.PRICE * (1 - IFNULL(p.DISCOUNT, 0) / 100), 2) AS UNIT_PRICE
       FROM CART c
       JOIN PRODUCTS p ON c.PRODUCT_ID = p.PRODUCT_ID
       WHERE c.USER_ID = ?`,
      [userId]
    );

    const items = rows.map(r => ({
      ...r,
      SUBTOTAL: (r.UNIT_PRICE * r.QUANTITY).toFixed(2),
    }));

    const total = items.reduce((sum, i) => sum + parseFloat(i.SUBTOTAL), 0);

    res.json({ items, total: total.toFixed(2) });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});


// ============================================
// DELETE /cart/:productId
// ============================================
router.delete('/:productId', auth, async (req, res) => {
  try {
    const db = getDB();

    await db.query(
      `DELETE FROM CART WHERE USER_ID = ? AND PRODUCT_ID = ?`,
      [req.user.userId, req.params.productId]
    );

    res.json({ message: 'Removed from cart' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove' });
  }
});

module.exports = router;