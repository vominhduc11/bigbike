-- V242: Đổi format khối "Hướng dẫn lắp đặt" (installation_guide / _en) từ rich-HTML tự do
-- sang JSON object có cấu trúc { steps: [{ icon, title, body, tip?, warning? }], maintenance? }
-- (xem API_CONTRACT.md / DATA_CONTRACT.md / PDP_CONTENT_GUIDE.md #10). Cột vẫn là TEXT — chỉ
-- NỘI DUNG đổi; backend tiếp tục truyền chuỗi opaque (như size_guide / suitability_advisory).
-- Admin/web parse JSON ở hai đầu.
--
-- Dữ liệu cũ (nếu có) là một đoạn rich-HTML/plain-text → gói thành ĐÚNG 1 bước chỉ có nội dung
-- (body) để không mất nội dung; admin có thể tách thành nhiều bước + thêm icon/mẹo/cảnh báo sau.
-- Bỏ qua giá trị đã ở dạng JSON object (bắt đầu bằng '{') để migration idempotent / không phá
-- data mới.

update products
set installation_guide = jsonb_build_object(
        'steps', jsonb_build_array(jsonb_build_object('body', installation_guide))
    )::text
where installation_guide is not null
  and btrim(installation_guide) <> ''
  and left(btrim(installation_guide), 1) <> '{';

update products
set installation_guide_en = jsonb_build_object(
        'steps', jsonb_build_array(jsonb_build_object('body', installation_guide_en))
    )::text
where installation_guide_en is not null
  and btrim(installation_guide_en) <> ''
  and left(btrim(installation_guide_en), 1) <> '{';
