# AUTH_RBAC.md — Authentication & Authorization

Áp dụng cho toàn bộ hệ thống mới (main-fe + admin-fe + backend).

Nguồn đối chiếu: [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md) (tình trạng hiện tại), [API_CONTRACT.md](API_CONTRACT.md) (gaps bảo mật).

---

## 1. Role đề xuất

Phân hai nhóm: admin roles (áp cho admin-fe) và customer role (áp cho main-fe).

### 1.1 Admin roles

| Role | Purpose | Mapping với WP cũ |
|---|---|---|
| **SUPER_ADMIN** | Không giới hạn, bao gồm impersonate, run migration scripts, sửa settings hệ thống, quản lý admin khác | `administrator` |
| **ADMIN** | Quản lý toàn bộ content + commerce + user, không sửa infra/audit | `administrator` trong đa số trường hợp |
| **EDITOR** | Quản lý content (Pages/Blog/Videos/Reviews/Media/Menu) + SEO content, không sửa product/order/user | `editor` + `author` |
| **SHOP_MANAGER** | Quản lý Product/Order/Customer/Coupon/Shipping/Payment, không sửa user admin khác, không sửa content không commerce | `shop_manager` |
| **VIEWER** | Read-only mọi module trừ user admin | n/a (vai trò mới) |

### 1.2 Customer role

| Role | Purpose | WP cũ |
|---|---|---|
| **CUSTOMER** | Truy cập `/tai-khoan/`, đặt hàng, sửa profile, xem lịch sử đơn | `subscriber` + `customer` |
| **GUEST** | Không login — có cart session tạm, checkout với guest checkout | n/a (không phải role DB) |

### 1.3 Mapping từ WordPress cũ

| `kd_usermeta.wp_capabilities` | Role mới | Ghi chú |
|---|---|---|
| `administrator` | SUPER_ADMIN (1 super) + ADMIN (còn lại) | SUPER_ADMIN phải được xác định manual |
| `shop_manager` | SHOP_MANAGER | |
| `editor` | EDITOR | |
| `author` | EDITOR (rút gọn) | Xem thêm chi tiết phân quyền page vs post |
| `contributor` | VIEWER hoặc EDITOR readonly | |
| `subscriber` / `customer` | CUSTOMER | |
| Synthetic user từ Quick Buy (login `<phone>@liveevil.vn`) | CUSTOMER + flag `is_synthetic=true` | Không cho login cho đến khi claim phone |

---

## 2. Permission model

Chọn một trong hai:

### 2.1 Option A — Role-based (đơn giản, khuyến nghị phase 1)

Role trực tiếp gắn quyền. Mọi endpoint khai báo `@RequireRole(["ADMIN","SHOP_MANAGER"])`.

### 2.2 Option B — Permission-based (fine-grained, phase 2)

Role chứa list permission. Permission dạng `verb:resource`:
- `read:product`, `write:product`, `delete:product`
- `read:order`, `write:order`, `refund:order`
- `read:user`, `write:user`, `impersonate:user`
- `read:audit`, `write:settings`, `run:migration`

Assignment:

| Permission | SUPER_ADMIN | ADMIN | EDITOR | SHOP_MANAGER | VIEWER | CUSTOMER |
|---|---|---|---|---|---|---|
| `read:*` | ✓ | ✓ | ✓ (content) | ✓ (commerce) | ✓ | Only `read:own-order`, `read:own-profile` |
| `write:page`, `write:blog`, `write:media`, `write:menu` | ✓ | ✓ | ✓ | | | |
| `write:product`, `write:product_category`, `write:brand`, `write:attribute` | ✓ | ✓ | | ✓ | | |
| `write:order`, `refund:order` | ✓ | ✓ | | ✓ | | |
| `write:user`, `change:role` | ✓ | ✓ | | | | |
| `impersonate:user` | ✓ | | | | | |
| `write:settings`, `run:migration`, `delete:audit` | ✓ | | | | | |

---

## 3. Authentication strategy

