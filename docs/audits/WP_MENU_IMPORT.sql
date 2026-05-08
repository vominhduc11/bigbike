-- ============================================================
-- BigBike — WordPress menu data import
-- Source: bigbike_vn__2026_04_17 (kd_terms IDs 360/367/368)
-- Target: public.menu_items (PostgreSQL)
-- Generated: 2026-05-08
--
-- Strategy:
--   • All items imported as targetType='CUSTOM' (URLs carry the link)
--   • Deterministic UUIDs via md5('bbwp-<wp_post_id>')::uuid
--   • legacy_id stores original WP post ID for traceability
--   • Parents inserted before children to satisfy FK constraint
--   • Sort order re-numbered 0-based within each parent group
-- ============================================================

BEGIN;

-- ── 1. PRIMARY MENU — Header Navigation ──────────────────────────────────────
-- PostgreSQL ID: 00000000-0000-0000-0000-000000000840
-- WP term_id: 360  |  35 items  |  Deep product-category mega-menu

-- Level 0: root items
INSERT INTO menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
VALUES
  -- wp_post 8135  page 12  "Trang chủ"
  (md5('bbwp-8135')::uuid, '00000000-0000-0000-0000-000000000840', NULL,
   'Trang chủ', '/', 'CUSTOM', NULL, 0, false, NULL, 'ACTIVE', 8135, NOW(), NOW()),

  -- wp_post 7936  page 1  "Tất cả sản phẩm"
  (md5('bbwp-7936')::uuid, '00000000-0000-0000-0000-000000000840', NULL,
   'Tất cả sản phẩm', '/san-pham', 'CUSTOM', NULL, 1, false, NULL, 'ACTIVE', 7936, NOW(), NOW()),

  -- wp_post 7941  category 361  "Tin tức"
  (md5('bbwp-7941')::uuid, '00000000-0000-0000-0000-000000000840', NULL,
   'Tin tức', '/tin-tuc', 'CUSTOM', NULL, 2, false, NULL, 'ACTIVE', 7941, NOW(), NOW()),

  -- wp_post 7942  page 6  "Giới thiệu"
  (md5('bbwp-7942')::uuid, '00000000-0000-0000-0000-000000000840', NULL,
   'Giới thiệu', '/gioi-thieu', 'CUSTOM', NULL, 3, false, NULL, 'ACTIVE', 7942, NOW(), NOW()),

  -- wp_post 7943  page 7937  "Liên hệ"
  (md5('bbwp-7943')::uuid, '00000000-0000-0000-0000-000000000840', NULL,
   'Liên hệ', '/lien-he', 'CUSTOM', NULL, 4, false, NULL, 'ACTIVE', 7943, NOW(), NOW());

