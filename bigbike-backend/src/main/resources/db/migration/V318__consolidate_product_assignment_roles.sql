-- V318: Consolidate the 3 fixed product_assign_role_*/items_* key-pairs (Content/SEO/Quản lý)
-- into a single product_assign_roles JSON array so Super Admin can add/remove roles (1-6) from
-- the admin UI without a code deploy. See DATA_CONTRACT.md "product_assign keys" + BUSINESS_RULES.md
-- SETTINGS_RULE_002. product_assign_title is untouched — it's a separate, orthogonal key.
--
-- Reads CURRENT live values (not the original V157 seed text, since an admin may have already
-- edited them) via subselects on setting_key, COALESCE-guarded in case a row was ever deleted
-- out-of-band. Stable ids content/seo/manager are assigned so the admin UI can still fall back
-- to the original default label if one of these 3 is later renamed or deleted (see Layout.jsx
-- useRoleLabel). Idempotent: skips the insert if product_assign_roles already exists (mirrors the
-- guard idiom in V240__convert_suitability_advisory_to_cards.sql).

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select
    gen_random_uuid(),
    'product_assign_roles',
    jsonb_build_array(
        jsonb_build_object(
            'id', 'content',
            'name', coalesce((select setting_value from site_settings where setting_key = 'product_assign_role_content'), 'Content'),
            'items', coalesce((select setting_value from site_settings where setting_key = 'product_assign_items_content'), '')
        ),
        jsonb_build_object(
            'id', 'seo',
            'name', coalesce((select setting_value from site_settings where setting_key = 'product_assign_role_seo'), 'SEO'),
            'items', coalesce((select setting_value from site_settings where setting_key = 'product_assign_items_seo'), '')
        ),
        jsonb_build_object(
            'id', 'manager',
            'name', coalesce((select setting_value from site_settings where setting_key = 'product_assign_role_manager'), 'Quản lý'),
            'items', coalesce((select setting_value from site_settings where setting_key = 'product_assign_items_manager'), '')
        )
    )::text,
    'product_assign',
    false,
    'Danh sách vai trò (tên + việc phụ trách) trên banner phân công, 1-6 vai trò.',
    now(),
    now()
where not exists (select 1 from site_settings where setting_key = 'product_assign_roles');

delete from site_settings
where setting_key in (
    'product_assign_role_content', 'product_assign_items_content',
    'product_assign_role_seo', 'product_assign_items_seo',
    'product_assign_role_manager', 'product_assign_items_manager'
);
