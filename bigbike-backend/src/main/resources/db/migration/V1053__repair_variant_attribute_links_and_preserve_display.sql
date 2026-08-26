-- V1053: Complete legacy variant dictionary links without changing public text.
--
-- The postponed V1047 migration deliberately refused to guess unresolved rows.
-- This migration has an explicit alias map and creates missing dictionary data
-- from the already stored option text. It only fills NULL foreign keys; rows
-- that already have both links are never rewritten.

alter table product_variant_options
    add column if not exists legacy_display_name varchar(255),
    add column if not exists legacy_display_value varchar(255);

-- Keep the exact public strings for rows that are about to receive a dictionary
-- link. The read path uses these snapshots only for repaired legacy rows.
update product_variant_options
set legacy_display_name = coalesce(legacy_display_name, option_name),
    legacy_display_value = coalesce(legacy_display_value, option_value)
where (attribute_id is null or attribute_value_id is null)
  and option_name is not null
  and btrim(option_name) <> ''
  and option_value is not null
  and btrim(option_value) <> '';

-- A value FK is authoritative when the attribute FK is the only missing link.
update product_variant_options pvo
set attribute_id = av.attribute_id
from attribute_values av
where pvo.attribute_id is null
  and pvo.attribute_value_id = av.id;

drop table if exists _v1053_attribute_groups;
drop table if exists _v1053_canonical_attributes;
drop table if exists _v1053_repair_rows;
drop table if exists _v1053_value_seeds;
drop table if exists _v1053_value_links;

create temporary table _v1053_attribute_groups (
    group_key varchar(255) primary key,
    display_name varchar(255) not null,
    display_name_en varchar(255),
    preferred_code varchar(160) not null
) on commit drop;

-- Known aliases are intentionally narrow. Unknown non-empty names become their
-- own attribute instead of being silently assigned to a different meaning.
insert into _v1053_attribute_groups (group_key, display_name, display_name_en, preferred_code)
select
    group_key,
    case group_key
        when 'color' then 'Màu sắc'
        when 'size' then 'Kích cỡ'
        when 'model' then 'Đời máy'
        else min(trim(option_name))
    end as display_name,
    case group_key
        when 'color' then 'Color'
        when 'size' then 'Size'
        when 'model' then 'Model'
        else null
    end as display_name_en,
    case group_key
        when 'color' then 'color'
        when 'size' then 'size'
        when 'model' then 'model'
        else 'legacy-' || substr(md5(group_key), 1, 24)
    end as preferred_code
from (
    select
        case normalized_name
            when 'mau' then 'color'
            when 'mau sac' then 'color'
            when 'color' then 'color'
            when 'colour' then 'color'
            when 'pa color' then 'color'
            when 'pa mau' then 'color'
            when 'pa mau sac' then 'color'
            when 'size' then 'size'
            when 'kich co' then 'size'
            when 'doi may' then 'model'
            when 'iphone' then 'model'
            when 'model' then 'model'
            else 'legacy:' || normalized_name
        end as group_key,
        option_name,
        trim(option_name) as display_name
    from (
        select distinct
            trim(option_name) as option_name,
            trim(regexp_replace(
                lower(unaccent(trim(option_name))),
                '[^a-z0-9]+', ' ', 'g'
            )) as normalized_name
        from product_variant_options
        where (attribute_id is null or attribute_value_id is null)
          and option_name is not null
          and btrim(option_name) <> ''
    ) names
) grouped_names
group by group_key;

create temporary table _v1053_canonical_attributes (
    group_key varchar(255) primary key,
    attribute_id varchar(64) not null
) on commit drop;

do $$
declare
    group_row record;
    chosen_id varchar(64);
    chosen_name varchar(255);
    attribute_usage bigint;
