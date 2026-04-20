# API_CONTRACT.md

> API contract source cho BigBike.
>
> Áp dụng cho:
> - `bigbike-web`: public website / customer-facing frontend
> - `bigbike-admin`: internal admin dashboard
> - `bigbike-backend`: Spring Boot backend
>
> File này mô tả chuẩn giao tiếp API ở mức contract: naming, request/response shape, error format, pagination, auth boundary và endpoint groups. Đây không phải implementation code, không phải database schema, không phải UI design. Một API contract mà lẫn cả màu nút bấm thì đúng là tài liệu đã mất phương hướng.

---

## 1. Purpose

`API_CONTRACT.md` là nguồn chuẩn cho giao tiếp giữa frontend và backend trong hệ thống BigBike.

File này dùng để:

- Thống nhất cách frontend gọi backend.
- Thống nhất response shape.
- Thống nhất error handling.
- Thống nhất pagination/filter/sort.
- Thống nhất authentication/authorization behavior ở mức API.
- Làm checklist cho AI agent khi tạo/sửa API.
- Giảm data-contract drift giữa `bigbike-web`, `bigbike-admin` và `bigbike-backend`.

File này không định nghĩa:

- Database table/column chi tiết.
- UI layout/component.
- Design token.
- Business rule chi tiết.
- Exact implementation class/package.
- Third-party integration secret/config.

---

## 2. Contract Principles

### 2.1 Backend is source of truth

Backend là nguồn quyết định cuối cùng cho:

- Giá.
- Tồn kho.
- Trạng thái đơn.
- Quyền thao tác.
- Auth/session.
- Validation nghiệp vụ.
- Payment/order transition.
- Publish/unpublish state.

Frontend không được tự enforce logic cuối cùng rồi coi là đủ.

### 2.2 Stable public contract

API response không nên thay đổi tùy tiện.

Nếu cần thay đổi breaking:

- Cập nhật `API_CONTRACT.md`.
- Cập nhật `DATA_CONTRACT.md` nếu liên quan model.
- Cập nhật frontend consumers.
- Có migration/fallback nếu cần.

### 2.3 Explicit over implicit

API phải trả dữ liệu rõ, không bắt frontend đoán.

Không tốt:

```json
{ "status": 1 }
```

Tốt hơn:

```json
{ "status": "PENDING_CONFIRMATION" }
```

### 2.4 Consistent error shape

Mọi lỗi API nên dùng format thống nhất để frontend render error đúng.

### 2.5 No secret exposure

API không bao giờ trả:

- Password hash.
- Token secret.
- Payment secret.
- Internal credentials.
- Stack trace production.
- Sensitive system config.

---

## 3. Base API Conventions

### 3.1 Base path

Khuyến nghị:

```text
/api/v1
```

Ví dụ:

```text
GET /api/v1/products
GET /api/v1/admin/products
POST /api/v1/orders
```

### 3.2 Public vs admin API

Public API:

```text
/api/v1/...
```

Admin API:

```text
/api/v1/admin/...
```

Public API phục vụ `bigbike-web`.

Admin API phục vụ `bigbike-admin` và cần auth/permission.

### 3.3 HTTP methods

| Method | Meaning |
|---|---|
| `GET` | Read/query data |
| `POST` | Create resource or execute command |
| `PUT` | Replace full resource if supported |
| `PATCH` | Partial update |
| `DELETE` | Delete/archive if supported |

Không dùng `GET` để mutate data. Đó là cách khiến crawler và cache trở thành đồng phạm.

### 3.4 Content type

Default:

```http
Content-Type: application/json
Accept: application/json
```

File upload có thể dùng:

```http
multipart/form-data
```

### 3.5 Time format

Datetime dùng ISO-8601:

```text
2026-04-20T10:30:00+07:00
```

Nếu backend dùng UTC:

```text
2026-04-20T03:30:00Z
```

Contract phải thống nhất timezone strategy trong `DATA_CONTRACT.md`.

### 3.6 Currency

Tiền tệ mặc định:

```text
VND
```

Không dùng floating point cho tiền trong API. Dùng integer minor/current VND amount.

Ví dụ:

