# Sơ đồ quan hệ dữ liệu (ERD) - BigBike

> File này được **sinh tự động** bằng `bash scripts/ops/export-erd.sh` từ cơ sở dữ liệu đang chạy.
> Không sửa tay. Đây là ảnh chụp hiện trạng, không phải tài liệu hợp đồng - contract nằm ở `DATA_CONTRACT.md`.
> Sinh lúc: 2026-09-05 08:39 (giờ VN)

**Tổng quan:** 89 bảng, 1000 cột, 77 liên kết khoá ngoại, 109.220 dòng dữ liệu.

## Bản đồ nhóm nghiệp vụ

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Inter, Segoe UI, Arial, sans-serif","fontSize":"15px","primaryColor":"#FDEBE9","primaryTextColor":"#1A1414","primaryBorderColor":"#D40A07","lineColor":"#9E4A45","textColor":"#1A1414"}}}%%
flowchart LR
  San_pham___danh_muc["Sản phẩm & danh mục<br/>19 bảng · 6.751 dòng"]
  Khach_hang["Khách hàng & tài khoản<br/>7 bảng · 2.914 dòng"]
  Don_hang["Giỏ hàng, đơn hàng & thanh toán<br/>15 bảng · 55.787 dòng"]
  Danh_gia["Đánh giá sản phẩm<br/>7 bảng · 1 dòng"]
  Noi_dung_web["Nội dung & giao diện website<br/>13 bảng · 5.008 dòng"]
  Quan_tri["Quản trị & phân quyền<br/>10 bảng · 31.273 dòng"]
  Tro_ly_chat["Trợ lý chat<br/>7 bảng · 5.318 dòng"]
  Ky_thuat["Kỹ thuật & vận hành<br/>11 bảng · 2.168 dòng"]
  Danh_gia -->|1 liên kết| Don_hang
  Danh_gia -->|1 liên kết| Khach_hang
  Danh_gia -->|1 liên kết| San_pham___danh_muc
  Don_hang -->|3 liên kết| Khach_hang
  Don_hang -->|1 liên kết| Quan_tri
  Noi_dung_web -->|2 liên kết| San_pham___danh_muc
  Quan_tri -->|1 liên kết| Don_hang
  Tro_ly_chat -->|1 liên kết| Khach_hang
  Tro_ly_chat -->|1 liên kết| Noi_dung_web
  Tro_ly_chat -->|1 liên kết| San_pham___danh_muc
  classDef grp fill:#FDEBE9,stroke:#D40A07,stroke-width:1.2px,color:#1A1414;
  class San_pham___danh_muc,Khach_hang,Don_hang,Danh_gia,Noi_dung_web,Quan_tri,Tro_ly_chat,Ky_thuat grp;
