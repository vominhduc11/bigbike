# Product Module Data Purpose — P2 Cleanup Report

**Date:** 2026-05-10  
**Engineer:** Senior Fullstack Engineer  
**Based on audit:** `docs/audits/PRODUCT_MODULE_DATA_PURPOSE_AUDIT.md`  
**P1 report:** `docs/audits/PRODUCT_MODULE_DATA_PURPOSE_P1_FIX_REPORT.md`

---

## Summary

5 P2 items processed. 2 code changes implemented. 3 items are classification/documentation decisions with no code change.

| Item | Decision | Code changed |
|---|---|---|
| P2-01: spec.group not rendered as group headers | **Implemented** — group headers rendered in ProductTabs | Yes |
| P2-02: thumbnailUrl missing from VideoEditor | **Implemented** — thumbnail URL input added for uploaded videos | Yes |
| P2-03: Dead DB columns | **RESERVE** — classify and document, do not delete without migration | No |
| P2-04: Tags "feature phantom" | **RESERVE** — explicitly reserved, not an accident | No |
| P2-05: Multi-category vs primary category ambiguity | **Option A** — primary-only is current design, M2M reserved for future | No |

---

## Decisions

### P2-01: spec.group — group header rendering

**Decision:** Implement group headers.

**Evidence:**
- `bigbike-backend/.../domain/catalog/ProductSpecification.java` — record has `String group` field
- `bigbike-backend/.../persistence/entity/catalog/ProductSpecificationEntity.java` — `groupName` column exists in DB
- `bigbike-admin/src/screens/ProductDetailScreen.jsx:402-407` — admin loads `groupName: s.group || ''` and sends `groupName: s.groupName.trim() || undefined`
- `bigbike-web/components/catalog/ProductTabs.tsx:93` — specs were keyed by `${spec.group}-${spec.name}` but no visual group headers were rendered

**Fix:** `flatMap` approach: for each spec, if `spec.group` changes from the previous spec, insert a `<tr class="bb-spec-group-header"><th colSpan={2}>` before the spec row. Specs without a group (null/empty) render flat without header.

---

### P2-02: thumbnailUrl — VideoEditor

**Decision:** Implement thumbnail URL input for uploaded videos.

**Evidence:**
- `bigbike-backend/.../api/admin/dto/VideoRequest.java` — `thumbnailUrl` field already exists (`@Size(max = 2048)`)
- `bigbike-web/components/catalog/ProductTabs.tsx:111` — web uses `video.thumbnail` as `<video poster={posterImage?.url}>`
- `bigbike-admin/src/screens/ProductDetailScreen.jsx:397-401` — `buildFormFromItem` was NOT loading `thumbnailUrl`
- `bigbike-admin/src/screens/ProductDetailScreen.jsx:472-479` — `toPayload` was NOT sending `thumbnailUrl`
- `bigbike-admin/src/screens/ProductDetailScreen.jsx:664-803` — `VideoEditor` had NO thumbnail URL input

**Scope:** thumbnail URL input shown only for `type === 'upload'` section (YouTube already auto-generates thumbnails via `img.youtube.com/vi/{ytId}/mqdefault.jpg`).

---

### P2-03: Dead DB columns — Classification

**Decision:** RESERVE (keep columns, document, do NOT delete without DB migration + data audit).

| Column | Entity field | Classification | Rationale |
|---|---|---|---|
| `discount_percent_override` | `discountPercentOverride` (BigDecimal) | RESERVED | No admin UI, no API field in `UpsertProductRequest`, no business rule references. WooCommerce residual. |
| `manage_stock` | `manageStock` (Boolean) | RESERVED | WooCommerce inventory management flag. BigBike uses `stockState` enum instead. No UI, no service logic. |
| `backorders` | `backorders` (String len 16) | RESERVED | WooCommerce backorder policy string. BigBike uses `forceOutOfStock` boolean instead. No UI, no service logic. |
| `weight_kg` | `weightKg` (BigDecimal) | RESERVED | Physical weight for shipping. No admin input, no API exposure, no shipping service using it. Keep — likely needed when shipping fee calculation is implemented. |
| `length_cm` | `lengthCm` (BigDecimal) | RESERVED | Same as weightKg. |
| `width_cm` | `widthCm` (BigDecimal) | RESERVED | Same as weightKg. |
| `height_cm` | `heightCm` (BigDecimal) | RESERVED | Same as weightKg. |

