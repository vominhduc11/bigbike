-- Minimal WordPress posts fixture for Phase 2A migration tests
-- Table prefix: kd_  (as used in bigbike.vn dump)

CREATE TABLE IF NOT EXISTS `kd_posts` (
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

-- A product
INSERT INTO `kd_posts` VALUES (101, 1, '2024-03-01 10:00:00', '2024-03-01 03:00:00', 'Full description of Honda ABC 125.', 'Honda ABC 125', 'Short description.', 'publish', 'open', 'honda-abc-125', 'product', 0, 0, 'https://bigbike.vn/?p=101', '', 0);

-- An attachment
INSERT INTO `kd_posts` VALUES (201, 1, '2024-03-01 10:01:00', '2024-03-01 03:01:00', '', 'honda-abc-125-main', '', 'inherit', 'open', 'honda-abc-125-main', 'attachment', 101, 0, 'https://bigbike.vn/?attachment_id=201', 'image/jpeg', 0);

-- A page
INSERT INTO `kd_posts` VALUES (301, 1, '2024-01-01 00:00:00', '2023-12-31 17:00:00', 'About BigBike content.', 'Giới thiệu', '', 'publish', 'closed', 'gioi-thieu', 'page', 0, 0, 'https://bigbike.vn/?page_id=301', '', 0);

-- A blog post
INSERT INTO `kd_posts` VALUES (401, 1, '2024-04-01 08:00:00', '2024-04-01 01:00:00', 'Article body content.', 'Tin tức mới nhất', 'Excerpt here.', 'publish', 'open', 'tin-tuc-moi-nhat', 'post', 0, 0, 'https://bigbike.vn/?p=401', '', 0);

-- A shop_coupon
INSERT INTO `kd_posts` VALUES (501, 1, '2024-02-01 00:00:00', '2024-01-31 17:00:00', '', 'GIAM10', 'Giảm 10%', 'publish', 'closed', 'giam10', 'shop_coupon', 0, 0, 'https://bigbike.vn/?p=501', '', 0);

-- A shop_order (legacy, HPOS off)
INSERT INTO `kd_posts` VALUES (601, 0, '2024-03-15 14:30:00', '2024-03-15 07:30:00', '', '', '', 'wc-completed', 'closed', '', 'shop_order', 0, 0, 'https://bigbike.vn/?p=601', '', 0);

-- A nav_menu_item
INSERT INTO `kd_posts` VALUES (701, 1, '2024-01-01 00:00:00', '2023-12-31 17:00:00', '', 'Sản phẩm', '', 'publish', 'closed', '', 'nav_menu_item', 0, 1, 'https://bigbike.vn/?p=701', '', 0);
