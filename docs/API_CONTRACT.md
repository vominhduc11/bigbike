# API_CONTRACT.md — bigbike.vn

All custom AJAX endpoints + inferred WooCommerce endpoints the front-end depends on.

Conventions:
- Transport: all custom handlers POST to `/wp-admin/admin-ajax.php` with `application/x-www-form-urlencoded` (or jQuery form-serialize) and expect JSON back.
- Response envelope (set by `wp_send_json_success|error` at all handlers):
  ```json
  // wp_send_json_success(payload)
  { "success": true, "data": { ... } }
  // wp_send_json_error(payload)
  { "success": false, "data": { ... } }
  ```
  The *inner* payload is what the app uses. All custom handlers return these common keys:
  ```
  error       : 0|1
  error_code  : 200|500
  action      : space-separated directive string, one or more of:
                  toastr | sweetalert | redirect | reload | replace | get_variation
  command     : "success" | "error"
  title       : "Thông báo" | "Lỗi"
  message     : user-facing Vietnamese string (may contain HTML)
  ```

- **Security defaults for every custom handler below (unless stated otherwise):**
  - Registered on BOTH `wp_ajax_<name>` AND `wp_ajax_nopriv_<name>` → guests allowed.
  - **No** nonce check (`check_ajax_referer`/`wp_verify_nonce`).
  - **No** capability check (`current_user_can`).
  - **No** ownership check.
  - Input sanitisation is minimal — typically a single `esc_attr()` which is NOT a security function, it only escapes HTML attributes.

---

## API-01 — custom_register_user