```

## Sản phẩm & danh mục

19 bảng · 6.751 dòng.

| Bảng | Số dòng | Ghi chú |
|---|---:|---|
| `attribute_values` | 271 |  |
| `attributes` | 11 |  |
| `brands` | 26 |  |
| `catalog_size_groups` | 6 |  |
| `catalog_size_scales` | 8 |  |
| `catalog_size_values` | 87 |  |
| `catalog_visual_alias_mappings` | 158 |  |
| `catalog_visual_facets` | 16 |  |
| `categories` | 37 |  |
| `legacy_discontinued_products` | 58 |  |
| `product_accessory_product_map` | 0 |  |
| `product_category_map` | 250 |  |
| `product_related_product_map` | 1 |  |
| `product_tag_assignments_legacy` | 0 |  |
| `product_variant_gallery_images` | 2.048 |  |
| `product_variant_options` | 2.264 |  |
| `product_variants` | 1.258 |  |
| `products` | 249 |  |
| `stock_movements` | 3 |  |

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Inter, Segoe UI, Arial, sans-serif","fontSize":"14px","primaryColor":"#FDEBE9","primaryTextColor":"#1A1414","primaryBorderColor":"#D40A07","lineColor":"#9E4A45","textColor":"#1A1414","attributeBackgroundColorOdd":"#FFFFFF","attributeBackgroundColorEven":"#FAF5F4"},"er":{"layoutDirection":"LR","entityPadding":12,"diagramPadding":16}}}%%
erDiagram
  attribute_values {
    varchar id PK
    varchar attribute_id FK
    varchar slug
  }
  attributes {
    varchar id PK
    varchar code
    varchar name
  }
  brands {
    varchar id PK
    varchar slug
    varchar name
    timestamptz created_at
  }
  catalog_size_groups {
    varchar id PK
  }
  catalog_size_scales {
    varchar id PK
    varchar code
    varchar name
    varchar group_id FK
  }
  catalog_size_values {
    varchar id PK
    varchar scale_id FK
  }
  catalog_visual_alias_mappings {
    varchar alias_key PK
    varchar facet_type PK, FK
    varchar facet_key PK, FK
  }
  catalog_visual_facets {
    varchar facet_type PK
    varchar facet_key PK
  }
  categories {
    varchar id PK
    varchar slug
    varchar name
    varchar parent_id FK
    timestamptz created_at
  }
  legacy_discontinued_products {
    uuid id PK
    varchar slug
    varchar name
    timestamp created_at
  }
  product_accessory_product_map {
    varchar product_id PK, FK
    varchar accessory_product_id PK, FK
  }
  product_category_map {
    varchar product_id PK, FK
    varchar category_id PK, FK
  }
  product_related_product_map {
    varchar product_id PK, FK
    varchar related_product_id PK, FK
  }
  product_tag_assignments_legacy {
    bigint id PK
    varchar product_id FK
  }
  product_variant_gallery_images {
    bigint id PK
    varchar variant_id FK
    varchar title
  }
  product_variant_options {
    bigint id PK
    varchar variant_id FK
    varchar attribute_id FK
    varchar attribute_value_id FK
  }
  product_variants {
    varchar id PK
    varchar product_id FK
    varchar sku
    varchar name
  }
  products {
    varchar id PK
    varchar sku
    varchar slug
    varchar name
    varchar brand_id FK
    timestamptz created_at
    varchar size_scale_id FK
  }
  stock_movements {
    uuid id PK
    varchar product_variant_id FK
    timestamptz created_at
  }
  categories ||--o{ categories : "parent_id"
  brands ||--o{ products : "brand_id"
  products ||--o{ product_variants : "product_id"
  product_variants ||--o{ product_variant_options : "variant_id"
  products ||--o{ product_tag_assignments_legacy : "product_id"
  attributes ||--o{ attribute_values : "attribute_id"
  attributes ||--o{ product_variant_options : "attribute_id"
  attribute_values ||--o{ product_variant_options : "attribute_value_id"
  products ||--o{ product_category_map : "product_id"
  product_variants ||--o{ stock_movements : "product_variant_id"
  categories ||--o{ product_category_map : "category_id"
  product_variants ||--o{ product_variant_gallery_images : "variant_id"
  catalog_visual_facets ||--o{ catalog_visual_alias_mappings : "facet_type"
  catalog_visual_facets ||--o{ catalog_visual_alias_mappings : "facet_key"
  catalog_size_groups ||--o{ catalog_size_scales : "group_id"
  catalog_size_scales ||--o{ catalog_size_values : "scale_id"
  catalog_size_scales ||--o{ products : "size_scale_id"
  products ||--o{ product_related_product_map : "product_id"
  products ||--o{ product_related_product_map : "related_product_id"
  products ||--o{ product_accessory_product_map : "product_id"
  products ||--o{ product_accessory_product_map : "accessory_product_id"
```

## Khách hàng & tài khoản

7 bảng · 2.914 dòng.

