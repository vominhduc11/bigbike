# Legacy Order Flow

Discovery date: 2026-04-20

This document summarizes legacy order behavior without copying customer names, emails, phones, addresses, order keys, IPs, user agents, password hashes, session values, or raw order rows.

## Storage Model

Legacy orders are primarily stored as WooCommerce classic order posts:

- `kd_posts.post_type=shop_order`: 1061 rows
- `kd_postmeta`: order totals, payment/shipping/customer metadata, and billing/shipping fields
- `kd_woocommerce_order_items`: line, shipping, tax, and fee items
- `kd_woocommerce_order_itemmeta`: item quantities, product ids, variation ids, tax/total fields, attribute snapshots
- `kd_wc_order_stats`: order analytics/status totals
- `kd_wc_order_product_lookup`: product/order lookup
- `kd_wc_customer_lookup`: customer lookup table

WooCommerce HPOS tables exist but were empty in this dump:

- `kd_wc_orders`
- `kd_wc_orders_meta`
- `kd_wc_order_addresses`

## Order Status Counts

Aggregate status counts from `shop_order` posts:

| Legacy status | Count |
|---|---:|
| `wc-completed` | 597 |
| `wc-pending` | 433 |
| `wc-cancelled` | 26 |
| `wc-on-hold` | 5 |

New-stack order statuses must be defined in `docs/contracts/STATE_MACHINES.md` before implementation. Do not invent mappings silently.

## Cart Flow

Custom AJAX actions:

- `custom_add_to_cart`
- `remove_item_from_cart`
- `update_cart_item_quantity`
- `find_variation_product`

Legacy behavior:

- Adds simple and variation products to WooCommerce cart.
- Returns cart total and cart data to the frontend.
- Updates/removes items by WooCommerce cart key.
- Resolves variation id by selected attributes.

New-stack requirements:

- Backend must validate product availability, variation validity, quantity, price, and stock.
- Frontend totals are display-only and must not be trusted.
- Preserve user-facing cart behavior, but use canonical API response shapes.

## Checkout Flow

WooCommerce checkout customizations:

- Theme removes company, second address line, postcode, country, state, and selected shipping/billing fields.
- Billing phone is validated as a 10 digit numeric value.
- Country defaults/assumptions are Vietnam-oriented.
- Shipping calculator country/state/city fields are disabled.
- Flexible Shipping is active.
- Payment flow references BACS in quick-buy code.

New-stack requirements:

- Define required checkout fields in `docs/contracts/DATA_CONTRACT.md`.
- Preserve order snapshots for product name, image, variation/options, unit price, quantity, customer info, and shipping address.
- Backend must validate phone/address requirements and final totals.
- Never commit legacy billing/shipping/contact values.

## Quick Buy Flow

Legacy `buy_quickly` behavior:

- Accepts name, phone, address, product id, optional variation id, and variation attributes.
- Creates or resolves a WordPress user.
- Creates a WooCommerce order.
- Adds one product or variation.
- Sets shipping address.
- Sets payment method to BACS.
- Adds a shipping item.
- Uses a legacy shipping fee rule: 35000 VND by default, free when product price is at least 2000000 VND.
- Sets order status to processing.
- Redirects to WooCommerce order-received URL.

Sensitive note:

- The order-received URL includes an order key in legacy WooCommerce. Never log, document, commit, or expose real order keys.

New-stack requirements:

- Treat quick-buy as a backend checkout command, not a frontend-only shortcut.
- Reconfirm the shipping fee rule with business owners before implementing.
- Preserve anti-double-submit and validation behavior.
- Do not create customer accounts with synthetic emails unless the business explicitly approves that policy.

## Account And Auth Flow

Legacy custom AJAX actions:

- `custom_register_user`
- `custom_login_user`
- `update_user_infomation`

Observed behavior:

- Registration uses phone as username.
- Email is required.
- Password minimum length is 6.
- Registration creates a `subscriber` user.
- Login accepts username or email.
- Profile update touches display name, gender, date of birth, and password change.
- WooCommerce my-account templates are overridden by the theme.
- Nextend social login files and a social users table exist, but Nextend is not active in the dump option.

New-stack requirements:

- Define auth identity model before implementation: phone login, email login, or both.
- Do not migrate password hashes into the repo.
- Do not commit user profile samples with phone/email/address/date of birth.
- If social login is needed, verify active production behavior first.

## Order Data Contract Notes

Before implementing order import or order APIs, update:

- `docs/contracts/DATA_CONTRACT.md`
- `docs/contracts/API_CONTRACT.md`
- `docs/contracts/STATE_MACHINES.md`
- `docs/business/WORKFLOW.md`

Minimum canonical concepts to define:

- Order status
- Payment status
- Fulfillment status
- Payment method
- Shipping method
- Customer snapshot
- Shipping address snapshot
- Billing/contact fields
- Line item snapshot
- Money as integer VND
- Legacy trace fields internal-only
