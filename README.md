# ShopMax - Shopping Management System

A full-stack e-commerce web application with **Customer** and **Admin** roles, built with Node.js (Express), Oracle DB, and vanilla HTML/CSS/JavaScript.

## Features

- **Homepage**: Amazon-like product grid with filters, discount badges, stock status
- **Authentication**: JWT-based login/signup with bcrypt password hashing
- **Customer**: Product browse, cart, checkout, order tracking, product reviews (1-5 stars)
- **Admin**: Product CRUD, order management, inventory control, daily/monthly reports
- **PL/SQL**: Function (order total), Procedure (place order), Cursor (generate bill), Trigger (stock management)

## Tech Stack

- **Backend**: Node.js, Express, oracledb
- **Database**: Oracle
- **Auth**: JWT + bcrypt
- **Frontend**: HTML, CSS, JavaScript (no framework)

## Project Structure

```
microproject/
├── config/
│   └── db.js              # Oracle connection pool
├── database/
│   ├── schema.sql         # Table creation
│   ├── plsql.sql          # PL/SQL (function, procedure, cursor, trigger)
│   └── seed.js            # Create admin user
├── middleware/
│   └── auth.js            # JWT authentication
├── routes/
│   ├── auth.js            # POST /signup, POST /login
│   ├── products.js        # GET/POST/PUT/DELETE products
│   ├── cart.js            # GET/POST/DELETE cart
│   ├── orders.js          # POST/GET orders, PUT status
│   ├── payments.js        # POST payments
│   ├── reviews.js         # GET/POST reviews
│   └── reports.js         # Daily, monthly, inventory reports
├── public/
│   ├── index.html         # Homepage
│   ├── login.html
│   ├── signup.html
│   ├── products.html
│   ├── product.html       # Product detail + reviews
│   ├── cart.html
│   ├── orders.html        # Order tracking
│   ├── admin.html         # Admin dashboard
│   ├── css/style.css
│   ├── js/api.js
│   ├── js/app.js
│   └── uploads/           # Product images
├── server.js
├── package.json
└── .env.example
```

## Setup Instructions

### 1. Prerequisites

- **Node.js** (v16+)
- **Oracle Database** (XE or full)
- **Oracle Instant Client** (for oracledb on your OS)

### 2. Install Oracle Instant Client

- Download from [Oracle Instant Client](https://www.oracle.com/database/technologies/instant-client/downloads.html)
- Extract and add to `PATH` (or set `LD_LIBRARY_PATH` on Linux)

### 3. Create Environment File

```bash
cp .env.example .env
```

Edit `.env`:

```
PORT=3000
JWT_SECRET=change_this_to_a_secure_random_string
ORACLE_USER=your_schema_user
ORACLE_PASSWORD=your_password
ORACLE_CONNECTION_STRING=localhost:1521/XE
```

### 4. Run Database Scripts

In SQL*Plus or SQL Developer, connected as your schema user:

```sql
@database/schema.sql
@database/plsql.sql
```

### 5. Create Admin User

```bash
npm install
node database/seed.js
```

Default admin: **admin@shop.com** / **admin123**

### 6. Start Server

```bash
npm start
```

Or with auto-reload:

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/signup | - | Register user |
| POST | /api/auth/login | - | Login |
| GET | /api/products | - | List products (filters: minPrice, maxPrice, inStock) |
| GET | /api/products/:id | - | Product detail |
| POST | /api/products | Admin | Add product |
| PUT | /api/products/:id | Admin | Update product |
| DELETE | /api/products/:id | Admin | Delete product |
| GET | /api/cart | Customer | Get cart |
| POST | /api/cart | Customer | Add to cart |
| DELETE | /api/cart/:productId | Customer | Remove from cart |
| POST | /api/orders | Customer | Checkout (uses PL/SQL procedure) |
| GET | /api/orders | Auth | List orders |
| PUT | /api/orders/:id/status | Admin | Update order status |
| POST | /api/payments | Auth | Record payment |
| GET | /api/reviews/:productId | - | Get reviews |
| POST | /api/reviews | Customer | Add review (purchased only) |
| GET | /api/reports/daily | Admin | Daily report |
| GET | /api/reports/monthly | Admin | Monthly report |
| GET | /api/reports/inventory | Admin | Low/out of stock |

## PL/SQL Components

1. **CALC_ORDER_TOTAL(order_id)** – Function to compute order total from ORDER_ITEMS
2. **PLACE_ORDER(user_id, order_id OUT)** – Procedure: create order, move cart → order_items, clear cart
3. **GENERATE_BILL(order_id)** – Procedure with cursor to output product, qty, price, total
4. **TRG_STOCK_MANAGEMENT** – Trigger before INSERT on ORDER_ITEMS: check stock, prevent over-order, reduce stock

## User Flows

### Customer

1. Browse products on homepage
2. Sign up / Log in
3. Add products to cart (validates stock)
4. Checkout → order created, cart cleared
5. Track order status (PENDING → CONFIRMED → SHIPPED → DELIVERED)
6. After purchase, add review (1–5 stars, comment)

### Admin

1. Log in as Admin
2. **Products**: Add, edit, delete products (name, price, discount, stock, image)
3. **Orders**: View all orders, update status
4. **Inventory**: View low stock (≤10) and out-of-stock items
5. **Reports**: Daily and monthly order count and revenue

## Notes

- Product images: upload via Admin; stored in `public/uploads/`
- Reviews: only customers who purchased the product can add a review, one per product
- Stock is validated on add-to-cart and enforced by trigger on order placement