| Bảng | Số dòng | Ghi chú |
|---|---:|---|
| `customer_addresses` | 877 |  |
| `customer_email_verification_tokens` | 3 |  |
| `customer_oauth_links` | 9 |  |
| `customer_password_reset_tokens` | 0 |  |
| `customer_privacy_consents` | 0 |  |
| `customer_sessions` | 65 |  |
| `customers` | 1.960 |  |

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Inter, Segoe UI, Arial, sans-serif","fontSize":"14px","primaryColor":"#FDEBE9","primaryTextColor":"#1A1414","primaryBorderColor":"#D40A07","lineColor":"#9E4A45","textColor":"#1A1414","attributeBackgroundColorOdd":"#FFFFFF","attributeBackgroundColorEven":"#FAF5F4"},"er":{"layoutDirection":"LR","entityPadding":12,"diagramPadding":16}}}%%
erDiagram
  customer_addresses {
    uuid id PK
    uuid customer_id FK
    varchar phone
    timestamptz created_at
    varchar email
  }
  customer_email_verification_tokens {
    uuid id PK
    uuid customer_id FK
    timestamptz created_at
  }
  customer_oauth_links {
    uuid id PK
    uuid customer_id FK
  }
  customer_password_reset_tokens {
    uuid id PK
    uuid customer_id FK
    timestamptz created_at
  }
  customer_privacy_consents {
    uuid id PK
    uuid customer_id FK
  }
  customer_sessions {
    uuid id PK
    uuid customer_id FK
    varchar status
    timestamptz created_at
  }
  customers {
    uuid id PK
    varchar email
    varchar phone
    varchar status
    timestamptz created_at
  }
  customers ||--o{ customer_addresses : "customer_id"
  customers ||--o{ customer_sessions : "customer_id"
  customers ||--o{ customer_password_reset_tokens : "customer_id"
  customers ||--o{ customer_email_verification_tokens : "customer_id"
  customers ||--o{ customer_oauth_links : "customer_id"
  customers ||--o{ customer_privacy_consents : "customer_id"
```

## Giỏ hàng, đơn hàng & thanh toán

15 bảng · 55.787 dòng.

| Bảng | Số dòng | Ghi chú |
|---|---:|---|
| `cart_items` | 46 |  |
| `carts` | 45.192 |  |
| `checkout_idempotency_keys` | 8 |  |
| `order_addresses` | 2.272 |  |
| `order_fee_items` | 0 |  |
| `order_history_batch_orders` | 1.660 |  |
| `order_history_batches` | 1 |  |
| `order_line_items` | 1.920 |  |
| `order_notes` | 3 |  |
| `order_overdue_reminder_orders` | 0 |  |
| `order_overdue_reminder_runs` | 3 |  |
| `order_shipping_items` | 1.346 |  |
| `orders` | 1.668 |  |
| `payment_events` | 0 |  |
| `payments` | 1.668 |  |

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Inter, Segoe UI, Arial, sans-serif","fontSize":"14px","primaryColor":"#FDEBE9","primaryTextColor":"#1A1414","primaryBorderColor":"#D40A07","lineColor":"#9E4A45","textColor":"#1A1414","attributeBackgroundColorOdd":"#FFFFFF","attributeBackgroundColorEven":"#FAF5F4"},"er":{"layoutDirection":"LR","entityPadding":12,"diagramPadding":16}}}%%
erDiagram
  cart_items {
    uuid id PK
    uuid cart_id FK
    varchar sku
    int quantity
    timestamptz created_at
  }
  carts {
    uuid id PK
    uuid customer_id FK
    varchar status
    timestamptz created_at
  }
  checkout_idempotency_keys {
    uuid id PK
    uuid customer_id FK
    uuid order_id FK
    timestamptz created_at
  }
  order_addresses {
    uuid id PK
    uuid order_id FK
    varchar email
    varchar phone
    timestamptz created_at
  }
  order_fee_items {
    uuid id PK
    uuid order_id FK
    text name
    timestamptz created_at
  }
  order_history_batch_orders {
    uuid id PK
    uuid batch_id FK
    uuid order_id FK
  }
  order_history_batches {
    uuid id PK
    timestamptz created_at
  }
  order_line_items {
    uuid id PK
    uuid order_id FK
    varchar sku
    int quantity
    timestamptz created_at
  }
  order_notes {
    uuid id PK
    uuid order_id FK
    timestamptz created_at
  }
  order_overdue_reminder_orders {
    uuid order_id PK, FK
    date run_date FK
  }
  order_overdue_reminder_runs {
    date run_date PK
    uuid notification_id FK
    timestamptz created_at
  }
  order_shipping_items {
    uuid id PK
    uuid order_id FK
    timestamptz created_at
  }
  orders {
    uuid id PK
    varchar order_number
    uuid customer_id FK
    varchar status
    timestamptz created_at
  }
  payment_events {
    uuid id PK
    uuid payment_id FK
    uuid order_id FK
    varchar status
  }
  payments {
    uuid id PK
    uuid order_id FK
    varchar status
    timestamptz created_at
  }
  admin_notifications {
    thuoc_nhom Quan_tri___phan_quyen
  }
  customers {
    thuoc_nhom Khach_hang___tai_khoan
  }
  customers ||--o{ carts : "customer_id"
  carts ||--o{ cart_items : "cart_id"
  customers ||--o{ orders : "customer_id"
  orders ||--o{ order_line_items : "order_id"
  orders ||--o{ order_shipping_items : "order_id"
  orders ||--o{ order_fee_items : "order_id"
  orders ||--o{ order_addresses : "order_id"
  orders ||--o{ order_notes : "order_id"
  orders ||--o{ payments : "order_id"
  payments ||--o{ payment_events : "payment_id"
  orders ||--o{ payment_events : "order_id"
  customers ||--o{ checkout_idempotency_keys : "customer_id"
  orders ||--o{ checkout_idempotency_keys : "order_id"
  order_history_batches ||--o{ order_history_batch_orders : "batch_id"
  orders ||--o{ order_history_batch_orders : "order_id"
  admin_notifications ||--o{ order_overdue_reminder_runs : "notification_id"
  orders ||--o{ order_overdue_reminder_orders : "order_id"
  order_overdue_reminder_runs ||--o{ order_overdue_reminder_orders : "run_date"
```

## Đánh giá sản phẩm

7 bảng · 1 dòng.

| Bảng | Số dòng | Ghi chú |
|---|---:|---|
| `review_invitation_campaigns` | 1 |  |
| `review_invitation_daily_quotas` | 0 |  |
| `review_invitation_deliveries` | 0 |  |
| `review_invitation_items` | 0 |  |
| `review_invitation_opt_outs` | 0 |  |
| `review_photo_uploads` | 0 |  |
| `reviews` | 0 |  |

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Inter, Segoe UI, Arial, sans-serif","fontSize":"14px","primaryColor":"#FDEBE9","primaryTextColor":"#1A1414","primaryBorderColor":"#D40A07","lineColor":"#9E4A45","textColor":"#1A1414","attributeBackgroundColorOdd":"#FFFFFF","attributeBackgroundColorEven":"#FAF5F4"},"er":{"layoutDirection":"LR","entityPadding":12,"diagramPadding":16}}}%%
erDiagram
  review_invitation_campaigns {
    uuid id PK
    timestamptz created_at
  }
  review_invitation_daily_quotas {
    date send_date PK
  }
  review_invitation_deliveries {
    uuid id PK
    uuid campaign_id FK
    uuid order_id FK
    varchar order_number
    varchar status
    timestamptz created_at
  }
  review_invitation_items {
    uuid id PK
    uuid delivery_id FK
    bigint review_id FK
    timestamptz created_at
  }
  review_invitation_opt_outs {
    uuid id PK
    varchar email
    timestamptz created_at
  }
  review_photo_uploads {
    varchar object_key PK
    bigint review_id FK
  }
  reviews {
    bigint id PK
    varchar product_id FK
    uuid customer_id FK
    varchar status
    timestamptz created_at
  }
  customers {
    thuoc_nhom Khach_hang___tai_khoan
  }
  orders {
    thuoc_nhom Gio_hang__don_hang___thanh_toan
  }
  products {
    thuoc_nhom San_pham___danh_muc
  }
  products ||--o{ reviews : "product_id"
  customers ||--o{ reviews : "customer_id"
  reviews ||--o{ review_photo_uploads : "review_id"
  review_invitation_campaigns ||--o{ review_invitation_deliveries : "campaign_id"
  orders ||--o{ review_invitation_deliveries : "order_id"
  review_invitation_deliveries ||--o{ review_invitation_items : "delivery_id"
  reviews ||--o{ review_invitation_items : "review_id"
```

## Nội dung & giao diện website

13 bảng · 5.008 dòng.

| Bảng | Số dòng | Ghi chú |
|---|---:|---|
| `article_tags` | 22 |  |
| `articles` | 185 |  |
| `home_category_highlights` | 3 |  |
| `home_highlights_config` | 1 |  |
| `home_videos` | 74 |  |
| `media` | 3.733 |  |
| `media_folders` | 34 |  |
| `media_tags` | 0 |  |
| `menu_items` | 75 |  |
| `menus` | 3 |  |
| `redirects` | 814 |  |
| `site_settings` | 59 |  |
| `sliders` | 5 |  |

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Inter, Segoe UI, Arial, sans-serif","fontSize":"14px","primaryColor":"#FDEBE9","primaryTextColor":"#1A1414","primaryBorderColor":"#D40A07","lineColor":"#9E4A45","textColor":"#1A1414","attributeBackgroundColorOdd":"#FFFFFF","attributeBackgroundColorEven":"#FAF5F4"},"er":{"layoutDirection":"LR","entityPadding":12,"diagramPadding":16}}}%%
erDiagram
  article_tags {
    varchar article_id PK, FK
    int sort_order PK
  }
  articles {
    varchar id PK
    varchar slug
    varchar title
    timestamptz published_at
    timestamptz created_at
  }
  home_category_highlights {
    smallint slot PK
    varchar product_id FK
  }
  home_highlights_config {
    smallint id PK
  }
  home_videos {
    varchar id PK
    varchar title
    bool is_active
    timestamptz created_at
  }
  media {
    uuid id PK
    text title
    varchar status
    timestamptz created_at
    uuid folder_id FK
  }
  media_folders {
    uuid id PK
    varchar name
    varchar slug
    timestamptz created_at
    uuid parent_id FK
  }
  media_tags {
    uuid media_id PK, FK
    varchar tag PK
    timestamptz created_at
  }
  menu_items {
    uuid id PK
    uuid menu_id FK
    uuid parent_id FK
    varchar status
    timestamptz created_at
  }
  menus {
    uuid id PK
    varchar name
    varchar status
    timestamptz created_at
  }
  redirects {
    uuid id PK
    timestamptz created_at
  }
  site_settings {
    uuid id PK
    timestamptz created_at
  }
  sliders {
    varchar id PK
    varchar product_id FK
    timestamptz created_at
    bool is_active
  }
  products {
    thuoc_nhom San_pham___danh_muc
  }
  articles ||--o{ article_tags : "article_id"
  menus ||--o{ menu_items : "menu_id"
  menu_items ||--o{ menu_items : "parent_id"
  products ||--o{ sliders : "product_id"
  media ||--o{ media_tags : "media_id"
  media_folders ||--o{ media : "folder_id"
  products ||--o{ home_category_highlights : "product_id"
  media_folders ||--o{ media_folders : "parent_id"
```

## Quản trị & phân quyền

10 bảng · 31.273 dòng.

| Bảng | Số dòng | Ghi chú |
|---|---:|---|
| `admin_invite_tokens` | 2 |  |
| `admin_notification_reads` | 3 |  |
| `admin_notifications` | 11 |  |
| `admin_refresh_tokens` | 4.411 |  |
| `admin_roles` | 4 |  |
| `admin_user_roles` | 0 |  |
| `admin_users` | 6 |  |
| `audit_logs` | 26.765 |  |
| `inventory_out_of_stock_digest_runs` | 6 |  |
| `role_permissions` | 65 |  |

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Inter, Segoe UI, Arial, sans-serif","fontSize":"14px","primaryColor":"#FDEBE9","primaryTextColor":"#1A1414","primaryBorderColor":"#D40A07","lineColor":"#9E4A45","textColor":"#1A1414","attributeBackgroundColorOdd":"#FFFFFF","attributeBackgroundColorEven":"#FAF5F4"},"er":{"layoutDirection":"LR","entityPadding":12,"diagramPadding":16}}}%%
erDiagram
  admin_invite_tokens {
    uuid id PK
    uuid admin_user_id FK
    timestamptz created_at
  }
  admin_notification_reads {
    uuid admin_id PK
  }
  admin_notifications {
    uuid id PK
    uuid order_id FK
    varchar order_number
    timestamptz created_at
  }
  admin_refresh_tokens {
    uuid id PK
    uuid admin_user_id FK
    timestamptz created_at
  }
  admin_roles {
    varchar id PK
    varchar name
    timestamptz created_at
  }
  admin_user_roles {
    uuid admin_user_id PK, FK
    varchar role PK
  }
  admin_users {
    uuid id PK
    varchar email
    varchar status
    timestamptz created_at
  }
  audit_logs {
    uuid id PK
    timestamptz created_at
  }
  inventory_out_of_stock_digest_runs {
    date digest_date PK
    uuid notification_id FK
    timestamptz created_at
  }
  role_permissions {
    varchar role_id PK, FK
    varchar permission PK
  }
  orders {
    thuoc_nhom Gio_hang__don_hang___thanh_toan
  }
  admin_users ||--o{ admin_refresh_tokens : "admin_user_id"
  admin_users ||--o{ admin_user_roles : "admin_user_id"
  admin_roles ||--o{ role_permissions : "role_id"
  orders ||--o{ admin_notifications : "order_id"
  admin_users ||--o{ admin_invite_tokens : "admin_user_id"
  admin_notifications ||--o{ inventory_out_of_stock_digest_runs : "notification_id"
```

## Trợ lý chat

7 bảng · 5.318 dòng.

| Bảng | Số dòng | Ghi chú |
|---|---:|---|
| `chat_ai_daily_usage` | 1 |  |
| `chat_conversations` | 3 |  |
| `chat_image_daily_usage` | 0 |  |
| `chat_images` | 0 |  |
| `chat_messages` | 3 |  |
| `chat_product_image_fingerprints` | 0 |  |
| `chat_visitors` | 5.311 |  |

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Inter, Segoe UI, Arial, sans-serif","fontSize":"14px","primaryColor":"#FDEBE9","primaryTextColor":"#1A1414","primaryBorderColor":"#D40A07","lineColor":"#9E4A45","textColor":"#1A1414","attributeBackgroundColorOdd":"#FFFFFF","attributeBackgroundColorEven":"#FAF5F4"},"er":{"layoutDirection":"LR","entityPadding":12,"diagramPadding":16}}}%%
erDiagram
  chat_ai_daily_usage {
    date usage_date PK
    timestamptz created_at
  }
  chat_conversations {
    uuid id PK
    uuid customer_id FK
    timestamptz created_at
    uuid continued_from_id FK
    uuid visitor_id FK
  }
  chat_image_daily_usage {
    date usage_date PK
    timestamptz created_at
  }
  chat_images {
    uuid id PK
    uuid conversation_id FK
    uuid customer_message_id FK
    varchar status
    timestamptz created_at
  }
  chat_messages {
    uuid id PK
    uuid conversation_id FK
    timestamptz created_at
  }
  chat_product_image_fingerprints {
    uuid id PK
    varchar product_id FK
    uuid media_id FK
  }
  chat_visitors {
    uuid id PK
    timestamptz created_at
  }
  customers {
    thuoc_nhom Khach_hang___tai_khoan
  }
  media {
    thuoc_nhom Noi_dung___giao_dien_website
  }
  products {
    thuoc_nhom San_pham___danh_muc
  }
  chat_conversations ||--o{ chat_images : "conversation_id"
  chat_messages ||--o{ chat_images : "customer_message_id"
  chat_conversations ||--o{ chat_messages : "conversation_id"
  products ||--o{ chat_product_image_fingerprints : "product_id"
  media ||--o{ chat_product_image_fingerprints : "media_id"
  customers ||--o{ chat_conversations : "customer_id"
  chat_conversations ||--o{ chat_conversations : "continued_from_id"
  chat_visitors ||--o{ chat_conversations : "visitor_id"
```

## Kỹ thuật & vận hành

11 bảng · 2.168 dòng.

| Bảng | Số dòng | Ghi chú |
|---|---:|---|
| `category_intro_faq_markup_backup` | 27 | ⚠️ bảng tạm/backup |
| `flyway_schema_history` | 453 |  |
| `gsc_agg` | 657 | ⚠️ bảng tạm/backup |
| `gsc_check` | 118 | ⚠️ bảng tạm/backup |
| `gsc_check2` | 231 | ⚠️ bảng tạm/backup |
| `live_migration_checkpoints` | 134 |  |
| `live_migration_runs` | 1 |  |
| `maintenance_cart_purge_backup_carts` | 0 | ⚠️ bảng tạm/backup |
| `maintenance_cart_purge_backup_items` | 0 | ⚠️ bảng tạm/backup |
| `maintenance_cart_purge_runs` | 0 |  |
| `tmp_p` | 547 | ⚠️ bảng tạm/backup |

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Inter, Segoe UI, Arial, sans-serif","fontSize":"14px","primaryColor":"#FDEBE9","primaryTextColor":"#1A1414","primaryBorderColor":"#D40A07","lineColor":"#9E4A45","textColor":"#1A1414","attributeBackgroundColorOdd":"#FFFFFF","attributeBackgroundColorEven":"#FAF5F4"},"er":{"layoutDirection":"LR","entityPadding":12,"diagramPadding":16}}}%%
erDiagram
  category_intro_faq_markup_backup {
    varchar category_id PK
  }
  flyway_schema_history {
    int installed_rank PK
  }
  gsc_agg {
    text path PK
  }
  gsc_check {
    text path
    int clicks
    int impressions
  }
  gsc_check2 {
    text path
    int clicks
    int impressions
  }
  live_migration_checkpoints {
    uuid run_id PK, FK
    varchar domain PK
    int batch_number PK
  }
  live_migration_runs {
    uuid run_id PK
    varchar status
  }
  maintenance_cart_purge_backup_carts {
    uuid run_id PK, FK
    uuid id PK
    varchar status
    timestamptz created_at
  }
  maintenance_cart_purge_backup_items {
    uuid run_id PK, FK
    uuid id PK
    varchar sku
    int quantity
    timestamptz created_at
  }
  maintenance_cart_purge_runs {
    uuid id PK
    varchar status
  }
  tmp_p {
    text p
  }
  live_migration_runs ||--o{ live_migration_checkpoints : "run_id"
  maintenance_cart_purge_runs ||--o{ maintenance_cart_purge_backup_carts : "run_id"
  maintenance_cart_purge_runs ||--o{ maintenance_cart_purge_backup_items : "run_id"
```

## Liên kết ngầm (không có ràng buộc khoá ngoại trong CSDL)

Các cột dưới đây trỏ tới bảng khác theo quy ước đặt tên nhưng **không** được cơ sở dữ liệu ràng buộc,
nên không hiện thành mũi tên trong sơ đồ. Dữ liệu mồ côi ở đây sẽ không bị chặn tự động.

| Bảng | Cột |
|---|---|
| `admin_notification_reads` | `admin_id` |
| `articles` | `cover_image_id` |
| `articles` | `seo_og_image_id` |
| `audit_logs` | `actor_id` |
| `audit_logs` | `resource_id` |
| `brands` | `logo_id` |
| `brands` | `seo_og_image_id` |
| `cart_items` | `product_id` |
| `cart_items` | `product_variant_id` |
| `cart_items` | `product_image_id` |
| `carts` | `session_id` |
| `categories` | `image_id` |
| `categories` | `icon_id` |
| `categories` | `seo_og_image_id` |
| `category_intro_faq_markup_backup` | `category_id` |
| `chat_conversations` | `thread_id` |
| `chat_images` | `request_id` |
| `chat_messages` | `request_id` |
| `checkout_idempotency_keys` | `guest_session_id` |
| `home_videos` | `youtube_id` |
| `live_migration_runs` | `run_id` |
| `live_migration_runs` | `snapshot_id` |
| `maintenance_cart_purge_backup_carts` | `customer_id` |
| `maintenance_cart_purge_backup_carts` | `session_id` |
| `maintenance_cart_purge_backup_items` | `cart_id` |
| `maintenance_cart_purge_backup_items` | `product_id` |
| `maintenance_cart_purge_backup_items` | `product_variant_id` |
| `maintenance_cart_purge_backup_items` | `product_image_id` |
| `menu_items` | `target_id` |
| `order_line_items` | `product_id` |
| `order_line_items` | `product_variant_id` |
| `order_notes` | `author_id` |
| `orders` | `created_by_admin_id` |
| `payment_events` | `event_id` |
| `payments` | `transaction_id` |
| `product_variant_gallery_images` | `image_id` |
| `product_variant_gallery_images` | `video_id` |
| `product_variants` | `image_id` |
| `products` | `image_id` |
| `products` | `seo_og_image_id` |
| `review_invitation_deliveries` | `customer_id` |
| `review_invitation_items` | `product_id` |
| `review_photo_uploads` | `product_id` |
| `stock_movements` | `reference_id` |
| `stock_movements` | `admin_id` |
| `stock_movements` | `product_id` |