-- Level 1: children of 7936 (Tất cả sản phẩm)
INSERT INTO menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
VALUES
  -- wp_post 8174  product_cat 287  slug: san-pham-khuyen-mai
  (md5('bbwp-8174')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-7936')::uuid,
   'Khuyến mãi hot', '/danh-muc-san-pham/san-pham-khuyen-mai', 'CUSTOM', NULL, 0, false, NULL, 'ACTIVE', 8174, NOW(), NOW()),

  -- wp_post 8161  product_cat 289  slug: non-bao-hiem-moto
  (md5('bbwp-8161')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-7936')::uuid,
   'Mũ bảo hiểm', '/danh-muc-san-pham/non-bao-hiem-moto', 'CUSTOM', NULL, 1, false, NULL, 'ACTIVE', 8161, NOW(), NOW()),

  -- wp_post 8141  product_cat 290  slug: quan-ao-bao-ho-moto
  (md5('bbwp-8141')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-7936')::uuid,
   'Áo quần bảo hộ moto phượt', '/danh-muc-san-pham/quan-ao-bao-ho-moto', 'CUSTOM', NULL, 2, false, NULL, 'ACTIVE', 8141, NOW(), NOW()),

  -- wp_post 8148  product_cat 291  slug: gang-tay
  (md5('bbwp-8148')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-7936')::uuid,
   'Găng tay', '/danh-muc-san-pham/gang-tay', 'CUSTOM', NULL, 3, false, NULL, 'ACTIVE', 8148, NOW(), NOW()),

  -- wp_post 8156  product_cat 292  slug: giay-bao-ho
  (md5('bbwp-8156')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-7936')::uuid,
   'Giày bảo hộ', '/danh-muc-san-pham/giay-bao-ho', 'CUSTOM', NULL, 4, false, NULL, 'ACTIVE', 8156, NOW(), NOW()),

  -- wp_post 8146  product_cat 294  slug: balo-deo-lung-tui-deo-tui-treo-xe
  (md5('bbwp-8146')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-7936')::uuid,
   'Balô & túi đeo', '/danh-muc-san-pham/balo-deo-lung-tui-deo-tui-treo-xe', 'CUSTOM', NULL, 5, false, NULL, 'ACTIVE', 8146, NOW(), NOW()),

  -- wp_post 8155  product_cat 293  slug: giap-bao-ho-tay-chan-dai-lung-phu-kien-giap
  (md5('bbwp-8155')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-7936')::uuid,
   'Giáp bảo hộ', '/danh-muc-san-pham/giap-bao-ho-tay-chan-dai-lung-phu-kien-giap', 'CUSTOM', NULL, 6, false, NULL, 'ACTIVE', 8155, NOW(), NOW()),

  -- wp_post 8170  product_cat 295  slug: tai-nghe-bluetooth-gan-mu-bao-hiem
  (md5('bbwp-8170')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-7936')::uuid,
   'Tai nghe Bluetooth', '/danh-muc-san-pham/tai-nghe-bluetooth-gan-mu-bao-hiem', 'CUSTOM', NULL, 7, false, NULL, 'ACTIVE', 8170, NOW(), NOW()),

  -- wp_post 8167  product_cat 299  slug: phu-kien-khac
  (md5('bbwp-8167')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-7936')::uuid,
   'Phụ kiện khác', '/danh-muc-san-pham/phu-kien-khac', 'CUSTOM', NULL, 8, false, NULL, 'ACTIVE', 8167, NOW(), NOW());

-- Level 2: children of 8161 (Mũ bảo hiểm)
INSERT INTO menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
VALUES
  -- wp_post 8164  product_cat 303  slug: mu-bao-hiem-fullface
  (md5('bbwp-8164')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8161')::uuid,
   'Mũ Bảo Hiểm Fullface', '/danh-muc-san-pham/mu-bao-hiem-fullface', 'CUSTOM', NULL, 0, false, NULL, 'ACTIVE', 8164, NOW(), NOW()),

  -- wp_post 8163  product_cat 325  slug: mu-bao-hiem-cao-cao-dual-sport
  (md5('bbwp-8163')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8161')::uuid,
   'Mũ Bảo Hiểm Cào Cào & Dual Sport', '/danh-muc-san-pham/mu-bao-hiem-cao-cao-dual-sport', 'CUSTOM', NULL, 1, false, NULL, 'ACTIVE', 8163, NOW(), NOW()),

  -- wp_post 8165  product_cat 309  slug: mu-bao-hiem-fullface-lat-ham
  (md5('bbwp-8165')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8161')::uuid,
   'Mũ Bảo Hiểm Fullface Lật Hàm', '/danh-muc-san-pham/mu-bao-hiem-fullface-lat-ham', 'CUSTOM', NULL, 2, false, NULL, 'ACTIVE', 8165, NOW(), NOW()),

  -- wp_post 8162  product_cat 318  slug: mu-bao-hiem-3-4
  (md5('bbwp-8162')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8161')::uuid,
   'Mũ Bảo Hiểm 3/4', '/danh-muc-san-pham/mu-bao-hiem-3-4', 'CUSTOM', NULL, 3, false, NULL, 'ACTIVE', 8162, NOW(), NOW());

