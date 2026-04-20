# PERMISSION_MATRIX.md

> Permission matrix contract cho BigBike.
>
> File này định nghĩa roles, permissions và quyền thao tác trong `bigbike-admin` và backend admin APIs.
>
> Đây không phải UI design, không phải business process, không phải database schema. Đây là bảng “ai được làm gì”. Nếu không có bảng này, admin dashboard sẽ nhanh chóng thành bữa tiệc ai cũng cầm chìa khóa kho.

---

## 1. Purpose

`PERMISSION_MATRIX.md` là nguồn chuẩn cho phân quyền trong BigBike.

File này dùng để:

- Backend enforce admin API permissions.
- Frontend hide/disable action hợp lý.
- QA test role-based access.
- AI agent không tự phát minh quyền.
- Admin UX hiển thị permission denied đúng.

File này áp dụng cho:

- `bigbike-admin`.
- `bigbike-backend` admin APIs.
- Admin-only operations.

Public customer website không dùng permission matrix này, trừ account/customer permission riêng nếu sau này có.

---

## 2. Permission Principles

### 2.1 Backend must enforce

Frontend chỉ giúp UX:

- Hide menu.
- Disable button.
- Show permission denied.

Backend phải enforce thật.

### 2.2 Least privilege

User chỉ có quyền cần thiết cho vai trò.

Không cấp quyền rộng vì “cho tiện”. Lịch sử phần mềm toàn những thứ “cho tiện” rồi thành audit nightmare.

### 2.3 Permission names are stable

Permission name phải ổn định.

Nếu đổi permission:

- Update this file.
- Update backend.
- Update frontend.
- Update seed/migration/config.
- Update tests.

### 2.4 Role is bundle, permission is truth

Role là nhóm permission.

Backend check permission cụ thể, không nên hardcode logic theo role name nếu có thể.

---

## 3. Role Definitions

### 3.1 SUPER_ADMIN

Toàn quyền hệ thống.

Dùng cho owner/developer/system admin.

### 3.2 ADMIN

Quản trị vận hành chính.

Có thể quản lý sản phẩm, đơn hàng, nội dung, khách hàng cơ bản, campaign và support tùy scope.

### 3.3 MANAGER

Quản lý vận hành, có quyền xem và xử lý nghiệp vụ quan trọng nhưng không nhất thiết có quyền system settings/user management.

### 3.4 SALES

Nhân sự bán hàng/chăm sóc khách.

Tập trung vào đơn hàng, khách hàng, liên hệ/support.

### 3.5 CONTENT_EDITOR

Quản lý bài viết, page, SEO content, campaign visual/copy nếu được cấp.

### 3.6 SUPPORT

Xử lý contact/support/warranty/return request nếu module có.

### 3.7 VIEWER

Chỉ xem, không mutate.

---

## 4. Permission Naming Convention

Format:

```text
resource.action
```

Examples:

```text
products.read
products.create
products.update
products.publish
products.archive

orders.read
orders.updateStatus
orders.cancel

content.read
content.create
content.update
content.publish

users.read
users.manage
settings.update
```

Actions chuẩn:

```text
read
create
update
delete
archive
publish
unpublish
manage
export
updateStatus
cancel
upload
reply
assign
```

Không dùng tên mơ hồ:

```text
doStuff
adminPower
specialAccess
editThings
```

---

## 5. Permission Catalog

### 5.1 Dashboard

| Permission | Meaning |
|---|---|
| `dashboard.read` | View admin dashboard |

### 5.2 Products

| Permission | Meaning |
|---|---|
| `products.read` | View product list/detail |
| `products.create` | Create product |
| `products.update` | Edit product |
| `products.publish` | Publish/unpublish product |
| `products.archive` | Archive product |
| `products.delete` | Hard delete product if supported |
| `products.export` | Export product data |

### 5.3 Categories / Brands

| Permission | Meaning |
|---|---|
| `catalog.read` | View categories/brands |
| `catalog.create` | Create category/brand |
| `catalog.update` | Edit category/brand |
| `catalog.archive` | Archive category/brand |
| `catalog.delete` | Hard delete if supported |

### 5.4 Orders

| Permission | Meaning |
|---|---|
| `orders.read` | View orders |
| `orders.create` | Create manual order if supported |
| `orders.update` | Edit order allowed fields |
| `orders.updateStatus` | Change order status |
| `orders.cancel` | Cancel order |
| `orders.export` | Export order data |
| `orders.addNote` | Add internal note |