### 3.1 admin-fe

- **Method:** Email + password + optional TOTP 2FA.
- **Token:** JWT (short-lived access token 15 min) + Refresh token (7 days, HttpOnly cookie, rotated).
- **Storage:** Access token trong memory React; refresh token trong HttpOnly + SameSite=Strict + Secure cookie, path=`/api/auth`.
- **2FA:** TOTP bằng `otpauth://` (Google Authenticator). Encrypt secret ở DB. Phase 2 optional WebAuthn.
- **Lockout:** 5 fail consecutive → lock 15 phút + notify email.
- **Session management:** Admin có thể revoke session theo device.

### 3.2 main-fe (customer)

- **Method:** Phone-or-email + password (giống cơ chế cũ nhưng có nonce/CSRF + rate limit).
- **Token:** Cookie session server-side (tránh expose token to client). SameSite=Lax (Strict cho `/tai-khoan/*` routes). Max-age 30 ngày (remember-me) hoặc browser session.
- **Lockout:** 10 fail / IP / 5 phút → challenge CAPTCHA.
- **Password reset:** Email magic link, token TTL 60 phút, single-use.
- **2FA:** Không bắt buộc phase 1.

### 3.3 API (backend)

- Admin-fe → API: Bearer JWT.
- Main-fe (SSR) → API: Server-to-server token (service account) cho public reads; session cookie forward cho per-user.
- Main-fe (CSR) → API: session cookie + CSRF token.
- Third-party (nếu có API key trong tương lai): OAuth2 client credentials.

---

## 4. Route protection

### 4.1 main-fe

| Route pattern | Yêu cầu |
|---|---|
| Public routes (home, shop, product, category, brand, blog, lien-he, gioi-thieu, huong-dan, search, robots.txt, sitemap) | Không auth |
| `/dang-nhap/`, `/dang-ky/`, `/quen-mat-khau/` | Redirect `/` nếu đã login |
| `/tai-khoan/*` | Auth required. Redirect `/dang-nhap/?return=/tai-khoan/*` nếu chưa login |
| `/tai-khoan/view-order/{id}/` | Ownership: order.customer_id == current_user.id |
| `/gio-hang/`, `/thanh-toan/` | Cho phép guest |
| `/thanh-toan/order-received/{id}?key=...` | Verify order_key hoặc ownership |

Middleware Next.js xử lý redirect + gate.

### 4.2 admin-fe

- Toàn bộ routes trừ `/login`, `/forgot-password`, `/reset-password`, `/2fa-setup` đều yêu cầu auth.
- Role check per route.
- Idle timeout 30 phút → logout.
- Tab/window focus re-check quyền (fetch `/api/auth/me`).

---

## 5. API protection

Checklist cho mọi endpoint backend:

| Layer | Rule |
|---|---|
| Transport | HTTPS only (HSTS) |
| CORS | Whitelist origin `https://bigbike.vn`, `https://admin.bigbike.vn`; credentials allow |
| Auth | Bearer JWT hoặc session cookie; middleware verify |
| Authorization | `@RequireRole` hoặc `@RequirePermission` decorator |
| Ownership | Middleware check `entity.owner_id == current_user.id` hoặc role override |
| CSRF | Với session cookie: double-submit CSRF token. Với JWT Bearer (admin-fe SPA): không cần nếu không dùng cookie |
| Rate limit | Redis-based. Default 60 req/min/IP cho read, 10 req/min/IP cho write. Cao hơn cho admin user. |
| Input validation | Zod/Pydantic schema → 400 Bad Request |
| Output filtering | Không expose sensitive fields (password_hash, TOTP secret, session tokens) |
| Logging | Audit log cho mutation; không log body chứa password |
| Error handling | 4xx client errors, 5xx server; không leak stack trace trong production |

---

## 6. Session / JWT strategy chi tiết

### 6.1 Claims JWT đề xuất

