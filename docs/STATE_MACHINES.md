# STATE_MACHINES.md — bigbike.vn

States + transitions + triggers for each major entity.

> Assumed defaults from WooCommerce core are marked "**[WC default, needs verification]**" when they cannot be independently confirmed from this repository's source.

---

## SM-01 — Product variation selection (client-side UI)

**Owner:** browser (JS `front_app.woocommerce` in `scripts/bigbike.main.js`).

### States
- `NoSelection` — no radio checked.
- `Incomplete` — some attributes checked, not all.
- `Resolving` — attributes chosen and XHR to `find_variation_product` in flight. UI: Add-to-cart button shows "Đang kiểm tra hàng…".
- `Resolved` — `variation_id` returned; add-to-cart + quick-buy enabled; hidden fields populated.
- `Invalid` — handler returned no body (no matching variation). UI remains in disabled state.

### Transitions

| From | Event | To | Guard | Side effect |
|---|---|---|---|---|
| NoSelection / Incomplete | radio click | Incomplete | more attributes to pick | `makeAvailableToBuy()` called; if all attributes chosen → Resolving |
| Incomplete | all attributes chosen | Resolving | count(chosen) == count(attributes) | AJAX sent |
| Resolving | API-08 success | Resolved | `res.data.variation_id` truthy | Update `.js-single-price`, enable add-to-cart + quick-buy, set hidden `variation_id` / `variations` |
| Resolving | API-08 no body | Invalid | — | Buttons remain disabled |
| Any | click "reset variations" | NoSelection | `.js-reset-variations` | Clear radios |

