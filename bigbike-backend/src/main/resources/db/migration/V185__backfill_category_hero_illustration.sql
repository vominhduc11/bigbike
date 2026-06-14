-- V183: Backfill hero illustration (icon_url) for product categories from WP image_left ACF field.
--
-- Context:
-- The WP BigBike theme used an ACF custom field "image_left" (stored in kd_termmeta)
-- as the right-side illustration in the .page-title hero banner on every category page
-- (taxonomy-product_cat.php, woocommerce/archive-product.php).
-- The original migration only captured thumbnail_id → image_url (WC grid thumbnail),
-- NOT image_left → icon_url. This caused each danh-muc-san-pham/[slug] page to show
-- either the wrong image (grid thumbnail) or the default gear image.
--
-- Source: kd_termmeta "image_left" entries cross-joined with kd_postmeta "_wp_attached_file"
-- from the WP SQL dump (sqldump.sql). Deleted EN-duplicate categories (V182) are excluded.
-- URLs use https://bigbike.vn/wp-content/uploads/... — resolveMediaUrl() handles this format.
--
-- Idempotent: UPDATE only touches rows where icon_url IS NULL.

UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/sdfghjkx.png',     updated_at = now() WHERE id = 'wp-cat-290' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/LS2-FENG-RACING.png', updated_at = now() WHERE id = 'wp-cat-291' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/njikm.png',          updated_at = now() WHERE id = 'wp-cat-292' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/sdfghujio.png',      updated_at = now() WHERE id = 'wp-cat-293' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/ety.png',            updated_at = now() WHERE id = 'wp-cat-294' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/asdrftyu.png',       updated_at = now() WHERE id = 'wp-cat-295' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/cascva.png',         updated_at = now() WHERE id = 'wp-cat-297' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/dfgh.png',           updated_at = now() WHERE id = 'wp-cat-299' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/ety.png',            updated_at = now() WHERE id = 'wp-cat-301' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/CABERG-Avalon-X.png', updated_at = now() WHERE id = 'wp-cat-303' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/sdfghjkx.png',      updated_at = now() WHERE id = 'wp-cat-304' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2022/09/STXL-BT-B.webp',    updated_at = now() WHERE id = 'wp-cat-305' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2020/08/ao-tui-khi-helite.png', updated_at = now() WHERE id = 'wp-cat-307' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/LS2-FF901-Advant-X.png', updated_at = now() WHERE id = 'wp-cat-309' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/sdfghjklas.png',    updated_at = now() WHERE id = 'wp-cat-311' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/adv.png',            updated_at = now() WHERE id = 'wp-cat-312' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2020/08/suit-da-2.png',      updated_at = now() WHERE id = 'wp-cat-315' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/sthjk.png',          updated_at = now() WHERE id = 'wp-cat-318' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/sdf.png',            updated_at = now() WHERE id = 'wp-cat-319' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/sdfghuji.png',       updated_at = now() WHERE id = 'wp-cat-323' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/gerdrhh.png',        updated_at = now() WHERE id = 'wp-cat-324' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/10/z5839317374654_9bd12f76fb85409263ae5956652cbbe6-1.png', updated_at = now() WHERE id = 'wp-cat-325' AND icon_url IS NULL;
UPDATE categories SET icon_url = 'https://bigbike.vn/wp-content/uploads/2024/03/non-cao-cao-300x3001-1.png', updated_at = now() WHERE id = 'wp-cat-6352' AND icon_url IS NULL;
