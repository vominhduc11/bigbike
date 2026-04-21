# WORKFLOW.md — bigbike.vn

Step-by-step workflows per actor, with data touched, success states, and failure modes.

Evidence paths use [file:line](path) links.

---

## 1. Actor: Guest

### W1.1 — Browse home → browse product → quick-buy (no account)

| Step | Screen / Template | User / System Action | API / AJAX / Form / WC Action | Data Read | Data Write | Success | Failure / Edge |
|---|---|---|---|---|---|---|---|
| 1 | `/` `page-home.php` | User visits home | — | page ACF, featured products, terms | — | HTML | — |
| 2 | `/product/{slug}/` `content-single-product.php` | User clicks a product | — | product, variations, ACF | — | Product page | 404 if slug bad |
| 3 | Product page | User picks attribute radio | AJAX `action=find_variation_product` (API-08) | WC data store | — | `{ variation_id, price }`, buttons enabled | No body if no variation → buttons stay disabled |
| 4 | Quick-buy modal | User opens quick-buy form | JS toggles visibility | — | — | Modal shown | — |
| 5 | Quick-buy modal | User fills name/phone/email/address + submits | AJAX `action=buy_quickly` (API-07) | product, user lookup | user (auto-create), WC order, order items, order address, payment = `bacs`, shipping item, status=`processing` | Redirect to `/thanh-toan/order-received/{id}?key=...` | **No error response** if DB fails; form stays "Đang xử lí…" |
| 6 | `/thanh-toan/order-received/...` `thankyou.php` | Render | GTM `purchase` | order | — | Confirmation + bank-transfer instructions | `failed` status → error notice + retry |

