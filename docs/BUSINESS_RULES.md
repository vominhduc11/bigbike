# BUSINESS_RULES.md — bigbike.vn

Rules extracted from theme source (and configuration where available).
For each: Trigger → Condition → Expected behaviour → Evidence → Edge cases → Risk → Status.

---

## BR-01 — Phone number must be exactly 10 digits

- **Domain:** Customer registration, checkout.
- **Trigger:** API-01 register, WC checkout submission.
- **Condition:** `strlen($data['phone']) == 10` and `preg_match('/^[0-9]{10}$/D', $_POST['billing_phone'])`.
- **Expected behaviour:** Registration rejects with "Số điện thoại không đúng". Checkout adds WC error notice "Vui lòng nhập đúng số điện thoại." and blocks submission.
- **Evidence:** [inc/ajax-functions.php:35-37](files/wp-content/themes/bigbike/inc/ajax-functions.php#L35-L37); [inc/woo-functions.php:69-79](files/wp-content/themes/bigbike/inc/woo-functions.php#L69-L79); [functions.php:158-171](files/wp-content/themes/bigbike/functions.php#L158-L171)
- **Edge cases:** Leading zero must be preserved (Vietnamese mobile numbers). International numbers (+84 prefix) are rejected. Quick Buy (API-07) does NOT re-validate length — possible regression.
- **Risk if wrong:** Blocks legitimate customers with non-standard phone; silently accepts non-10-digit phone through Quick Buy.
- **Status:** Implemented (register + standard checkout); Partial in quick-buy.

---

## BR-02 — Phone number is the user login

- **Domain:** Registration.
- **Trigger:** API-01.
- **Condition:** Always.
- **Expected behaviour:** `user_login = phone`. `user_meta.phone = phone`. Phone uniqueness checked via `username_exists($phone)`.
- **Evidence:** [inc/ajax-functions.php:63-92](files/wp-content/themes/bigbike/inc/ajax-functions.php#L63-L92)
- **Edge cases:** Any user created outside API-01 (e.g. by Quick Buy at [ajax-functions.php:381](files/wp-content/themes/bigbike/inc/ajax-functions.php#L381), admin, or WC checkout-register) will NOT have a 10-digit phone as `user_login` — causing later logins to fail if the customer tries the phone-login path.
- **Risk if wrong:** Duplicate accounts per phone. Users created via Quick Buy use email-as-login (`phone@liveevil.vn`) and cannot log in via their phone.
- **Status:** Implemented.

---

## BR-03 — Password minimum 6 characters

- **Domain:** Registration + profile password change.
- **Trigger:** API-01 register, API-03 update-profile.
- **Condition:** `strlen($password) >= 6`.
- **Expected behaviour:** Reject with "Mật khẩu phải ít nhất 6 kí tự".
- **Evidence:** [inc/ajax-functions.php:41-42](files/wp-content/themes/bigbike/inc/ajax-functions.php#L41-L42); [inc/ajax-functions.php:195-196](files/wp-content/themes/bigbike/inc/ajax-functions.php#L195-L196); client side `data-rule-minlength="6"` on both login/register forms.
- **Edge cases:** Reset-password via WooCommerce lost-password flow applies WC default strength requirements, which may be stricter. Client side also enforces `maxlength=32` but server does not.
- **Risk if wrong:** Weak passwords.
- **Status:** Implemented.

---

## BR-04 — Email must be valid and unique

- **Domain:** Registration.
- **Trigger:** API-01.
- **Condition:** `is_email($email) && !email_exists($email)`.
- **Evidence:** [inc/ajax-functions.php:47-52](files/wp-content/themes/bigbike/inc/ajax-functions.php#L47-L52)
- **Edge cases:** Quick Buy generates synthetic email `<phone>@liveevil.vn` that may clash with an existing real email — but Quick Buy skips validation altogether.
- **Risk:** Duplicate synthetic emails across Quick Buy orders for same phone → account reuse without verification.
- **Status:** Implemented for API-01 only.

---

## BR-05 — Variation selection required before add-to-cart on variable products

- **Domain:** Product detail.
- **Trigger:** User clicks Add to cart.
- **Condition:** Variation radio set must have 1 selected value per attribute AND `variation_id != 0`.
- **Expected behaviour:** Until a valid variation is resolved via API-08, the add-to-cart button shows the disabled class `wc-variation-selection-needed`. When resolved, `find_variation_product` enables it.
- **Evidence:** [inc/woo-functions.php:178-185](files/wp-content/themes/bigbike/inc/woo-functions.php#L178-L185) "Vui lòng chọn size/màu sắc để mua hàng" notice; [scripts/bigbike.main.js:443-476](files/wp-content/themes/bigbike/scripts/bigbike.main.js#L443-L476); [scripts/bigbike.main.js:477-502](files/wp-content/themes/bigbike/scripts/bigbike.main.js#L477-L502)
- **Edge cases:** Handler API-08 returns nothing (no JSON body) when variation match fails — JS leaves the button enabled with the stale id, which could send `variation_id=0` to add-to-cart.
- **Risk:** Cart item created with no variation resolved → cart contains a variable product with no attributes.
- **Status:** Partial — see edge case.

---

## BR-06 — Out-of-stock variations disabled in radio selector

- **Domain:** Product detail.
- **Trigger:** Page render.
- **Condition:** `variation['is_in_stock']===false` AND `!backorders_allowed()`.
- **Expected behaviour:** Radio input gets `disabled="disabled"` and class `disabled` ([woo-functions.php:282,305,342](files/wp-content/themes/bigbike/inc/woo-functions.php#L282-L342)), and `variation_check` returns false when consulted by WC ([woo-functions.php:356-362](files/wp-content/themes/bigbike/inc/woo-functions.php#L356-L362)).
- **Evidence:** see above.
- **Edge cases:** The manual `product_of_stock` postmeta (custom) overrides WC stock state at the form level ([variable.php:25-32](files/wp-content/themes/bigbike/woocommerce/single-product/add-to-cart/variable.php#L25-L32)). Two different overrides can interact.
- **Risk:** User sees "CÒN HÀNG" while product is actually out of stock, or vice versa.
- **Status:** Implemented but over-layered.

---

## BR-07 — Color variation swatches read ACF fields on the term

- **Domain:** Product detail variation UI.
- **Trigger:** Rendering `pa_color` attribute radios.
- **Condition:** Attribute name == `pa_color`.
- **Expected behaviour:**
  1. If the matched variation has an `image` attached, use that image URL as the swatch background.
  2. Else read `get_field('image', $term)` (ACF) on the `pa_color` term and use it.
  3. Else read `get_field('color', $term)` (ACF hex/CSS value) on the term.
- **Evidence:** [inc/woo-functions.php:283-301](files/wp-content/themes/bigbike/inc/woo-functions.php#L283-L301)
- **Risk:** Colour swatches missing for uncaptured terms.
- **Status:** Implemented.

---

## BR-08 — Home page surfaces only categories flagged `show_on_homepage=1`

- **Domain:** Home.
- **Trigger:** Home page render.
- **Condition:** `term_meta.show_on_homepage==1`.
- **Expected behaviour:** Categories rendered in `.product-category-list` ordered by numeric `term_meta.ordering` descending.
- **Evidence:** [page-home.php:104-117](files/wp-content/themes/bigbike/page-templates/page-home.php#L104-L117)
- **Risk:** Editors must manage this term-meta flag out-of-band (via ACF or admin term editor).
- **Status:** Implemented.

---

## BR-09 — Home page pulls 3 featured products

- **Domain:** Home.
- **Trigger:** Home render.
- **Condition:** `product_visibility='featured'` (WC feature-flag taxonomy).
- **Expected behaviour:** First 3 featured products rendered via `content-product-featured-item`.
- **Evidence:** [page-home.php:57-87](files/wp-content/themes/bigbike/page-templates/page-home.php#L57-L87)
- **Status:** Implemented.

---

## BR-10 — Search covers product title + product_cat + pwb-brand names

- **Domain:** Search.
- **Trigger:** Front-end search.
- **Condition:** `is_search() && post_type=product && !is_admin()`.
- **Expected behaviour:** Runs a separate `WP_Query` for products whose `product_cat` OR `pwb-brand` term name equals `$search_string`, collects IDs, and injects them into the core search SQL after the opening `AND (((`.
- **Evidence:** [functions.php:215-254](files/wp-content/themes/bigbike/functions.php#L215-L254)
- **Edge cases:** Filter `request` at [functions.php:266-273](files/wp-content/themes/bigbike/functions.php#L266-L273) appends ` s` to single-word searches to "trick" WP into allowing a broader match. This is a stopgap — replace in migration.
- **Status:** Implemented.

---

## BR-11 — Empty search redirects to home search

- **Domain:** Search.
- **Trigger:** Search executed on a non-product archive with zero results.
- **Condition:** `!is_admin() && is_search() && !have_posts()`.
- **Expected behaviour:** `wp_redirect(home_url('/?s=' . get_search_query()))`.
- **Evidence:** [functions.php:256-264](files/wp-content/themes/bigbike/functions.php#L256-L264)
- **Risk:** Can produce a redirect loop if the home-search also yields no posts — tested in code: home-search is a normal WP search on all post types, which includes pages, so loop is unlikely in practice but still possible.
- **Status:** Implemented.

---

## BR-12 — Currency is VND, symbol "đ", thousands separator ".", no decimals

- **Domain:** All monetary display.
- **Trigger:** WC price rendering.
- **Condition:** Always.
- **Expected behaviour:** Currency code = VND; symbol replaced from "₫" to "đ" by `change_existing_currency_symbol`; `number_format($price, 0, ',', '.')` for manual formatting.
- **Evidence:** `kd_options`: woocommerce_currency=VND, woocommerce_price_thousand_sep=".", woocommerce_price_decimal_sep=",", woocommerce_price_num_decimals=0. [inc/woo-functions.php:160-167](files/wp-content/themes/bigbike/inc/woo-functions.php#L160-L167); [inc/utils-functions.php:270-283](files/wp-content/themes/bigbike/inc/utils-functions.php#L270-L283)
- **Status:** Implemented.

---

## BR-13 — Sale discount percentage rule

- **Domain:** Product listing UI.
- **Trigger:** Rendering `content-product-*-item.php`.
- **Condition:** Simple: `sale_price < regular_price` and both > 0. Variable: `get_variation_price('min') < get_variation_regular_price('min')` and both > 0. `postmeta.salediscount` overrides computed value if present.
- **Expected behaviour:** Badge "{percent}%" shown in a `.product--item-sale` pill.
- **Evidence:** [inc/utils-functions.php:214-245](files/wp-content/themes/bigbike/inc/utils-functions.php#L214-L245), hook `bigbike_after_shop_loop_item_image_thumb` → `show_percent_sale_discount` at [utils-functions.php:327-338](files/wp-content/themes/bigbike/inc/utils-functions.php#L327-L338)
- **Status:** Implemented.

---

## BR-14 — Related products driven by Yoast primary category (not WC defaults)

- **Domain:** Single product.
- **Trigger:** Render of content-single-product after summary.
- **Condition:** Same `postmeta._yoast_wpseo_primary_product_cat` as current product.
- **Expected behaviour:** Up to 8 products in same primary product category, excluding the current product and upsell ids.
- **Evidence:** [inc/utils-functions.php:391-433](files/wp-content/themes/bigbike/inc/utils-functions.php#L391-L433); invoked from [content-single-product.php:188-212](files/wp-content/themes/bigbike/woocommerce/content-single-product.php#L188-L212)
- **Risk:** Products missing a Yoast primary-cat value yield a `[NULL]` tax_query term; custom `getMainProductCategory` has a fallback ([utils-functions.php:312-324](files/wp-content/themes/bigbike/inc/utils-functions.php#L312-L324)) excluding term_id `287` — likely a promo/KM category — but `custom_related_products` does not use the fallback, so missing Yoast meta → broken related list. **Needs verification** of whether Yoast meta is populated for all products after Yoast deactivation.
- **Status:** Partial.

---

## BR-15 — Shop / category title reflects current filters

- **Domain:** Shop + product_cat + SEO.
- **Trigger:** Shop/category page with query-string filters.
- **Condition:** Any of `pwb-brand`, `filter_gender`, `min_price`, `max_price`, `paged`, `filter_color` GET params present.
- **Expected behaviour:** Title becomes `{base_title} - {brand name} - Dành cho Nam|Nữ - Giá từ/dưới/trên X đến Y đồng - Trang N - Màu {color}`. Same rule applied in `wpseo_title` (browser tab) and `woocommerce_page_title` (H1).
- **Evidence:** [inc/woo-functions.php:459-581](files/wp-content/themes/bigbike/inc/woo-functions.php#L459-L581)
- **Status:** Implemented.

---

## BR-16 — Shop page canonical is forced to home on search

- **Domain:** SEO.
- **Trigger:** Render of header on search page.
- **Condition:** `is_search()`.
- **Expected behaviour:** Emit `<meta name="canonical" content="https://bigbike.vn/">` in `<head>`.
- **Evidence:** [inc/layout-functions.php:297-303](files/wp-content/themes/bigbike/inc/layout-functions.php#L297-L303)
- **Risk:** Uses `<meta>` instead of `<link rel="canonical">` — engines may ignore.
- **Status:** Partial.

---

## BR-17 — Rel-next / rel-prev disabled on listing pages

- **Domain:** SEO.
- **Trigger:** Any paginated listing.
- **Expected behaviour:** `wpseo_next_rel_link` and `wpseo_prev_rel_link` filters forced to false.
- **Evidence:** [inc/layout-functions.php:305-313](files/wp-content/themes/bigbike/inc/layout-functions.php#L305-L313)
- **Status:** Implemented.

---

## BR-18 — Shipping calculator country / state / city disabled

- **Domain:** Shipping / cart.
- **Expected behaviour:** WC shipping calculator never shows country, state, or city fields (all three filters return false).
- **Evidence:** [inc/woo-functions.php:93-100](files/wp-content/themes/bigbike/inc/woo-functions.php#L93-L100)
- **Status:** Implemented.

---

## BR-19 — Quick Buy shipping fee rule

- **Domain:** Quick Buy order creation.
- **Trigger:** API-07 (`buy_quickly`).
- **Condition:** `active_price >= 2_000_000` VND → free shipping. Else 35,000 VND flat.
- **Side effects:** Shipping item uses method id `flexible_shipping_single:9`, title "Phí vận chuyển".
- **Evidence:** [inc/ajax-functions.php:417-431](files/wp-content/themes/bigbike/inc/ajax-functions.php#L417-L431)
- **Risk:** Threshold is hard-coded. Shipping method id is environment-specific.
- **Status:** Implemented (fragile).

---

## BR-20 — Quick Buy order is set to `processing` immediately

- **Domain:** Quick Buy.
- **Expected behaviour:** `$order->update_status('processing', 'Imported order', true)` runs right after `calculate_totals`, without payment verification.
- **Evidence:** [inc/ajax-functions.php:434-435](files/wp-content/themes/bigbike/inc/ajax-functions.php#L434-L435)
- **Risk:** Payment method is BACS (bank transfer). An order moves to `processing` before the transfer is received — stock is decremented, downstream systems treat it as confirmed. **Security and operational risk.**
- **Status:** Implemented, **high business risk**.

---

## BR-21 — Cart renderings emit GTM ecommerce events

- **Domain:** Analytics.
- **Expected behaviour:**
  - Product detail: `view_item`.
  - Cart page: `view_cart` (only when cart is non-empty).
  - Thank-you: `purchase` (unless order status is `failed`).
- **Evidence:** [content-single-product.php:38-52](files/wp-content/themes/bigbike/woocommerce/content-single-product.php#L38-L52); [cart.php:22-45](files/wp-content/themes/bigbike/woocommerce/cart/cart.php#L22-L45); [thankyou.php:41-51](files/wp-content/themes/bigbike/woocommerce/checkout/thankyou.php#L41-L51)
- **Risk:** No cart `add_to_cart` event is fired — only `view_*`/`purchase`. Funnel analytics missing mid-funnel step.
- **Status:** Partial.

---

## BR-22 — WP native registration is disabled; AJAX register is the only path

- **Domain:** Accounts.
- **Evidence:** `kd_options.users_can_register=0`. AJAX handler `custom_register_user` remains exposed and creates users anyway. WooCommerce-side `woocommerce_enable_myaccount_registration=yes` AND `woocommerce_enable_signup_and_login_from_checkout=yes` — both conflict with `users_can_register=0`.
- **Risk:** Registration policy is ambiguous; WordPress admin may hide WP-native register form, but WC + custom AJAX still allow creation.
- **Status:** **Needs verification** of which paths are actually reachable from the UI.

---

## BR-23 — After successful password reset, redirect to Polylang-aware login page

- **Domain:** Password reset.
- **Trigger:** `woocommerce_customer_reset_password`.
- **Expected behaviour:** WC notice "Your password has been changed successfully! Please login to continue." + redirect to `pll_get_post(7970, current_language)`.
- **Evidence:** [inc/utils-functions.php:443-449](files/wp-content/themes/bigbike/inc/utils-functions.php#L443-L449)
- **Status:** Implemented.

---

## BR-24 — Admin bar hidden; file mods / file edits disabled

- **Domain:** Admin hardening.
- **Expected behaviour:** `show_admin_bar(false)`; `DISALLOW_FILE_MODS=true`; `DISALLOW_FILE_EDIT=true`.
- **Evidence:** [functions.php:138](files/wp-content/themes/bigbike/functions.php#L138); [wp-config.php:5,148](files/wp-config.php#L5)
- **Status:** Implemented.

---

## BR-25 — Featured image fallback

- **Domain:** Shop loop thumbnails.
- **Expected behaviour:** If product has thumbnail, render `<img class=lazy src="/wp-content/themes/bigbike/images/logo-1.png" data-src="{real url}">`. Otherwise `wc_placeholder_img`.
- **Evidence:** [inc/woo-functions.php:443-457](files/wp-content/themes/bigbike/inc/woo-functions.php#L443-L457)
- **Status:** Implemented.

---

## BR-26 — Post thumbnails image width/height attributes stripped

- **Domain:** Content output.
- **Expected behaviour:** `post_thumbnail_html`, `image_send_to_editor` filtered to strip `width`/`height` attributes (via `remove_width_attribute` AND `remove_wps_width_attribute`).
- **Evidence:** [inc/layout-functions.php:261-267](files/wp-content/themes/bigbike/inc/layout-functions.php#L261-L267); [inc/utils-functions.php:355-361](files/wp-content/themes/bigbike/inc/utils-functions.php#L355-L361)
- **Risk:** Registered twice for same filter, one overrides the other. Performance/CLS cost.
- **Status:** Implemented (redundant).

---

## BR-27 — Product image alt / title overridden to product name

- **Domain:** Accessibility + SEO.
- **Expected behaviour:** Any attachment whose parent is a product has its `alt` and `title` rewritten to the product title. `_wp_attachment_image_alt` postmeta virtually returns the product title for every attachment ([functions.php:196-203](files/wp-content/themes/bigbike/functions.php#L196-L203)).
- **Evidence:** [functions.php:174-203](files/wp-content/themes/bigbike/functions.php#L174-L203)
- **Risk:** Overrides any editor-curated alt text.
- **Status:** Implemented.

---

## BR-28 — Shop products per page = 24

- **Domain:** Shop loop.
- **Evidence:** [inc/woo-functions.php:186-193](files/wp-content/themes/bigbike/inc/woo-functions.php#L186-L193) overrides `loop_shop_per_page`.
- **Status:** Implemented.

---

## BR-29 — Related products limit = 4 columns × 1 row

- **Domain:** Single product.
- **Evidence:** [inc/woo-functions.php:27-37](files/wp-content/themes/bigbike/inc/woo-functions.php#L27-L37)
- **Status:** Implemented (but `custom_related_products` uses 8 limit; see BR-14).

---

## BR-30 — WooCommerce default CSS/JS globally deregistered

- **Domain:** Performance.
- **Trigger:** Every front-end page.
- **Expected behaviour:** Dequeue WC layout/general/smallscreen/wc-block styles; deregister `wc-cart-fragments`, `woocommerce`, `wc-add-to-cart`, `js-cookie`.
- **Evidence:** [inc/layout-functions.php:143-167](files/wp-content/themes/bigbike/inc/layout-functions.php#L143-L167)
- **Risk:** Breaks any WC feature that expects these scripts (mini-cart fragments, add-to-cart ajax, variation script).
- **Status:** Implemented.

---

## BR-31 — Search input auto-padded with ` s` for single-word queries

- **Domain:** Search.
- **Evidence:** [functions.php:266-273](files/wp-content/themes/bigbike/functions.php#L266-L273)
- **Risk:** Hack. Needs replacement.
- **Status:** Implemented (to be revisited).

---

## Top 10 rules (ranked by business criticality)

1. BR-20 Quick Buy → `processing` immediately without payment
2. BR-19 Quick Buy free-shipping threshold 2M VND
3. BR-01 Phone = 10 digits
4. BR-02 Phone is user login
5. BR-05 Variation must be resolved before Add to Cart
6. BR-12 VND formatting rule
7. BR-15 Shop title reflects filters
8. BR-14 Related products via Yoast primary cat
9. BR-10 Search covers cat + brand
10. BR-22 Registration policy duplication
