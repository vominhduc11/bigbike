-- Phase 2B fixture: SQL INSERT parser tests
-- Single-line INSERTs (standard mysqldump extended-insert format)
-- Tests: multi-row INSERT, escaped quotes, NULL values, various data types.

-- ── kd_posts (CREATE TABLE for column-name resolution) ───────────────────────
CREATE TABLE `kd_posts` (
  `ID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `post_author` bigint(20) unsigned NOT NULL DEFAULT 0,
  `post_date` datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
  `post_date_gmt` datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
  `post_content` longtext NOT NULL,
  `post_title` text NOT NULL,
  `post_excerpt` text NOT NULL,
  `post_status` varchar(20) NOT NULL DEFAULT 'publish',
  `comment_status` varchar(20) NOT NULL DEFAULT 'open',
  `post_name` varchar(200) NOT NULL DEFAULT '',
  `post_type` varchar(20) NOT NULL DEFAULT 'post',
  `post_parent` bigint(20) unsigned NOT NULL DEFAULT 0,
  `menu_order` int(11) NOT NULL DEFAULT 0,
  `guid` varchar(255) NOT NULL DEFAULT '',
  `post_mime_type` varchar(100) NOT NULL DEFAULT '',
  `comment_count` bigint(20) NOT NULL DEFAULT 0,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Multi-row INSERT with escaped quotes and NULL — all on ONE line (mysqldump extended-insert)
INSERT INTO `kd_posts` VALUES (201,1,'2024-03-01 10:00:00','2024-03-01 03:00:00','Content with \'quotes\' and \\backslash.','Honda Wave Alpha 110','Short desc.','publish','open','honda-wave-alpha-110','product',0,0,'https://bigbike.vn/?p=201','',0),(202,1,'2024-03-02 11:00:00','2024-03-02 04:00:00','Another product.','Yamaha Exciter 155','','draft','open','yamaha-exciter-155','product',0,0,'https://bigbike.vn/?p=202','',0),(203,1,'2024-03-03 09:00:00','2024-03-03 02:00:00','','Xe bien bien','','publish','open','xe-bien-bien','product',201,0,'https://bigbike.vn/?p=203','',0);

-- ── kd_postmeta ───────────────────────────────────────────────────────────────
CREATE TABLE `kd_postmeta` (
  `meta_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `post_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `meta_key` varchar(255) DEFAULT '',
  `meta_value` longtext,
  PRIMARY KEY (`meta_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Multi-row postmeta for product 201 (all on one line)
INSERT INTO `kd_postmeta` VALUES (2001,201,'_sku','WAVE-ALPHA-110'),(2002,201,'_price','30500000'),(2003,201,'_regular_price','32000000'),(2004,201,'_sale_price','30500000'),(2005,201,'_stock','50'),(2006,201,'_stock_status','instock'),(2007,201,'_thumbnail_id','301'),(2008,201,'_product_image_gallery','302,303'),(2009,201,'rank_math_title','Honda Wave Alpha 110 | BigBike'),(2010,201,'rank_math_description','Mua xe Honda Wave Alpha 110 chinh hang.');

-- Postmeta with NULL value
INSERT INTO `kd_postmeta` VALUES (2011,201,'_sale_end_date',NULL);

-- Postmeta for invalid price
INSERT INTO `kd_postmeta` VALUES (2012,202,'_price','not-a-number');

-- Attachment metadata with PHP serialized content (single-line)
INSERT INTO `kd_postmeta` VALUES (3001,301,'_wp_attached_file','2024/03/honda-wave-alpha-110.jpg'),(3002,301,'_wp_attachment_metadata','a:3:{s:5:\"width\";i:1200;s:6:\"height\";i:800;s:5:\"sizes\";a:1:{s:9:\"thumbnail\";a:4:{s:4:\"file\";s:28:\"honda-wave-alpha-150x150.jpg\";s:5:\"width\";i:150;s:6:\"height\";i:150;s:9:\"mime-type\";s:10:\"image/jpeg\";}}}'),(3003,301,'_wp_attachment_image_alt','Honda Wave Alpha 110');

-- Menu item metadata with PHP serialized CSS classes
INSERT INTO `kd_postmeta` VALUES (7001,701,'_menu_item_url','/san-pham.html'),(7002,701,'_menu_item_title','San pham'),(7003,701,'_menu_item_menu_item_parent','0'),(7004,701,'_menu_item_target',''),(7005,701,'_menu_item_classes','a:2:{i:0;s:0:\"\";i:1;s:11:\"menu-active\";}');

-- ── kd_terms ──────────────────────────────────────────────────────────────────
CREATE TABLE `kd_terms` (
  `term_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL DEFAULT '',
  `slug` varchar(200) NOT NULL DEFAULT '',
  `term_group` bigint(10) NOT NULL DEFAULT 0,
  PRIMARY KEY (`term_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `kd_terms` VALUES (10,'Xe so','xe-so',0),(11,'Honda','honda',0),(12,'Giam gia','giam-gia',0),(13,'Menu chinh','menu-chinh',0);

-- ── kd_term_taxonomy ──────────────────────────────────────────────────────────
CREATE TABLE `kd_term_taxonomy` (
  `term_taxonomy_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `term_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `taxonomy` varchar(32) NOT NULL DEFAULT '',
  `description` longtext NOT NULL,
  `parent` bigint(20) unsigned NOT NULL DEFAULT 0,
  `count` bigint(20) NOT NULL DEFAULT 0,
  PRIMARY KEY (`term_taxonomy_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `kd_term_taxonomy` VALUES (100,10,'product_cat','Danh muc xe so',0,45),(101,11,'pwb-brand','Thuong hieu Honda',0,120),(102,12,'product_tag','Tag giam gia',0,10),(103,13,'nav_menu','',0,5);

-- ── kd_term_relationships ─────────────────────────────────────────────────────
CREATE TABLE `kd_term_relationships` (
  `object_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `term_taxonomy_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `term_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`object_id`,`term_taxonomy_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `kd_term_relationships` VALUES (201,100,0),(201,101,0),(701,103,0);

-- ── kd_rank_math_redirections ─────────────────────────────────────────────────
CREATE TABLE `kd_rank_math_redirections` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `sources` mediumtext,
  `url_to` text NOT NULL,
  `header_code` smallint(6) unsigned NOT NULL DEFAULT 301,
  `created` bigint(20) unsigned NOT NULL DEFAULT 0,
  `updated` bigint(20) unsigned NOT NULL DEFAULT 0,
  `times_accessed` bigint(20) unsigned NOT NULL DEFAULT 0,
  `last_accessed` datetime DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `kd_rank_math_redirections` VALUES (1,'[{\"pattern\":\"\\/vi\\/san-pham\",\"comparison\":\"exact\"}]','/san-pham.html',301,1710000000,1710000000,0,NULL,'active'),(2,'[{\"pattern\":\"\\/en\\/products\",\"comparison\":\"exact\"}]','/san-pham.html',301,1710000000,1710000000,0,NULL,'active'),(3,'[{\"pattern\":\"\\/old-page\",\"comparison\":\"exact\"}]','/gioi-thieu.html',302,1710000000,1710000000,0,NULL,'active'),(4,'[{\"pattern\":\"\\/self-loop\",\"comparison\":\"exact\"}]','/self-loop',301,1710000000,1710000000,0,NULL,'active');

-- ── kd_options ────────────────────────────────────────────────────────────────
CREATE TABLE `kd_options` (
  `option_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `option_name` varchar(191) NOT NULL DEFAULT '',
  `option_value` longtext NOT NULL,
  `autoload` varchar(20) NOT NULL DEFAULT 'yes',
  PRIMARY KEY (`option_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Permalink Manager URIs (PHP serialized associative array, single-line)
INSERT INTO `kd_options` VALUES (1,'permalink-manager_uris','a:3:{i:201;s:25:\"/san-pham/honda-wave.html\";i:202;s:22:\"/san-pham/exciter.html\";s:7:\"tax-100\";s:11:\"/xe-so.html\";}','no');