Evidence: [ajax-functions.php:354-447](files/wp-content/themes/bigbike/inc/ajax-functions.php#L354-L447); [thankyou.php](files/wp-content/themes/bigbike/woocommerce/checkout/thankyou.php).

### W1.2 — Browse → add to cart → standard checkout

| Step | Screen | Action | Endpoint | Data Read | Data Write | Success | Edge |
|---|---|---|---|---|---|---|---|
| 1 | Product page | Select variation | API-08 | variation | — | price + id | — |
| 2 | Product page | Click Add to cart | API-04 | product | `kd_woocommerce_sessions` cart | Toastr + reload, cart updated | "Sản phẩm này không tồn tại" if missing id |
| 3 | `/gio-hang/` `cart.php` | View cart | — | session cart | — | Cart list | Empty cart → template fallback |
| 4 | Cart | Update qty via + / − | API-06 | session cart | session cart | Line totals recalculated | — |
| 5 | Cart | Remove item | API-05 (mini-cart) or `wc-action=remove-cart-item` | session cart | session cart | Item removed, mini-cart replaced | Template `header-cart.php` missing → empty mini-cart |
| 6 | Cart | Apply coupon | WC `apply_coupon` form (nonce) | coupon | cart session | Coupon applied | Invalid/expired coupon → WC notice |
| 7 | `/thanh-toan/` `form-checkout.php` | Fill billing + (optional) different shipping | WC checkout AJAX (`wc-ajax=checkout`, nonce `woocommerce-process-checkout`) | cart session, gateways, shipping | WC order, addresses | Redirect to thank-you | 10-digit phone rule: non-conforming phone blocked by `phone_custom_checkout_field_process` |
| 8 | Thank-you | — | GTM `purchase` | order | — | Done | `failed` → retry UI |

### W1.3 — Search (guest)

| Step | Screen | Action | Endpoint | Data | Success | Edge |
|---|---|---|---|---|---|---|
| 1 | Any | Type query in search | GET `/?s=...` | — | — | — |
| 2 | Search results | — | WP core w/ `posts_search`+`request` filters | `kd_posts`, `kd_terms` | Results grid | If 0 results → redirect to `/?s={q}` home search |

### W1.4 — Register (guest)

| Step | Screen | Action | Endpoint | Data Read | Data Write | Success | Edge |
|---|---|---|---|---|---|---|---|
| 1 | `/dang-ky/` `page-register.php` | Fill form + submit | AJAX API-01 | users table | new user + usermeta + auth cookie | Toastr + redirect home | Validation error surfaces via Sweetalert |

### W1.5 — Login (guest)

| Step | Screen | Action | Endpoint | Data Read | Data Write | Success | Edge |
|---|---|---|---|---|---|---|---|
| 1 | `/dang-nhap/` `page-login.php` | Fill form + submit | AJAX API-02 | users | auth cookie | Redirect home | "Tên đăng nhập hoặc Email không đúng…" vs "Mật khẩu không đúng…" — timing oracle |

### W1.6 — Lost password (guest)

| Step | Screen | Action | Endpoint | Data | Success |
|---|---|---|---|---|---|
| 1 | `/quen-mat-khau/` (page 10155) `[lost_password_form]` shortcode → `form-lost-password.php` | Submit login/email | WC lost-password handler (nonce) | users | Email sent |
| 2 | Reset link | Click link | WC reset-password form | — | Password changed |
| 3 | — | Handler fires `woocommerce_customer_reset_password` | `woocommerce_new_pass_redirect` | — | Redirect to `pll_get_post(7970, lang)` |

### W1.7 — Contact (guest)

| Step | Screen | Action | Endpoint | Data Read | Data Write | Success | Edge |
|---|---|---|---|---|---|---|---|
| 1 | `/lien-he/` | Fill CF7 form + submit | CF7 REST `/wp-json/contact-form-7/v1/contact-forms/{id}/feedback` (nonce) | form config | `kd_db7_forms` row + email | Inline success | Inline validation |

---

## 2. Actor: Logged-in customer

Same as Guest plus:

### W2.1 — Update profile

| Step | Screen | Action | Endpoint | Data Read | Data Write | Success | Edge |
|---|---|---|---|---|---|---|---|
| 1 | `/tai-khoan/` (profile template or WC my-account form) | Fill new display name / gender / DOB | AJAX API-03 | current user | `kd_users`, `kd_usermeta` | Toastr reload | **CSRF risk** — no nonce. Non-authed GET that POSTs via CSRF can silently change password |
| 2 | Same | Optional: fill old + new + re-password | API-03 | — | `wp_set_password` | Toastr reload | New < 6 chars or mismatch rejected |

### W2.2 — My Account navigation

| Step | Screen | Data | Notes |
|---|---|---|---|
| 1 | `/my-account/` dashboard | current user | Default WC dashboard; header says "Hello {display_name}" |
| 2 | Orders tab | `kd_wc_orders` / `kd_posts` shop_order | WC lists customer orders |
| 3 | Addresses tab | `kd_usermeta` billing/shipping | Edit form |
| 4 | Account details | `kd_users` | Edit name/email/password via WC default |
| 5 | Logout | — | Clears auth cookie |

### W2.3 — Add to cart / checkout

Same as Guest W1.2. Logged-in customer's cart is session-keyed and persists after login (WC merges guest cart into user cart on login).

---

## 3. Actor: Shop Manager (role `shop_manager`)

Default WooCommerce capability set — can manage products, orders, coupons, reports, but cannot edit plugins/theme or other users except other shop managers.

| Step | Screen | Action | Data |
|---|---|---|---|
| 1 | `/wp-admin/` login | Standard WP login | — |
| 2 | `/wp-admin/edit.php?post_type=product` | CRUD products | `kd_posts`, `kd_postmeta`, `kd_wc_product_meta_lookup`, `kd_term_relationships` |
| 3 | `/wp-admin/admin.php?page=wc-orders` (HPOS) | View / edit orders, update status, refund | `kd_wc_orders`, `kd_wc_orders_meta`, `kd_wc_order_addresses` |
| 4 | `/wp-admin/admin.php?page=wc-reports` | Reports | WC Analytics tables `kd_wc_order_stats`, `kd_wc_order_product_lookup`, `kd_wc_customer_lookup` |
| 5 | `/wp-admin/edit.php?post_type=shop_coupon` | Coupon CRUD | `kd_posts` (shop_coupon) |
| 6 | `/wp-admin/edit-tags.php?taxonomy=product_cat` / `=pwb-brand` / `=pa_color` | Taxonomy CRUD | `kd_terms`, `kd_termmeta` |
| 7 | Admin AJAX | standard `wp-admin/admin-ajax.php` actions | WP nonces |

Custom theme-provided admin surface: none.

---

## 4. Actor: Admin (role `administrator`)

Shop Manager + full WP admin:

- Plugin management (but `DISALLOW_FILE_MODS=true` blocks upload/install from UI).
- Theme management (`DISALLOW_FILE_EDIT=true` blocks editor).
- User management (create/delete users, change roles).
- Polylang language management.
- RankMath SEO settings.
- Permalink Manager URL rules.
- Wordfence firewall settings / live traffic / scan.
- W3 Total Cache page rules.
- Google Listings & Ads feed/linkage.

---

## 5. Actor: System / plugin

### W5.1 — Cart session maintenance (WooCommerce)

| Step | Trigger | Action | Data | Effect |
|---|---|---|---|---|
| 1 | Every request | WC init | Loads `kd_woocommerce_sessions` row for this `wc_session_cookie` | Cart reconstructed |
| 2 | Every N hours | Action Scheduler `woocommerce_cleanup_sessions` | Deletes expired rows | Session cleanup |

### W5.2 — Order status side-effects

| Step | Trigger | Action | Data |
|---|---|---|---|
| 1 | Order `processing` | `woocommerce_order_status_processing` hooks: email customer + admin, reduce stock | `kd_postmeta` or `kd_wc_orders_meta`, product stock meta |
| 2 | Order `completed` | Customer-completed email + `woocommerce_order_status_completed` hooks | — |
| 3 | Order `cancelled` | Restock items + email | — |
| 4 | Order created via Quick Buy | Skips `pending` — goes straight to `processing` → stock reduced immediately without payment verification | — |

### W5.3 — Cache layer

| Step | Trigger | Action | Data |
|---|---|---|---|
| 1 | Pre-request | `advanced-cache.php` (W3TC) | Serves cached HTML if hit |
| 2 | `save_post` | `clear_cache_post_after_save` (currently **not hooked** — commented out at [functions.php:156](files/wp-content/themes/bigbike/functions.php#L156)) | No-op |
| 3 | Per plugin rules | Autoptimize post-processes HTML, optimises CSS/JS | Updates cache dir |

### W5.4 — Search redirect

Already described in W1.3. Edge: `no_products_found_redirect` can loop on non-product archives returning 0 posts.

### W5.5 — Polylang + permalink

- `pll_get_post()` used extensively to resolve login/register/forgot page IDs per current language.
- `permalink-manager-pro` may rewrite URLs post-rewrite-rules in ways not evident from source — **Needs verification**.

### W5.6 — Image lazy-load transform

- Content filter `add_data_src_to_content` at priority 9999 rewrites `<img src=…>` → `<img class='lazy' data-src=…>` in the_content output.
- Lozad JS observes intersection and swaps `data-src` → `src`.
- Running order matters — other filters running at priority > 9999 could break the rewrite.

### W5.7 — Wordfence

Active plugin. Blocks IP-level attacks, logs traffic, live traffic view. **Needs verification** for rate limits on the custom AJAX endpoints.

---

## Failure matrix (critical paths)

| Failure | Detection | Current behaviour | Desired behaviour (for migration) |
|---|---|---|---|
| API-07 exception during order creation | No try/catch | Silent — client stuck on "Đang xử lí..." | Return JSON error + surface toastr; roll back user/order |
| API-05 `header-cart.php` missing | Template not in snapshot | Mini-cart HTML blank | Guarantee template exists or render inline |
| API-08 no variation match | Handler returns nothing | JS leaves UI in half-enabled state | Return structured error |
| Checkout with WC JS deregistered | Server-side only | Some UX degraded | Re-enable WC scripts on checkout page only |
| Redirect loop on empty search | `no_products_found_redirect` | Already redirects to home search | Return 404 or "no results" page |
| CSRF on API-03 password change | No nonce | Potentially exploitable | Require nonce + CSRF token |
