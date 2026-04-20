# BigBike Admin - Phase 4D Foundation

Admin catalog/content CRUD foundation for:

- product list + product detail/edit shell
- category list + category detail/edit shell
- brand list + brand detail/edit shell
- article/page list + detail/edit shell

This phase intentionally does not implement order/checkout/payment flows.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```

`npm run test` is not defined in this package yet.

## Routing

Foundation routes:

- `/admin/products`
- `/admin/products/:id`
- `/admin/categories`
- `/admin/categories/:id`
- `/admin/brands`
- `/admin/brands/:id`
- `/admin/content`
- `/admin/content/:type/:id`

## Data Mode

The admin API client is contract-aware and supports typed mock fallback when backend endpoints are unavailable.

Environment flags:

- `VITE_USE_ADMIN_MOCK=true` forces typed mock mode
- `VITE_ADMIN_ROLE=ADMIN|MANAGER|CONTENT_EDITOR|VIEWER|SUPER_ADMIN` controls mock permission profile
- `VITE_ADMIN_API_BASE=/api/v1` overrides API base path

When mock fallback is active, screens render an explicit read-only banner.
