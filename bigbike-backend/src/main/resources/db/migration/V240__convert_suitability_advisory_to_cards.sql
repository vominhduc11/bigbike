-- V240: Đổi format khối "Phù hợp với ai" (suitability_advisory / _en) từ rich-HTML tự do
-- sang JSON array các thẻ tư vấn [{ audience, advice, linkLabel?, linkUrl? }] (xem
-- API_CONTRACT.md / PDP_CONTENT_GUIDE.md §5b). Field vẫn là TEXT — chỉ NỘI DUNG đổi,
-- backend tiếp tục truyền chuỗi opaque (như size_guide). Admin/web parse JSON ở hai đầu.
--
-- Dữ liệu cũ (nếu có) là một đoạn văn rich-HTML/plain-text → gói thành ĐÚNG 1 thẻ chỉ có
-- lời khuyên (advice) để không mất nội dung; admin có thể tách thành nhiều thẻ sau. Bỏ qua
-- giá trị đã ở dạng JSON array (bắt đầu bằng '[') để migration idempotent / không phá data mới.

update products
set suitability_advisory = jsonb_build_array(
        jsonb_build_object('advice', suitability_advisory)
    )::text
where suitability_advisory is not null
  and btrim(suitability_advisory) <> ''
  and left(btrim(suitability_advisory), 1) <> '[';

update products
set suitability_advisory_en = jsonb_build_array(
        jsonb_build_object('advice', suitability_advisory_en)
    )::text
where suitability_advisory_en is not null
  and btrim(suitability_advisory_en) <> ''
  and left(btrim(suitability_advisory_en), 1) <> '[';
