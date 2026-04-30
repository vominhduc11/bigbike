-- Minimal WordPress postmeta fixture for Phase 2A migration tests

CREATE TABLE IF NOT EXISTS `kd_postmeta` (
  `meta_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `post_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `meta_key` varchar(255) DEFAULT NULL,
  `meta_value` longtext DEFAULT NULL,
  PRIMARY KEY (`meta_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Product 101 meta
INSERT INTO `kd_postmeta` VALUES (1001, 101, '_sku', 'HONDA-ABC-125');
INSERT INTO `kd_postmeta` VALUES (1002, 101, '_price', '35000000');
INSERT INTO `kd_postmeta` VALUES (1003, 101, '_regular_price', '37000000');
INSERT INTO `kd_postmeta` VALUES (1004, 101, '_sale_price', '35000000');
INSERT INTO `kd_postmeta` VALUES (1005, 101, '_stock', '15');
INSERT INTO `kd_postmeta` VALUES (1006, 101, '_stock_status', 'instock');
INSERT INTO `kd_postmeta` VALUES (1007, 101, '_thumbnail_id', '201');
INSERT INTO `kd_postmeta` VALUES (1008, 101, '_product_image_gallery', '202,203');
INSERT INTO `kd_postmeta` VALUES (1009, 101, 'rank_math_title', 'Honda ABC 125 - Xe máy phổ thông');

-- Attachment 201 meta
INSERT INTO `kd_postmeta` VALUES (2001, 201, '_wp_attached_file', '2024/03/honda-abc-125.jpg');
INSERT INTO `kd_postmeta` VALUES (2002, 201, '_wp_attachment_image_alt', 'Honda ABC 125 màu đỏ');
INSERT INTO `kd_postmeta` VALUES (2003, 201, '_wp_attachment_metadata', 'a:5:{s:5:"width";i:800;s:6:"height";i:600;}');

-- Shop coupon 501 meta
INSERT INTO `kd_postmeta` VALUES (5001, 501, 'discount_type', 'percent');
INSERT INTO `kd_postmeta` VALUES (5002, 501, 'coupon_amount', '10');
INSERT INTO `kd_postmeta` VALUES (5003, 501, 'minimum_amount', '500000');
INSERT INTO `kd_postmeta` VALUES (5004, 501, 'maximum_amount', '2000000');
INSERT INTO `kd_postmeta` VALUES (5005, 501, 'usage_limit', '100');
INSERT INTO `kd_postmeta` VALUES (5006, 501, 'usage_count', '23');
INSERT INTO `kd_postmeta` VALUES (5007, 501, 'date_expires', '1735689600');

-- Order 601 meta
INSERT INTO `kd_postmeta` VALUES (6001, 601, '_order_number', 'BB-2024-0601');
INSERT INTO `kd_postmeta` VALUES (6002, 601, '_order_total', '35000000');
INSERT INTO `kd_postmeta` VALUES (6003, 601, '_order_currency', 'VND');
INSERT INTO `kd_postmeta` VALUES (6004, 601, '_payment_method', 'cod');
INSERT INTO `kd_postmeta` VALUES (6005, 601, '_customer_user', '0');
INSERT INTO `kd_postmeta` VALUES (6006, 601, '_billing_first_name', 'Nguyễn');
INSERT INTO `kd_postmeta` VALUES (6007, 601, '_billing_last_name', 'Văn A');
INSERT INTO `kd_postmeta` VALUES (6008, 601, '_billing_email', 'nguyenvana@example.com');
INSERT INTO `kd_postmeta` VALUES (6009, 601, '_billing_phone', '0901234567');
INSERT INTO `kd_postmeta` VALUES (6010, 601, '_billing_address_1', '123 Nguyễn Huệ');
INSERT INTO `kd_postmeta` VALUES (6011, 601, '_billing_city', 'Hồ Chí Minh');
INSERT INTO `kd_postmeta` VALUES (6012, 601, '_billing_country', 'VN');

-- Nav menu item 701 meta
INSERT INTO `kd_postmeta` VALUES (7001, 701, '_menu_item_url', '/san-pham.html');
INSERT INTO `kd_postmeta` VALUES (7002, 701, '_menu_item_title', 'Sản phẩm');
INSERT INTO `kd_postmeta` VALUES (7003, 701, '_menu_item_menu_item_parent', '0');
INSERT INTO `kd_postmeta` VALUES (7004, 701, '_menu_item_target', '');
INSERT INTO `kd_postmeta` VALUES (7005, 701, '_menu_item_classes', 'a:1:{i:0;s:0:"";}');
