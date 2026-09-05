# Trợ lý chat

7 bảng · 5.318 dòng · chỉ hiện khoá chính (PK) và khoá liên kết (FK).

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
