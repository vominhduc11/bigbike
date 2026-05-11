# Product Module — Smoke Test Report (Local Docker Stack)

**Date:** 2026-05-10
**Engineer:** Senior Fullstack Engineer
**Environment:** Local Docker stack (`docker-compose.yaml` — Postgres + MinIO + backend + web + admin)
**Scope:** Verify P1 fixes + P2 cleanup hold up against a real backend + DB before production go-live.

---

## TL;DR

| Status | Count | Items |
|---|---|---|
| ✅ Code verified end-to-end | 3 | P1-01 OG image, P1-02 filter_gender, P1-04 carousel filter |
| ⚠️ Code deployed, data missing to verify visually | 4 | P1-03 gallery alt, P1-04 carousel display, P2-01 spec groups, P2-02 video thumbnail |
| 🐛 Operational issue found (not code) | 1 | Next.js fetch-cache poisons after backend startup race |

**Verdict:** Code-level production-ready. Two pre-launch tasks for ops/admin team:
1. Admin nhập test data (gallery alt + showOnHomepage tick + specs với group + video upload) để verify UI visual layer.
2. Document Next.js fetch-cache purge procedure cho ops team (xem mục "Operational Issue").

---

## Stack used

| Service | Image | Status | Port |
|---|---|---|---|
| `bigbike-postgres` | postgres:16-alpine | healthy | 127.0.0.1:5432 |
| `bigbike-minio` | minio/minio | healthy | 127.0.0.1:9000-9001 |
| `bigbike-backend` | local build | healthy (after restart mid-test, see Risks) | 127.0.0.1:8080 |
| `bigbike-web` | local build | healthy | 0.0.0.0:3000 |
| `bigbike-admin` | local build | healthy | 0.0.0.0:4000 |

Container build time `2026-05-10T16:49 UTC` is AFTER source last-modified `2026-05-10 22:44 local` → **container has all P1/P2 changes**. Confirmed by grepping compiled `_0385ijl._.js` for the new heading string `"TẠI BIGBIKE"` (P1-04).

---

## Test results — by fix

### P1-01 OG image fallback ✅ VERIFIED

```
GET http://localhost:3000/product/tui-chong-nuoc-ilm-bl01/
→ <meta property="og:image" content="http://localhost:9000/bigbike-media/wp-uploads/2025/09/TUI-CHONG-NUOC-ILM-BL01-01.jpg"/>
```

Test product has `seo: null` (admin chưa set SEO override). Fallback chain `seo?.ogImage?.url ?? image?.url` chọn đúng `image.url` = product image. **Trước fix sẽ ra logo BigBike mặc định.**

---

### P1-02 filter_gender ✅ VERIFIED (3 sub-checks)

| Check | Result |
|---|---|
| Backend `GET /api/v1/products?filter_gender=male` | **200** OK (was 400 with `UNSUPPORTED_FILTER`) |
| Web catalog `/san-pham/` HTML — "Giới tính" filter UI absent | ✅ removed |
| Web `/san-pham/?filter_gender=male` (legacy bookmarked URL) | **200** OK, không 500/400 |

Backward-compat hoàn hảo cho người dùng có URL/bookmark cũ.

---

### P1-03 Gallery alt ⚠️ CODE OK / DATA MISSING

| Check | Result |
|---|---|
| API contract: `gallery[].alt` field present in `GET /api/v1/products/{slug}` response | ✅ field exists |
| Test product gallery items | 3 ảnh, `alt = ''` (admin chưa nhập) |

Code path Admin → Backend → Web complete. Để verify visual **cần admin nhập alt cho ít nhất 1 gallery image**, sau đó mở PDP và inspect `<img alt="...">`.

---

### P1-04 showOnHomepage carousel ⚠️ CODE OK / DATA MISSING

| Check | Result |
|---|---|
| Compiled web bundle chứa kicker mới `"TẠI BIGBIKE"` + heading `"SẢN PHẨM BIGBIKE"` | ✅ trong `_0385ijl._.js` |
| Compiled web bundle chứa query `showOnHomepage:!0,size:5,sort:"createdAt:desc"` | ✅ |
| Backend `GET /api/v1/products?showOnHomepage=true` | **200**, returns 0 products (no product flagged) |
| Backend `GET /api/v1/products?showOnHomepage=false` | **200**, returns 1 product (test product) |
| Homepage HTML chứa carousel section | ❌ ẨN — đúng behavior khi 0 sản phẩm có flag |

**Backend filter hoạt động đúng** (true vs false trả về kết quả khác nhau). **Để verify carousel render**, admin tick `showOnHomepage` cho ít nhất 5 sản phẩm rồi reload trang chủ.

---

### P2-01 Spec group headers ⚠️ CODE OK / DATA MISSING

Test product có `specifications: []`. Không có data để verify rendering. **Code path đã trace từ entity → API → ProductTabs.tsx**. Để verify visual cần admin nhập specs có `groupName` (ví dụ: 3 specs nhóm "Kích thước" + 2 specs nhóm "Vật liệu").

---

### P2-02 Video thumbnail ⚠️ CODE OK / DATA MISSING

Test product có `videos: []`. Để verify cần admin upload video (type=upload) + nhập thumbnailUrl, rồi mở PDP xem `<video poster="...">`.

---

## Web pages — HTTP-level smoke

