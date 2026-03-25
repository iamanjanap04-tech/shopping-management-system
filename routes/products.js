const express = require('express');
const router = express.Router();

const db = require('../config/db');


const { auth, adminOnly } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

async function ensureDescriptionColumn(db) {
  try {
    await db.query('ALTER TABLE PRODUCTS ADD COLUMN DESCRIPTION TEXT');
  } catch (e) {
    if (
      e.code !== 'ER_DUP_FIELDNAME' &&
      e.code !== 'ER_PARSE_ERROR' &&
      e.code !== 'ER_TABLEACCESS_DENIED_ERROR' &&
      e.code !== 'ER_DBACCESS_DENIED_ERROR'
    ) {
      throw e;
    }
  }
}


// ============================================
// GET /products
// ============================================
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const { minPrice, maxPrice, inStock, q } = req.query;

    let sql = `
      SELECT p.*,
      ROUND(p.PRICE * (1 - IFNULL(p.DISCOUNT, 0) / 100), 2) AS FINAL_PRICE,
      IFNULL(rv.AVG_RATING, 0) AS AVG_RATING,
      IFNULL(rv.TOTAL_REVIEWS, 0) AS TOTAL_REVIEWS
      FROM PRODUCTS p
      LEFT JOIN (
        SELECT PRODUCT_ID,
               ROUND(AVG(RATING), 1) AS AVG_RATING,
               COUNT(*) AS TOTAL_REVIEWS
        FROM REVIEWS
        GROUP BY PRODUCT_ID
      ) rv ON rv.PRODUCT_ID = p.PRODUCT_ID
      WHERE 1=1
    `;

    const values = [];

    if (minPrice) {
      sql += ` AND p.PRICE >= ?`;
      values.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      sql += ` AND p.PRICE <= ?`;
      values.push(parseFloat(maxPrice));
    }

    if (inStock === 'true') {
      sql += ` AND p.STOCK > 0`;
    }

    if (q && String(q).trim()) {
      const terms = String(q).trim().split(/\s+/).filter(Boolean).slice(0, 5);
      if (terms.length) {
        const clauses = terms.map(() => `(p.NAME LIKE ? OR IFNULL(p.DESCRIPTION, '') LIKE ?)`);
        sql += ` AND (${clauses.join(' OR ')})`;
        terms.forEach((term) => {
          const search = `%${term}%`;
          values.push(search, search);
        });
      }
    }

    sql += ` ORDER BY p.PRODUCT_ID`;

    const [rows] = await db.query(sql, values);
    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});


// ============================================
// GET /products/:id
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();

    const [rows] = await db.query(
      `SELECT p.*,
       ROUND(p.PRICE * (1 - IFNULL(p.DISCOUNT, 0) / 100), 2) AS FINAL_PRICE,
       (
         SELECT ROUND(AVG(r.RATING), 1)
         FROM REVIEWS r
         WHERE r.PRODUCT_ID = p.PRODUCT_ID
       ) AS AVG_RATING,
       (
         SELECT COUNT(*)
         FROM REVIEWS r
         WHERE r.PRODUCT_ID = p.PRODUCT_ID
       ) AS TOTAL_REVIEWS
       FROM PRODUCTS p WHERE p.PRODUCT_ID = ?`,
      [req.params.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: 'Product not found' });

    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});


// ============================================
// POST /products
// ============================================
router.post('/', auth, adminOnly, upload.single('image'), async (req, res) => {
  try {
    const db = getDB();
    const { name, price, discount, stock, description } = req.body;

    if (!name || !price)
      return res.status(400).json({ error: 'Name and price required' });

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : 'default-product.png';

    try {
      await db.query(
        `INSERT INTO PRODUCTS (NAME, PRICE, DISCOUNT, STOCK, IMAGE_URL, DESCRIPTION)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          name,
          parseFloat(price) || 0,
          parseFloat(discount) || 0,
          parseInt(stock) || 0,
          imageUrl,
          description || ''
        ]
      );
    } catch (e) {
      if (e.code !== 'ER_BAD_FIELD_ERROR') throw e;
      await ensureDescriptionColumn(db);
      try {
        await db.query(
          `INSERT INTO PRODUCTS (NAME, PRICE, DISCOUNT, STOCK, IMAGE_URL, DESCRIPTION)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            name,
            parseFloat(price) || 0,
            parseFloat(discount) || 0,
            parseInt(stock) || 0,
            imageUrl,
            description || ''
          ]
        );
        return res.status(201).json({ message: 'Product added' });
      } catch (inner) {
        if (inner.code !== 'ER_BAD_FIELD_ERROR') throw inner;
      }
      await db.query(
        `INSERT INTO PRODUCTS (NAME, PRICE, DISCOUNT, STOCK, IMAGE_URL)
         VALUES (?, ?, ?, ?, ?)`,
        [
          name,
          parseFloat(price) || 0,
          parseFloat(discount) || 0,
          parseInt(stock) || 0,
          imageUrl
        ]
      );
    }

    res.status(201).json({ message: 'Product added' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add product' });
  }
});


// ============================================
// PUT /products/:id
// ============================================
router.put('/:id', auth, adminOnly, upload.single('image'), async (req, res) => {
  try {
    const db = getDB();
    const { name, price, discount, stock, description } = req.body;
    const id = req.params.id;

    let sql = `
      UPDATE PRODUCTS 
      SET NAME = ?, PRICE = ?, DISCOUNT = ?, STOCK = ?, DESCRIPTION = ?
    `;

    const values = [
      name || '',
      parseFloat(price) || 0,
      parseFloat(discount) || 0,
      parseInt(stock) || 0,
      description || ''
    ];

    if (req.file) {
      sql += `, IMAGE_URL = ?`;
      values.push(`/uploads/${req.file.filename}`);
    }

    sql += ` WHERE PRODUCT_ID = ?`;
    values.push(id);

    let result;
    try {
      [result] = await db.query(sql, values);
    } catch (e) {
      if (e.code !== 'ER_BAD_FIELD_ERROR') throw e;
      await ensureDescriptionColumn(db);
      try {
        [result] = await db.query(sql, values);
      } catch (inner) {
        if (inner.code !== 'ER_BAD_FIELD_ERROR') throw inner;
      }
      if (result) {
        if (result.affectedRows === 0)
          return res.status(404).json({ error: 'Product not found' });
        return res.json({ message: 'Product updated' });
      }
      let fallbackSql = `
        UPDATE PRODUCTS 
        SET NAME = ?, PRICE = ?, DISCOUNT = ?, STOCK = ?
      `;
      const fallbackValues = [
        name || '',
        parseFloat(price) || 0,
        parseFloat(discount) || 0,
        parseInt(stock) || 0
      ];
      if (req.file) {
        fallbackSql += `, IMAGE_URL = ?`;
        fallbackValues.push(`/uploads/${req.file.filename}`);
      }
      fallbackSql += ` WHERE PRODUCT_ID = ?`;
      fallbackValues.push(id);
      [result] = await db.query(fallbackSql, fallbackValues);
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'Product not found' });

    res.json({ message: 'Product updated' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});


// ============================================
// DELETE /products/:id
// ============================================
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();

    const [result] = await db.query(
      `DELETE FROM PRODUCTS WHERE PRODUCT_ID = ?`,
      [req.params.id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'Product not found' });

    res.json({ message: 'Product deleted' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;