### 5.5 Payments

| Permission | Meaning |
|---|---|
| `payments.read` | View payment state/info |
| `payments.updateStatus` | Update payment status manually if supported |
| `payments.refund` | Process/mark refund if supported |

### 5.6 Customers

| Permission | Meaning |
|---|---|
| `customers.read` | View customer list/detail |
| `customers.update` | Edit customer data |
| `customers.disable` | Disable customer |
| `customers.export` | Export customer data |

### 5.7 Content / SEO

| Permission | Meaning |
|---|---|
| `content.read` | View content list/detail |
| `content.create` | Create article/page |
| `content.update` | Edit article/page |
| `content.publish` | Publish/unpublish content |
| `content.archive` | Archive content |
| `content.delete` | Hard delete if supported |

### 5.8 Campaigns / Promotions

| Permission | Meaning |
|---|---|
| `campaigns.read` | View campaigns |
| `campaigns.create` | Create campaign |
| `campaigns.update` | Edit campaign |
| `campaigns.publish` | Activate/publish campaign |
| `campaigns.disable` | Disable campaign |
| `campaigns.delete` | Delete campaign if supported |

### 5.9 Media

| Permission | Meaning |
|---|---|
| `media.read` | View media |
| `media.upload` | Upload media |
| `media.update` | Edit media metadata |
| `media.delete` | Delete media if supported |

### 5.10 Support / Contact

| Permission | Meaning |
|---|---|
| `support.read` | View contact/support requests |
| `support.reply` | Reply to customer if supported |
| `support.updateStatus` | Update support status |
| `support.assign` | Assign support request |
| `support.addNote` | Add internal note |

### 5.11 Warranty / Return

Only if module exists.

| Permission | Meaning |
|---|---|
| `warranty.read` | View warranty/return requests |
| `warranty.updateStatus` | Update request status |
| `warranty.approve` | Approve request |
| `warranty.reject` | Reject request |
| `warranty.addNote` | Add internal note |

### 5.12 Users / Roles

| Permission | Meaning |
|---|---|
| `users.read` | View admin users |
| `users.create` | Create admin user |
| `users.update` | Edit admin user |
| `users.disable` | Disable admin user |
| `roles.read` | View roles |
| `roles.manage` | Create/update role permissions |

### 5.13 Settings

| Permission | Meaning |
|---|---|
| `settings.read` | View settings |
| `settings.update` | Update settings |
| `settings.sensitive.update` | Update sensitive/integration settings |

### 5.14 Audit

| Permission | Meaning |
|---|---|
| `audit.read` | View audit logs if supported |

---

## 6. Role Permission Matrix

### 6.1 Matrix