begin
    for group_row in select * from _v1053_attribute_groups order by group_key loop
        chosen_id := null;

        select a.id, a.name
        into chosen_id, chosen_name
        from attributes a
        where
            case group_row.group_key
                when 'color' then
                    trim(regexp_replace(lower(unaccent(coalesce(a.code, ''))), '[^a-z0-9]+', ' ', 'g'))
                        in ('color', 'colour', 'mau', 'mau sac', 'pa color', 'pa mau', 'pa mau sac')
                    or trim(regexp_replace(lower(unaccent(coalesce(a.name, ''))), '[^a-z0-9]+', ' ', 'g'))
                        in ('color', 'colour', 'mau', 'mau sac', 'pa color', 'pa mau', 'pa mau sac')
                when 'size' then
                    trim(regexp_replace(lower(unaccent(coalesce(a.code, ''))), '[^a-z0-9]+', ' ', 'g'))
                        in ('size', 'kich co')
                    or trim(regexp_replace(lower(unaccent(coalesce(a.name, ''))), '[^a-z0-9]+', ' ', 'g'))
                        in ('size', 'kich co')
                when 'model' then
                    trim(regexp_replace(lower(unaccent(coalesce(a.code, ''))), '[^a-z0-9]+', ' ', 'g'))
                        in ('model', 'doi may', 'iphone')
                    or trim(regexp_replace(lower(unaccent(coalesce(a.name, ''))), '[^a-z0-9]+', ' ', 'g'))
                        in ('model', 'doi may', 'iphone')
                else
                    trim(regexp_replace(lower(unaccent(coalesce(a.code, ''))), '[^a-z0-9]+', ' ', 'g'))
                        = replace(group_row.group_key, 'legacy:', '')
                    or trim(regexp_replace(lower(unaccent(coalesce(a.name, ''))), '[^a-z0-9]+', ' ', 'g'))
                        = replace(group_row.group_key, 'legacy:', '')
            end
        order by
            case when lower(a.code) = group_row.preferred_code then 0 else 1 end,
            case when trim(regexp_replace(lower(unaccent(a.name)), '[^a-z0-9]+', ' ', 'g')) =
                           trim(regexp_replace(lower(unaccent(group_row.display_name)), '[^a-z0-9]+', ' ', 'g'))
                 then 0 else 1 end,
            a.id
        limit 1;

        if chosen_id is null then
            chosen_id := 'repair-attr-' || substr(md5(group_row.group_key), 1, 32);
            insert into attributes (id, code, name, name_en, kind, is_variation)
            values (
                chosen_id,
                group_row.preferred_code,
                group_row.display_name,
                group_row.display_name_en,
                'select',
                true
            )
            on conflict (code) do nothing;

            select a.id, a.name
            into chosen_id, chosen_name
            from attributes a
            where a.code = group_row.preferred_code
            order by a.id
            limit 1;
        end if;

        -- The supplied live data has an empty "Iphone" entry. Reuse it for the
        -- model group and give it the owner-approved display name only while it
        -- is unused; linked attributes are never renamed by this migration.
        if group_row.group_key = 'model'
           and trim(regexp_replace(lower(unaccent(coalesce(chosen_name, ''))), '[^a-z0-9]+', ' ', 'g')) = 'iphone' then
            select count(*) into attribute_usage
            from product_variant_options pvo
            where pvo.attribute_id = chosen_id;

            if attribute_usage = 0 then
                update attributes
                set name = 'Đời máy', name_en = 'Model'
                where id = chosen_id;
            end if;
        end if;

        -- If a canonical Model attribute already exists, remove only the empty
        -- legacy "Iphone" alias. Never delete an attribute that still has a
        -- value or a variant link; those rows remain available for review.
        if group_row.group_key = 'model' then
            delete from attributes alias_attr
            where alias_attr.id <> chosen_id
              and (
                  trim(regexp_replace(lower(unaccent(coalesce(alias_attr.code, ''))), '[^a-z0-9]+', ' ', 'g')) = 'iphone'
                  or trim(regexp_replace(lower(unaccent(coalesce(alias_attr.name, ''))), '[^a-z0-9]+', ' ', 'g')) = 'iphone'
              )
              and not exists (
                  select 1 from product_variant_options pvo
                  where pvo.attribute_id = alias_attr.id
              )
              and not exists (
                  select 1 from attribute_values av
                  where av.attribute_id = alias_attr.id
              );
        end if;

        insert into _v1053_canonical_attributes (group_key, attribute_id)
        values (group_row.group_key, chosen_id);
    end loop;
end $$;

create temporary table _v1053_repair_rows (
    option_id bigint primary key,
    target_attribute_id varchar(64),
    raw_value varchar(255) not null
) on commit drop;

insert into _v1053_repair_rows (option_id, target_attribute_id, raw_value)
select
    pvo.id,
    coalesce(pvo.attribute_id, ca.attribute_id),
    trim(pvo.option_value)
from product_variant_options pvo
left join lateral (
    select
        case trim(regexp_replace(lower(unaccent(trim(pvo.option_name))), '[^a-z0-9]+', ' ', 'g'))
            when 'mau' then 'color'
            when 'mau sac' then 'color'
            when 'color' then 'color'
            when 'colour' then 'color'
            when 'pa color' then 'color'
            when 'pa mau' then 'color'
            when 'pa mau sac' then 'color'
            when 'size' then 'size'
            when 'kich co' then 'size'
            when 'doi may' then 'model'
            when 'iphone' then 'model'
            when 'model' then 'model'
            else 'legacy:' || trim(regexp_replace(lower(unaccent(trim(pvo.option_name))), '[^a-z0-9]+', ' ', 'g'))
        end as group_key
) group_map on true
left join _v1053_canonical_attributes ca on ca.group_key = group_map.group_key
where pvo.attribute_value_id is null
  and pvo.option_value is not null
  and btrim(pvo.option_value) <> '';

