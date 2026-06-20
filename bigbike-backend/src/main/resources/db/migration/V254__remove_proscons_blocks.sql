-- V254: Tách Ưu/Nhược điểm RA khỏi mô tả — đảo phần `prosCons` của V246.
--
-- V246 từng gộp Ưu/Nhược điểm thành KHỐI `prosCons` trong trình dựng mô tả (description_blocks).
-- Nay Ưu/Nhược điểm trở lại là MỘT khối RIÊNG, cố định dưới mô tả (ngoài tab) — nguồn dữ liệu
-- duy nhất quay về bảng con `product_highlights` (V175, vẫn còn nguyên, KHÔNG drop ở V246).
-- Suitability ("Phù hợp với ai") + sizeGuide ("Bảng size") GIỮ NGUYÊN là khối trong mô tả.
--
-- Migration này gỡ mọi khối `prosCons` còn sót trong description_blocks / description_blocks_en
-- (chỉ có ở các DB đã chạy V246 — production chưa chạy nên là no-op). jsonb_agg trả NULL khi
-- không còn phần tử → cột về NULL (= không có khối), đúng ngữ nghĩa. Idempotent.

update products
set description_blocks = (
        select jsonb_agg(elem)
        from jsonb_array_elements(description_blocks) elem
        where elem->>'type' <> 'prosCons'
    )
where description_blocks @> '[{"type":"prosCons"}]'::jsonb;

update products
set description_blocks_en = (
        select jsonb_agg(elem)
        from jsonb_array_elements(description_blocks_en) elem
        where elem->>'type' <> 'prosCons'
    )
where description_blocks_en @> '[{"type":"prosCons"}]'::jsonb;