```json
{
  "retailPrice": 1250000,
  "currency": "VND"
}
```

---

## 4. Standard Response Shape

### 4.1 Single resource response

```json
{
  "data": {
    "id": "prod_123",
    "name": "Mũ bảo hiểm LS2 FF800"
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-04-20T03:30:00Z"
  }
}
```

### 4.2 List response

```json
{
  "data": [
    {
      "id": "prod_123",
      "name": "Mũ bảo hiểm LS2 FF800"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 282,
    "totalPages": 15,
    "hasNext": true,
    "hasPrevious": false
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-04-20T03:30:00Z"
  }
}
```

### 4.3 Command response

Dùng cho action như publish, cancel order, update status:

```json
{
  "data": {
    "success": true,
    "resourceId": "ord_123",
    "status": "CONFIRMED"
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-04-20T03:30:00Z"
  }
}
```

### 4.4 Empty success response

Nếu không cần trả resource:

```json
{
  "data": null,
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-04-20T03:30:00Z"
  }
}
```

---

## 5. Standard Error Shape

### 5.1 Error response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed.",
    "details": [
      {
        "field": "phone",
        "code": "INVALID_PHONE",
        "message": "Phone number is invalid."
      }
    ]
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-04-20T03:30:00Z"
  }
}
```

### 5.2 Error fields

| Field | Required | Meaning |
|---|---:|---|
| `error.code` | Yes | Stable machine-readable error code |
| `error.message` | Yes | Human-readable summary |
| `error.details` | No | Field-level or domain-specific details |
| `details[].field` | No | Field path |
| `details[].code` | Yes if detail exists | Machine-readable detail code |
| `details[].message` | Yes if detail exists | User-safe detail message |
| `meta.requestId` | Yes | Trace/debug support |
| `meta.timestamp` | Yes | Response time |

### 5.3 Error code categories

```text
VALIDATION_ERROR
AUTHENTICATION_REQUIRED
PERMISSION_DENIED
NOT_FOUND
CONFLICT
BUSINESS_RULE_VIOLATION
RATE_LIMITED
SERVER_ERROR
SERVICE_UNAVAILABLE
UPLOAD_FAILED
```

### 5.4 Field validation example

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "details": [
      {
        "field": "customer.fullName",
        "code": "REQUIRED",
        "message": "Full name is required."
      },
      {
        "field": "customer.phone",
        "code": "INVALID_PHONE",
        "message": "Phone number is invalid."
      }
    ]
  }
}
```

---

## 6. HTTP Status Codes

| Status | Meaning |
|---:|---|
| `200` | OK |
| `201` | Created |
| `204` | No content if intentionally used |
| `400` | Bad request / validation error |
| `401` | Authentication required |
| `403` | Permission denied |
| `404` | Resource not found |
| `409` | Conflict / invalid state transition |
| `422` | Business validation failed if used |
| `429` | Rate limited |
| `500` | Server error |
| `503` | Service unavailable |

Rule:

- `401`: user chưa login/session hết hạn.
- `403`: user có login nhưng không đủ quyền.
- `404`: resource không tồn tại hoặc không được expose.
- `409`: conflict, stale state, invalid transition.

---

## 7. Pagination, Filter, Sort

### 7.1 Query params

```text
?page=1&pageSize=20&sort=createdAt:desc
```

### 7.2 Pagination params

| Param | Type | Default | Rule |
|---|---|---:|---|
| `page` | integer | `1` | 1-based |
| `pageSize` | integer | `20` | backend caps max |
| `sort` | string | endpoint-specific | `field:direction` |

### 7.3 Filter params

Filter nên dùng query params rõ:

```text
GET /api/v1/products?categorySlug=mu-bao-hiem&brand=ls2&minPrice=500000&maxPrice=3000000
```

Admin filters:

```text
GET /api/v1/admin/orders?status=PENDING_CONFIRMATION&paymentStatus=UNPAID&from=2026-04-01&to=2026-04-20
```

### 7.4 Sort format

```text
sort=createdAt:desc
sort=price:asc
sort=name:asc
```

Backend phải reject unsupported sort field, không silently ignore nếu gây hiểu nhầm.

