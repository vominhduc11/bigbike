---
name: admin-screen
description: "Dùng khi tạo screen mới trong bigbike-admin, ví dụ trang quản lý list/detail mới. Scaffold screen theo convention React, react-query, react-i18next, shadcn và Tailwind của dự án; wire đủ 5 điểm trong App.jsx gồm lazy import, nav group, route parse, permission map và render switch; đồng thời cập nhật cả vi.json và en.json."
---

# admin-screen — Scaffold screen mới cho bigbike-admin

Routing ở admin là **thủ công** trong `App.jsx` — quên 1 trong 5 điểm là screen không chạy hoặc 403. Đây là giá trị chính của skill.

## Bước 0 — Docs-First

Nếu screen động đến API/permission/data shape mới → đọc trước `API_CONTRACT.md`, `PERMISSION_MATRIX.md`, `DATA_CONTRACT.md` (chỉ section liên quan; bảng tra đầy đủ ở `CLAUDE.md` / `AGENTS.md` §3–§4). Permission key phải khớp `PERMISSION_MATRIX.md`.

## Bước 1 — Copy một exemplar đúng loại

- List + Detail: `src/screens/BrandListScreen.jsx` + `src/screens/BrandDetailScreen.jsx` (mẫu sạch, đủ pattern).
- Screen function: `export function XxxScreen({ navigate, canUpdate })` trong `src/screens/XxxScreen.jsx`.

## Bước 2 — Wire vào `src/App.jsx` (ĐỦ 5 ĐIỂM)

```jsx
// 1) Lazy import (cụm import ~đầu file)
const XxxScreen = lazyScreen(() => import('./screens/XxxScreen'), 'XxxScreen')

// 2) NAV_GROUP_DEFS — thêm entry vào group phù hợp
{ path: '/admin/xxx', labelKey: 'nav.xxx', permission: 'xxx.read', icon: SomeLucideIcon }

// 3) parseRoute() — map URL module → screen name
if (module === 'xxx' && !id) return { kind: 'screen', name: 'xxx-list' }
if (module === 'xxx' && id === 'new') return { kind: 'screen', name: 'xxx-create' }
if (module === 'xxx' && id) return { kind: 'screen', name: 'xxx-detail', id }

// 4) routePermission() — map screen → permission key
case 'xxx-list': case 'xxx-detail': return 'xxx.read'

// 5) render switch — instantiate, truyền navigate + canUpdate
case 'xxx-list':
  screen = <XxxScreen navigate={navigate} canUpdate={hasPermission('xxx.update')} />; break
```

## Bước 3 — Data qua react-query + `src/lib/adminApi.js`

```jsx
// List
const state = useAdminList(['xxx', query], () => fetchXxx(query))
// state cho sẵn: status, isFetching, items, pagination, error

// Detail
const { data, isLoading, isError } = useQuery({
  queryKey: ['xxx', id], queryFn: () => fetchXxxDetail(id), enabled: !isCreate,
})

// Mutation (sonner toast + map lỗi validation từ backend)
const save = useMutation({
  mutationFn: (p) => isCreate ? createXxx(p) : updateXxx(id, p),
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['xxx'] }); toast.success(t('xxx.detail.ok')) },
  onError: (e) => { setValidationErrors(mapValidationErrors(e)); toast.error(e.message) },
})
```

Thêm hàm API mới (nếu chưa có) vào `src/lib/adminApi.js` qua `requestJson(...)` — không fetch trực tiếp, không hardcode mock (guard `check:no-admin-runtime-mock` sẽ chặn).

## Bước 4 — i18n: sửa CẢ HAI file locale

Thêm key vào **`src/locales/vi.json`** và **`src/locales/en.json`** (cùng cấu trúc). Trong screen: `const { t } = useTranslation()` → `t('xxx.title')`. Tiếng Việt phải có dấu đầy đủ.

## Bước 5 — Designed states + UI stack

- Mọi state phải có thiết kế: loading / empty / error / success / disabled / permission-denied. Dùng `StatePanel` (loading/empty/error), `ReadOnlyBanner` khi `!canUpdate`, `PaginationControls`, `StatusBadge`, `showConfirm` (`src/lib/confirm`) cho hành động destructive.
- Component dùng chung — **lấy đúng đường dẫn, kiểm tra reuse trước khi tạo mới**:

| Từ `src/components/layout/` (barrel `index.js`) | Từ `src/components/` (import trực tiếp) |
|---|---|
| `Screen`, `ScreenHeader`, `FilterBar`, `MobileCardList`/`MobileCard`, `StickyActionBar`, `FormField`, `Modal`, `Tabs` | `AdminTable`, `StatusBadge`, `PaginationControls`, `PageSizeSelect`, `FilterSelect`, `FilterSearchInput`, `FilterChips`, `BulkActionBar`, `ReadOnlyBanner`, `StatePanel`, `ScreenSkeleton`, `ConfirmDialog`, `ColumnVisibilityToggle`, `ExportButton`, `SectionCard`, `DetailSection`, `SeoCard` |

- shadcn từ `@/components/ui/*` (Button, Input, Checkbox, Textarea…). KHÔNG dùng native `<select>/<button>/<input type=checkbox>`.
- CSS: tái dùng class cấu trúc `bb-*` + layout primitives như các screen xung quanh; **styling mới viết Tailwind token thẳng vào className** (`border-border`, `text-danger`, `bg-muted`). KHÔNG thêm class mới vào `admin-prototype.css`.
- **Font admin:** Inter (body), Oswald (display/KPI/H1), JetBrains Mono (mã/SKU). KHÔNG dùng Exo/Barlow/Bungee, không dùng font của web.
- **Bo góc:** theo token ngữ nghĩa, không hardcode px và **không** `rounded-none` (đó là quy ước của web): card/panel/KPI `--admin-radius-card` (12px), button/input/select/menu `--admin-radius-control` (8px), thumbnail `--admin-radius-thumb` (5px).

## Bước 6 — Đóng gate

Chạy quy trình `hygiene` rồi `preflight` (admin = `npm run lint` + `npm run test` + `npm run build`). Screen mới nên có Vitest bám mẫu `src/screens/BrandListScreen.test.jsx`.
