# bigbike-admin

Internal admin dashboard for BigBike operations. Vite 8 + React 19 SPA (JavaScript), runs on port **5173** (local dev) / **4000** (Docker behind nginx).

## Scripts

```bash
npm run dev       # dev server on port 5173
npm run build     # production build
npm run preview   # preview build on port 4173
npm run lint
```

`npm run test` is not defined.

## Routes

| Route | Permission |
|-------|-----------|
| `/admin/products` | `products.read` |
| `/admin/categories` | `catalog.read` |
| `/admin/brands` | `catalog.read` |
| `/admin/content` | `content.read` |
| `/admin/orders` | `orders.read` |
| `/admin/customers` | `customers.read` |
| `/admin/media` | `media.read` |
| `/admin/coupons` | `coupons.read` |
| `/admin/redirects` | `redirects.read / redirects.write` |
| `/admin/menus` | `menus.read` |
| `/admin/sliders` | `sliders.read` |
| `/admin/shipping` | `shipping.read` |
| `/admin/reviews` | `reviews.read` |
| `/admin/admin-users` | `admin-users.read` |
| `/admin/settings` | `settings.read` |

Default landing: `/admin/products`.

## Data Source

The admin runtime uses the real backend API as its only data source. Backend failures surface as screen error states; the client does not fall back to generated data.

```text
VITE_ADMIN_API_BASE=http://localhost:8080/api/v1      # API base
```
