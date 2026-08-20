-- Chỉ ghép các liên kết cũ có đúng một kết quả. Nếu có nhiều hoặc không có kết quả,
-- migration dừng nguyên tử thay vì đoán thuộc tính của sản phẩm.

update product_variant_options pvo
set attribute_id = (
    select a.id
    from attributes a
    where a.code = pvo.option_name
       or lower(a.name) = lower(pvo.option_name)
       or trim(regexp_replace(lower(unaccent(a.code)), '[^a-z0-9]+', ' ', 'g'))
            = trim(regexp_replace(lower(unaccent(pvo.option_name)), '[^a-z0-9]+', ' ', 'g'))
       or trim(regexp_replace(lower(unaccent(a.name)), '[^a-z0-9]+', ' ', 'g'))
            = trim(regexp_replace(lower(unaccent(pvo.option_name)), '[^a-z0-9]+', ' ', 'g'))
    limit 1
)
where pvo.attribute_id is null
  and 1 = (
      select count(*) from attributes a
      where a.code = pvo.option_name
         or lower(a.name) = lower(pvo.option_name)
         or trim(regexp_replace(lower(unaccent(a.code)), '[^a-z0-9]+', ' ', 'g'))
              = trim(regexp_replace(lower(unaccent(pvo.option_name)), '[^a-z0-9]+', ' ', 'g'))
         or trim(regexp_replace(lower(unaccent(a.name)), '[^a-z0-9]+', ' ', 'g'))
              = trim(regexp_replace(lower(unaccent(pvo.option_name)), '[^a-z0-9]+', ' ', 'g'))
  );

update product_variant_options pvo
set attribute_value_id = (
    select av.id
    from attribute_values av
    where av.attribute_id = pvo.attribute_id
      and (
          av.slug = pvo.option_value
          or lower(av.label) = lower(pvo.option_value)
          or trim(regexp_replace(lower(unaccent(av.slug)), '[^a-z0-9]+', ' ', 'g'))
               = trim(regexp_replace(lower(unaccent(pvo.option_value)), '[^a-z0-9]+', ' ', 'g'))
          or trim(regexp_replace(lower(unaccent(av.label)), '[^a-z0-9]+', ' ', 'g'))
               = trim(regexp_replace(lower(unaccent(pvo.option_value)), '[^a-z0-9]+', ' ', 'g'))
      )
    limit 1
)
where pvo.attribute_value_id is null
  and pvo.attribute_id is not null
  and 1 = (
      select count(*) from attribute_values av
      where av.attribute_id = pvo.attribute_id
        and (
            av.slug = pvo.option_value
            or lower(av.label) = lower(pvo.option_value)
            or trim(regexp_replace(lower(unaccent(av.slug)), '[^a-z0-9]+', ' ', 'g'))
                 = trim(regexp_replace(lower(unaccent(pvo.option_value)), '[^a-z0-9]+', ' ', 'g'))
            or trim(regexp_replace(lower(unaccent(av.label)), '[^a-z0-9]+', ' ', 'g'))
                 = trim(regexp_replace(lower(unaccent(pvo.option_value)), '[^a-z0-9]+', ' ', 'g'))
        )
  );

do $$
declare
    unresolved_count bigint;
    sample_ids text;
begin
    select count(*)
    into unresolved_count
    from product_variant_options pvo
    where pvo.attribute_id is null
       or pvo.attribute_value_id is null
       or not exists (
           select 1
           from attribute_values av
           where av.id = pvo.attribute_value_id
             and av.attribute_id = pvo.attribute_id
       );

    select string_agg(id::text, ', ' order by id)
    into sample_ids
    from (
        select pvo.id
        from product_variant_options pvo
        where pvo.attribute_id is null
           or pvo.attribute_value_id is null
           or not exists (
               select 1
               from attribute_values av
               where av.id = pvo.attribute_value_id
                 and av.attribute_id = pvo.attribute_id
           )
        order by id
        limit 20
    ) unresolved;

    if unresolved_count > 0 then
        raise exception using
            message = format('V1046 đã dừng an toàn: %s dòng product_variant_options chưa có đúng một liên kết thuộc tính/giá trị chắc chắn.', unresolved_count),
            detail = format('Mẫu mã dòng cần rà soát thủ công: %s', coalesce(sample_ids, 'không có')),
            hint = 'Hãy sửa nội dung tuỳ chọn hoặc từ điển thuộc tính được liệt kê, sau đó chạy lại triển khai. Không đoán liên kết.';
    end if;
end $$;

alter table product_variant_options
    alter column attribute_id set not null,
    alter column attribute_value_id set not null;
