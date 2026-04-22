-- Minimal WordPress terms fixture for Phase 2A migration tests

CREATE TABLE IF NOT EXISTS `kd_terms` (
  `term_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL DEFAULT '',
  `slug` varchar(200) NOT NULL DEFAULT '',
  `term_group` bigint(10) NOT NULL DEFAULT 0,
  PRIMARY KEY (`term_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `kd_term_taxonomy` (
  `term_taxonomy_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `term_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `taxonomy` varchar(32) NOT NULL DEFAULT '',
  `description` longtext NOT NULL,
  `parent` bigint(20) unsigned NOT NULL DEFAULT 0,
  `count` bigint(20) NOT NULL DEFAULT 0,
  PRIMARY KEY (`term_taxonomy_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Product category
INSERT INTO `kd_terms` VALUES (1, 'Xe Máy', 'xe-may', 0);
INSERT INTO `kd_term_taxonomy` VALUES (1, 1, 'product_cat', 'Danh mục xe máy', 0, 45);

-- Product category child
INSERT INTO `kd_terms` VALUES (2, 'Xe Số', 'xe-so', 0);
INSERT INTO `kd_term_taxonomy` VALUES (2, 2, 'product_cat', 'Xe số phổ thông', 1, 12);

-- Brand (Perfect WooCommerce Brands plugin)
INSERT INTO `kd_terms` VALUES (3, 'Honda', 'honda', 0);
INSERT INTO `kd_term_taxonomy` VALUES (3, 3, 'pwb-brand', 'Honda Vietnam', 0, 30);

-- Product tag
INSERT INTO `kd_terms` VALUES (4, 'bán chạy', 'ban-chay', 0);
INSERT INTO `kd_term_taxonomy` VALUES (4, 4, 'product_tag', '', 0, 15);

-- Nav menu
INSERT INTO `kd_terms` VALUES (5, 'Main Navigation', 'main-navigation', 0);
INSERT INTO `kd_term_taxonomy` VALUES (5, 5, 'nav_menu', '', 0, 7);

-- Blog category
INSERT INTO `kd_terms` VALUES (6, 'Tin Tức', 'tin-tuc', 0);
INSERT INTO `kd_term_taxonomy` VALUES (6, 6, 'category', 'Tin tức xe máy', 0, 20);
