-- Bỏ "Danh sách điểm nổi bật" (listStyle/items/itemsEn) khỏi khối "feature" trong mô tả sản phẩm
-- (owner decision 2026-07-19): admin đã gỡ phần nhập danh sách này khỏi FeatureBlockEditor, và
-- DescriptionBlock.FeatureBlock (backend) + FeatureBody/FeatureBlockT (web) không còn đọc 3 field
-- này nữa (@JsonIgnoreProperties vẫn cho phép đọc an toàn dữ liệu cũ dù có/không chạy migration
-- này). Migration này chỉ dọn sạch dữ liệu jsonb cho khớp schema mới; idempotent (chỉ đụng row có
-- khối feature chứa "listStyle" hoặc "items"). Cùng khuôn với V321__strip_suitability_card_link_fields.sql.
-- Lưu ý: chỉ còn 1 cột description_blocks (description_blocks_en đã DROP ở V326).

update products
set description_blocks = (
  select coalesce(
    jsonb_agg(
      case
        when block->>'type' = 'feature' then block - 'listStyle' - 'items' - 'itemsEn'
        else block
      end
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(description_blocks) as block
)
where description_blocks is not null
  and description_blocks::text like '%"type":"feature"%'
  and (description_blocks::text like '%listStyle%' or description_blocks::text like '%"items"%' or description_blocks::text like '%itemsEn%');