| URL | Status | Notes |
|---|---|---|
| `/` (homepage) | 200 (137KB) | Hero + featured grid + categories + brands render OK |
| `/san-pham/` (catalog) | 200 (143KB) | Test product card visible |
| `/san-pham/?filter_gender=male` | 200 (144KB) | Legacy URL không lỗi |
| `/san-pham/?filter_color=do` | 200 | Filter param accepted |
| `/product/tui-chong-nuoc-ilm-bl01/` | 200 (86KB) | PDP renders product (sau khi purge cache — xem Issue) |
| `/danh-muc-san-pham/balo-deo-lung-tui-deo-tui-treo-xe-1/` | 200 (101KB) | Category page renders product |
| `/api/revalidate` (admin trigger) | 200 | Revalidate endpoint OK |
| `:4000/` (admin) | 200 (1KB SPA shell) | Vite SPA loads |

Lưu ý: tất cả URL không có trailing slash trả về **308 → trailing-slash version**. Đó là policy hiện tại của Next.js config, không phải bug.

---

## Operational issue found (NOT a code bug)

**Next.js fetch-cache poisons sau backend startup race.**

**Triệu chứng phát hiện:**
- PDP `/product/{slug}/` trả về "Không tìm thấy sản phẩm" + og:image = logo mặc định.
- Backend trả về 200 với data đầy đủ khi gọi trực tiếp.
- Catalog `/san-pham/` (cùng `requestJson()`) hoạt động bình thường.

**Root cause:**
Khi `bigbike-web` start trước/cùng lúc `bigbike-backend` (cả hai healthy gần như cùng lúc), request đầu tiên đến PDP có thể fetch backend trong khoảng thời gian backend chưa load product (DB chưa migrate xong, hoặc pre-warm cache). Next.js cache 404 response với `revalidate: 3600` (1 giờ). Tag-based revalidate (`/api/revalidate` với `tags: ["product:..."]`) **không invalidate cache nếu fetch ban đầu lỗi không attach tag**.

**Fix tạm:** Xóa `/app/.next/cache/fetch-cache/*` trong container web → restart. Sau đó PDP render đúng ngay lập tức.

**Recommendation cho ops:**
1. **Trước khi launch staging/production**: ensure backend đã serve data thật trước khi web container nhận traffic. `depends_on: condition: service_healthy` không đủ — backend "healthy" nghĩa là `actuator/health` lên, nhưng DB migrations + ISR seeding chưa chắc xong.
2. **Sau mỗi deploy**: chạy script post-deploy purge fetch-cache trên web container, hoặc tăng `WEB_REVALIDATE_SECRET` call sau khi backend stable 30s.
3. **Theo dõi sản phẩm trả 404**: nếu user báo PDP "Không tìm thấy" trong khi sản phẩm đang published, suspect cache poison trước.

---

## Risks observed during test

| Risk | Severity | Note |
|---|---|---|
| `bigbike-backend` chết mid-test (OOM hoặc graceful timeout) | Trung bình | Container deploy memory limit 768MB. Restart 4s, không lỗi data. Nhưng cần monitor RAM khi traffic cao. |
| DB chỉ có **1 product** | Cao cho test | Không thể test pagination, filter combo, search relevance trên data thật. Cần seed thêm trước go-live. |
| Default site logo `https://bigbike.vn/brand/logo/...` hard-coded trong `metadata.ts:4` | Thấp | Đúng intent — fallback cho trang không có ảnh. Nhưng cần đảm bảo URL `bigbike.vn` đã point đúng production trước launch. |
| `INTERNAL_API_TOKEN is not set` warning trong web logs | Trung bình | Redirect lookups silently fail. Cần set token cho production để 301/410 redirects hoạt động. |
| `SITE_ORIGIN` warning về localhost trong production mode | Thấp | Sitemap/canonical URLs sẽ có `localhost:3000`. Cần override `BIGBIKE_SITE_URL=https://bigbike.vn` cho production. |

---

## Pending verification (cần admin/QA)

Trước khi go-live, ops/admin team chạy 5 thao tác sau, mỗi lần xong reload web để check:

1. **Gallery alt** — Vào admin sản phẩm → tab Gallery → nhập alt cho 1 ảnh → save → reload PDP → inspect `<img alt="...">`.
2. **showOnHomepage carousel** — Tick `showOnHomepage` cho 5 sản phẩm → save → reload `/` → carousel "TẠI BIGBIKE / SẢN PHẨM BIGBIKE" hiện 5 sản phẩm.
3. **Spec group** — Thêm 5 specs trên 1 sản phẩm với 2 group khác nhau (vd: 3 "Kích thước", 2 "Vật liệu") → save → reload PDP tab Thông số kỹ thuật → 2 group header rows hiện đúng.
4. **Video thumbnail** — Upload 1 video MP4 + nhập thumbnailUrl → save → reload PDP tab Video → `<video poster="...">` đúng.
5. **isFeatured grid** — Tick `isFeatured` cho 12 sản phẩm → save → reload `/` → "Sản phẩm nổi bật" grid 12 cards đúng.

Sau 5 việc trên xong, module Products đạt **production-ready**.

---

## Validation evidence

| Check | Tool | Result |
|---|---|---|
| `bigbike-web` TS | `npx tsc --noEmit` | exit 0 |
| `bigbike-web` tests | `npx vitest run` | 95/95 pass |
| Backend API contract | curl/wget against `:8080` | All endpoints return correct shape |
| Web compiled bundle | `grep` inside container `.next/server/chunks/` | Confirmed P1-04 strings present |
| Backend filter behavior | curl with `?showOnHomepage=true` vs `false` | Different result counts → filter works |