```json
{
  "sub": "user_uuid",
  "email": "admin@bigbike.vn",
  "roles": ["ADMIN"],
  "permissions": ["read:*","write:product","write:order"],
  "iat": 1712345678,
  "exp": 1712346578,   // 15 min
  "jti": "token_uuid",
  "sid": "session_uuid"  // revocation handle
}
```

### 6.2 Refresh token

- Opaque token (random 32 bytes base64url) stored hashed in `admin_session` table với `user_id`, `device`, `ip`, `expires_at`, `revoked_at`.
- Rotation: mỗi lần refresh, issue new refresh token, revoke cũ. Nếu phát hiện refresh token cũ được dùng lại → revoke toàn bộ session của user (token theft).

### 6.3 Main-fe customer session

- Server-side session lưu Redis hoặc DB. Key = random 64 chars. Cookie `SID` HttpOnly + Secure + SameSite=Lax.
- TTL default 30 ngày (remember-me), 8h nếu không tick remember.
- Session data: `user_id`, `login_at`, `ip`, `user_agent`, `csrf_token`.

---

## 7. Password policy

| Audience | Rule |
|---|---|
| Admin (SUPER_ADMIN/ADMIN/EDITOR/SHOP_MANAGER/VIEWER) | Min 12 chars, bắt buộc chữ + số; khuyến cáo ký tự đặc biệt. Expire 90 ngày (configurable, default off). Không reuse 5 password cuối. |
| Customer | Min 6 chars (giữ để không chặn khách hàng cũ). Không expire. |
| Reset via email token | Token random 256-bit, TTL 60 phút, single-use, invalidate khi user login thành công. |
| Hash algorithm | `argon2id` (khuyến nghị) hoặc `bcrypt` cost ≥ 12. phpass legacy chỉ dùng trong giai đoạn migration — auto re-hash lên argon2id sau lần login đầu. |

---

## 8. Admin bootstrap strategy

Khi deploy lần đầu, admin-fe chưa có user:

1. CLI tool: `node scripts/bootstrap-admin.js --email founder@bigbike.vn --role SUPER_ADMIN`.
2. Tool gửi email kích hoạt kèm token setup password (TTL 24h).
3. Password setup qua secure link, yêu cầu setup 2FA (option).
4. Ghi log trong audit + disable route CLI sau khi đã có ≥ 1 SUPER_ADMIN (hoặc require env var `ALLOW_BOOTSTRAP=true` để chạy lại).

---

## 9. Security checklist