-- The only rows that can reach this point without a target attribute are rows
-- with an invalid pre-existing value FK or an empty option name; leave those
-- untouched so the final assertion can stop the migration safely.
create temporary table _v1053_value_seeds (
    target_attribute_id varchar(64) not null,
    raw_value varchar(255) not null,
    base_slug varchar(160) not null,
    primary key (target_attribute_id, raw_value)
) on commit drop;

insert into _v1053_value_seeds (target_attribute_id, raw_value, base_slug)
select distinct
    target_attribute_id,
    raw_value,
    left(
        trim(both '-' from regexp_replace(lower(unaccent(raw_value)), '[^a-z0-9]+', '-', 'g')),
        150
    )
from _v1053_repair_rows
where target_attribute_id is not null;

create temporary table _v1053_value_links (
    target_attribute_id varchar(64) not null,
    raw_value varchar(255) not null,
    value_id varchar(64) not null,
    primary key (target_attribute_id, raw_value)
) on commit drop;

do $$
declare
    value_row record;
    chosen_id varchar(64);
    candidate_slug varchar(160);
    next_sort integer;
begin
    for value_row in select * from _v1053_value_seeds order by target_attribute_id, raw_value loop
        select av.id
        into chosen_id
        from attribute_values av
        where av.attribute_id = value_row.target_attribute_id
          and (
              av.label = value_row.raw_value
              or trim(regexp_replace(lower(unaccent(av.label)), '[^a-z0-9]+', ' ', 'g')) =
                 trim(regexp_replace(lower(unaccent(value_row.raw_value)), '[^a-z0-9]+', ' ', 'g'))
              or av.slug = value_row.raw_value
          )
        order by
            case when av.label = value_row.raw_value then 0 else 1 end,
            case when av.slug = value_row.base_slug then 0 else 1 end,
            av.id
        limit 1;

        if chosen_id is null then
            candidate_slug := nullif(value_row.base_slug, '');
            if candidate_slug is null then
                candidate_slug := 'value-' || substr(md5(value_row.raw_value), 1, 24);
            end if;

            loop
                exit when not exists (
                    select 1 from attribute_values av
                    where av.attribute_id = value_row.target_attribute_id
                      and av.slug = candidate_slug
                      and av.label <> value_row.raw_value
                );
                candidate_slug := left(candidate_slug, 135) || '-' || substr(
                    md5(value_row.target_attribute_id || ':' || value_row.raw_value || ':' || candidate_slug),
                    1,
                    14
                );
            end loop;

            select coalesce(max(av.sort_order), -1) + 1
            into next_sort
            from attribute_values av
            where av.attribute_id = value_row.target_attribute_id;

            chosen_id := 'repair-attr-value-' || substr(
                md5(value_row.target_attribute_id || ':' || value_row.raw_value),
                1,
                32
            );

            insert into attribute_values (id, attribute_id, slug, label, label_en, sort_order)
            values (
                chosen_id,
                value_row.target_attribute_id,
                candidate_slug,
                value_row.raw_value,
                null,
                next_sort
            )
            on conflict (attribute_id, slug) do nothing;

            select av.id
            into chosen_id
            from attribute_values av
            where av.attribute_id = value_row.target_attribute_id
              and av.slug = candidate_slug
            order by av.id
            limit 1;
        end if;

        insert into _v1053_value_links (target_attribute_id, raw_value, value_id)
        values (value_row.target_attribute_id, value_row.raw_value, chosen_id)
        on conflict (target_attribute_id, raw_value) do update set value_id = excluded.value_id;
    end loop;
end $$;

update product_variant_options pvo
set attribute_id = rr.target_attribute_id,
    attribute_value_id = vl.value_id
from _v1053_repair_rows rr
join _v1053_value_links vl
  on vl.target_attribute_id = rr.target_attribute_id
 and vl.raw_value = rr.raw_value
where pvo.id = rr.option_id
  and (pvo.attribute_id is null or pvo.attribute_value_id is null);

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
            message = format('V1053 đã dừng an toàn: %s dòng biến thể chưa có liên kết thuộc tính/giá trị hợp lệ.', unresolved_count),
            detail = format('Mẫu mã dòng cần rà soát: %s', coalesce(sample_ids, 'không có')),
            hint = 'Kiểm tra option_name/option_value hoặc liên kết cũ; migration không tự đoán và không ghi đè dòng đã liên kết.';
    end if;
end $$;

alter table product_variant_options
    alter column attribute_id set not null,
    alter column attribute_value_id set not null;
