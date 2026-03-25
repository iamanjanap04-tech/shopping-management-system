const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');


// ============================================
// GET /reports/daily
// ============================================
router.get('/daily', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();

    const [todayRows] = await db.query(
      `SELECT COUNT(*) AS ORDER_COUNT,
              IFNULL(SUM(TOTAL_AMOUNT), 0) AS REVENUE
       FROM ORDERS
       WHERE DATE(CREATED_AT) = CURDATE()`
    );

    const [yesterdayRows] = await db.query(
      `SELECT COUNT(*) AS ORDER_COUNT,
              IFNULL(SUM(TOTAL_AMOUNT), 0) AS REVENUE
       FROM ORDERS
       WHERE DATE(CREATED_AT) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`
    );

    const orderCount = Number(todayRows[0]?.ORDER_COUNT || 0);
    const revenue = Number(todayRows[0]?.REVENUE || 0);
    const previousOrderCount = Number(yesterdayRows[0]?.ORDER_COUNT || 0);
    const previousRevenue = Number(yesterdayRows[0]?.REVENUE || 0);
    const orderChangePct = previousOrderCount
      ? ((orderCount - previousOrderCount) / previousOrderCount) * 100
      : (orderCount > 0 ? 100 : 0);
    const revenueChangePct = previousRevenue
      ? ((revenue - previousRevenue) / previousRevenue) * 100
      : (revenue > 0 ? 100 : 0);

    const [logRows] = await db.query(
      `SELECT
         p.PRODUCT_ID,
         p.NAME AS ITEM_NAME,
         ROUND(AVG(oi.UNIT_PRICE), 2) AS UNIT_PRICE,
         SUM(oi.QUANTITY) AS QUANTITY,
         SUM(oi.SUBTOTAL) AS AMOUNT
       FROM ORDER_ITEMS oi
       JOIN ORDERS o ON o.ORDER_ID = oi.ORDER_ID
       JOIN PRODUCTS p ON p.PRODUCT_ID = oi.PRODUCT_ID
       WHERE DATE(o.CREATED_AT) = CURDATE()
       GROUP BY p.PRODUCT_ID, p.NAME
       ORDER BY AMOUNT DESC, p.PRODUCT_ID ASC`
    );

    let normalizedLogRows = logRows;
    if (!normalizedLogRows.length && orderCount > 0) {
      const [orderFallbackRows] = await db.query(
        `SELECT
           o.ORDER_ID,
           o.TOTAL_AMOUNT
         FROM ORDERS o
         WHERE DATE(o.CREATED_AT) = CURDATE()
         ORDER BY o.ORDER_ID DESC`
      );
      normalizedLogRows = orderFallbackRows.map((row) => ({
        PRODUCT_ID: null,
        ITEM_NAME: `Order #${row.ORDER_ID}`,
        UNIT_PRICE: row.TOTAL_AMOUNT,
        QUANTITY: 1,
        AMOUNT: row.TOTAL_AMOUNT,
      }));
    }

    res.json({
      date: new Date().toISOString().split('T')[0],
      orderCount,
      revenue: revenue.toFixed(2),
      previous: {
        orderCount: previousOrderCount,
        revenue: previousRevenue.toFixed(2),
      },
      change: {
        orderCountPct: Number(orderChangePct.toFixed(2)),
        revenuePct: Number(revenueChangePct.toFixed(2)),
      },
      logItems: normalizedLogRows.map((row) => ({
        productId: row.PRODUCT_ID,
        itemName: row.ITEM_NAME,
        unitPrice: Number(row.UNIT_PRICE || 0),
        quantity: Number(row.QUANTITY || 0),
        amount: Number(row.AMOUNT || 0),
        total: Number(row.AMOUNT || 0),
      })),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch daily report' });
  }
});


