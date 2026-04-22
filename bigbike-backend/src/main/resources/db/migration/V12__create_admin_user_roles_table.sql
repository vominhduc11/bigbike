-- Join table for AdminUserEntity.roles (ElementCollection<AdminRole>).
-- Allows a single admin user to hold multiple roles imported from WP
-- wp_capabilities (e.g. shop_manager + wpseo_editor).

create table admin_user_roles (
    admin_user_id uuid not null references admin_users(id) on delete cascade,
    role varchar(50) not null,
    primary key (admin_user_id, role)
);

create index admin_user_roles_user_idx on admin_user_roles(admin_user_id);
