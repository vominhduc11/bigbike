# PERMISSION_MATRIX.md — bigbike.vn

Who can do what, with which guards (nonce, capability, ownership). Derived from theme source and `kd_options`.

Legend
- `ALLOW` — feature is reachable.
- `DENY` — blocked.
- `—` — not applicable.
- `wp_ajax_*` / `wp_ajax_nopriv_*` indicates whether the handler is exposed to logged-in users / guests.

> **Critical finding:** None of the custom AJAX handlers in `inc/ajax-functions.php` verify a nonce, a capability, or a CSRF token. All of them are registered for BOTH logged-in and unauthenticated users. See ARCHITECTURE §12 risks A2–A6.

---

## 1. Page / screen access

| Feature / URL | Guest | Customer (subscriber) | Shop Manager | Admin | Evidence |
|---|---|---|---|---|---|
| Home `/` | ALLOW | ALLOW | ALLOW | ALLOW | [page-home.php](files/wp-content/themes/bigbike/page-templates/page-home.php) |
| Shop / category / brand / search | ALLOW | ALLOW | ALLOW | ALLOW | WC archive templates |
| Product detail `/product/{slug}/` | ALLOW | ALLOW | ALLOW | ALLOW | [content-single-product.php](files/wp-content/themes/bigbike/woocommerce/content-single-product.php) |
| Cart `/gio-hang/` | ALLOW (guest cart) | ALLOW | ALLOW | ALLOW | WC page |
| Checkout `/thanh-toan/` | ALLOW (guest checkout=yes) | ALLOW | ALLOW | ALLOW | `kd_options.woocommerce_enable_guest_checkout=yes` |
| Order received (thank-you) | ALLOW with `?key=<order_key>` | ALLOW if owner | ALLOW | ALLOW | [thankyou.php:66](files/wp-content/themes/bigbike/woocommerce/checkout/thankyou.php#L66) |
| Login page `/dang-nhap/` | ALLOW | DENY (redirect home) | DENY (redirect home) | DENY (redirect home) | [page-login.php:7-10](files/wp-content/themes/bigbike/page-templates/page-login.php#L7-L10) |
| Register page `/dang-ky/` | ALLOW | DENY (redirect home) | DENY | DENY | [page-register.php:7-10](files/wp-content/themes/bigbike/page-templates/page-register.php#L7-L10) |
| Lost password page | ALLOW | ALLOW | ALLOW | ALLOW | WC `[lost_password_form]` |
| Profile `/tai-khoan/` | DENY | ALLOW | ALLOW | ALLOW | WC `WC_Shortcode_My_Account` guard |
| My-account → Orders / Addresses / Edit | DENY | ALLOW (own records) | ALLOW | ALLOW | WC plugin |
| Contact `/lien-he/` | ALLOW | ALLOW | ALLOW | ALLOW | Static |
| Blog `/tin-tuc/*` | ALLOW | ALLOW | ALLOW | ALLOW | WP default |
| `/wp-admin/` | DENY | usually DENY (subscribers may see profile only) | ALLOW (scoped to WC screens) | ALLOW | WP + WC capabilities |
| `/wp-admin/admin-ajax.php` | ALLOW (handler-dependent) | ALLOW | ALLOW | ALLOW | WP core |

---

## 2. AJAX endpoints

| Action | `wp_ajax_*` | `wp_ajax_nopriv_*` | Nonce | Capability | Ownership | CSRF safe? | Rate limit | Data touched | Evidence | Risk |
|---|---|---|---|---|---|---|---|---|---|---|
| `custom_register_user` | ✓ | ✓ | **NO** | **NO** | n/a | **NO** | none from theme (Wordfence may limit — NV) | users + usermeta | [ajax-functions.php:2-3](files/wp-content/themes/bigbike/inc/ajax-functions.php#L2-L3) | Mass-account creation, bypasses `users_can_register=0` |
| `custom_login_user` | ✓ | ✓ | **NO** | **NO** | n/a | **NO** | none | auth cookie | [ajax-functions.php:5-6](files/wp-content/themes/bigbike/inc/ajax-functions.php#L5-L6) | Credential stuffing; user enumeration via differing error msgs |
| `update_user_infomation` | ✓ | ✓ | **NO** | **NO** | implicit (self) | **NO** | none | user + usermeta (incl. password) | [ajax-functions.php:8-9](files/wp-content/themes/bigbike/inc/ajax-functions.php#L8-L9) | **CSRF password change.** Although `nopriv` handler rejects when not logged-in (guard at line 163), the `priv` handler accepts any logged-in CSRF victim. |
| `custom_add_to_cart` | ✓ | ✓ | **NO** | **NO** | n/a | **NO** | none | cart session | [ajax-functions.php:11-12](files/wp-content/themes/bigbike/inc/ajax-functions.php#L11-L12) | Returns cart contents verbatim; low direct risk |
| `remove_item_from_cart` | ✓ | ✓ | **NO** | **NO** | n/a | **NO** | none | cart session | [ajax-functions.php:14-15](files/wp-content/themes/bigbike/inc/ajax-functions.php#L14-L15) | CSRF-remove from attacker domain |
| `update_cart_item_quantity` | ✓ | ✓ | **NO** | **NO** | n/a | **NO** | none | cart session | [ajax-functions.php:17-18](files/wp-content/themes/bigbike/inc/ajax-functions.php#L17-L18) | Low |
| `buy_quickly` | ✓ | ✓ | **NO** | **NO** | n/a | **NO** | none | creates user + WC order (status=processing) | [ajax-functions.php:20-21](files/wp-content/themes/bigbike/inc/ajax-functions.php#L20-L21) | **CRITICAL — open order creation** |
| `find_variation_product` | ✓ | ✓ | **NO** | **NO** | n/a | **NO** | none | reads products | [ajax-functions.php:23-24](files/wp-content/themes/bigbike/inc/ajax-functions.php#L23-L24) | Low (read-only) |

---

## 3. Form / WC endpoints

| Endpoint | Guest | Customer | Shop Manager | Admin | Nonce | Evidence |
|---|---|---|---|---|---|---|
| WC checkout submit `wc-ajax=checkout` | ALLOW (guest checkout=yes) | ALLOW | ALLOW | ALLOW | `woocommerce-process-checkout` | WC core |
| WC cart update / apply-coupon | ALLOW | ALLOW | ALLOW | ALLOW | `woocommerce-cart` | [cart.php:181](files/wp-content/themes/bigbike/woocommerce/cart/cart.php#L181) |
| WC `remove_item=...` URL | ALLOW | ALLOW | ALLOW | ALLOW | WC nonce on URL | [cart.php:158](files/wp-content/themes/bigbike/woocommerce/cart/cart.php#L158) |
| Lost password form | ALLOW | ALLOW | ALLOW | ALLOW | `woocommerce-lost-password-nonce` | [form-lost-password.php:38](files/wp-content/themes/bigbike/woocommerce/myaccount/form-lost-password.php#L38) |
| CF7 contact form | ALLOW | ALLOW | ALLOW | ALLOW | CF7 `_wpcf7_nonce` | Plugin |
| `wp-login.php?loginSocial=facebook` (Nextend) | ALLOW | ALLOW | ALLOW | ALLOW | Nextend cookie | **NV** — plugin not in active list |

---

## 4. Capability requirements (wp-admin)

Standard WP + WC capabilities:

| Capability | Roles that hold it | What it unlocks |
|---|---|---|
| `read` | subscriber, customer, shop_manager, admin | Dashboard, profile |
| `edit_posts`, `publish_posts` | author+, shop_manager, admin | Blog posts (via Classic Editor) |
| `edit_pages`, `publish_pages` | editor+, admin | Pages |
| `manage_options` | admin only | Settings, plugins, permalinks |
| `manage_woocommerce` | shop_manager, admin | WC settings, reports, coupons |
| `edit_shop_orders`, `read_private_shop_orders`, `edit_others_shop_orders` | shop_manager, admin | Orders |
| `edit_products`, `publish_products` | shop_manager, admin | Product CRUD |
| `manage_categories` | shop_manager, admin | product_cat, product_tag, pwb-brand |
| `manage_ acf` (ACF custom cap), `edit_acf_*` | admin | ACF field groups |
| `promote_users`, `create_users`, `delete_users` | admin only | User administration |
| `edit_theme_options` | admin | Menus, widgets, customiser |
| `edit_themes`, `edit_plugins`, `install_plugins` | — | **Blocked by `DISALLOW_FILE_MODS/EDIT`** |

Derived from `kd_usermeta.wp_capabilities` rows (not exhaustively dumped here). Assumes default WP+WC role map.

---

## 5. Guard mechanisms used in the codebase

| Guard | Where used | Evidence |
|---|---|---|
| Redirect if logged-in on `/dang-nhap/` or `/dang-ky/` | Template-level guard | [page-login.php:7-10](files/wp-content/themes/bigbike/page-templates/page-login.php#L7-L10), [page-register.php:7-10](files/wp-content/themes/bigbike/page-templates/page-register.php#L7-L10) |
| `wp_get_current_user()->ID == 0` check | API-03 only | [ajax-functions.php:163-172](files/wp-content/themes/bigbike/inc/ajax-functions.php#L163-L172) |
| `$product->is_purchasable()` | simple.php | [simple.php:22-24](files/wp-content/themes/bigbike/woocommerce/single-product/add-to-cart/simple.php#L22-L24) |
| `$product->is_in_stock()` | simple.php + variable.php | [simple.php:28](files/wp-content/themes/bigbike/woocommerce/single-product/add-to-cart/simple.php#L28), [variable.php:31](files/wp-content/themes/bigbike/woocommerce/single-product/add-to-cart/variable.php#L31) |
| 10-digit phone regex | Checkout | [woo-functions.php:76-78](files/wp-content/themes/bigbike/inc/woo-functions.php#L76-L78) |
| `username_exists` / `email_exists` | Register validation | [ajax-functions.php:38,50](files/wp-content/themes/bigbike/inc/ajax-functions.php#L38) |
| `wp_check_password` | Login + profile password change | [ajax-functions.php:127,193](files/wp-content/themes/bigbike/inc/ajax-functions.php#L127) |

Guards that are **missing** across every custom AJAX handler:
- `check_ajax_referer(...)` / `wp_verify_nonce(...)`.
- `current_user_can(...)`.
- CSRF origin/referer check.
- Rate limiting / captcha.

---

## 6. Top security gaps (ranked)

1. **G1 — Unauthenticated order creation (API-07 `buy_quickly`).** See ARCHITECTURE A4, A10, A12, A13.
2. **G2 — CSRF password change (API-03 `update_user_infomation`).** A logged-in customer's session can be abused to silently change their password from a 3rd-party site.
3. **G3 — Mass account creation (API-01 `custom_register_user`) bypasses `users_can_register=0`.**
4. **G4 — Credentials plaintext in `wp-config.php`.** Salts, DB password, and custom `DUPLICATOR_AUTH_KEY` embedded. Never commit this file to git.
5. **G5 — User enumeration in login** (distinct error messages for "user not found" vs "wrong password"). [ajax-functions.php:124-128](files/wp-content/themes/bigbike/inc/ajax-functions.php#L124-L128).
6. **G6 — `buy_quickly` email reassignment bug** — `$email = $_REQUEST['product_id']` at [ajax-functions.php:364](files/wp-content/themes/bigbike/inc/ajax-functions.php#L364).
7. **G7 — `update_cart_item_quantity` accepts arbitrary quantity.** WC `set_quantity` does its own validation, but the endpoint is still open to abusers filling cart sessions.
8. **G8 — No nonce on `remove_item_from_cart` / `custom_add_to_cart`.** Allows CSRF manipulation of a victim's cart.
9. **G9 — `obj_ajax.ajaxurl` is computed from `get_site_url()` not `admin_url('admin-ajax.php')`** — if the site URL ever mismatches WP's admin URL (e.g. HTTPS vs HTTP), AJAX breaks.
10. **G10 — Plaintext auth salts reused across snapshots.** Anyone with this snapshot can forge cookies on the prod host. Rotate salts immediately on import.

---

## 7. Plugin-level permissions to verify on migration

1. **Wordfence** — Is a Web Application Firewall rule set blocking unusual POST patterns on `admin-ajax.php`? **NV**
2. **Permalink Manager Pro** — License still valid after migration? Rules exported?
3. **RankMath** — Admin role for managing SEO content?
4. **Polylang** — Translator role exists?
5. **Google Listings & Ads** — OAuth tokens scoped to which Google account? **NV**

---

## 8. Per-endpoint "guest can create/modify"

| Endpoint | Guest can create? | Guest can modify/remove? |
|---|---|---|
| Cart session | Yes (CSRF vector) | Yes (CSRF vector) |
| User account | **Yes via API-01 and via API-07** | No (API-03 requires auth, by handler logic) |
| WC order | **Yes via API-07** and via standard WC (guest checkout=yes) | No |
| Password reset | Guest can request — WC default | Guest can reset with token — WC default |
| CF7 submission | Yes | No |
| Blog post / product / admin content | No | No |

---

## 9. Referer / Origin validation

Not performed anywhere in the theme. `wp-login.php` uses WP core cookie + nonces; `wp-admin/*` core uses nonces. Custom AJAX — none.

---

## 10. Summary

This project's front-end admin surface is small, but its custom AJAX surface is broad and uniformly unprotected. Any migration MUST:

1. Replace all 8 custom AJAX endpoints with authenticated+nonce-protected handlers (or with first-class API routes on the new stack with CSRF tokens).
2. Add a CAPTCHA or equivalent to `buy_quickly` and `custom_register_user`.
3. Remove the two distinct "user not found" vs "wrong password" messages.
4. Rotate auth salts and DB credentials on import.
5. Reconcile `users_can_register=0` with the custom register endpoint to avoid policy ambiguity.
