-- Bỏ "Nhãn link gợi ý" (linkLabel) / "Đường dẫn nội bộ" (linkUrl) khỏi khối "Phù hợp với ai"
-- (owner decision 2026-07-06): admin đã gỡ 2 ô nhập này, và
-- DescriptionBlock.SuitabilityBlock.SuitabilityCard (backend) + SuitabilityBlockView (web) không
-- còn đọc 2 trường này nữa (@JsonIgnoreProperties vẫn cho phép đọc an toàn dữ liệu cũ dù có/không
-- chạy migration này). Migration này chỉ dọn sạch dữ liệu jsonb cho khớp schema mới; idempotent
-- (chỉ đụng row có chứa "linkLabel" trong khối suitability).
update products
set description_blocks = (
  select coalesce(
    jsonb_agg(
      case
        when block->>'type' = 'suitability' and jsonb_typeof(block->'cards') = 'array' then
          jsonb_set(
            block,
            '{cards}',
            (
              select coalesce(jsonb_agg(card - 'linkLabel' - 'linkUrl'), '[]'::jsonb)
              from jsonb_array_elements(block->'cards') as card
            )
          )
        else block
      end
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(description_blocks) as block
)
where description_blocks is not null
  and description_blocks::text like '%linkLabel%';

update products
set description_blocks_en = (
  select coalesce(
    jsonb_agg(
      case
        when block->>'type' = 'suitability' and jsonb_typeof(block->'cards') = 'array' then
          jsonb_set(
            block,
            '{cards}',
            (
              select coalesce(jsonb_agg(card - 'linkLabel' - 'linkUrl'), '[]'::jsonb)
              from jsonb_array_elements(block->'cards') as card
            )
          )
        else block
      end
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(description_blocks_en) as block
)
where description_blocks_en is not null
  and description_blocks_en::text like '%linkLabel%';