| Permission | SUPER_ADMIN | ADMIN | MANAGER | SALES | CONTENT_EDITOR | SUPPORT | VIEWER |
|---|---:|---:|---:|---:|---:|---:|---:|
| `dashboard.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `products.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `products.create` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `products.update` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `products.publish` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `products.archive` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `products.delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `products.export` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `catalog.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `catalog.create` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `catalog.update` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `catalog.archive` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `catalog.delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `orders.read` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `orders.create` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `orders.update` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `orders.updateStatus` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `orders.cancel` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `orders.export` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `orders.addNote` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `payments.read` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `payments.updateStatus` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `payments.refund` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `customers.read` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `customers.update` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `customers.disable` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `customers.export` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `content.read` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| `content.create` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `content.update` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `content.publish` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `content.archive` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `content.delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `campaigns.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `campaigns.create` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `campaigns.update` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `campaigns.publish` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `campaigns.disable` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `campaigns.delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `media.read` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| `media.upload` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `media.update` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `media.delete` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `support.read` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `support.reply` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `support.updateStatus` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `support.assign` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `support.addNote` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `warranty.read` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `warranty.updateStatus` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `warranty.approve` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `warranty.reject` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `warranty.addNote` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `users.read` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `users.create` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `users.update` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `users.disable` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `roles.read` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `roles.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `settings.read` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `settings.update` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `settings.sensitive.update` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `audit.read` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 6.2 Matrix notes

- `SUPER_ADMIN` should be rare.
- `ADMIN` should not automatically manage users/settings unless intentionally granted.
- `VIEWER` never mutates data.
- `CONTENT_EDITOR` should not touch orders/payments/customers unless explicitly needed.
- `SALES` focuses on orders/customers/contact, not system settings.
- `SUPPORT` focuses on support/warranty/contact.

---

## 7. Frontend Behavior

### 7.1 Hide vs disable

Use hide when:

- User should not know feature exists.
- Permission missing for whole module/menu.

Use disable when:

- User can see resource but action is not allowed.
- Need explain why action unavailable.

### 7.2 Permission denied page

If user opens unauthorized route:

```text
You do not have permission to access this page.
```

Vietnamese UI copy can be:

```text
Bạn không có quyền truy cập trang này.
```

### 7.3 Action-level denial

If user clicks action but backend returns `403`:

- Show clear message.
- Do not retry automatically.
- Do not expose internal permission details beyond what is useful.

---

## 8. Backend Behavior

### 8.1 Enforce every admin endpoint

Every admin endpoint must check permission.

Examples:

```text
GET /api/v1/admin/products -> products.read
POST /api/v1/admin/products -> products.create
PATCH /api/v1/admin/products/{id} -> products.update
POST /api/v1/admin/orders/{id}/cancel -> orders.cancel
```

### 8.2 401 vs 403

Use:

```text
401 AUTHENTICATION_REQUIRED
```

when no valid session/token.

Use:

```text
403 PERMISSION_DENIED
```

when authenticated but missing permission.

### 8.3 Role/permission response

`GET /api/v1/auth/me` should return role/permissions needed by frontend:

```json
{
  "data": {
    "id": "user_123",
    "fullName": "Admin User",
    "roles": ["ADMIN"],
    "permissions": ["products.read", "orders.read"]
  }
}
```

Do not expose sensitive auth internals.

---

## 9. Route Permission Mapping

Suggested admin routes:

| Route | Required permission |
|---|---|
| `/admin` | `dashboard.read` |
| `/admin/products` | `products.read` |
| `/admin/products/new` | `products.create` |
| `/admin/products/:id` | `products.read` |
| `/admin/products/:id/edit` | `products.update` |
| `/admin/categories` | `catalog.read` |
| `/admin/orders` | `orders.read` |
| `/admin/orders/:id` | `orders.read` |
| `/admin/customers` | `customers.read` |
| `/admin/content` | `content.read` |
| `/admin/content/new` | `content.create` |
| `/admin/campaigns` | `campaigns.read` |
| `/admin/media` | `media.read` |
| `/admin/support` | `support.read` |
| `/admin/warranty` | `warranty.read` |
| `/admin/users` | `users.read` |
| `/admin/settings` | `settings.read` |
| `/admin/audit` | `audit.read` |

---

## 10. Dangerous Actions

Dangerous actions require:

- Permission.
- Confirmation.
- Backend validation.
- Audit if supported.

Dangerous permissions:

```text
products.delete
catalog.delete
orders.cancel
payments.refund
customers.disable
content.delete
campaigns.delete
media.delete
users.disable
roles.manage
settings.sensitive.update
```

### 10.1 Last super admin rule

If system has super admin concept:

- Do not allow disabling/removing the last `SUPER_ADMIN`.
- Do not allow role edit that leaves system without super admin.

Backend must enforce.

---

## 11. Data Visibility Rules

### 11.1 Customer data

Customer data should require `customers.read` or related order/support permission.

Sensitive export requires:

```text
customers.export
orders.export
```

### 11.2 Payment data

Payment detail visibility requires:

```text
payments.read
```

Updating payment state requires:

```text
payments.updateStatus
```

Refund requires:

```text
payments.refund
```

### 11.3 Settings

Sensitive settings require:

```text
settings.sensitive.update
```

Even `ADMIN` should not get this by default unless intended.

---

## 12. AI Agent Rules

1. Do not add admin route without permission mapping.
2. Do not add backend admin endpoint without permission check.
3. Do not invent permission names outside naming convention.
4. Do not rely on frontend hiding for security.
5. Do not grant broad permissions by default.
6. Do not expose unauthorized data in list/detail.
7. Do not confuse `401` and `403`.
8. Do not allow dangerous action without confirmation.
9. Do not change role matrix silently.
10. Update tests when permission changes.

---

## 13. Review Checklist

- [ ] New route has permission.
- [ ] New endpoint enforces permission.
- [ ] Frontend hides/disables action based on permission.
- [ ] Backend returns `401` or `403` correctly.
- [ ] Dangerous action has confirmation.
- [ ] Sensitive data export requires export permission.
- [ ] User/settings/role actions restricted.
- [ ] Role matrix updated.
- [ ] `auth/me` returns enough permission info.
- [ ] No secret/internal data exposed.