**Evidence:** [bigbike.main.js:162-183](files/wp-content/themes/bigbike/scripts/bigbike.main.js#L162-L183); [bigbike.main.js:443-475](files/wp-content/themes/bigbike/scripts/bigbike.main.js#L443-L475); [bigbike.main.js:510-560](files/wp-content/themes/bigbike/scripts/bigbike.main.js#L510-L560).

---

## SM-02 — Cart item lifecycle (session-scoped)

**Owner:** `WC()->cart` (session in `kd_woocommerce_sessions`).

### States
- `Absent` — not in cart.
- `Added` — `WC()->cart->add_to_cart()` returned a cart_key.
- `QuantityChanged` — same key, updated qty.
- `Removed` — `WC()->cart->remove_cart_item($cart_key)` called.

### Transitions

| From | Event | To | Trigger | Side effect |
|---|---|---|---|---|
| Absent | user adds | Added | API-04 `custom_add_to_cart` or WC default add-to-cart form | Cart session updated; fires `woocommerce_add_to_cart` action |
| Added/QuantityChanged | user sets qty | QuantityChanged | API-06 or WC cart form `update_cart` | `set_quantity(key, qty)` |
| Any | user removes | Removed | API-05 or `?remove_item=key` | `remove_cart_item(key)` |
| Added/QuantityChanged | checkout success | Absent | WC core `woocommerce_checkout_order_created` | Cart emptied |
| Added/QuantityChanged | session expires | Absent | `woocommerce_cleanup_sessions` cron | Row deleted |

Guard: `WC()->cart->add_to_cart` itself enforces stock, purchasable, min/max qty.

**Evidence:** [ajax-functions.php:224-352](files/wp-content/themes/bigbike/inc/ajax-functions.php#L224-L352).

---

## SM-03 — Checkout form state (client)

**Owner:** `form-checkout.php` + WC core checkout JS.

### States
- `Initial` — blank form.
- `Editing` — user typing.
- `Validating` — submit clicked, server validating.
- `Failed` — server returned notices (e.g., phone regex failure).
- `Submitted` — redirect to thank-you page.

Transitions are standard WC; custom additions:
- `phone_custom_checkout_field_process` adds a validation rule (billing_phone must be 10 digits) ([woo-functions.php:69-79](files/wp-content/themes/bigbike/inc/woo-functions.php#L69-L79)).

**T:** Plugin-provided, customised.

---

## SM-04 — WooCommerce order status (global WC enum)

**Owner:** `WC_Order::update_status()`.

### States (WC core)
- `pending` — awaiting payment
- `processing` — payment received, items reserved
- `on-hold` — payment pending (manual gateways)
- `completed` — fulfilled
- `cancelled` — cancelled by customer/admin
- `refunded`
- `failed` — payment failed
- `checkout-draft` **[WC Blocks default, needs verification]**

### Transitions observed in this project

| From | Event | To | Trigger | Evidence |
|---|---|---|---|---|
| (new) | `wc_create_order` | `pending` | WC default | WC core |
| `pending` | payment gateway success | `processing` or `on-hold` | gateway callback | WC core |
| (new, Quick Buy path) | `$order->update_status('processing', 'Imported order', true)` | `processing` | API-07 buy_quickly | [ajax-functions.php:435](files/wp-content/themes/bigbike/inc/ajax-functions.php#L435) |
| `processing` → `completed` | admin marks complete | `completed` | wp-admin action | Plugin-provided |
| any → `cancelled` / `refunded` | admin | — | wp-admin | Plugin-provided |

### Invalid transitions
- `(new) → completed` without going through `processing` or `on-hold` is allowed by WC but unusual; not exercised in source.
- `cancelled → processing` requires admin "Change status to processing" — no source-level prohibition.

### Side effects (WC core)
- `processing`: customer email + admin email; stock decremented (if not already at order creation).
- `completed`: completed email; download permissions.
- `cancelled`: restock items if applicable.
- `refunded`: credit note.

**Status:** Plugin-provided (WC). Only the quick-buy forced transition is custom.

---

## SM-05 — Payment / Shipping state (inferred)

**Owner:** Gateway + shipping method.

### Shipping (Flexible Shipping)

| State | Trigger | Evidence |
|---|---|---|
| `no-shipping-selected` | before cart calculates | — |
| `calculated` | `WC()->cart->calculate_shipping()` using zone rules | WC core |
| `fixed-method-forced` | Quick Buy sets `flexible_shipping_single:9` directly | [ajax-functions.php:424-428](files/wp-content/themes/bigbike/inc/ajax-functions.php#L424-L428) |

### Payment

Default WC states: `not-paid`, `awaiting`, `paid`, `failed`.

- Quick Buy forces method `bacs` → starts as `processing` but functionally "awaiting bank transfer". There is no reconciliation loop in source — admin must manually confirm transfer and move to `completed`.

**Status:** Partial — shipping zones and gateways config not inspected (not present in source; lives in DB options).

---

## SM-06 — User / Account state

### States
- `Guest` — `wp_get_current_user()->ID == 0`.
- `Authenticated` — auth cookie valid.
- `Pending registration` — n/a (registration auto-logs-in).

### Transitions

| From | Event | To | Trigger | Evidence |
|---|---|---|---|---|
| Guest | register | Authenticated | API-01 `custom_register_user` | [ajax-functions.php:94-98](files/wp-content/themes/bigbike/inc/ajax-functions.php#L94-L98) |
| Guest | login success | Authenticated | API-02 `custom_login_user` | [ajax-functions.php:142-146](files/wp-content/themes/bigbike/inc/ajax-functions.php#L142-L146) |
| Guest | WC "Create account at checkout" | Authenticated | WC option `woocommerce_enable_signup_and_login_from_checkout=yes` | `kd_options` |
| Authenticated | logout | Guest | `wp_logout()` via `wp_logout_url` | WP core |
| Authenticated | password reset success | Authenticated→Guest | Notice + redirect to login page; user is NOT auto-authenticated | [utils-functions.php:443-449](files/wp-content/themes/bigbike/inc/utils-functions.php#L443-L449) |
| Guest | Quick Buy (no existing user for that phone email) | Silent user creation (subscriber). **Does not authenticate the browser session.** | [ajax-functions.php:381](files/wp-content/themes/bigbike/inc/ajax-functions.php#L381) |

### Invalid / risky transitions
- API-07 creates users silently without setting auth — the customer who placed the quick-buy order does not become logged-in, but an account with login `<phone>@liveevil.vn` now exists in the DB.

**Status:** Implemented (with the above caveat).

---

## SM-07 — Contact form submission state

**Owner:** Contact Form 7 + contact-form-cfdb7.

### States
- `Draft` — user typing.
- `Validating` — CF7 runs field validators + spam filters (if configured).
- `Sent` — email + DB record.
- `ValidationFailed` — CF7 shows field-level errors.
- `MailFailed` — CF7 reports "There was an error trying to send your message".

**Status:** Plugin-provided.

---

## SM-08 — Product "effective availability" (composite)

Not a WC state — inferred from the theme's two overlapping stock flags.

### Inputs
- `WC product->is_in_stock()` — from `_stock_status` postmeta / WC stock rules.
- `postmeta.product_of_stock` — custom boolean (0 by default).
- Variation `is_in_stock` + `backorders_allowed()`.

### Rule (as applied on variable product):
```
if ( empty(available_variations) OR product_of_stock == 1 ) → "out of stock"
else → show variation radios
```
([variable.php:31-33](files/wp-content/themes/bigbike/woocommerce/single-product/add-to-cart/variable.php#L31-L33))

### Rule (single product "CÒN HÀNG" display):
```
if ( !empty(availability['availability']) OR product_of_stock ) → show WC stock HTML
else → show hard-coded "CÒN HÀNG"
```
([content-single-product.php:92-102](files/wp-content/themes/bigbike/woocommerce/content-single-product.php#L92-L102))

### Risk
- Logic reads "if there IS availability text OR product_of_stock" then show WC html, otherwise assume "still in stock". This means a product with no availability string (common) ALWAYS shows "CÒN HÀNG" even if actually out of stock — unless the `product_of_stock` flag is set.
- `product_of_stock` / `prouduct_of_stock` (typo in `simple.php:25`) — two spellings exist; probably a bug.

**Status:** Partial — documented rule is fragile.

---

## Machines not inspected yet

- SM-09 — Refund state machine (WC core, not exercised by custom code).
- SM-10 — Subscription state (not used — no subscription plugin active).
- SM-11 — Email-delivery state (WC emails — plugin default).
- SM-12 — SEO sitemap generation (RankMath) — not in scope.
