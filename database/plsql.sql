-- ============================================
-- STORED FUNCTIONS, PROCEDURES, TRIGGER (MYSQL)
-- ============================================

DELIMITER $$

-- ============================================
-- 1. FUNCTION: CALCULATE ORDER TOTAL
-- ============================================
CREATE FUNCTION CALC_ORDER_TOTAL(p_order_id INT)
RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_qty INT;
    DECLARE v_price DECIMAL(10,2);
    DECLARE v_total DECIMAL(10,2) DEFAULT 0;

    DECLARE cur CURSOR FOR
        SELECT QUANTITY, UNIT_PRICE
        FROM ORDER_ITEMS
        WHERE ORDER_ID = p_order_id;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_qty, v_price;
        IF done THEN
            LEAVE read_loop;
        END IF;

        SET v_total = v_total + (v_qty * v_price);
    END LOOP;

    CLOSE cur;

    RETURN v_total;
END$$

-- ============================================
-- 2. PROCEDURE: PLACE ORDER
-- ============================================
CREATE PROCEDURE PLACE_ORDER(
    IN p_user_id INT,
    OUT p_order_id INT
)
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_product_id INT;
    DECLARE v_qty INT;
    DECLARE v_price DECIMAL(10,2);
    DECLARE v_discount DECIMAL(5,2);
    DECLARE v_unit_price DECIMAL(10,2);
    DECLARE v_final_price DECIMAL(10,2);
    DECLARE v_cart_total DECIMAL(10,2) DEFAULT 0;

    DECLARE cur CURSOR FOR
        SELECT c.PRODUCT_ID, c.QUANTITY, p.PRICE, p.DISCOUNT
        FROM CART c
        JOIN PRODUCTS p ON c.PRODUCT_ID = p.PRODUCT_ID
        WHERE c.USER_ID = p_user_id;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    START TRANSACTION;

    -- Create order
    INSERT INTO ORDERS (USER_ID, TOTAL_AMOUNT, STATUS)
    VALUES (p_user_id, 0, 'PENDING');

    SET p_order_id = LAST_INSERT_ID();

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_product_id, v_qty, v_price, v_discount;
        IF done THEN
            LEAVE read_loop;
        END IF;

        SET v_unit_price = v_price * (1 - IFNULL(v_discount,0)/100);
        SET v_final_price = v_unit_price * v_qty;
        SET v_cart_total = v_cart_total + v_final_price;

        INSERT INTO ORDER_ITEMS (ORDER_ID, PRODUCT_ID, QUANTITY, UNIT_PRICE, SUBTOTAL)
        VALUES (p_order_id, v_product_id, v_qty, v_unit_price, v_final_price);

    END LOOP;

    CLOSE cur;

    -- Update total
    UPDATE ORDERS
    SET TOTAL_AMOUNT = v_cart_total
    WHERE ORDER_ID = p_order_id;

    -- Clear cart
    DELETE FROM CART WHERE USER_ID = p_user_id;

    COMMIT;

END$$

-- ============================================
-- 3. PROCEDURE: GENERATE BILL
-- ============================================
CREATE PROCEDURE GENERATE_BILL(IN p_order_id INT)
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_name VARCHAR(255);
    DECLARE v_qty INT;
    DECLARE v_price DECIMAL(10,2);
    DECLARE v_subtotal DECIMAL(10,2);
    DECLARE v_total DECIMAL(10,2) DEFAULT 0;

    DECLARE cur CURSOR FOR
        SELECT p.NAME, oi.QUANTITY, oi.UNIT_PRICE, oi.SUBTOTAL
        FROM ORDER_ITEMS oi
        JOIN PRODUCTS p ON oi.PRODUCT_ID = p.PRODUCT_ID
        WHERE oi.ORDER_ID = p_order_id;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    SELECT CONCAT('===== BILL FOR ORDER #', p_order_id, ' =====') AS BILL;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_name, v_qty, v_price, v_subtotal;
        IF done THEN
            LEAVE read_loop;
        END IF;

        SELECT CONCAT(
            v_name,
            ' | Qty: ', v_qty,
            ' | Price: $', v_price,
            ' | Total: $', v_subtotal
        ) AS ITEM;

        SET v_total = v_total + v_subtotal;

    END LOOP;

    CLOSE cur;

    SELECT '-----------------------------------' AS LINE;
    SELECT CONCAT('GRAND TOTAL: $', v_total) AS TOTAL;

END$$

-- ============================================
-- 4. TRIGGER: STOCK MANAGEMENT
-- ============================================
DELIMITER $$

DROP TRIGGER IF EXISTS TRG_STOCK_MANAGEMENT $$

CREATE TRIGGER TRG_STOCK_MANAGEMENT
BEFORE INSERT ON ORDER_ITEMS
FOR EACH ROW
BEGIN
    DECLARE v_available_stock INT;
    DECLARE msg TEXT;

    SELECT STOCK INTO v_available_stock
    FROM PRODUCTS
    WHERE PRODUCT_ID = NEW.PRODUCT_ID;

    IF NEW.QUANTITY > v_available_stock THEN
        SET msg = CONCAT(
            'Insufficient stock for product ID: ',
            NEW.PRODUCT_ID,
            '. Available: ',
            v_available_stock,
            ', Requested: ',
            NEW.QUANTITY
        );

        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = msg;
    END IF;

    UPDATE PRODUCTS
    SET STOCK = STOCK - NEW.QUANTITY
    WHERE PRODUCT_ID = NEW.PRODUCT_ID;

END$$

DELIMITER ;