**Action needed before removing:** A DB migration dropping these columns requires a data audit confirming no rows have non-null values for migrated products. `discountPercentOverride`, `manageStock`, and `backorders` are stronger candidates for removal (no planned use) than the dimension columns.

**No code change in this task.** Removal should be a separate task with a Flyway migration.

---

### P2-04: Tags — Feature phantom resolution

**Decision:** RESERVE explicitly.

**Evidence:**
- `bigbike-backend/.../persistence/entity/catalog/ProductTagEntity.java` — full entity: `id`, `slug`, `name`, `products` (ManyToMany back-reference). DB table `product_tag` and join table `product_tag_map` exist.
- No `TagRequest` or tags field in `UpsertProductRequest.java`
- No tag endpoints in `AdminCatalogController.java` or `CatalogController.java`
- No tag field in admin `ProductDetailScreen.jsx` form
- No tag rendering in `bigbike-web/` anywhere

**Resolution:** Tags are **explicitly reserved**, not an accident. The DB infrastructure is in place. When tags are needed (SEO tag pages, product filtering by tag), they require:
1. Tag CRUD endpoints in `AdminCatalogController`
2. `tags: [{ id, slug, name }]` field in `UpsertProductRequest` and admin form
3. Tag filter in `CatalogController` + `CatalogReadService`
4. Tag page in `bigbike-web/app/tags/[slug]/page.tsx`

**No code change in this task.**

---

### P2-05: Multi-category vs primary category

**Decision:** Option A — primary-only is the current designed behavior. Reserve multi-category for future.

**Evidence:**
- `bigbike-backend/.../service/admin/AdminCatalogMutationService.java:769-772`:
  ```java
  entity.setCategory(category);
  if (category != null) {
      entity.setCategories(new LinkedHashSet<>(List.of(category)));
  }
  ```
  On every save, the `categories` M2M set is replaced with exactly `{primaryCategory}`. This is intentional, not a bug.
- `bigbike-backend/.../repository/catalog/JpaCatalogReadRepository.java:179-183` — admin product list filter checks BOTH `primaryMatch` (FK) and `m2mMatch` (M2M join) with `OR`. Future expansion only requires admin UI + DTO change.
- `bigbike-backend/.../service/catalog/CatalogReadService.java:129-135` — public API `matchesCategory` checks `product.categories()` (the set), so it already handles multi-category transparently.
- `UpsertProductRequest.java:36` — only `categoryId: String` (single), no `categoryIds: List<String>`.
- `bigbike-admin/src/screens/ProductDetailScreen.jsx:439` — only `categoryId: form.categoryId.trim()` in `toPayload`.

**Resolution:** The architecture already supports multi-category at the DB and service layer. The admin currently only allows one category per product. This is the intended state. When multi-category support is required, changes are limited to:
1. Admin UI: category multi-select (replace `<select>` with multi-picker)
2. `UpsertProductRequest`: add `categoryIds: List<String>` field
3. `AdminCatalogMutationService`: change `setCategories(List.of(category))` to set from `categoryIds`

**No code change in this task.**

---

## Changes Implemented

### P2-01: ProductTabs.tsx — spec group headers

**File:** [bigbike-web/components/catalog/ProductTabs.tsx](../../bigbike-web/components/catalog/ProductTabs.tsx)

