# WORKFLOW.md â€” bigbike.vn

Step-by-step workflows per actor, with data touched, success states, and failure modes.

Evidence paths use [file:line](path) links.

---

## 1. Actor: Guest

### W1.1 â€” Browse home â†’ browse product â†’ quick-buy (no account)

| Step | Screen / Template | User / System Action | API / AJAX / Form / WC Action | Data Read | Data Write | Success | Failure / Edge |
|---|---|---|---|---|---|---|---|
| 1 | `/` `page-home.php` | User visits home | â€” | page ACF, featured products, terms | â€” | HTML | â€” |
| 2 | `/product/{slug}/` `content-single-product.php` | User clicks a product | â€” | product, variations, ACF | â€” | Product page | 404 if slug bad |
| 3 | Product page | User picks attribute radio | AJAX `action=find_variation_product` (API-08) | WC data store | â€” | `{ variation_id, price }`, buttons enabled | No body if no variation â†’ buttons stay disabled |
| 4 | Quick-buy modal | User opens quick-buy form | JS toggles visibility | â€” | â€” | Modal shown | â€” |
| 5 | Quick-buy modal | User fills name/phone/email/address + submits | AJAX `action=buy_quickly` (API-07) | product, user lookup | user (auto-create), WC order, order items, order address, payment = `bacs`, shipping item, status=`processing` | Redirect to `/thanh-toan/order-received/{id}?key=...` | **No error response** if DB fails; form stays "Äang xá»­ lĂ­â€¦" |
| 6 | `/thanh-toan/order-received/...` `thankyou.php` | Render | GTM `purchase` | order | â€” | Confirmation + bank-transfer instructions | `failed` status â†’ error notice + retry |