| Field | Value |
|---|---|
| API ID | API-01 |
| Name / action | `custom_register_user` |
| Transport | POST `/wp-admin/admin-ajax.php` |
| Source file | [inc/ajax-functions.php:60-110](files/wp-content/themes/bigbike/inc/ajax-functions.php#L60-L110) |
| Handler function | `custom_register_user()` |
| Registered hook | `wp_ajax_custom_register_user` + `wp_ajax_nopriv_custom_register_user` at [inc/ajax-functions.php:2-3](files/wp-content/themes/bigbike/inc/ajax-functions.php#L2-L3) |
| Auth requirement | Guest (should not be called while logged in — see A04) |
| Nonce check | **None** |
| Capability check | **None** |
| Ownership check | n/a |
| Request params | `fullname` (string), `email` (string), `phone` (10 digits string), `password` (min 6 chars), `repassword` (must equal password). Optional `username` is effectively overwritten by `phone`. |
| Sanitisation / validation | `esc_attr()` applied to each field (inadequate as security boundary); business validation via `register_validation_update()`: phone length==10, phone uniqueness (`username_exists`), password length ≥ 6, password==repassword, `is_email(email)`, `email_exists(email)` |
| Response shape — success | `{ error:0, error_code:200, action:"toastr redirect", link:home_url('/'), title:"Thông báo", command:"success", message:"Đăng nhập thành công" }` |
| Response shape — error | `{ error:1, error_code:500, action:"sweetalert", title:"Lỗi", command:"error", message:"<p>…</p>…" }` |
| Error cases | Phone length ≠ 10, phone already used, password < 6 chars, password != repassword, email invalid, email already used |
| Data read | `kd_users` (uniqueness lookups) |
| Data write | `kd_users` (INSERT), `kd_usermeta` (phone), auth cookie |
| Side effects | `wp_insert_user` with role `subscriber`, then auto-login via `wp_set_current_user`+`wp_set_auth_cookie`+`do_action('wp_login')` |
| Evidence | [inc/ajax-functions.php:27-58](files/wp-content/themes/bigbike/inc/ajax-functions.php#L27-L58), [inc/ajax-functions.php:60-110](files/wp-content/themes/bigbike/inc/ajax-functions.php#L60-L110) |
| Status | Implemented. **Risks:** no CSRF, no CAPTCHA, no rate limit, username_exists check races, phone uniqueness lookup uses `username_exists($phone)` which only works because username==phone for this handler (not for any user created outside this flow). |

---

## API-02 — custom_login_user

| Field | Value |
|---|---|
| API ID | API-02 |
| Name / action | `custom_login_user` |
| Source file | [inc/ajax-functions.php:112-158](files/wp-content/themes/bigbike/inc/ajax-functions.php#L112-L158) |
| Handler function | `custom_login_user()` |
| Registered hook | `wp_ajax_custom_login_user` + `wp_ajax_nopriv_custom_login_user` at [inc/ajax-functions.php:5-6](files/wp-content/themes/bigbike/inc/ajax-functions.php#L5-L6) |
| Auth requirement | Guest |
| Nonce check | **None** |
| Capability check | **None** |
| Request params | `username` (string — accepts login name OR email), `password` (string), `remember` (0/1 optional, default 0) |
| Sanitisation / validation | `esc_attr` + `trim` on username, `esc_attr` on password. No validation beyond existence. |
| Response — success | `{ error:0, error_code:200, action:"toastr redirect", link:home_url('/'), title:"Thông báo", command:"success", message:"Đăng nhập thành công" }` |
| Response — error | `{ error:1, error_code:500, action:"sweetalert", title:"Lỗi", command:"error", message:"Tên đăng nhập hoặc Email không đúng…" or "Mật khẩu không đúng…" }` |
| Error cases | User not found by login/email; password mismatch |
| Data read | `kd_users`, `kd_usermeta` |
| Data write | auth cookie |
| Side effects | `wp_set_auth_cookie($user_id, $remember)`. Because `$remember` is taken raw from POST, any value counts as truthy. |
| Evidence | [inc/ajax-functions.php:5-6,112-158](files/wp-content/themes/bigbike/inc/ajax-functions.php#L112-L158) |
| Status | Implemented. **Risks:** timing oracle (error message differs between "user not found" and "bad password"), no login throttling (Wordfence may compensate — Needs verification), no nonce. |

---

## API-03 — update_user_infomation

| Field | Value |
|---|---|
| API ID | API-03 |
| Name / action | `update_user_infomation` |
| Source file | [inc/ajax-functions.php:161-222](files/wp-content/themes/bigbike/inc/ajax-functions.php#L161-L222) |
| Handler function | `update_user_infomation()` |
| Registered hook | `wp_ajax_update_user_infomation` + `wp_ajax_nopriv_update_user_infomation` at [inc/ajax-functions.php:8-9](files/wp-content/themes/bigbike/inc/ajax-functions.php#L8-L9) |
| Auth requirement | **Logged-in** (handler rejects if `wp_get_current_user()->ID == 0`) |
| Nonce check | **None** |
| Capability check | **None** (implicit: any logged-in user updating themselves) |
| Ownership check | Implicit: handler only ever writes `$current_user->ID`. A request cannot target another user. **But:** no CSRF token means a malicious third-party site can force a logged-in user to change their password via a hidden form. |
| Request params | `fullname` (string), `gender` (string), `day_of_birthday`/`month_of_birthday`/`year_of_birthday` (int, default 1/1/1990), `old_password`, `new_password`, `re_password` (optional triple) |
| Sanitisation / validation | `esc_attr`+`trim` on fullname, `esc_attr` on gender. No sanitisation on password fields. Business: new password length ≥ 6, new_password == re_password, old_password must match. |
| Response — success | `{ error:0, error_code:200, action:"toastr reload", title:"Thông báo", command:"success", message:"Cập nhật thông tin thành công" }` |
| Response — error | `{ error:1, error_code:500, action:"sweetalert", ... }` |
| Error cases | Not logged in, new password too short, confirm mismatch |
| Data read | `kd_users`, `kd_usermeta` |
| Data write | `kd_users` (`first_name`, `display_name`), `kd_usermeta` (`gender`, `dob`), optional `wp_set_password` |
| Evidence | [inc/ajax-functions.php:161-222](files/wp-content/themes/bigbike/inc/ajax-functions.php#L161-L222) |
| Status | Implemented. **Security risk: CSRF on password change** (see A03 in ARCHITECTURE.md §12). |

---

## API-04 — custom_add_to_cart

| Field | Value |
|---|---|
| API ID | API-04 |
| Name / action | `custom_add_to_cart` |
| Source file | [inc/ajax-functions.php:224-297](files/wp-content/themes/bigbike/inc/ajax-functions.php#L224-L297) |
| Handler function | `custom_add_to_cart()` |
| Registered hook | `wp_ajax_custom_add_to_cart` + `wp_ajax_nopriv_custom_add_to_cart` at [inc/ajax-functions.php:11-12](files/wp-content/themes/bigbike/inc/ajax-functions.php#L11-L12) |
| Auth requirement | Guest OK |
| Nonce check | **None** |
| Capability check | **None** |
| Request params | `product_id` (int, required), `variation_id` (int, optional default 0), `variation` (assoc array of attribute→value pairs, optional), `quantity` (int, required) |
| Validation | `apply_filters('woocommerce_add_to_cart_validation', true, $product_id, $quantity)` — default WC sanity filter; `empty($product_id)` and `empty($quantity)` checks. |
| Response — success | `{ error:0, error_code:200, action:"toastr replace reload", message:"Thêm sản phẩm vào giỏ hàng thành công.", js_class:".js-cart-box", cart:{ total, data, url } }` where `total` is HTML from `WC()->cart->get_cart_total()`, `data` is the full cart array from `WC()->cart->get_cart()`, `url` is cart page URL. |
| Response — error | `{ error:1, error_code:500\|200, action:"toastr[ reload]", message:"…" }` |
| Data read | products, variations |
| Data write | cart session (`kd_woocommerce_sessions`) |
| Evidence | [inc/ajax-functions.php:11-12,224-297](files/wp-content/themes/bigbike/inc/ajax-functions.php#L224-L297) |
| Status | Implemented. **Risks:** leaks full cart structure including prices and session details in the response. |

---

## API-05 — remove_item_from_cart

| Field | Value |
|---|---|
| API ID | API-05 |
| Name / action | `remove_item_from_cart` |
| Source file | [inc/ajax-functions.php:299-332](files/wp-content/themes/bigbike/inc/ajax-functions.php#L299-L332) |
| Handler function | `remove_item_from_cart()` |
| Registered hook | `wp_ajax_remove_item_from_cart` + `wp_ajax_nopriv_remove_item_from_cart` at [inc/ajax-functions.php:14-15](files/wp-content/themes/bigbike/inc/ajax-functions.php#L14-L15) |
| Auth requirement | Guest OK |
| Nonce check | **None** |
| Request params | `cart_key` (string — WC cart item hash) |
| Response — success | `{ error:0, ..., action:"toastr replace", message:"Xóa sản phẩm khỏi giỏ hàng thành công", html:<header-cart partial>, js_class:".js-cart-box", cart:{ total, data } }` |
| Response — error | `{ error:1, error_code:500, action:"toastr", message:"Có lỗi xảy ra…" }` |
| Data read | cart session |
| Data write | `WC()->cart->remove_cart_item($cart_key)` updates session |
| Side effects | Renders template `template-parts/header-cart.php` for the returned `html` — file NOT found in snapshot, **Needs verification** |
| Evidence | [inc/ajax-functions.php:14-15,299-332](files/wp-content/themes/bigbike/inc/ajax-functions.php#L299-L332) |
| Status | Implemented (template dependency unverified) |

---

## API-06 — update_cart_item_quantity

| Field | Value |
|---|---|
| API ID | API-06 |
| Name / action | `update_cart_item_quantity` |
| Source file | [inc/ajax-functions.php:334-352](files/wp-content/themes/bigbike/inc/ajax-functions.php#L334-L352) |
| Handler function | `update_cart_item_quantity()` |
| Registered hook | `wp_ajax_update_cart_item_quantity` + `wp_ajax_nopriv_update_cart_item_quantity` at [inc/ajax-functions.php:17-18](files/wp-content/themes/bigbike/inc/ajax-functions.php#L17-L18) |
| Auth requirement | Guest OK |
| Nonce check | **None** |
| Request params | `cart_key` (string), `quantity` (int) |
| Validation | None — quantity passed unchecked to `WC()->cart->set_quantity` (which does internal validation) |
| Response — success | `{ error:0, error_code:200, action:"replace", js_class:".js-cart-box", cart:{ total, data } }` |
| Response — error | `{ error:1, error_code:500 }` (no message) |
| Data read | cart session |
| Data write | cart session |
| Evidence | [inc/ajax-functions.php:17-18,334-352](files/wp-content/themes/bigbike/inc/ajax-functions.php#L334-L352) |
| Status | Implemented |

---

## API-07 — buy_quickly (Quick Buy / One-click order)

| Field | Value |
|---|---|
| API ID | API-07 |
| Name / action | `buy_quickly` |
| Source file | [inc/ajax-functions.php:354-447](files/wp-content/themes/bigbike/inc/ajax-functions.php#L354-L447) |
| Handler function | `buy_quickly()` |
| Registered hook | `wp_ajax_buy_quickly` + `wp_ajax_nopriv_buy_quickly` at [inc/ajax-functions.php:20-21](files/wp-content/themes/bigbike/inc/ajax-functions.php#L20-L21) |
| Auth requirement | Guest OK |
| Nonce check | **None** |
| Capability check | **None** |
| Ownership check | n/a |
| Request params | `name` (string), `phone` (string), `address` (string), `product_id` (int), `variation_id` (int, optional "0" if not variable), `variations` (JSON-encoded assoc array of attribute→value, optional). `email` is never actually read from POST — instead it is set to `$_REQUEST['product_id']` (bug — see ARCHITECTURE A5), then overwritten on user lookup by `$phone.'@liveevil.vn'` when no user exists. |
| Sanitisation / validation | None beyond reading `$_REQUEST`. No required-field check, no format validation, no CAPTCHA. |
| Response — success | `{ error:0, error_code:200, action:"toastr redirect", link:"/thanh-toan/order-received/{id}?key={key}", title:"Thông báo", command:"success", message:"Bạn đã đặt hàng thành công…" }` |
| Response — error | (none — handler does not emit failure response) |
| Data read | product (`wc_get_product`), user (`get_user_by('login', $email)`) |
| Data write | `kd_users` (via `wp_create_user` if no match), WooCommerce order (`wc_create_order`), `kd_wc_orders` + `kd_wc_order_addresses` + `kd_wc_order_operational_data` + `kd_wc_orders_meta` (HPOS) and/or `kd_posts/kd_postmeta` (legacy), `kd_woocommerce_order_items` + `kd_woocommerce_order_itemmeta` |
| Side effects | Sets order payment method to `bacs`; adds shipping method `flexible_shipping_single:9` with amount = 0 if product price ≥ 2,000,000 VND else 35,000 VND; `$order->update_status('processing', 'Imported order', true)`; stores shipping address only (not billing) |
| Evidence | [inc/ajax-functions.php:20-21,354-447](files/wp-content/themes/bigbike/inc/ajax-functions.php#L354-L447) |
| Status | Implemented. **Risks (see ARCHITECTURE A4, A5, A10, A12, A13):** unlimited order creation by any actor; fictitious email domain (`@liveevil.vn`); hard-coded shipping method id; hard-coded free-shipping threshold; moves straight to `processing` with no payment. |

---

## API-08 — find_variation_product

| Field | Value |
|---|---|
| API ID | API-08 |
| Name / action | `find_variation_product` |
| Source file | [inc/ajax-functions.php:449-475](files/wp-content/themes/bigbike/inc/ajax-functions.php#L449-L475) |
| Handler function | `find_variation_product()` |
| Registered hook | `wp_ajax_find_variation_product` + `wp_ajax_nopriv_find_variation_product` at [inc/ajax-functions.php:23-24](files/wp-content/themes/bigbike/inc/ajax-functions.php#L23-L24) |
| Auth requirement | Guest OK |
| Nonce check | **None** |
| Request params | `data` (assoc): `product_id` (int), `attribute` (array of attribute slugs), `value` (array of values, parallel to `attribute`) |
| Validation | `!count($values) || empty($product_id)` → silently returns (no response body) |
| Response — success | `{ error:0, code:200, action:"get_variation", variation_id, price (HTML string), regular_price }` |
| Response — error | None — handler falls through without sending JSON when no variation matches |
| Data read | products + variations |
| Data write | none |
| Evidence | [inc/ajax-functions.php:23-24,449-475](files/wp-content/themes/bigbike/inc/ajax-functions.php#L449-L475) |
| Status | Implemented. **Risks:** handler fails open (returns nothing instead of error JSON). JS at [bigbike.main.js:456-475](files/wp-content/themes/bigbike/scripts/bigbike.main.js#L456-L475) tolerates missing `res.data.variation_id`. |

---

## Form / WC-core endpoints used by the front-end

These are not custom handlers but they are invoked by the UI.

### FE-01 — WooCommerce checkout submission

| Field | Value |
|---|---|
| Endpoint | `POST /thanh-toan/?wc-ajax=checkout` (or standard form POST to the checkout URL) |
| Registered by | WooCommerce core |
| Template | [woocommerce/checkout/form-checkout.php](files/wp-content/themes/bigbike/woocommerce/checkout/form-checkout.php) |
| Custom filters/actions | `woocommerce_checkout_fields` → `custom_override_checkout_fields` (unsets company, address_2, postcode, country, state for both billing and shipping) [woo-functions.php:43-65](files/wp-content/themes/bigbike/inc/woo-functions.php#L43-L65); `woocommerce_checkout_process` → `phone_custom_checkout_field_process` (regex validates `billing_phone` is exactly 10 digits) [woo-functions.php:69-79](files/wp-content/themes/bigbike/inc/woo-functions.php#L69-L79); `woocommerce_checkout_fields` → `add_custom_class_to_checkout_field` (adds `shipping_phone` field required, min/max 10) [functions.php:158-171](files/wp-content/themes/bigbike/functions.php#L158-L171) |
| Auth | Guest checkout = yes (`kd_options.woocommerce_enable_guest_checkout=yes`) |
| Nonce | WooCommerce sets `woocommerce-process-checkout-nonce` |
| Data write | WC_Order; user if registering during checkout (`woocommerce_enable_signup_and_login_from_checkout=yes`) |
| Status | Plugin-provided, customised |

### FE-02 — WooCommerce mini-cart (apply coupon, update cart via form submit)

| Field | Value |
|---|---|
| Endpoint | `POST <cart URL>` with `update_cart=1` or `apply_coupon=1` |
| Template | [woocommerce/cart/cart.php](files/wp-content/themes/bigbike/woocommerce/cart/cart.php) |
| Nonce | `woocommerce-cart-nonce` emitted via `wp_nonce_field('woocommerce-cart', ...)` at [cart.php:181](files/wp-content/themes/bigbike/woocommerce/cart/cart.php#L181) |
| Status | Plugin-provided |

### FE-03 — WooCommerce lost password (form submit)

| Field | Value |
|---|---|
| Endpoint | `POST` the page that renders `[lost_password_form]` (page id 10155) |
| Template | [woocommerce/myaccount/form-lost-password.php](files/wp-content/themes/bigbike/woocommerce/myaccount/form-lost-password.php) |
| Nonce | `woocommerce-lost-password-nonce` emitted at line 38 |
| Handler | WC core `WC_Shortcode_My_Account::lost_password` |
| Custom redirect | `woocommerce_customer_reset_password` → `woocommerce_new_pass_redirect` → redirects to Polylang-aware page 7970 ([utils-functions.php:443-449](files/wp-content/themes/bigbike/inc/utils-functions.php#L443-L449)) |
| Status | Plugin-provided, customised |

### FE-04 — Contact Form 7 submission

| Field | Value |
|---|---|
| Endpoint | `POST /wp-json/contact-form-7/v1/contact-forms/{id}/feedback` |
| Source | Contact Form 7 plugin + contact-form-cfdb7 (stores records to `kd_db7_forms`) |
| Form id | Stored in ACF field `contact_form` on the Contact page (shortcode string). |
| Nonce | CF7 emits `_wpcf7_nonce` |
| Status | Plugin-provided |

### FE-05 — Nextend / native WP login

| Field | Value |
|---|---|
| Endpoint | `GET /wp-login.php?loginSocial=facebook` (referenced in [page-login.php:56](files/wp-content/themes/bigbike/page-templates/page-login.php#L56) and [page-register.php:67](files/wp-content/themes/bigbike/page-templates/page-register.php#L67)) |
| Source | Nextend Social Login plugin |
| Status | **Needs verification** — plugin folder present in `wp-content/plugins/` but NOT in `active_plugins` serialized option. Button may be dead. |

### FE-06 — WP admin AJAX / REST (wp-admin back office)

Scope: all admin activity (manage products, orders, users, posts, media) goes through default WP core + WooCommerce REST/AJAX endpoints under `/wp-admin/*`. No custom admin endpoints are defined in theme.

---

## Summary of gaps

- No custom REST API (`register_rest_route`) found in the theme. Grep of theme folder returns no `register_rest_route`.
- All custom endpoints are AJAX under `admin-ajax.php`.
- No rate limiting, no IP throttle, no nonce, no CAPTCHA on any of them. Wordfence plugin is active and may provide some protection — **Needs verification**.