**Change:**
```diff
- {specifications.map((spec) => (
-   <tr key={`${spec.group}-${spec.name}`}>
-     <td>{safeText(spec.name, "Thông tin")}</td>
-     <td>{safeText(spec.value, "Đang cập nhật")}</td>
-   </tr>
- ))}
+ {specifications.flatMap((spec, idx) => {
+   const group = spec.group?.trim() || null;
+   const prevGroup = idx > 0 ? (specifications[idx - 1].group?.trim() || null) : "__none__";
+   const showHeader = group !== null && group !== prevGroup;
+   return [
+     ...(showHeader ? [
+       <tr key={`group-${group}`} className="bb-spec-group-header">
+         <th colSpan={2}>{group}</th>
+       </tr>
+     ] : []),
+     <tr key={`${idx}-${spec.name}`}>
+       <td>{safeText(spec.name, "Thông số")}</td>
+       <td>{safeText(spec.value, "Đang cập nhật")}</td>
+     </tr>,
+   ];
+ })}
```

**Behavior:**
- Specs with no `group` (null/empty): render flat, no header — backward compatible
- Specs with `group`: first occurrence of a group name triggers a header row
- Multiple groups: each group gets its own header
- CSS class `bb-spec-group-header` on the `<tr>` — styling deferred to CSS (no class existed before)

---

### P2-02: ProductDetailScreen.jsx — VideoEditor thumbnailUrl

**File:** [bigbike-admin/src/screens/ProductDetailScreen.jsx](../../bigbike-admin/src/screens/ProductDetailScreen.jsx)

**Change 1 — buildFormFromItem (load):**
```diff
  videos: (item.videos || []).map((v) => ({
    url: v.url || '',
    title: v.title || '',
    type: inferVideoType(v.url || '', v.provider),
+   thumbnailUrl: v.thumbnail?.url || '',
  })),
```

**Change 2 — addItem (new row default):**
```diff
- onChange([...items, { url: '', title: '', type: 'youtube' }])
+ onChange([...items, { url: '', title: '', type: 'youtube', thumbnailUrl: '' }])
```

**Change 3 — VideoEditor UI (upload section only):**
```diff
  {item.url && (
    <video ... />
  )}
+ <input
+   className="control-input"
+   placeholder="Thumbnail URL (tuỳ chọn)"
+   value={item.thumbnailUrl || ''}
+   onChange={(e) => updateItem(index, { thumbnailUrl: e.target.value })}
+   disabled={disabled}
+ />
```
Input is inside the `type === 'upload'` branch — not shown for YouTube videos.

**Change 4 — toPayload (save):**
```diff
  .map((v, i) => ({
    url: v.url.trim(),
    title: v.title.trim() || undefined,
    provider: v.type === 'upload' ? 'upload' : 'youtube',
+   thumbnailUrl: v.thumbnailUrl?.trim() || undefined,
    sortOrder: i,
  }))
```

**Trace:**
- Admin form state: `videos: [{ url, title, type, thumbnailUrl }]`
- Admin payload: `videos: [{ url, title, provider, thumbnailUrl?, sortOrder }]`
- Backend: `VideoRequest.java` already has `thumbnailUrl: String @Size(max=2048)` — no backend change needed
- Web: `ProductTabs.tsx:111` uses `video.thumbnail` as `<video poster={posterImage?.url}>` — already renders when available

---

## Deferred Items

| Item | Reason deferred | Future action |
|---|---|---|
| Dead columns removal (`discountPercentOverride`, `manageStock`, `backorders`) | Requires Flyway migration + data audit | Create separate task: write migration, verify no data loss, update entity |
| Dimension columns (`weightKg`, `lengthCm`, `widthCm`, `heightCm`) | Needed for shipping fee calculation when implemented | Implement when shipping module is built |
| Tags feature | No business requirement currently | Implement as separate feature: Tag CRUD API + admin UI + web tag pages |
| Multi-category admin UI | No business requirement currently | Implement as separate feature: admin multi-select + `categoryIds` in DTO |
| Gallery alt CSS (`.gallery-card-alt-input`) | P1-03 remaining risk | Style in admin CSS file when admin UI is reviewed |

---

## Validation

| Command | Result |
|---|---|
| `cd bigbike-web && npx tsc --noEmit` | Exit 0 — no errors |
| `cd bigbike-web && npx vitest run` | 12 test files, 95/95 tests passed |
| Backend | No backend changes — no backend test run needed |
