-- Rebuild the primary (header) menu to match the WordPress production "Main menu".
-- Source: bigbike_vn__2026_04_17/sqldump.sql term_taxonomy_id=360, mapped to the
-- header location via theme_mods_bigbike->nav_menu_locations.primary.
-- 35 items total, up to 3-level hierarchy. UUIDs are deterministic and derived
-- from the WP nav_menu_item post IDs (legacy_id holds the same value).

delete from menu_items
where menu_id = '00000000-0000-0000-0000-000000000201';

insert into menu_items
  (id, menu_id, parent_id, label, url, target_type, target_id,
   sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
values
  -- ── Top level ──────────────────────────────────────────────────────────────
  ('00000000-0000-0000-0010-000000008135', '00000000-0000-0000-0000-000000000201', null,
   'Trang chủ', '/', 'CUSTOM', null,
   1, false, null, 'ACTIVE', 8135, now(), now()),
  ('00000000-0000-0000-0010-000000007936', '00000000-0000-0000-0000-000000000201', null,
   'Tất cả sản phẩm', '/san-pham/', 'CUSTOM', null,
   2, false, null, 'ACTIVE', 7936, now(), now()),

  -- ── Children of "Tất cả sản phẩm" (mega-menu categories) ──────────────────
  ('00000000-0000-0000-0010-000000008174', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000007936',
   'KHUYẾN MÃI HOT', '/danh-muc-san-pham/san-pham-khuyen-mai/', 'CUSTOM', null,
   3, false, null, 'ACTIVE', 8174, now(), now()),
  ('00000000-0000-0000-0010-000000008161', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000007936',
   'MŨ BẢO HIỂM', '/danh-muc-san-pham/non-bao-hiem-moto/', 'CUSTOM', null,
   4, false, null, 'ACTIVE', 8161, now(), now()),

  -- Children of "MŨ BẢO HIỂM"
  ('00000000-0000-0000-0010-000000008164', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008161',
   'Mũ Bảo Hiểm Fullface', '/danh-muc-san-pham/mu-bao-hiem-fullface/', 'CUSTOM', null,
   5, false, null, 'ACTIVE', 8164, now(), now()),
  ('00000000-0000-0000-0010-000000008163', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008161',
   'Mũ Bảo Hiểm Cào Cào & Dual Sport', '/danh-muc-san-pham/mu-bao-hiem-cao-cao-dual-sport/', 'CUSTOM', null,
   6, false, null, 'ACTIVE', 8163, now(), now()),
  ('00000000-0000-0000-0010-000000008165', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008161',
   'MŨ BẢO HIỂM FULLFACE LẬT HÀM', '/danh-muc-san-pham/mu-bao-hiem-fullface-lat-ham/', 'CUSTOM', null,
   7, false, null, 'ACTIVE', 8165, now(), now()),
  ('00000000-0000-0000-0010-000000008162', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008161',
   'MŨ BẢO HIỂM 3/4', '/danh-muc-san-pham/mu-bao-hiem-3-4/', 'CUSTOM', null,
   8, false, null, 'ACTIVE', 8162, now(), now()),

  ('00000000-0000-0000-0010-000000008141', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000007936',
   'ÁO QUẦN BẢO HỘ MOTO PHƯỢT', '/danh-muc-san-pham/quan-ao-bao-ho-moto/', 'CUSTOM', null,
   9, false, null, 'ACTIVE', 8141, now(), now()),

  -- Children of "ÁO QUẦN BẢO HỘ MOTO PHƯỢT"
  ('00000000-0000-0000-0010-000000008144', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008141',
   'Áo Bảo Hộ Vải', '/danh-muc-san-pham/ao-bao-ho-vai-textile-jackets-vi/', 'CUSTOM', null,
   10, false, null, 'ACTIVE', 8144, now(), now()),
  ('00000000-0000-0000-0010-000000008142', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008141',
   'Áo Bảo Hộ Da, Liền Quần', '/danh-muc-san-pham/ao-lien-quan-alpinestars-vi/', 'CUSTOM', null,
   11, false, null, 'ACTIVE', 8142, now(), now()),
  ('00000000-0000-0000-0010-000000008143', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008141',
   'Áo bảo hộ túi khí', '/danh-muc-san-pham/ao-bao-ho-tui-khi/', 'CUSTOM', null,
   12, false, null, 'ACTIVE', 8143, now(), now()),
  ('00000000-0000-0000-0010-000000008145', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008141',
   'Quần Bảo Hộ - Quần Giáp', '/danh-muc-san-pham/quan-bao-ho-quan-giap-vi/', 'CUSTOM', null,
   13, false, null, 'ACTIVE', 8145, now(), now()),

  ('00000000-0000-0000-0010-000000008148', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000007936',
   'GĂNG TAY', '/danh-muc-san-pham/gang-tay/', 'CUSTOM', null,
   14, false, null, 'ACTIVE', 8148, now(), now()),
  ('00000000-0000-0000-0010-000000008156', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000007936',
   'GIÀY BẢO HỘ', '/danh-muc-san-pham/giay-bao-ho/', 'CUSTOM', null,
   15, false, null, 'ACTIVE', 8156, now(), now()),

  ('00000000-0000-0000-0010-000000008146', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000007936',
   'BALÔ ĐEO LƯNG - TÚI ĐEO - TÚI TREO XE', '/danh-muc-san-pham/balo-deo-lung-tui-deo-tui-treo-xe/', 'CUSTOM', null,
   16, false, null, 'ACTIVE', 8146, now(), now()),

  -- Children of "BALÔ ĐEO LƯNG - TÚI ĐEO - TÚI TREO XE"
  ('00000000-0000-0000-0010-000000008147', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008146',
   'BALO ĐEO LƯNG', '/danh-muc-san-pham/balo-deo-lung/', 'CUSTOM', null,
   17, false, null, 'ACTIVE', 8147, now(), now()),
  ('00000000-0000-0000-0010-000000009993', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008146',
   'TÚI ĐEO ĐÙI', '/danh-muc-san-pham/tui-deo-dui/', 'CUSTOM', null,
   18, false, null, 'ACTIVE', 9993, now(), now()),
  ('00000000-0000-0000-0010-000000009994', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008146',
   'TÚI ĐEO HÔNG - TÚI BAO TỬ', '/danh-muc-san-pham/tui-deo-hong-tui-bao-tu/', 'CUSTOM', null,
   19, false, null, 'ACTIVE', 9994, now(), now()),
  ('00000000-0000-0000-0010-000000009995', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008146',
   'TÚI TREO XE', '/danh-muc-san-pham/tui-treo-theo-xe/', 'CUSTOM', null,
   20, false, null, 'ACTIVE', 9995, now(), now()),

  ('00000000-0000-0000-0010-000000008155', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000007936',
   'GIÁP BẢO HỘ TAY CHÂN - ĐAI LƯNG - PHỤ KIỆN GIÁP', '/danh-muc-san-pham/giap-bao-ho-tay-chan-dai-lung-phu-kien-giap/', 'CUSTOM', null,
   21, false, null, 'ACTIVE', 8155, now(), now()),
  ('00000000-0000-0000-0010-000000008170', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000007936',
   'TAI NGHE BLUETOOTH', '/danh-muc-san-pham/tai-nghe-bluetooth-gan-mu-bao-hiem/', 'CUSTOM', null,
   22, false, null, 'ACTIVE', 8170, now(), now()),

  ('00000000-0000-0000-0010-000000008167', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000007936',
   'Phụ kiện khác', '/danh-muc-san-pham/phu-kien-khac/', 'CUSTOM', null,
   23, false, null, 'ACTIVE', 8167, now(), now()),

  -- Children of "Phụ kiện khác"
  ('00000000-0000-0000-0010-000000008168', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008167',
   'PHỤ KIỆN ĐỒ LÓT', '/danh-muc-san-pham/phu-kien-do-lot/', 'CUSTOM', null,
   24, false, null, 'ACTIVE', 8168, now(), now()),

  -- Children of "PHỤ KIỆN ĐỒ LÓT"
  ('00000000-0000-0000-0010-000000028407', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008168',
   'ÁO LÓT', '/danh-muc-san-pham/ao-lot/', 'CUSTOM', null,
   25, false, null, 'ACTIVE', 28407, now(), now()),
  ('00000000-0000-0000-0010-000000028408', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008168',
   'QUẦN LÓT', '/danh-muc-san-pham/quan-lot/', 'CUSTOM', null,
   26, false, null, 'ACTIVE', 28408, now(), now()),
  ('00000000-0000-0000-0010-000000028409', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008168',
   'TRÙM ĐẦU', '/danh-muc-san-pham/trum-dau/', 'CUSTOM', null,
   27, false, null, 'ACTIVE', 28409, now(), now()),
  ('00000000-0000-0000-0010-000000028410', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008168',
   'VỚ - ỐNG TAY', '/danh-muc-san-pham/vo-ong-tay/', 'CUSTOM', null,
   28, false, null, 'ACTIVE', 28410, now(), now()),

  ('00000000-0000-0000-0010-000000008166', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008167',
   'PHỤ KIỆN ĐI MƯA', '/danh-muc-san-pham/phu-kien-di-mua/', 'CUSTOM', null,
   29, false, null, 'ACTIVE', 8166, now(), now()),
  ('00000000-0000-0000-0010-000000009520', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008167',
   'Sản phẩm vệ sinh đồ bảo hộ - Chăm sóc xe', '/danh-muc-san-pham/san-pham-ve-sinh-do-bao-ho-cham-soc-xe/', 'CUSTOM', null,
   30, false, null, 'ACTIVE', 9520, now(), now()),
  ('00000000-0000-0000-0010-000000009519', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008167',
   'KÍNH THAY - PINLOCK CHỐNG SƯƠNG', '/danh-muc-san-pham/pinlock-kinh-chong-suong-mu/', 'CUSTOM', null,
   31, false, null, 'ACTIVE', 9519, now(), now()),
  ('00000000-0000-0000-0010-000000008169', '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0010-000000008167',
   'PHỤ KIỆN - GIÁ ĐỠ ĐIỆN THOẠI', '/danh-muc-san-pham/phu-kien-gia-do-dien-thoai/', 'CUSTOM', null,
   32, false, null, 'ACTIVE', 8169, now(), now()),

  -- ── Top-level (continued) ─────────────────────────────────────────────────
  ('00000000-0000-0000-0010-000000007941', '00000000-0000-0000-0000-000000000201', null,
   'Tin tức', '/tin-tuc/', 'CUSTOM', null,
   33, false, null, 'ACTIVE', 7941, now(), now()),
  ('00000000-0000-0000-0010-000000007942', '00000000-0000-0000-0000-000000000201', null,
   'Giới thiệu', '/gioi-thieu/', 'CUSTOM', null,
   34, false, null, 'ACTIVE', 7942, now(), now()),
  ('00000000-0000-0000-0010-000000007943', '00000000-0000-0000-0000-000000000201', null,
   'Liên hệ', '/lien-he/', 'CUSTOM', null,
   35, false, null, 'ACTIVE', 7943, now(), now());

-- Drop the legacy "main-menu" location that was imported earlier with empty labels.
-- It is INACTIVE so not publicly visible, but is redundant alongside the rebuilt
-- "primary" menu. Cascade deletes its menu_items.
delete from menus where location = 'main-menu';