-- Level 2: children of 8141 (Áo quần bảo hộ moto phượt)
INSERT INTO menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
VALUES
  -- wp_post 8144  product_cat 304  slug: ao-bao-ho-vai-textile-jackets-vi
  (md5('bbwp-8144')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8141')::uuid,
   'Áo Bảo Hộ Vải', '/danh-muc-san-pham/ao-bao-ho-vai-textile-jackets-vi', 'CUSTOM', NULL, 0, false, NULL, 'ACTIVE', 8144, NOW(), NOW()),

  -- wp_post 8142  product_cat 315  slug: ao-lien-quan-alpinestars-vi
  (md5('bbwp-8142')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8141')::uuid,
   'Áo Bảo Hộ Da, Liền Quần', '/danh-muc-san-pham/ao-lien-quan-alpinestars-vi', 'CUSTOM', NULL, 1, false, NULL, 'ACTIVE', 8142, NOW(), NOW()),

  -- wp_post 8143  product_cat 307  slug: ao-bao-ho-tui-khi
  (md5('bbwp-8143')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8141')::uuid,
   'Áo Bảo Hộ Túi Khí', '/danh-muc-san-pham/ao-bao-ho-tui-khi', 'CUSTOM', NULL, 2, false, NULL, 'ACTIVE', 8143, NOW(), NOW()),

  -- wp_post 8145  product_cat 323  slug: quan-bao-ho-quan-giap-vi
  (md5('bbwp-8145')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8141')::uuid,
   'Quần Bảo Hộ - Quần Giáp', '/danh-muc-san-pham/quan-bao-ho-quan-giap-vi', 'CUSTOM', NULL, 3, false, NULL, 'ACTIVE', 8145, NOW(), NOW());

-- Level 2: children of 8146 (Balô & túi đeo)
INSERT INTO menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
VALUES
  -- wp_post 8147  product_cat 301  slug: balo-deo-lung
  (md5('bbwp-8147')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8146')::uuid,
   'Balô đeo lưng', '/danh-muc-san-pham/balo-deo-lung', 'CUSTOM', NULL, 0, false, NULL, 'ACTIVE', 8147, NOW(), NOW()),

  -- wp_post 9993  product_cat 312  slug: tui-deo-dui
  (md5('bbwp-9993')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8146')::uuid,
   'Túi đeo đùi', '/danh-muc-san-pham/tui-deo-dui', 'CUSTOM', NULL, 1, false, NULL, 'ACTIVE', 9993, NOW(), NOW()),

  -- wp_post 9994  product_cat 319  slug: tui-deo-hong-tui-bao-tu
  (md5('bbwp-9994')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8146')::uuid,
   'Túi đeo hông - Túi bao tử', '/danh-muc-san-pham/tui-deo-hong-tui-bao-tu', 'CUSTOM', NULL, 2, false, NULL, 'ACTIVE', 9994, NOW(), NOW()),

  -- wp_post 9995  product_cat 324  slug: tui-treo-theo-xe
  (md5('bbwp-9995')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8146')::uuid,
   'Túi treo xe', '/danh-muc-san-pham/tui-treo-theo-xe', 'CUSTOM', NULL, 3, false, NULL, 'ACTIVE', 9995, NOW(), NOW());

