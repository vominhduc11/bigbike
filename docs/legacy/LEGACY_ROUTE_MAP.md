# Legacy Route Map

Discovery date: 2026-04-20

This document records public legacy WordPress route patterns for the rebuild. It uses route patterns only and does not include customer/order keys or raw redirect rows.

## Source Of Truth

- WordPress permalink option: `/tin-tuc/%postname%.html`
- WooCommerce product base: `/product`
- WooCommerce category base: `danh-muc-san-pham`
- WooCommerce product tag base: `tu-khoa-san-pham`
- Perfect WooCommerce Brands default permalink base from plugin source: `brands`
- Shop page slug from published pages: `san-pham`
- Cart page slug: `gio-hang`
- Checkout page slug: `thanh-toan`
- My account page slug: `tai-khoan`

## Public Page Slugs

Published page slugs observed:

```text
cac-dieu-kien-va-dieu-khoan
cach-do-size-dau
cach-do-size-gang-tay
chinh-sach-bao-hanh
chinh-sach-bao-ve-thong-tin-ca-nhan
chinh-sach-doi-tra-hang
dang-ky
dang-nhap
giam-10-khi-mua-hang-online-html
gio-hang
gioi-thieu
home
home-2
huong-dan
huong-dan-mua-hang
huong-dan-mua-hang-online-html
lien-he
quen-mat-khau
san-pham
tai-khoan
thanh-toan
```

## Primary Route Patterns

| Legacy pattern | Source | New-stack recommendation |
|---|---|---|
| `/` | Front page using homepage template | Preserve. |
| `/{page-slug}/` | WordPress pages | Preserve page slugs unless a redirect is explicitly added. |
| `/san-pham/` | WooCommerce shop page | Preserve. |
| `/product/{product-slug}/` | WooCommerce product base | Preserve during initial rebuild. |
| `/danh-muc-san-pham/{category-slug}/` | WooCommerce product category base | Preserve during initial rebuild. |
| `/tu-khoa-san-pham/{tag-slug}/` | WooCommerce product tag base | Preserve during initial rebuild. |
| `/brands/{brand-slug}/` | Perfect WooCommerce Brands default base | Preserve if verified live; otherwise add explicit redirect after production crawl. |
| `/tin-tuc/{post-slug}.html` | WordPress post permalink | Preserve unless SEO plan approves clean blog slugs. |
| `/category/{category-slug}/` | WordPress category base is empty/default | Preserve or redirect after crawl. |
| `/?s={query}` | WordPress search | Preserve query compatibility, even if new UI also supports `/search?q=`. |
| `/gio-hang/` | WooCommerce cart page | Preserve. |
| `/thanh-toan/` | WooCommerce checkout page | Preserve. |
| `/thanh-toan/order-received/{order-id}/` | WooCommerce thank-you route | Preserve behavior but never log or expose order keys. |
| `/tai-khoan/` | WooCommerce account page | Preserve or redirect to the new account route. |
| `/dang-nhap/` | Custom theme login page | Preserve or redirect to the new login route. |
| `/dang-ky/` | Custom theme register page | Preserve or redirect to the new register route. |
| `/quen-mat-khau/` | Lost password page | Preserve or redirect to the new password reset route. |
| `/lien-he/` | Contact page | Preserve. |

## AJAX And API-Like Legacy Endpoints

These are not SEO pages, but they define frontend behavior that must map to new APIs:

| Legacy endpoint | Action | New-stack responsibility |
|---|---|---|
| `/wp-admin/admin-ajax.php` | `custom_register_user` | Backend auth registration endpoint. |
| `/wp-admin/admin-ajax.php` | `custom_login_user` | Backend auth login endpoint. |
| `/wp-admin/admin-ajax.php` | `update_user_infomation` | Backend profile endpoint. |
| `/wp-admin/admin-ajax.php` | `custom_add_to_cart` | Cart add item endpoint. |
| `/wp-admin/admin-ajax.php` | `remove_item_from_cart` | Cart remove item endpoint. |
| `/wp-admin/admin-ajax.php` | `update_cart_item_quantity` | Cart update quantity endpoint. |
| `/wp-admin/admin-ajax.php` | `buy_quickly` | Quick-buy checkout command. |
| `/wp-admin/admin-ajax.php` | `find_variation_product` | Product variation resolution endpoint. |
| `/wc-auth/v1/{route}` | WooCommerce auth route | Only implement if a legacy integration requires it. |
| `/wc-api/v1/{route}`, `/wc-api/v2/{route}`, `/wc-api/v3/{route}` | WooCommerce legacy REST route | Only implement if a legacy integration requires it. |

## SEO Redirect Data Sources

Legacy redirect data exists but was not copied:

- `kd_rank_math_redirections`: 40 row tuples
- `kd_rank_math_redirections_cache`: 63 row tuples
- `kd_fg_redirect`: 19516 row tuples

Future redirect extraction must be a separate sanitizer pass that emits only route mappings and never emits customer/order/user data.

## Route Change Rule

Any change to a public route, slug format, trailing slash policy, or blog `.html` policy must update `docs/legacy/SEO_REDIRECT_MAP.csv` in the same change.