---

## 8. Authentication & Authorization

### 8.1 Public API

Public API không yêu cầu admin auth.

Có thể vẫn cần anonymous/session/cart token nếu hệ thống hỗ trợ.

### 8.2 Admin API

Admin API bắt buộc auth.

Nếu chưa login:

```http
401 Unauthorized
```

Nếu không đủ quyền:

```http
403 Forbidden
```

### 8.3 Session expiration

Khi session hết hạn:

- Backend trả `401`.
- Frontend redirect/login hoặc show session expired.
- Không silently fail.

### 8.4 Permission source

Permission chính thức nằm trong:

```text
docs/contracts/PERMISSION_MATRIX.md
```

API phải enforce permission ở backend.

Frontend chỉ ẩn/disable action để UX tốt hơn.

---

## 9. Idempotency

### 9.1 Checkout/order submit

Order creation nên hỗ trợ idempotency để tránh duplicate order khi:

- User double-click submit.
- Network retry.
- Browser refresh after submit.
- Mobile connection unstable.

Header khuyến nghị:

```http
Idempotency-Key: uuid-v4
```

### 9.2 Idempotent commands

Các command có rủi ro tạo duplicate side effect nên cân nhắc idempotency:

- Create order.
- Payment confirmation.
- Manual order creation.
- Upload finalization if relevant.

---

## 10. Public Product APIs

### 10.1 List products

```http
GET /api/v1/products
```

Query params:

```text
page
pageSize
q
categorySlug
brandSlug
minPrice
maxPrice
stockState
sort
```

Response item shape should align with `DATA_CONTRACT.md`.

Minimum fields:

```json
{
  "id": "prod_123",
  "slug": "mu-bao-hiem-ls2-ff800",
  "name": "Mũ bảo hiểm LS2 FF800",
  "brand": {
    "id": "brand_123",
    "name": "LS2",
    "slug": "ls2"
  },
  "category": {
    "id": "cat_helmet",
    "name": "Mũ bảo hiểm",
    "slug": "mu-bao-hiem"
  },
  "image": {
    "url": "https://cdn.example.com/products/ls2-ff800.jpg",
    "alt": "Mũ bảo hiểm LS2 FF800"
  },
  "price": {
    "retailPrice": 1250000,
    "compareAtPrice": 1500000,
    "currency": "VND"
  },
  "stockState": "IN_STOCK",
  "publishStatus": "PUBLISHED"
}
```

### 10.2 Get product detail

```http
GET /api/v1/products/{slug}
```

Response should include:

- Identity.
- Media/gallery.
- Price.
- Stock state.
- Variants if any.
- Specifications.
- Description.
- SEO metadata.
- Related products if endpoint owns that data.

### 10.3 Product search

```http
GET /api/v1/search/products?q=helmet
```

Or reuse list endpoint with `q`.

Search response should include product cards and optional suggestions.

---

## 11. Public Category APIs

### 11.1 List categories

```http
GET /api/v1/categories
```

Response:

```json
{
  "data": [
    {
      "id": "cat_helmet",
      "name": "Mũ bảo hiểm",
      "slug": "mu-bao-hiem",
      "description": "Mũ bảo hiểm cho biker.",
      "image": {
        "url": "/brand/category/helmet.jpg",
        "alt": "Mũ bảo hiểm"
      },
      "isVisible": true
    }
  ]
}
```

### 11.2 Get category detail

```http
GET /api/v1/categories/{slug}
```

Should include:

- Category identity.
- SEO content.
- Children if any.
- Metadata needed by category page.

---

## 12. Cart APIs

### 12.1 Get cart

```http
GET /api/v1/cart
```

### 12.2 Add item

```http
POST /api/v1/cart/items
```

Request:

```json
{
  "productId": "prod_123",
  "variantId": "var_123",
  "quantity": 1
}
```

### 12.3 Update item quantity

```http
PATCH /api/v1/cart/items/{itemId}
```

Request:

```json
{
  "quantity": 2
}
```

### 12.4 Remove item

```http
DELETE /api/v1/cart/items/{itemId}
```

### 12.5 Cart response