-- Level 2: children of 8167 (Phụ kiện khác)
INSERT INTO menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
VALUES
  -- wp_post 8168  product_cat 305  slug: phu-kien-do-lot
  (md5('bbwp-8168')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8167')::uuid,
   'Phụ kiện đồ lót', '/danh-muc-san-pham/phu-kien-do-lot', 'CUSTOM', NULL, 0, false, NULL, 'ACTIVE', 8168, NOW(), NOW()),

  -- wp_post 8166  product_cat 297  slug: phu-kien-di-mua
  (md5('bbwp-8166')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8167')::uuid,
   'Phụ kiện đi mưa', '/danh-muc-san-pham/phu-kien-di-mua', 'CUSTOM', NULL, 1, false, NULL, 'ACTIVE', 8166, NOW(), NOW()),

  -- wp_post 9520  product_cat 296  slug: san-pham-ve-sinh-do-bao-ho-cham-soc-xe
  (md5('bbwp-9520')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8167')::uuid,
   'Vệ sinh & chăm sóc xe', '/danh-muc-san-pham/san-pham-ve-sinh-do-bao-ho-cham-soc-xe', 'CUSTOM', NULL, 2, false, NULL, 'ACTIVE', 9520, NOW(), NOW()),

  -- wp_post 9519  product_cat 298  slug: pinlock-kinh-chong-suong-mu
  (md5('bbwp-9519')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8167')::uuid,
   'Kính thay - Pinlock chống sương', '/danh-muc-san-pham/pinlock-kinh-chong-suong-mu', 'CUSTOM', NULL, 3, false, NULL, 'ACTIVE', 9519, NOW(), NOW()),

  -- wp_post 8169  product_cat 311  slug: phu-kien-gia-do-dien-thoai
  (md5('bbwp-8169')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8167')::uuid,
   'Giá đỡ điện thoại', '/danh-muc-san-pham/phu-kien-gia-do-dien-thoai', 'CUSTOM', NULL, 4, false, NULL, 'ACTIVE', 8169, NOW(), NOW());

-- Level 3: children of 8168 (Phụ kiện đồ lót)
INSERT INTO menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
VALUES
  -- wp_post 28407  product_cat 4467  slug: ao-lot
  (md5('bbwp-28407')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8168')::uuid,
   'Áo lót', '/danh-muc-san-pham/ao-lot', 'CUSTOM', NULL, 0, false, NULL, 'ACTIVE', 28407, NOW(), NOW()),

  -- wp_post 28408  product_cat 4465  slug: quan-lot
  (md5('bbwp-28408')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8168')::uuid,
   'Quần lót', '/danh-muc-san-pham/quan-lot', 'CUSTOM', NULL, 1, false, NULL, 'ACTIVE', 28408, NOW(), NOW()),

  -- wp_post 28409  product_cat 4469  slug: trum-dau
  (md5('bbwp-28409')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8168')::uuid,
   'Trùm đầu', '/danh-muc-san-pham/trum-dau', 'CUSTOM', NULL, 2, false, NULL, 'ACTIVE', 28409, NOW(), NOW()),

  -- wp_post 28410  product_cat 4471  slug: vo-ong-tay
  (md5('bbwp-28410')::uuid, '00000000-0000-0000-0000-000000000840', md5('bbwp-8168')::uuid,
   'Vớ - ống tay', '/danh-muc-san-pham/vo-ong-tay', 'CUSTOM', NULL, 3, false, NULL, 'ACTIVE', 28410, NOW(), NOW());


-- ── 2. FOOTER MENU ────────────────────────────────────────────────────────────
-- PostgreSQL ID: 00000000-0000-0000-0000-000000000841
-- WP term_id: 368  |  6 items  |  All root-level

