# Đánh giá sản phẩm

7 bảng · 1 dòng · chỉ hiện khoá chính (PK) và khoá liên kết (FK).

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