```json
{
  "data": {
    "id": "cart_123",
    "items": [
      {
        "id": "item_123",
        "productId": "prod_123",
        "variantId": "var_123",
        "name": "Mũ bảo hiểm LS2 FF800",
        "image": {
          "url": "https://cdn.example.com/products/ls2-ff800.jpg",
          "alt": "Mũ bảo hiểm LS2 FF800"
        },
        "unitPrice": 1250000,
        "quantity": 2,
        "lineTotal": 2500000,
        "stockState": "IN_STOCK"
      }
    ],
    "subtotal": 2500000,
    "currency": "VND"
  }
}
```

---

## 13. Checkout / Order APIs

### 13.1 Create order

```http
POST /api/v1/orders
```

Recommended header:

```http
Idempotency-Key: uuid-v4
```

Request:

```json
{
  "cartId": "cart_123",
  "customer": {
    "fullName": "Nguyễn Văn A",
    "phone": "0900000000",
    "email": "customer@example.com"
  },
  "shippingAddress": {
    "addressLine": "123 Nguyễn Trãi",
    "ward": "Phường ...",
    "district": "Quận ...",
    "province": "TP. Hồ Chí Minh"
  },
  "paymentMethod": "COD",
  "note": "Gọi trước khi giao"
}
```

Response:

```json
{
  "data": {
    "orderId": "ord_123",
    "orderCode": "BB-20260420-0001",
    "status": "PENDING_CONFIRMATION",
    "paymentStatus": "UNPAID",
    "total": 2500000,
    "currency": "VND",
    "nextStep": "BigBike will contact the customer to confirm the order."
  }
}
```

### 13.2 Get public order by code if supported

```http
GET /api/v1/orders/{orderCode}
```

Only expose if business/security allows.

---

## 14. Public Content APIs

### 14.1 List articles

```http
GET /api/v1/articles
```

Params:

```text
page
pageSize
categorySlug
q
sort
```

### 14.2 Get article detail

```http
GET /api/v1/articles/{slug}
```

Response should include:

- Title.
- Slug.
- Excerpt.
- Body/content.
- Cover image.
- SEO metadata.
- Published date.
- Updated date.
- Related content/products if available.

### 14.3 Policy pages

```http
GET /api/v1/pages/{slug}
```

Or static build source if Next.js owns content.

---

## 15. Contact / Support APIs

### 15.1 Submit contact form

```http
POST /api/v1/contact-requests
```

Request:

```json
{
  "fullName": "Nguyễn Văn A",
  "phone": "0900000000",
  "email": "customer@example.com",
  "subject": "Tư vấn mũ bảo hiểm",
  "message": "Tôi cần tư vấn size mũ."
}
```

Response:

```json
{
  "data": {
    "id": "contact_123",
    "status": "RECEIVED"
  }
}
```

---

## 16. Admin Product APIs

### 16.1 List admin products

```http
GET /api/v1/admin/products
```

Admin product response can include internal fields:

- publishStatus.
- stock quantity if allowed.
- updatedAt.
- createdAt.
- validation flags.
- internal notes if any.

### 16.2 Create product

```http
POST /api/v1/admin/products
```

### 16.3 Update product

```http
PATCH /api/v1/admin/products/{productId}
```

### 16.4 Publish / unpublish product

```http
POST /api/v1/admin/products/{productId}/publish
POST /api/v1/admin/products/{productId}/unpublish
```

Command endpoint is preferred when transition has validation/history.

### 16.5 Archive/delete product

```http
POST /api/v1/admin/products/{productId}/archive
```

Hard delete only if business/backend supports it.

---

## 17. Admin Order APIs

### 17.1 List orders

```http
GET /api/v1/admin/orders
```

Filters:

```text
q
status
paymentStatus
from
to
page
pageSize
sort
```

### 17.2 Get order detail

```http
GET /api/v1/admin/orders/{orderId}
```

### 17.3 Update order status

```http
POST /api/v1/admin/orders/{orderId}/status
```

Request:

```json
{
  "status": "CONFIRMED",
  "reason": "Customer confirmed by phone",
  "note": "Call completed at 10:30"
}
```

### 17.4 Cancel order

