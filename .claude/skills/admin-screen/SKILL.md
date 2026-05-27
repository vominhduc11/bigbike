---
name: admin-screen
description: Dùng khi tạo một screen mới trong bigbike-admin (ví dụ trang quản lý list/detail mới). Scaffold screen theo đúng convention React + react-query + react-i18next + shadcn/Tailwind của dự án, và wire vào App.jsx tại đủ 5 điểm bắt buộc (lazy import, nav group, route parse, permission map, render switch), kèm cả 2 file locale. Gọi bằng /admin-screen <tên resource>.
---

# /admin-screen — Scaffold screen mới cho bigbike-admin

Routing ở admin là **thủ công** trong `App.jsx` — quên 1 trong 5 điểm là screen không chạy hoặc 403. Đây là giá trị chính của skill.

## Bước 0 — Docs-First

Nếu screen động đến API/permission/data shape mới → chạy `/docs-first <mô tả>` trước (đọc `API_CONTRACT.md`, `PERMISSION_MATRIX.md`, `DATA_CONTRACT.md`). Permission key phải khớp `PERMISSION_MATRIX.md`.

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
- Layout primitives từ `src/components/layout` (import từ `index.js`): `Screen, ScreenHeader, FilterBar/FilterField, SummaryCard/SummaryCardGrid, Tabs, Modal, StickyActionBar, MobileCardList/MobileCard, FormField`. **Kiểm tra reuse trước khi tạo mới.**
- shadcn từ `@/components/ui/*` (Button, Input, Checkbox, Textarea…). KHÔNG dùng native `<select>/<button>/<input type=checkbox>`.
- CSS: tái dùng class cấu trúc `bb-*` + layout primitives như các screen xung quanh; **styling mới viết Tailwind token thẳng vào className** (`border-border`, `text-danger`, `bg-muted`, `rounded-none`). KHÔNG thêm class mới vào `admin-prototype.css`. Font admin: Bungee (display) / Exo (body) — không dùng font web.

## Bước 6 — Đóng gate

Chạy `/preflight` (admin = `npm run lint` + `npm run build`; **không có** `npm run test`).