// ============================================
// GET /reports/monthly
// ============================================
router.get('/monthly', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();

    const [currentRows] = await db.query(
      `SELECT COUNT(*) AS ORDER_COUNT,
              IFNULL(SUM(TOTAL_AMOUNT), 0) AS REVENUE
       FROM ORDERS
       WHERE MONTH(CREATED_AT) = MONTH(CURDATE())
         AND YEAR(CREATED_AT) = YEAR(CURDATE())`
    );

    const [previousRows] = await db.query(
      `SELECT COUNT(*) AS ORDER_COUNT,
              IFNULL(SUM(TOTAL_AMOUNT), 0) AS REVENUE
       FROM ORDERS
       WHERE MONTH(CREATED_AT) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
         AND YEAR(CREATED_AT) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))`
    );

    const orderCount = Number(currentRows[0]?.ORDER_COUNT || 0);
    const revenue = Number(currentRows[0]?.REVENUE || 0);
    const previousOrderCount = Number(previousRows[0]?.ORDER_COUNT || 0);
    const previousRevenue = Number(previousRows[0]?.REVENUE || 0);
    const orderChangePct = previousOrderCount
      ? ((orderCount - previousOrderCount) / previousOrderCount) * 100
      : (orderCount > 0 ? 100 : 0);
    const revenueChangePct = previousRevenue
      ? ((revenue - previousRevenue) / previousRevenue) * 100
      : (revenue > 0 ? 100 : 0);

    const [logRows] = await db.query(
      `SELECT
         p.PRODUCT_ID,
         p.NAME AS ITEM_NAME,
         ROUND(AVG(oi.UNIT_PRICE), 2) AS UNIT_PRICE,
         SUM(oi.QUANTITY) AS QUANTITY,
         SUM(oi.SUBTOTAL) AS AMOUNT
       FROM ORDER_ITEMS oi
       JOIN ORDERS o ON o.ORDER_ID = oi.ORDER_ID
       JOIN PRODUCTS p ON p.PRODUCT_ID = oi.PRODUCT_ID
       WHERE MONTH(o.CREATED_AT) = MONTH(CURDATE())
         AND YEAR(o.CREATED_AT) = YEAR(CURDATE())
       GROUP BY p.PRODUCT_ID, p.NAME
       ORDER BY AMOUNT DESC, p.PRODUCT_ID ASC`
    );

    let normalizedLogRows = logRows;
    if (!normalizedLogRows.length && orderCount > 0) {
      const [orderFallbackRows] = await db.query(
        `SELECT
           o.ORDER_ID,
           o.TOTAL_AMOUNT
         FROM ORDERS o
         WHERE MONTH(o.CREATED_AT) = MONTH(CURDATE())
           AND YEAR(o.CREATED_AT) = YEAR(CURDATE())
         ORDER BY o.ORDER_ID DESC`
      );
      normalizedLogRows = orderFallbackRows.map((row) => ({
        PRODUCT_ID: null,
        ITEM_NAME: `Order #${row.ORDER_ID}`,
        UNIT_PRICE: row.TOTAL_AMOUNT,
        QUANTITY: 1,
        AMOUNT: row.TOTAL_AMOUNT,
      }));
    }

    res.json({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      orderCount,
      revenue: revenue.toFixed(2),
      previous: {
        orderCount: previousOrderCount,
        revenue: previousRevenue.toFixed(2),
      },
      change: {
        orderCountPct: Number(orderChangePct.toFixed(2)),
        revenuePct: Number(revenueChangePct.toFixed(2)),
      },
      logItems: normalizedLogRows.map((row) => ({
        productId: row.PRODUCT_ID,
        itemName: row.ITEM_NAME,
        unitPrice: Number(row.UNIT_PRICE || 0),
        quantity: Number(row.QUANTITY || 0),
        amount: Number(row.AMOUNT || 0),
        total: Number(row.AMOUNT || 0),
      })),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch monthly report' });
  }
});


// ============================================
// GET /reports/inventory
// ============================================
router.get('/inventory', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();

    const [lowStock] = await db.query(
      `SELECT * FROM PRODUCTS WHERE STOCK > 0 AND STOCK <= 10 ORDER BY STOCK`
    );

    const [outOfStock] = await db.query(
      `SELECT * FROM PRODUCTS WHERE STOCK = 0`
    );

    res.json({
      lowStock,
      outOfStock,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// ============================================
// GET /reports/trends
// ============================================
router.get('/trends', auth, adminOnly, async (req, res) => {
  try {
    const db = getDB();

    const [dailyRows] = await db.query(
      `SELECT
         DATE(CREATED_AT) AS DAY_DATE,
         IFNULL(SUM(TOTAL_AMOUNT), 0) AS REVENUE
       FROM ORDERS
       WHERE DATE(CREATED_AT) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(CREATED_AT)
       ORDER BY DATE(CREATED_AT) ASC`
    );

    const [monthlyRows] = await db.query(
      `SELECT
         DATE_FORMAT(CREATED_AT, '%Y-%m-01') AS MONTH_DATE,
         IFNULL(SUM(TOTAL_AMOUNT), 0) AS REVENUE
       FROM ORDERS
       WHERE CREATED_AT >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
       GROUP BY DATE_FORMAT(CREATED_AT, '%Y-%m-01')
       ORDER BY MONTH_DATE ASC`
    );

    const dailyMap = new Map(
      dailyRows.map((row) => [
        new Date(row.DAY_DATE).toISOString().split('T')[0],
        Number(row.REVENUE || 0),
      ])
    );

    const monthlyMap = new Map(
      monthlyRows.map((row) => [
        new Date(row.MONTH_DATE).toISOString().split('T')[0],
        Number(row.REVENUE || 0),
      ])
    );

    const daily = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      daily.push({ label: key, revenue: dailyMap.get(key) || 0 });
    }

    const monthly = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().split('T')[0];
      monthly.push({ label: key, revenue: monthlyMap.get(key) || 0 });
    }

    res.json({ daily, monthly });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch report trends' });
  }
});

module.exports = router;