INSERT INTO menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
VALUES
  -- wp_post 8049  page 11  "Hướng dẫn mua hàng"
  (md5('bbwp-8049')::uuid, '00000000-0000-0000-0000-000000000841', NULL,
   'Hướng dẫn mua hàng', '/huong-dan-mua-hang', 'CUSTOM', NULL, 0, false, NULL, 'ACTIVE', 8049, NOW(), NOW()),

  -- wp_post 8050  page 25  "Hướng dẫn mua hàng Online"
  (md5('bbwp-8050')::uuid, '00000000-0000-0000-0000-000000000841', NULL,
   'Hướng dẫn mua hàng Online', '/huong-dan-mua-hang-online-html', 'CUSTOM', NULL, 1, false, NULL, 'ACTIVE', 8050, NOW(), NOW()),

  -- wp_post 8046  page 27  "Chính sách bảo hành"
  (md5('bbwp-8046')::uuid, '00000000-0000-0000-0000-000000000841', NULL,
   'Chính sách bảo hành', '/chinh-sach-bao-hanh', 'CUSTOM', NULL, 2, false, NULL, 'ACTIVE', 8046, NOW(), NOW()),

  -- wp_post 8048  page 28  "Chính Sách Đổi Trả Hàng"
  (md5('bbwp-8048')::uuid, '00000000-0000-0000-0000-000000000841', NULL,
   'Chính sách đổi trả hàng', '/chinh-sach-doi-tra-hang', 'CUSTOM', NULL, 3, false, NULL, 'ACTIVE', 8048, NOW(), NOW()),

  -- wp_post 8047  page 26  "Chính sách Bảo vệ thông tin cá nhân"
  (md5('bbwp-8047')::uuid, '00000000-0000-0000-0000-000000000841', NULL,
   'Chính sách bảo mật', '/chinh-sach-bao-ve-thong-tin-ca-nhan', 'CUSTOM', NULL, 4, false, NULL, 'ACTIVE', 8047, NOW(), NOW()),

  -- wp_post 8045  page 29  "Các Điều Kiện và Điều khoản"
  (md5('bbwp-8045')::uuid, '00000000-0000-0000-0000-000000000841', NULL,
   'Điều khoản sử dụng', '/cac-dieu-kien-va-dieu-khoan', 'CUSTOM', NULL, 5, false, NULL, 'ACTIVE', 8045, NOW(), NOW());


-- ── 3. GUIDE MENU — Buying Guide Footer Widget ────────────────────────────────
-- PostgreSQL ID: 00000000-0000-0000-0000-000000000842
-- WP term_id: 367  |  5 items  |  All root-level

INSERT INTO menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
VALUES
  -- wp_post 8176  page 11  "Hướng dẫn mua hàng"
  (md5('bbwp-8176')::uuid, '00000000-0000-0000-0000-000000000842', NULL,
   'Hướng dẫn mua hàng', '/huong-dan-mua-hang', 'CUSTOM', NULL, 0, false, NULL, 'ACTIVE', 8176, NOW(), NOW()),

  -- wp_post 8038  page 26  "Chính sách Bảo vệ thông tin cá nhân"
  (md5('bbwp-8038')::uuid, '00000000-0000-0000-0000-000000000842', NULL,
   'Chính sách bảo mật', '/chinh-sach-bao-ve-thong-tin-ca-nhan', 'CUSTOM', NULL, 1, false, NULL, 'ACTIVE', 8038, NOW(), NOW()),

  -- wp_post 8037  page 27  "Chính sách bảo hành"
  (md5('bbwp-8037')::uuid, '00000000-0000-0000-0000-000000000842', NULL,
   'Chính sách bảo hành', '/chinh-sach-bao-hanh', 'CUSTOM', NULL, 2, false, NULL, 'ACTIVE', 8037, NOW(), NOW()),

  -- wp_post 8036  page 28  "Chính Sách Đổi Trả Hàng"
  (md5('bbwp-8036')::uuid, '00000000-0000-0000-0000-000000000842', NULL,
   'Chính sách đổi trả hàng', '/chinh-sach-doi-tra-hang', 'CUSTOM', NULL, 3, false, NULL, 'ACTIVE', 8036, NOW(), NOW()),

  -- wp_post 8035  page 29  "Các Điều Kiện và Điều khoản"
  (md5('bbwp-8035')::uuid, '00000000-0000-0000-0000-000000000842', NULL,
   'Điều khoản sử dụng', '/cac-dieu-kien-va-dieu-khoan', 'CUSTOM', NULL, 4, false, NULL, 'ACTIVE', 8035, NOW(), NOW());

COMMIT;

-- Verify
SELECT m.location, COUNT(mi.id) AS item_count
FROM menus m
LEFT JOIN menu_items mi ON mi.menu_id = m.id
GROUP BY m.location, m.id
ORDER BY m.location;