```http
POST /api/v1/admin/orders/{orderId}/cancel
```

Request:

```json
{
  "reason": "Customer requested cancellation"
}
```

Backend must validate transition.

---

## 18. Admin Content APIs

### 18.1 List content

```http
GET /api/v1/admin/articles
GET /api/v1/admin/pages
```

### 18.2 Create/update content

```http
POST /api/v1/admin/articles
PATCH /api/v1/admin/articles/{articleId}
```

### 18.3 Publish/unpublish content

```http
POST /api/v1/admin/articles/{articleId}/publish
POST /api/v1/admin/articles/{articleId}/unpublish
```

---

## 19. Media APIs

### 19.1 Upload media

```http
POST /api/v1/admin/media
Content-Type: multipart/form-data
```

Response:

```json
{
  "data": {
    "id": "media_123",
    "url": "https://cdn.example.com/uploads/image.jpg",
    "alt": "",
    "mimeType": "image/jpeg",
    "size": 120000,
    "width": 1200,
    "height": 1200
  }
}
```

### 19.2 Media rules

- Backend validates file type.
- Backend validates size.
- Do not expose server file path.
- Return public URL or signed URL strategy.
- Alt text should be editable for public images.

---

## 20. Admin User / Auth APIs

### 20.1 Login

```http
POST /api/v1/auth/login
```

### 20.2 Logout

```http
POST /api/v1/auth/logout
```

### 20.3 Current user

```http
GET /api/v1/auth/me
```

Response:

```json
{
  "data": {
    "id": "user_123",
    "fullName": "Admin User",
    "email": "admin@example.com",
    "roles": ["ADMIN"],
    "permissions": ["products.read", "orders.updateStatus"]
  }
}
```

Do not expose password hash, refresh token secret, or internal security fields.

---

## 21. Contract With DATA_CONTRACT.md

Every API resource shape must align with:

```text
docs/contracts/DATA_CONTRACT.md
```

If API returns product:

- Product fields must match data contract naming.
- Status values must match official status list.
- Nullable/optional fields must be documented.
- Frontend fallback must not hide contract mismatch.

---

## 22. Contract With STATE_MACHINES.md

Endpoints that change status must align with:

```text
docs/contracts/STATE_MACHINES.md
```

Examples:

- Order status update.
- Payment status update.
- Product publish/unpublish.
- Content publish/unpublish.
- Support ticket status update.

Backend must reject invalid transition with:

```text
409 CONFLICT
```

or appropriate business rule error.

---

## 23. Contract With PERMISSION_MATRIX.md

Admin endpoints must align with:

```text
docs/contracts/PERMISSION_MATRIX.md
```

Rule:

- Frontend may hide actions.
- Backend must enforce permissions.
- API must return `403` when permission is missing.

---

## 24. Versioning

### 24.1 API version

Use path versioning:

```text
/api/v1
```

### 24.2 Breaking changes

Breaking changes require:

- New version or migration.
- Contract update.
- Frontend update.
- Changelog if needed.

### 24.3 Backward compatibility

Do not remove fields used by frontend without migration.

Adding optional fields is usually non-breaking.

---

## 25. AI Agent Rules

When modifying API:

1. Do not invent fields without updating `DATA_CONTRACT.md`.
2. Do not invent statuses without updating `STATE_MACHINES.md`.
3. Do not invent permissions without updating `PERMISSION_MATRIX.md`.
4. Do not expose secrets.
5. Do not return raw stack trace.
6. Do not use inconsistent error format.
7. Do not let frontend be final business validator.
8. Do not use `GET` for mutation.
9. Do not break existing consumers silently.
10. Update this file when contract changes.

---

## 26. Review Checklist

- [ ] Endpoint path follows convention.
- [ ] Method matches operation.
- [ ] Request shape documented.
- [ ] Response shape documented.
- [ ] Error shape documented.
- [ ] Auth/permission documented.
- [ ] Pagination/filter/sort documented if list endpoint.
- [ ] Status transition validated.
- [ ] Response fields align with `DATA_CONTRACT.md`.
- [ ] No secret/internal fields exposed.
- [ ] Frontend error handling possible.
