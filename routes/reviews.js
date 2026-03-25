const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const { auth, customerOnly } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../public/uploads/reviews');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });


// ============================================
// GET /reviews/:productId
// ============================================
router.get('/:productId', async (req, res) => {
  try {
    const db = getDB();

    // Get reviews (compatible with older DBs before REVIEW_IMAGE_URL exists)
    let reviews = [];
    try {
      const [rows] = await db.query(
        `SELECT r.*, u.NAME, IFNULL(r.REVIEW_IMAGE_URL, '') AS REVIEW_IMAGE_URL
         FROM REVIEWS r
         JOIN USERS u ON r.USER_ID = u.USER_ID
         WHERE r.PRODUCT_ID = ?
         ORDER BY r.CREATED_AT DESC`,
        [req.params.productId]
      );
      reviews = rows;
    } catch (e) {
      if (e.code !== 'ER_BAD_FIELD_ERROR') throw e;
      const [rows] = await db.query(
        `SELECT r.*, u.NAME
         FROM REVIEWS r
         JOIN USERS u ON r.USER_ID = u.USER_ID
         WHERE r.PRODUCT_ID = ?
         ORDER BY r.CREATED_AT DESC`,
        [req.params.productId]
      );
      reviews = rows.map((r) => ({ ...r, REVIEW_IMAGE_URL: '' }));
    }

    // Get average rating
    const [avgRows] = await db.query(
      `SELECT ROUND(AVG(RATING), 2) AS AVG_RATING,
              COUNT(*) AS TOTAL
       FROM REVIEWS
       WHERE PRODUCT_ID = ?`,
      [req.params.productId]
    );

    res.json({
      reviews,
      averageRating: avgRows[0]?.AVG_RATING || 0,
      totalReviews: avgRows[0]?.TOTAL || 0,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});


// ============================================
// POST /reviews
// ============================================
router.post('/', auth, customerOnly, upload.single('image'), async (req, res) => {
  try {
    const db = getDB();
    const { productId, rating, comment } = req.body;
    const userId = req.user.userId;

    if (!productId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Product ID and rating (1-5) required'
      });
    }

    // Check if user purchased product
    const [purchasedRows] = await db.query(
      `SELECT 1
       FROM ORDER_ITEMS oi
       JOIN ORDERS o ON oi.ORDER_ID = o.ORDER_ID
       WHERE o.USER_ID = ? AND oi.PRODUCT_ID = ?
       LIMIT 1`,
      [userId, productId]
    );

    if (purchasedRows.length === 0) {
      return res.status(403).json({
        error: 'You must purchase this product before reviewing'
      });
    }

    // Check existing review
    const [existingRows] = await db.query(
      `SELECT 1 FROM REVIEWS WHERE USER_ID = ? AND PRODUCT_ID = ?`,
      [userId, productId]
    );

    if (existingRows.length > 0) {
      return res.status(400).json({
        error: 'You have already reviewed this product'
      });
    }

    const reviewImageUrl = req.file ? `/uploads/reviews/${req.file.filename}` : '';

    // Insert review
    try {
      await db.query(
        `INSERT INTO REVIEWS (USER_ID, PRODUCT_ID, RATING, COMMENT, REVIEW_IMAGE_URL)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          productId,
          parseInt(rating),
          comment || '',
          reviewImageUrl
        ]
      );
    } catch (e) {
      if (e.code !== 'ER_BAD_FIELD_ERROR') throw e;
      await db.query(
        `INSERT INTO REVIEWS (USER_ID, PRODUCT_ID, RATING, COMMENT)
         VALUES (?, ?, ?, ?)`,
        [
          userId,
          productId,
          parseInt(rating),
          comment || ''
        ]
      );
    }

    res.status(201).json({ message: 'Review added' });

  } catch (err) {

    // MySQL duplicate check
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        error: 'You have already reviewed this product'
      });
    }

    console.error(err);
    res.status(500).json({ error: 'Failed to add review' });
  }
});

module.exports = router;