-- Phase 2C fixture: Customer / Order / Coupon dry-run tests
-- Contains: kd_users, kd_usermeta, kd_posts (shop_order/shop_coupon),
--           kd_postmeta, kd_woocommerce_order_items, kd_woocommerce_order_itemmeta

-- ── kd_users ──────────────────────────────────────────────────────────────────
CREATE TABLE `kd_users` (
  `ID` bigint NOT NULL,
  `user_login` varchar(60) NOT NULL DEFAULT '',
  `user_pass` varchar(255) NOT NULL DEFAULT '',
  `user_nicename` varchar(50) NOT NULL DEFAULT '',
  `user_email` varchar(100) NOT NULL DEFAULT '',
  `user_url` varchar(100) NOT NULL DEFAULT '',
  `user_registered` datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
  `user_status` int NOT NULL DEFAULT 0,
  `display_name` varchar(250) NOT NULL DEFAULT '',
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User 1001: normal customer
-- User 1002: administrator (excluded by role)
-- User 1003: normal customer (duplicate email triggers warning)
INSERT INTO `kd_users` VALUES (1001,'nguyenvana','$P$BHashedPass001','nguyen-van-a','nguyenvana@example.com','','2024-01-01 00:00:00',0,'Nguyen Van A'),(1002,'admin-user','$P$BAdminHash002','admin-bigbike','admin@bigbike.vn','','2024-01-02 00:00:00',0,'Admin BigBike'),(1003,'tranthib','$P$BHashedPass003','tran-thi-b','tranthib@example.com','','2024-01-03 00:00:00',0,'Tran Thi B'),(1004,'dupuser','$P$BDupHash004','dup-user','nguyenvana@example.com','','2024-01-04 00:00:00',0,'Dup User');

-- ── kd_usermeta ───────────────────────────────────────────────────────────────
CREATE TABLE `kd_usermeta` (
  `umeta_id` bigint NOT NULL,
  `user_id` bigint NOT NULL DEFAULT 0,
  `meta_key` varchar(255) DEFAULT '',
  `meta_value` longtext,
  PRIMARY KEY (`umeta_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Capabilities: kd_capabilities (table prefix kd_)
-- User 1001 & 1003 & 1004: customer role
-- User 1002: administrator (excluded)
INSERT INTO `kd_usermeta` VALUES (9001,1001,'kd_capabilities','a:1:{s:8:\"customer\";b:1;}'),(9002,1001,'billing_first_name','Nguyen'),(9003,1001,'billing_last_name','Van A'),(9004,1001,'billing_phone','0912345678'),(9005,1001,'billing_address_1','123 Le Loi'),(9006,1001,'billing_city','Ho Chi Minh'),(9007,1001,'billing_country','VN'),(9008,1001,'shipping_first_name','Nguyen'),(9009,1001,'shipping_last_name','Van A'),(9010,1001,'shipping_address_1','123 Le Loi'),(9011,1001,'shipping_city','Ho Chi Minh');

INSERT INTO `kd_usermeta` VALUES (9020,1002,'kd_capabilities','a:1:{s:13:\"administrator\";b:1;}'),(9021,1003,'kd_capabilities','a:1:{s:8:\"customer\";b:1;}'),(9022,1003,'billing_first_name','Tran'),(9023,1003,'billing_last_name','Thi B'),(9024,1003,'billing_phone','0987654321'),(9025,1004,'kd_capabilities','a:1:{s:8:\"customer\";b:1;}');

-- ── kd_posts ──────────────────────────────────────────────────────────────────
CREATE TABLE `kd_posts` (
  `ID` bigint NOT NULL,
  `post_author` bigint NOT NULL DEFAULT 0,
  `post_date` datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
  `post_date_gmt` datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
  `post_content` longtext NOT NULL,
  `post_title` text NOT NULL,
  `post_excerpt` text NOT NULL,
  `post_status` varchar(20) NOT NULL DEFAULT 'publish',
  `comment_status` varchar(20) NOT NULL DEFAULT 'closed',
  `post_name` varchar(200) NOT NULL DEFAULT '',
  `post_type` varchar(20) NOT NULL DEFAULT 'post',
  `post_parent` bigint NOT NULL DEFAULT 0,
  `menu_order` int NOT NULL DEFAULT 0,
  `guid` varchar(255) NOT NULL DEFAULT '',
  `post_mime_type` varchar(100) NOT NULL DEFAULT '',
  `comment_count` bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- shop_orders: 5001 (completed/customer), 5002 (pending/guest)
-- shop_coupons: 6001 (percent/active), 6002 (same code = duplicate warning)
INSERT INTO `kd_posts` VALUES (5001,1,'2024-03-15 10:00:00','2024-03-15 03:00:00','','Order 5001','Customer note here','wc-completed','closed','order-5001','shop_order',0,0,'https://bigbike.vn/?p=5001','',0),(5002,1,'2024-03-16 11:00:00','2024-03-16 04:00:00','','Order 5002 Guest','','wc-pending','closed','order-5002','shop_order',0,0,'https://bigbike.vn/?p=5002','',0);

INSERT INTO `kd_posts` VALUES (6001,1,'2024-01-01 00:00:00','2024-01-01 00:00:00','','GIAM10','Giam 10 phan tram','publish','closed','giam10','shop_coupon',0,0,'https://bigbike.vn/?p=6001','',0),(6002,1,'2024-01-02 00:00:00','2024-01-02 00:00:00','','GIAM10','Coupon trung ten','publish','closed','giam10-2','shop_coupon',0,0,'https://bigbike.vn/?p=6002','',0);

-- ── kd_postmeta ───────────────────────────────────────────────────────────────
CREATE TABLE `kd_postmeta` (
  `meta_id` bigint NOT NULL,
  `post_id` bigint NOT NULL DEFAULT 0,
  `meta_key` varchar(255) DEFAULT '',
  `meta_value` longtext,
  PRIMARY KEY (`meta_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Order 5001: completed, customer 1001, paid via bacs
INSERT INTO `kd_postmeta` VALUES (8001,5001,'_order_number','ORD-1001'),(8002,5001,'_order_key','wc_order_abc123fix'),(8003,5001,'_customer_user','1001'),(8004,5001,'_order_currency','VND'),(8005,5001,'_order_total','1500000'),(8006,5001,'_cart_discount','100000'),(8007,5001,'_order_shipping','50000'),(8008,5001,'_order_tax','0'),(8009,5001,'_payment_method','bacs'),(8010,5001,'_payment_method_title','Chuyen khoan ngan hang'),(8011,5001,'_date_paid','2024-03-15 10:30:00'),(8012,5001,'_billing_first_name','Nguyen'),(8013,5001,'_billing_last_name','Van A'),(8014,5001,'_billing_email','nguyenvana@example.com'),(8015,5001,'_billing_phone','0912345678'),(8016,5001,'_billing_address_1','123 Le Loi'),(8017,5001,'_billing_city','Ho Chi Minh'),(8018,5001,'_billing_country','VN'),(8019,5001,'_shipping_first_name','Nguyen'),(8020,5001,'_shipping_last_name','Van A'),(8021,5001,'_shipping_address_1','123 Le Loi'),(8022,5001,'_shipping_city','Ho Chi Minh'),(8023,5001,'_shipping_country','VN'),(8024,5001,'_customer_ip_address','1.2.3.4'),(8025,5001,'_customer_user_agent','Mozilla/5.0');

-- Order 5002: pending, guest (customer_user=0), no billing email (so no synthetic)
INSERT INTO `kd_postmeta` VALUES (8101,5002,'_order_number','ORD-1002'),(8102,5002,'_order_key','wc_order_def456fix'),(8103,5002,'_customer_user','0'),(8104,5002,'_order_currency','VND'),(8105,5002,'_order_total','500000'),(8106,5002,'_payment_method','cod'),(8107,5002,'_payment_method_title','Thanh toan khi nhan hang'),(8108,5002,'_billing_first_name','Le'),(8109,5002,'_billing_last_name','Thi C'),(8110,5002,'_billing_email','lethic@example.com'),(8111,5002,'_billing_phone','0901234567');

-- Coupon 6001: percent 10%, no expiry
INSERT INTO `kd_postmeta` VALUES (8201,6001,'discount_type','percent'),(8202,6001,'coupon_amount','10'),(8203,6001,'minimum_amount','500000'),(8204,6001,'usage_limit','100'),(8205,6001,'usage_count','5'),(8206,6001,'date_expires','0');

-- Coupon 6002: same code GIAM10 (duplicate)
INSERT INTO `kd_postmeta` VALUES (8211,6002,'discount_type','percent'),(8212,6002,'coupon_amount','10'),(8213,6002,'date_expires','0');

-- ── kd_woocommerce_order_items ────────────────────────────────────────────────
CREATE TABLE `kd_woocommerce_order_items` (
  `order_item_id` bigint NOT NULL,
  `order_item_name` text NOT NULL,
  `order_item_type` varchar(200) NOT NULL DEFAULT '',
  `order_id` bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (`order_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Order 5001: line_item + shipping + fee + coupon + tax
-- Order 5002: line_item (no product_id to test warning)
INSERT INTO `kd_woocommerce_order_items` VALUES (4001,'Honda Wave Alpha 110','line_item',5001),(4002,'Phi van chuyen toan quoc','shipping',5001),(4003,'Phi xu ly','fee',5001),(4004,'GIAM10','coupon',5001),(4005,'Thue VAT 10%','tax',5001),(4006,'Yamaha Exciter 155','line_item',5002);

-- ── kd_woocommerce_order_itemmeta ─────────────────────────────────────────────
CREATE TABLE `kd_woocommerce_order_itemmeta` (
  `meta_id` bigint NOT NULL,
  `order_item_id` bigint NOT NULL DEFAULT 0,
  `meta_key` varchar(255) DEFAULT '',
  `meta_value` text DEFAULT '',
  PRIMARY KEY (`meta_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Line item 4001: product 201, qty 1
INSERT INTO `kd_woocommerce_order_itemmeta` VALUES (4101,4001,'_product_id','201'),(4102,4001,'_variation_id','0'),(4103,4001,'_qty','1'),(4104,4001,'_line_subtotal','1400000'),(4105,4001,'_line_total','1400000'),(4106,4001,'_line_subtotal_tax','0'),(4107,4001,'_line_tax','0');

-- Shipping item 4002
INSERT INTO `kd_woocommerce_order_itemmeta` VALUES (4201,4002,'method_id','flat_rate'),(4202,4002,'instance_id','1'),(4203,4002,'cost','50000'),(4204,4002,'total_tax','0');

-- Fee item 4003
INSERT INTO `kd_woocommerce_order_itemmeta` VALUES (4301,4003,'_line_total','50000'),(4302,4003,'_line_tax','0');

-- Coupon item 4004
INSERT INTO `kd_woocommerce_order_itemmeta` VALUES (4401,4004,'discount_amount','100000'),(4402,4004,'discount_amount_tax','0');

-- Tax item 4005: no meta needed (deferred)

-- Line item 4006: qty=0 → warning; no _product_id → warning
INSERT INTO `kd_woocommerce_order_itemmeta` VALUES (4601,4006,'_qty','0'),(4602,4006,'_line_total','500000');