Tham chiếu [PERMISSION_MATRIX.md §6](PERMISSION_MATRIX.md#6-top-security-gaps-ranked) — các gap phải đóng:

- [ ] Bắt buộc nonce/CSRF cho mọi mutation endpoint.
- [ ] Rotate toàn bộ DB password + auth salt trên môi trường mới (file `wp-config.php` trong snapshot có plaintext).
- [ ] Password hash argon2id cho user mới; phpass chỉ để verify legacy rồi re-hash.
- [ ] CAPTCHA cho register + quick-buy + contact + forgot-password.
- [ ] Rate limit trên login, register, quick-buy, forgot-password.
- [ ] Error message đồng nhất cho login (tránh user enumeration — gộp "user không tồn tại" và "sai mật khẩu").
- [ ] HSTS + HTTPS redirect tất cả domain.
- [ ] SameSite cookie + Secure + HttpOnly.
- [ ] CSP + Referrer-Policy.
- [ ] Session revocation trên password change và logout-all-devices.
- [ ] Audit log immutable (append-only).
- [ ] 2FA cho role admin (khuyến nghị bắt buộc với SUPER_ADMIN).
- [ ] WebAuthn option phase 2.
- [ ] Không cho upload file thực thi (.php, .exe, .sh) — mime + magic bytes check.
- [ ] Sanitize HTML content server-side (jsoup / bleach / DOMPurify server) trước khi lưu.
- [ ] Validate redirect target trong URL param (không cho open redirect).
- [ ] Protect `/api/admin/*` endpoint bằng CORS origin whitelist.
- [ ] Không dùng `wp_ajax_nopriv_*` pattern mới — mọi mutation có auth hoặc CAPTCHA rõ ràng.
- [ ] Order creation (thay quick-buy) bắt buộc ≥ 1 trong: auth, CAPTCHA, payment verification.

---

## 10. Mapping với PERMISSION_MATRIX.md hiện có

| Trang / Tính năng | Guest | CUSTOMER | SHOP_MANAGER | ADMIN | SUPER_ADMIN | Nguồn đối chiếu |
|---|---|---|---|---|---|---|
| Public storefront (home/shop/product/brand/blog/...) | ✓ | ✓ | ✓ | ✓ | ✓ | [PERMISSION_MATRIX.md §1](PERMISSION_MATRIX.md) |
| Add/remove/update cart | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Checkout (guest checkout enabled) | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Quick-buy (rate-limited + CAPTCHA) | ✓ (CAPTCHA) | ✓ | ✓ | ✓ | ✓ | Thay API-07 |
| Register | ✓ (CAPTCHA) | — | — | — | — | |
| Login | ✓ | — | — | — | — | |
| Update profile | — | ✓ | ✓ | ✓ | ✓ | |
| Lost password | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Contact form | ✓ (CAPTCHA) | ✓ | ✓ | ✓ | ✓ | |
| My Account | — | ✓ | ✓ | ✓ | ✓ | |
| Admin — read product | — | — | ✓ | ✓ | ✓ | |
| Admin — write product/category/brand/attribute | — | — | ✓ | ✓ | ✓ | |
| Admin — write order, refund | — | — | ✓ | ✓ | ✓ | |
| Admin — write user, change role | — | — | — | ✓ | ✓ | |
| Admin — impersonate user | — | — | — | — | ✓ | |
| Admin — content (page/blog/media/menu) | — | — | — | ✓ (+EDITOR) | ✓ | |
| Admin — SEO / redirect | — | — | ✓ commerce SEO | ✓ | ✓ | |
| Admin — settings (payment/shipping/i18n) | — | — | — | ✓ | ✓ | |
| Admin — run migration | — | — | — | — | ✓ | |
| Admin — audit log | — | — | — | ✓ read | ✓ | |

---

## 11. Handling legacy users

### 11.1 Customer cũ

- Login `user_login` legacy giữ nguyên (phần lớn là phone hoặc email).
- Password phpass được verify một lần; sau đó re-hash argon2id.
- Yêu cầu user update phone nếu `user_meta.phone` rỗng và login không phải phone.

### 11.2 Synthetic user (Quick Buy)

- Flag `is_synthetic=true` khi login match `.+@liveevil\.vn$` hoặc thiếu verified phone.
- Block login với password cho đến khi user "claim" account qua flow verify phone (OTP).
- Cho phép guest checkout của cùng phone không tạo thêm account synthetic nếu đã tồn tại.

### 11.3 Admin cũ

- Export từ `kd_usermeta.wp_capabilities` → map role.
- Force đổi password lần đầu login vào admin-fe (password reset email).
- Bắt buộc setup 2FA với SUPER_ADMIN/ADMIN sau 30 ngày.

---

## 12. Logout

- Logout main-fe: clear session cookie + invalidate session server-side.
- Logout admin-fe: clear refresh token cookie + revoke current refresh token + short access token expires naturally.
- Logout all devices: revoke toàn bộ refresh token của user.
- Forced logout on password change: revoke toàn bộ session.

---

## 13. Open questions / NEEDS_CONFIRMATION

1. Có enforce 2FA cho SHOP_MANAGER không?
2. Có cho phép social login (Facebook/Google) phase 1 không? (Hiện tại Nextend inactive).
3. Password policy cho customer có upgrade lên 8 ký tự không?
4. Ownership check cho order view qua URL không auth (có `?key=`) — có giữ cơ chế cũ không?
5. IP whitelist cho admin-fe (VPN only) hay public với 2FA?
