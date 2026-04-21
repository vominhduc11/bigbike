# BUSINESS_PROCESS.md — bigbike.vn

Processes grouped by domain. Each process describes actor, pre-conditions, happy path, alternative paths, exception paths, end-state, data touched.

Legend — **T** (status): Implemented / Plugin-provided / Partial / Needs verification.

---

## P-01 — Browse / discover products (home)

- **Actor:** Guest, Logged-in customer.
- **Start:** Visit `/`.
- **Main flow:**
  1. Serve `page-templates/page-home.php`.
  2. Render slider (ACF `sliders` repeater on page-id 12).
  3. Render 3 featured products (`product_visibility=featured`).
  4. Render about-us block (ACF `about_us`).
  5. Render 5-product swipe carousel + product_cat cards (`show_on_homepage=1`, ordered by `ordering`).
  6. Render 3 latest "Trải nghiệm" posts (category id 365, Polylang-aware).
  7. Render 3 latest news posts (category id 361).
  8. Render 5 product videos (`post_type=video`).
  9. Render 5 brand logos (`pwb-brand` taxonomy).
  10. Render `content_bottom` WYSIWYG.
- **Alternative:** Slider fallback to `post_type=slider` if ACF repeater empty ([page-home.php:10-15](files/wp-content/themes/bigbike/page-templates/page-home.php#L10-L15)).
- **Exception:** Empty queries leave sections blank; no error state.
- **End:** HTML page with GTM dataLayer initial push for page_view (platform-level, not explicit in code).
- **Data touched:** `kd_posts` (page+product+slider+video+review), `kd_postmeta` (ACF), `kd_terms`+`kd_termmeta`, `kd_options` (site URL, theme).
- **Evidence:** [page-home.php](files/wp-content/themes/bigbike/page-templates/page-home.php)
- **T:** Implemented.

---

## P-02 — Search / filter products

- **Actor:** Guest, Logged-in.
- **Start:** Submit query in `searchform.php` OR apply filter in sidebar `template-parts/product-filter.php` (currently **stubbed to 2 lines** — see below).
- **Main flow (search):**
  1. `GET /?s={q}&post_type=product`.
  2. `request` filter pads single-word `s` with ` s` (BR-31).
  3. `posts_search` filter expands SQL with IDs of products whose `product_cat` or `pwb-brand` term name matches `$q` (BR-10).
  4. WC archive renders the result with `kdc_pagination()`.
- **Main flow (filter):**
  1. User ticks brand / colour / gender / price range.
  2. Form submits query params `pwb-brand`, `filter_color`, `filter_gender`, `min_price`, `max_price`.
  3. Shop page title updated via `bigbike_title_override()` to reflect filters.
  4. Price-range filter is served by plugin `devvn-woocommerce-price-filter`.
- **Alternative:** Sort with `.woocommerce-ordering select` auto-submits the form ([bigbike.main.js:157-159](files/wp-content/themes/bigbike/scripts/bigbike.main.js#L157-L159)).
- **Exception:** If search returns 0 posts, `no_products_found_redirect` sends user to `/?s={q}` (home search).
- **End:** Filtered product grid with pagination.
- **Data touched:** `kd_posts`, `kd_term_*`, `kd_wc_product_meta_lookup`, `kd_wc_product_attributes_lookup`.
- **Risk:** `template-parts/product-filter.php` is 2 lines (empty shell) — **Needs verification** of actual sidebar filter implementation; may be rendered by a plugin widget or a child template not in the theme.
- **Evidence:** [functions.php:215-273](files/wp-content/themes/bigbike/functions.php#L215-L273); `template-parts/product-filter.php` (2 lines).
- **T:** Partial.

---

## P-03 — Product detail + variation selection

- **Actor:** Guest, Logged-in.
- **Start:** `GET /product/{slug}/`.
- **Main flow:**
  1. Serve `single-product.php` → `content-single-product.php`.
  2. Render gallery (swiper, elevateZoom), title, price, rating, short description, stock status.
  3. Render variable product form with radio buttons (custom, see BR-07) OR simple product add-to-cart form.
  4. Emit GTM `view_item`.
  5. User selects attribute(s) → JS `makeAvailableToBuy()` calls API-08 `find_variation_product`.
  6. Handler resolves `variation_id`, returns price. JS updates price, enables Add-to-cart and Quick Buy buttons, pushes variation id into hidden form fields.
- **Alternative:** Simple product — no variation selection; add-to-cart button enabled immediately.
- **Exception:** Variation cannot be resolved — API-08 silently returns no body. UI remains in disabled state.
- **End:** User on detail page with a resolved (or unresolvable) variation.
- **Data touched:** `kd_posts` (variations), `kd_postmeta`, `kd_term_relationships`.
- **Evidence:** [content-single-product.php](files/wp-content/themes/bigbike/woocommerce/content-single-product.php); [ajax-functions.php:449-475](files/wp-content/themes/bigbike/inc/ajax-functions.php#L449-L475); [bigbike.main.js:443-502](files/wp-content/themes/bigbike/scripts/bigbike.main.js#L443-L502).
- **T:** Implemented.

---

## P-04 — Cart management

- **Actor:** Guest, Logged-in.
- **Start:** Add-to-cart on product detail.
- **Main flow:**
  1. API-04 `custom_add_to_cart` → WC cart session updated.
  2. Mini-cart (`.js-cart-box`) replaced and page reloads (`action: "toastr replace reload"`).
  3. User navigates to `/gio-hang/`.
  4. `woocommerce/cart/cart.php` renders line items, quantities, totals.
  5. User clicks +/− to change qty → API-06 `update_cart_item_quantity` updates `WC()->cart->set_quantity()`.
  6. User clicks remove icon → either standard WC URL `wc-action=remove-cart-item` OR mini-cart AJAX API-05 `remove_item_from_cart`.
  7. User may apply coupon via standard WC form `apply_coupon` (nonce-protected).
  8. User clicks "THANH TOÁN" → redirects to checkout page.
- **Alternative:** Continue shopping → back to shop.
- **Exception:** Removing via AJAX returns HTML for `template-parts/header-cart.php` which is missing from snapshot — UI may show empty cart box. **Needs verification**.
- **End:** Cart contains desired items, ready for checkout.
- **Data touched:** `kd_woocommerce_sessions` (cart blob), `kd_posts` (product data read).
- **T:** Implemented.

---

## P-05 — Quick Buy (one-click order)

- **Actor:** Guest or Logged-in.
- **Start:** Product detail page, click "Mua ngay".
- **Main flow:**
  1. Quick-buy form (`.js-quickbuy-box`, hidden) is toggled visible.
  2. User fills `name`, `phone`, `email`, `address`.
  3. Form submitted via generic `processSubmitFormFront` → POST `action=buy_quickly`.
  4. API-07 creates user if not existing (using `$phone.'@liveevil.vn'` as login+email), creates WC_Order, adds the product, attaches shipping (free if ≥ 2M VND, else 35K), sets payment to `bacs`, moves order to `processing`.
  5. User redirected to `/thanh-toan/order-received/{id}?key=...`.
- **Exception:** Handler does not send failure JSON on WC order creation errors — client sees no response. Form stays in "Đang xử lí..." state forever.
- **End:** Order exists in DB, user sees thank-you page, GTM `purchase` event fires.
- **Data touched:** `kd_users`, `kd_usermeta`, `kd_wc_orders`, `kd_wc_orders_meta`, `kd_wc_order_addresses`, `kd_wc_order_operational_data`, `kd_woocommerce_order_items`, `kd_woocommerce_order_itemmeta`.
- **Evidence:** [ajax-functions.php:354-447](files/wp-content/themes/bigbike/inc/ajax-functions.php#L354-L447), [woo-functions.php:115-158](files/wp-content/themes/bigbike/inc/woo-functions.php#L115-L158).
- **T:** Implemented — **high business risk** (BR-20).

---

## P-06 — Checkout (standard WC)

- **Actor:** Guest (guest checkout=yes) or Logged-in.
- **Start:** Cart page → "THANH TOÁN".
- **Main flow:**
  1. `/thanh-toan/` renders `form-checkout.php`.
  2. Customer billing fields shown (minus company/address_2/postcode/country/state — see BR).
  3. Shipping phone field added as required (10 digits).
  4. User fills form, optionally ticks "ship to a different address" (toggled by JS `choose_shipping_address`).
  5. User selects payment gateway.
  6. User submits → WC checkout AJAX (`wc-ajax=checkout`) with nonce `woocommerce-process-checkout`.
  7. WC runs `woocommerce_checkout_process` hook — custom filter rejects non-10-digit billing phone.
  8. On success WC creates `WC_Order`, redirects to `/thanh-toan/order-received/{id}`.
  9. `thankyou.php` renders + GTM `purchase`.
- **Alternative:** If `woocommerce_enable_signup_and_login_from_checkout=yes` AND user unchecked guest, a WC user account is created.
- **Exception:** Checkout notices surface via `wc_add_notice`. Since WC JS is globally deregistered, some notice rendering may rely on server round-trip. **Needs verification**.
- **End:** Order exists with status `pending|processing|on-hold` depending on gateway default.
- **Data touched:** Full WC order stack.
- **T:** Plugin-provided (customised).

---

## P-07 — Order received (thank-you)

- **Actor:** Order owner or guest with `key`.
- **Main flow:**
  1. URL `/thanh-toan/order-received/{id}?key=...`.
  2. WC verifies order exists + key matches.
  3. `thankyou.php` renders order summary (number, date, total, payment method).
  4. GTM `purchase` event fires (unless `status=failed`).
  5. `woocommerce_thankyou_{payment_method}` action runs gateway-specific instructions (e.g. BACS shows bank account details).
- **Exception:** Status `failed` — show retry button / "Pay" link.
- **End:** User has confirmation.
- **T:** Plugin-provided.

---

## P-08 — Account registration / login / logout / profile

### P-08a — Register (custom)
- **Actor:** Guest.
- **Main flow:** See API-01. After success, user is auto-logged-in and redirected to home.
- **T:** Implemented.

### P-08b — Login (custom)
- **Actor:** Guest.
- **Main flow:** See API-02. User auto-redirected to home on success. Remember-me stored as cookie duration flag.
- **Alternative:** `wp-login.php` still exists (wp-admin has a login form), and Facebook login button points to `/wp-login.php?loginSocial=facebook` (Nextend handler). Nextend plugin not in `active_plugins` — likely inactive.
- **T:** Implemented (WP-native) + **Needs verification** (FB social login).

### P-08c — Logout
- **Actor:** Logged-in.
- **Main flow:** Standard `wp_logout_url` — clears WP auth cookie. No custom handler.
- **T:** Plugin-provided.

### P-08d — Update profile
- **Actor:** Logged-in.
- **Main flow:** See API-03.
- **Fields updated:** display name, gender, dob, password (optional).
- **T:** Implemented — **security gap (no CSRF)**.

### P-08e — Lost password
- **Actor:** Guest.
- **Main flow:** User fills email/login on page rendering `[lost_password_form]`. WC emails reset link. On successful reset, WC triggers `woocommerce_customer_reset_password` → redirect to Polylang-aware login page (page id 7970).
- **T:** Plugin-provided (WC) + customised redirect.

### P-08f — My Account (WC default)
- **Actor:** Logged-in.
- **Main flow:** `/my-account/` → `woocommerce/myaccount/my-account.php`. Tabs: Dashboard, Orders, Addresses, Account details. Dashboard tab displays welcome message (custom dashboard override keeps WC defaults — [dashboard.php:103-125](files/wp-content/themes/bigbike/woocommerce/myaccount/dashboard.php#L103-L125)).
- **T:** Plugin-provided.

---

## P-09 — Contact inquiry

- **Actor:** Guest or Logged-in.
- **Main flow:**
  1. `GET /lien-he/` renders `page-templates/page-contact.php`.
  2. Map iframe + company info + contact-form-7 shortcode from ACF field `contact_form`.
  3. User submits CF7 form → CF7 REST endpoint.
  4. CF7 validates (with its own nonce `_wpcf7_nonce`), emails admin, contact-form-cfdb7 stores record in `kd_db7_forms`.
- **Alternative:** Hotline, ZALO, maps are static content.
- **Exception:** CF7 validation errors surface inline.
- **End:** Record in DB + email.
- **T:** Plugin-provided.

---

## P-10 — Blog / news browsing

- **Actor:** Any.
- **Main flow:**
  1. `/tin-tuc/` — landing via a Page OR category archive. `page-templates/page-news.php` is empty (1 line) in snapshot — landing likely via category archive template `category.php`.
  2. `/tin-tuc/{slug}.html` — single post.
  3. Category filters: id 365 (Trải nghiệm), 361 (Tin tức) — visible on home. Polylang-aware per current language.
- **T:** Implemented.

---

## P-11 — Admin manages products / orders / content (wp-admin)

- **Actor:** Admin (role `administrator`) or Shop Manager (role `shop_manager`).
- **Main flow:** Default WP + WC admin UI (pages: Products, Orders, Customers, Coupons, Reports, Settings, Tools, System Status, Posts, Pages, Comments, Media, Users, Plugins, Appearance, Tools, Settings).
- **Scope:** Full CRUD over everything.
- **Security:** Standard WP nonces + capabilities. `DISALLOW_FILE_EDIT=true` prevents theme/plugin editor. `DISALLOW_FILE_MODS=true` blocks plugin install/update from the UI.
- **Custom admin surface:** none inside the theme.
- **Additional admin plugins active:**
  - `wordfence` — firewall/live traffic.
  - `w3-total-cache` — cache management.
  - `seo-by-rank-math` — SEO content management.
  - `contact-form-cfdb7` — view submitted CF7 messages.
  - `permalink-manager-pro` — URL management.
  - `polylang` — language management.
  - `google-listings-and-ads` — merchant feed.
- **T:** Plugin-provided.

---

## Matrix of processes by actor

| Process | Guest | Customer | Shop Manager | Admin |
|---|---|---|---|---|
| P-01 Browse | ✓ | ✓ | ✓ | ✓ |
| P-02 Search/filter | ✓ | ✓ | ✓ | ✓ |
| P-03 Product detail / variation | ✓ | ✓ | ✓ | ✓ |
| P-04 Cart | ✓ | ✓ | ✓ | ✓ |
| P-05 Quick Buy | ✓ | ✓ | ✓ | ✓ |
| P-06 Standard checkout | ✓ (guest checkout) | ✓ | ✓ | ✓ |
| P-07 Order received | owner / guest w/ key | ✓ | ✓ | ✓ |
| P-08a Register | ✓ | — | — | — |
| P-08b Login | ✓ | — | — | — |
| P-08d Update profile | — | ✓ | ✓ | ✓ |
| P-08e Lost password | ✓ | ✓ | — | — |
| P-08f My Account | — | ✓ | ✓ | ✓ |
| P-09 Contact | ✓ | ✓ | ✓ | ✓ |
| P-10 Blog | ✓ | ✓ | ✓ | ✓ |
| P-11 wp-admin | — | — | ✓ (scoped) | ✓ |
