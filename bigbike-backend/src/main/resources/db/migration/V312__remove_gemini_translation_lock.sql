-- V312: Gỡ bỏ tính năng tự động dịch VI→EN (Google Gemini) và cơ chế khoá tay đi kèm.
-- Admin nay tự nhập tiếng Anh (TRANSLATION_RULE_001/002) — không còn ô nào cần "khoá khỏi
-- tự-dịch" nữa, nên cột lưu trạng thái khoá trở thành dữ liệu chết. Đối xứng với V296
-- (thêm en_overrides) và V309 (thêm en_locked). Idempotent.

ALTER TABLE products DROP COLUMN IF EXISTS en_overrides;
ALTER TABLE categories DROP COLUMN IF EXISTS en_overrides;
ALTER TABLE brands DROP COLUMN IF EXISTS en_overrides;
ALTER TABLE articles DROP COLUMN IF EXISTS en_overrides;
ALTER TABLE site_settings DROP COLUMN IF EXISTS en_locked;