Evidence: [ajax-functions.php:354-447](files/wp-content/themes/bigbike/inc/ajax-functions.php#L354-L447); [thankyou.php](files/wp-content/themes/bigbike/woocommerce/checkout/thankyou.php).

### W1.2 â€” Browse â†’ add to cart â†’ standard checkout

| Step | Screen | Action | Endpoint | Data Read | Data Write | Success | Edge |
|---|---|---|---|---|---|---|---|
| 1 | Product page | Select variation | API-08 | variation | â€” | price + id | â€” |
| 2 | Product page | Click Add to cart | API-04 | product | `kd_woocommerce_sessions` cart | Toastr + reload, cart updated | "Sáº£n pháº©m nĂ y khĂ´ng tá»“n táº¡i" if missing id |
| 3 | `/gio-hang/` `cart.php` | View cart | â€” | session cart | â€” | Cart list | Empty cart â†’ template fallback |
| 4 | Cart | Update qty via + / âˆ’ | API-06 | session cart | session cart | Line totals recalculated | â€” |
| 5 | Cart | Remove item | API-05 (mini-cart) or `wc-action=remove-cart-item` | session cart | session cart | Item removed, mini-cart replaced | Template `header-cart.php` missing â†’ empty mini-cart |
| 6 | Cart | Apply coupon | WC `apply_coupon` form (nonce) | coupon | cart session | Coupon applied | Invalid/expired coupon â†’ WC notice |
| 7 | `/thanh-toan/` `form-checkout.php` | Fill billing + (optional) different shipping | WC checkout AJAX (`wc-ajax=checkout`, nonce `woocommerce-process-checkout`) | cart session, gateways, shipping | WC order, addresses | Redirect to thank-you | 10-digit phone rule: non-conforming phone blocked by `phone_custom_checkout_field_process` |
| 8 | Thank-you | â€” | GTM `purchase` | order | â€” | Done | `failed` â†’ retry UI |

### W1.3 â€” Search (guest)

| Step | Screen | Action | Endpoint | Data | Success | Edge |
|---|---|---|---|---|---|---|
| 1 | Any | Type query in search | GET `/?s=...` | â€” | â€” | â€” |
| 2 | Search results | â€” | WP core w/ `posts_search`+`request` filters | `kd_posts`, `kd_terms` | Results grid | If 0 results â†’ redirect to `/?s={q}` home search |

### W1.4 â€” Register (guest)

| Step | Screen | Action | Endpoint | Data Read | Data Write | Success | Edge |
|---|---|---|---|---|---|---|---|
| 1 | `/dang-ky/` `page-register.php` | Fill form + submit | AJAX API-01 | users table | new user + usermeta + auth cookie | Toastr + redirect home | Validation error surfaces via Sweetalert |

### W1.5 â€” Login (guest)

| Step | Screen | Action | Endpoint | Data Read | Data Write | Success | Edge |
|---|---|---|---|---|---|---|---|
| 1 | `/dang-nhap/` `page-login.php` | Fill form + submit | AJAX API-02 | users | auth cookie | Redirect home | "TĂªn Ä‘Äƒng nháº­p hoáº·c Email khĂ´ng Ä‘Ăºngâ€¦" vs "Máº­t kháº©u khĂ´ng Ä‘Ăºngâ€¦" â€” timing oracle |

### W1.6 â€” Lost password (guest)

| Step | Screen | Action | Endpoint | Data | Success |
|---|---|---|---|---|---|
| 1 | /quen-mat-khau | Submit email or phone | POST /api/v1/customer/auth/password/forgot | customers | Generic success message; email link sent when an account with email exists |
| 2 | /quen-mat-khau?token=... | Submit new password + confirm | POST /api/v1/customer/auth/password/reset | password reset tokens, customers, sessions | Password changed; existing customer sessions revoked |
| 3 | â€” | Redirect to login | /dang-nhap | â€” | User logs in again with new password |

### W1.7 â€” Contact (guest)

| Step | Screen | Action | Endpoint | Data Read | Data Write | Success | Edge |
|---|---|---|---|---|---|---|---|
| 1 | `/lien-he/` | Fill CF7 form + submit | CF7 REST `/wp-json/contact-form-7/v1/contact-forms/{id}/feedback` (nonce) | form config | `kd_db7_forms` row + email | Inline success | Inline validation |

---

## 2. Actor: Logged-in customer

Same as Guest plus:

### W2.1 â€” Update profile

| Step | Screen | Action | Endpoint | Data Read | Data Write | Success | Edge |
|---|---|---|---|---|---|---|---|
| 1 | `/tai-khoan/` (profile template or WC my-account form) | Fill new display name / gender / DOB | AJAX API-03 | current user | `kd_users`, `kd_usermeta` | Toastr reload | **CSRF risk** â€” no nonce. Non-authed GET that POSTs via CSRF can silently change password |
| 2 | Same | Optional: fill old + new + re-password | API-03 | â€” | `wp_set_password` | Toastr reload | New < 6 chars or mismatch rejected |

### W2.2 â€” My Account navigation

| Step | Screen | Data | Notes |
|---|---|---|---|
| 1 | `/my-account/` dashboard | current user | Default WC dashboard; header says "Hello {display_name}" |
| 2 | Orders tab | `kd_wc_orders` / `kd_posts` shop_order | WC lists customer orders |
| 3 | Addresses tab | `kd_usermeta` billing/shipping | Edit form |
| 4 | Account details | `kd_users` | Edit name/email/password via WC default |
| 5 | Logout | â€” | Clears auth cookie |

### W2.3 â€” Add to cart / checkout

Same as Guest W1.2. Logged-in customer's cart is session-keyed and persists after login (WC merges guest cart into user cart on login).

---

## 3. Actor: Shop Manager (role `shop_manager`)

Default WooCommerce capability set â€” can manage products, orders, coupons, reports, but cannot edit plugins/theme or other users except other shop managers.

| Step | Screen | Action | Data |
|---|---|---|---|
| 1 | `/wp-admin/` login | Standard WP login | â€” |
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

### W5.1 â€” Cart session maintenance (WooCommerce)

| Step | Trigger | Action | Data | Effect |
|---|---|---|---|---|
| 1 | Every request | WC init | Loads `kd_woocommerce_sessions` row for this `wc_session_cookie` | Cart reconstructed |
| 2 | Every N hours | Action Scheduler `woocommerce_cleanup_sessions` | Deletes expired rows | Session cleanup |

### W5.2 â€” Order status side-effects

| Step | Trigger | Action | Data |
|---|---|---|---|
| 1 | Order `processing` | `woocommerce_order_status_processing` hooks: email customer + admin, reduce stock | `kd_postmeta` or `kd_wc_orders_meta`, product stock meta |
| 2 | Order `completed` | Customer-completed email + `woocommerce_order_status_completed` hooks | â€” |
| 3 | Order `cancelled` | Restock items + email | â€” |
| 4 | Order created via Quick Buy | Skips `pending` â€” goes straight to `processing` â†’ stock reduced immediately without payment verification | â€” |

### W5.3 â€” Cache layer

| Step | Trigger | Action | Data |
|---|---|---|---|
| 1 | Pre-request | `advanced-cache.php` (W3TC) | Serves cached HTML if hit |
| 2 | `save_post` | `clear_cache_post_after_save` (currently **not hooked** â€” commented out at [functions.php:156](files/wp-content/themes/bigbike/functions.php#L156)) | No-op |
| 3 | Per plugin rules | Autoptimize post-processes HTML, optimises CSS/JS | Updates cache dir |

### W5.4 â€” Search redirect

Already described in W1.3. Edge: `no_products_found_redirect` can loop on non-product archives returning 0 posts.

### W5.5 â€” Polylang + permalink

- `pll_get_post()` used extensively to resolve login/register/forgot page IDs per current language.
- `permalink-manager-pro` may rewrite URLs post-rewrite-rules in ways not evident from source â€” **Needs verification**.

### W5.6 â€” Image lazy-load transform

- Content filter `add_data_src_to_content` at priority 9999 rewrites `<img src=â€¦>` â†’ `<img class='lazy' data-src=â€¦>` in the_content output.
- Lozad JS observes intersection and swaps `data-src` â†’ `src`.
- Running order matters â€” other filters running at priority > 9999 could break the rewrite.

### W5.7 â€” Wordfence

Active plugin. Blocks IP-level attacks, logs traffic, live traffic view. **Needs verification** for rate limits on the custom AJAX endpoints.

---

## Failure matrix (critical paths)

| Failure | Detection | Current behaviour | Desired behaviour (for migration) |
|---|---|---|---|
| API-07 exception during order creation | No try/catch | Silent â€” client stuck on "Äang xá»­ lĂ­..." | Return JSON error + surface toastr; roll back user/order |
| API-05 `header-cart.php` missing | Template not in snapshot | Mini-cart HTML blank | Guarantee template exists or render inline |
| API-08 no variation match | Handler returns nothing | JS leaves UI in half-enabled state | Return structured error |
| Checkout with WC JS deregistered | Server-side only | Some UX degraded | Re-enable WC scripts on checkout page only |
| Redirect loop on empty search | `no_products_found_redirect` | Already redirects to home search | Return 404 or "no results" page |
| CSRF on API-03 password change | No nonce | Potentially exploitable | Require nonce + CSRF token |

