-- Báo cáo chỉ đọc để chủ shop duyệt tên màu từ dữ liệu production.
-- Không có INSERT/UPDATE/DELETE và không thay đổi local fake data.
select
    pvo.option_value as current_code_or_value,
    string_agg(distinct p.name, ', ' order by p.name) as products_using,
    pvo.option_name as source_label,
    string_agg(distinct p.publish_status, ', ' order by p.publish_status) as product_statuses,
    count(distinct p.id) as product_count,
    ''::text as proposed_vietnamese_name
from product_variant_options pvo
join product_variants pv on pv.id = pvo.variant_id
join products p on p.id = pv.product_id
where lower(trim(pvo.option_name)) in ('màu', 'màu sắc', 'color', 'colour')
group by pvo.option_value, pvo.option_name
order by lower(pvo.option_value), lower(pvo.option_name);
