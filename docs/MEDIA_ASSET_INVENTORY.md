# MEDIA_ASSET_INVENTORY.md — bigbike.vn

Inventory media + kế hoạch migrate 8GB uploads sang storage mới.

---

## 1. Tổng quan

| Chỉ số | Giá trị |
|---|---|
| Tổng dung lượng `wp-content/uploads/` | **8.0 GB** (theo `du -sh`) |
| Số attachment post | **12,053** (verified count qua regex `,'attachment','',…'` trên `kd_posts`) |
| Khoảng thời gian | 2014 → 2026 (12 năm) |
| Path pattern | `/wp-content/uploads/YYYY/MM/filename.ext` |
| Thumb sizes mặc định WP | thumbnail, medium, medium_large, large, 1536x1536, 2048x2048, full |
| Thumb sizes thêm trong theme | `post-thumbnail` 270×180, `post-thumbnail-reviews` 673×378, `facebook-share` 1200×630 (cropped) |
| Thumb sizes WC core | `woocommerce_thumbnail`, `woocommerce_single`, `woocommerce_gallery_thumbnail` (override 150×150 trong theme) |

---

## 2. Cấu trúc `wp-content/uploads/`

```
wp-content/uploads/
├── 2014/   (sớm nhất có file)
├── 2015/
├── 2016/
├── 2017/
├── 2018/
├── 2019/
├── 2020/
├── 2021/
├── 2022/
├── 2023/
├── 2024/
├── 2025/
├── 2026/                      (mới nhất — snapshot ngày 2026-04-17)
│   ├── 01/, 02/, 03/, 04/
├── ao_ccss/                   (Autoptimize CriticalCSS cache — không migrate)
├── hummingbird-assets/        (Hummingbird cache — không migrate, plugin inactive)
├── rank-math/                 (RankMath content analysis/sitemap cache — không migrate)
├── wc-logs/                   (WooCommerce logs — không migrate)
├── woocommerce_uploads/       (WooCommerce private files; có thể chứa download/invoice — NEEDS_CONFIRMATION)
├── wpallexport/               (WP All Export artifact — không migrate)
├── wpcf7_uploads/             (CF7 file attachments nếu form có upload field — NEEDS_CONFIRMATION)
├── wpcode/                    (WP All Import config — không migrate)
├── fg-magento-to-woocommerce-progress.json   (import artefact)
├── fg-magento-to-woocommerce.logs
├── fgm2wcp-progress.json
├── fgm2wcp.logs
├── pwb-export.json            (Perfect WC Brands export — backup, không cần migrate)
└── woocommerce-placeholder*.png   (WC default placeholders — FE mới có placeholder riêng)
```

---

## 3. Loại media đang dùng

Phân loại theo `post_mime_type` (NEEDS_CONFIRMATION cụ thể — cần query `SELECT post_mime_type, COUNT(*) FROM kd_posts WHERE post_type='attachment' GROUP BY post_mime_type`):

| Loại | Dùng ở đâu |
|---|---|
| `image/jpeg`, `image/png`, `image/webp` | Product main/gallery, featured image blog, slider, category top_image/image_left, brand logo, pa_color swatch, review image |
| `image/gif` | Rare |
| `image/svg+xml` | Icon theme (nếu có) |
| `video/mp4` | (NEEDS_CONFIRMATION có dùng không — CPT `video` chủ yếu nhúng YouTube) |
| `application/pdf` | Có thể có trong `woocommerce_uploads/` (invoice) — NEEDS_CONFIRMATION |

---

## 4. Media theo vùng sử dụng

### 4.1 Ảnh logo / banner / hero

- Logo theme: [files/wp-content/themes/bigbike/images/logo.png](files/wp-content/themes/bigbike/images/logo.png) (tham chiếu trong header.php, quick-buy form).
- Logo fallback: `/wp-content/themes/bigbike/images/logo-1.png` (lazy-load placeholder trong `woocommerce_get_product_thumbnail`).
- Favicon set: `files/wp-content/themes/bigbike/favicon/*` (16×16, 32×32, 57×57...180×180, apple-touch, manifest.json).
- Hero/banner: ACF `top_image`, `image_left` cho shop page + category term.
- Home banner ads: `/wp-content/themes/bigbike/images/banner-ads.jpg`.
- Home video-bg: `/wp-content/themes/bigbike/images/video-bg.jpg`.
- Default category icon: `/wp-content/themes/bigbike/images/Union-2.png`.
- Home default mũ: `/wp-content/themes/bigbike/images/mu-bao-hiem.png`.

### 4.2 Ảnh sản phẩm

- Mỗi product có `_thumbnail_id` (main) + `_product_image_gallery` (danh sách attachment id). Ảnh thực lưu trong `wp-content/uploads/YYYY/MM/`.
- Alt/title bị theme override ở runtime: alt = product_title ([functions.php:174-203](files/wp-content/themes/bigbike/functions.php#L174-L203)).
- Variation image: `WC_Product_Variation->get_image_id()`.
- Swatch `pa_color`: ACF field `image` trên term (attachment id).

### 4.3 Ảnh bài viết

- Featured image qua `_thumbnail_id` trên post.
- Inline image trong `post_content` HTML — phải parse để đổi URL nếu storage đổi.

### 4.4 File download

- `woocommerce_uploads/` có thể chứa file downloadable nếu WooCommerce bật. NEEDS_CONFIRMATION (không phát hiện product dạng downloadable trong code theme; `_downloadable` meta chưa được kiểm tra chéo).

### 4.5 Contact form uploads

- `wpcf7_uploads/` nếu form có trường file upload. NEEDS_CONFIRMATION (form hiện tại chưa được đọc field config).

---

## 5. Bảng inventory tổng hợp

| Asset Type | Old Path/URL | Used In | New Path | Alt Text | Migration Status | Notes |
|---|---|---|---|---|---|---|
| Theme logo | `/wp-content/themes/bigbike/images/logo.png` | header.php, JSON-LD | `/static/logo.png` hoặc CDN | "Bigbike" | Manual | Chép 1 lần sang main-fe `public/` |
| Theme lazy placeholder | `/wp-content/themes/bigbike/images/logo-1.png` | Woo loop thumbnail fallback | `/static/placeholder.png` | — | Manual | Có thể thay bằng low-quality placeholder (LQIP) từ Next.js |
| Favicon set | `/wp-content/themes/bigbike/favicon/*` | header.php | `/static/favicon/*` | — | Manual | |
| Home banner ads | `/wp-content/themes/bigbike/images/banner-ads.jpg` | page-home.php | `/static/home/banner-ads.jpg` hoặc admin-managed media | — | Manual | Hiện hard-code, nên chuyển sang admin-managed |
| Home video bg | `/wp-content/themes/bigbike/images/video-bg.jpg` | page-home.php | `/static/home/video-bg.jpg` | — | Manual | |
| Default category icon | `/wp-content/themes/bigbike/images/Union-2.png` | page-home.php fallback | `/static/category-default.png` | — | Manual | |
| Product images | `/wp-content/uploads/YYYY/MM/*` | single-product, shop loop | `/wp-content/uploads/YYYY/MM/*` (proxy) hoặc S3 `bigbike-media/products/...` | Product title | Bulk | 8GB, script migrate |
| Blog featured images | same path | single.php, archive | same | Post title hoặc alt_text | Bulk | |
| Category top_image / image_left | same path | archive-product.php | same | — | Bulk | |
| Brand logo | `/wp-content/uploads/YYYY/MM/{brand-logo}.*` | home carousel | same hoặc CDN | Brand name | Bulk | |
| CF7 uploads | `/wp-content/uploads/wpcf7_uploads/*` | CF7 form | `/api/contact/files/{id}` hoặc tương đương | — | Conditional | Nếu form có upload field |
| WC private uploads | `/wp-content/uploads/woocommerce_uploads/*` | downloadable products | Protected storage với signed URL | — | Conditional | NEEDS_CONFIRMATION có dùng không |
| WooCommerce placeholders | `/wp-content/uploads/woocommerce-placeholder*.png` | WC default | Main-fe có placeholder riêng | — | Skip | Không migrate |
| Plugin/cache artefacts | `ao_ccss/`, `hummingbird-assets/`, `rank-math/`, `wc-logs/`, `wpallexport/`, `wpcode/`, `fg-*.logs` | — | — | — | Skip | Không migrate |

---

## 6. Chiến lược storage mới

3 tùy chọn, xếp theo đánh giá:

### 6.1 Option A — Giữ path + reverse proxy (khuyến nghị phase 1)

Main-fe không phục vụ `wp-content/uploads/*`. Thay vào đó nginx hoặc Cloudflare có rule:

```nginx
location /wp-content/uploads/ {
    proxy_pass https://legacy-media.bigbike.vn;   # origin nội bộ giữ uploads gốc
    proxy_cache media_cache;
    proxy_cache_valid 200 30d;
}
```

Ưu:
- Không broken link.
- Không cần đổi 21,678 product record.
- Dễ rollback.

Nhược:
- Origin vẫn phải chạy → chi phí host + bảo trì.
- Cần cache aggressive.

### 6.2 Option B — Copy toàn bộ sang S3/MinIO + rewrite URL

1. `rclone sync wp-content/uploads/ s3://bigbike-media/uploads/`.
2. Thêm nginx rule rewrite `/wp-content/uploads/(.+)` → `https://cdn.bigbike.vn/uploads/$1`.
3. Main-fe dùng `next/image` với `remotePatterns: ['cdn.bigbike.vn']`.

Ưu:
- Không phụ thuộc WordPress origin.
- CDN performance.
- Chi phí cố định.

Nhược:
- Đồng bộ delta khi WordPress còn sinh media (trong phase chuyển tiếp).
- Cần có thể gộp tất cả ảnh (kể cả ảnh trong `post_content` HTML).

### 6.3 Option C — Migrate + optimize (khuyến nghị phase 2+)

Như Option B + pipeline:
- Chạy `tinypng` / `cwebp` / Imagify tương đương để sinh WebP/AVIF.
- Upload multi-variant (original + WebP + AVIF).
- `next/image` tự chọn format khi render.

Bulk job: dùng Cloudflare Image Resizing hoặc `@next/image` tại runtime cũng đủ tốt.

### 6.4 Đề xuất

Phase 1: **Option A**. Giữ nguyên path `/wp-content/uploads/`. Không cần sửa URL trong content.

Phase 2: **Option B**. Sync sang S3 + CDN. Đổi hệ thống URL nội bộ, vẫn giữ Nginx rewrite `/wp-content/uploads/*` → CDN để không phá link Google đã index.

Phase 3: **Option C**. Optimize format.

---

## 7. Media → new Media entity

Schema: xem [CONTENT_MODEL.md#36-media](CONTENT_MODEL.md#36--media).

Field quan trọng để migrate:

| Column mới | Nguồn cũ |
|---|---|
| `legacy_id` | `kd_posts.ID` của attachment |
| `file_path` | `kd_postmeta._wp_attached_file` (string relative `YYYY/MM/filename.ext`) |
| `mime_type` | `kd_posts.post_mime_type` |
| `sizes` (JSONB) | Deserialize `kd_postmeta._wp_attachment_metadata['sizes']` |
| `width`, `height`, `filesize` | `_wp_attachment_metadata['width']`, `['height']`, `['filesize']` |
| `alt_text` | `kd_postmeta._wp_attachment_image_alt` |
| `title` | `kd_posts.post_title` |
| `caption` | `kd_posts.post_excerpt` |
| `description` | `kd_posts.post_content` |
| `parent_id` | `kd_posts.post_parent` (nếu là ảnh gắn product thì parent = product_id) |
| `storage_backend` | enum(`wp_uploads`, `s3`, `minio`) |
| `public_url` | tính toán — phase 1 = `/wp-content/uploads/{file_path}`, phase 2 = `https://cdn.bigbike.vn/uploads/{file_path}` |

---

## 8. Alt text rule

Hiện tại:
- Theme rewrite alt/title của attachment thuộc product = `post_title` của parent product ([functions.php:174-203](files/wp-content/themes/bigbike/functions.php#L174-L203)).
- Virtual meta `_wp_attachment_image_alt` trả `get_the_title($object_id)` ([functions.php:196-203](files/wp-content/themes/bigbike/functions.php#L196-L203)).

Khi migrate:
1. Với attachment thuộc product → `alt_text = product.name` (persist vào DB). Bỏ cơ chế runtime override.
2. Với attachment khác → dùng `_wp_attachment_image_alt` thật.
3. Nếu cả 2 rỗng → `alt_text = post_title` hoặc rỗng.

---

## 9. Rủi ro broken image

| # | Rủi ro | Mitigation |
|---|---|---|
| M1 | Ảnh được tham chiếu trong `post_content` HTML với URL tuyệt đối `https://bigbike.vn/wp-content/uploads/...` | Sau khi migrate path, nếu dùng Option A vẫn OK. Nếu Option B, chạy SQL `UPDATE` để replace URL trong content — cẩn thận test trước |
| M2 | Ảnh không có `_wp_attachment_metadata` (import cũ) | Media entity set `sizes=null`, main-fe fallback `next/image` generate on-the-fly |
| M3 | File vật lý mất trên disk (orphan DB record) | Chạy audit script: so sánh danh sách `_wp_attached_file` với listing thực tế của disk |
| M4 | File trên disk không có DB record (orphan file) | Audit ngược: disk → DB. Các file không có entity Media giữ nguyên trong proxy layer |
| M5 | Thumb sizes không được generate cho size theme custom (post-thumbnail-reviews, facebook-share) | Next.js `next/image` tự resize tại runtime; không cần thumb cũ |
| M6 | Media URL trong email hoặc bài viết external (Facebook, Zalo) | Giữ proxy `/wp-content/uploads/*` vĩnh viễn |
| M7 | SVG trực tiếp có thể chứa script | Sanitize SVG khi upload — backend |
| M8 | File tên tiếng Việt có dấu | Check encode URL đúng; recommend rename sang ASCII khi upload mới nhưng KHÔNG rename file cũ |

---

## 10. Migration steps media

1. **Audit**:
   - `SELECT ID, post_mime_type, post_parent FROM kd_posts WHERE post_type='attachment';`
   - `SELECT post_id, meta_value FROM kd_postmeta WHERE meta_key='_wp_attached_file';`
   - `find wp-content/uploads -type f > uploads_filesystem.txt`
   - Diff DB vs filesystem → list orphan.

2. **Extract**:
   - Export Media entity rows → CSV.
   - Upload filesystem sang S3 giữ path (nếu chọn Option B).

3. **Link**:
   - Update Product, BlogPost, Page, Brand, Category records để trỏ `featured_image_id` / `gallery_media_ids` sang new Media.id.
   - `content_html` HTML: Nếu Option A → không đổi. Nếu Option B → batch replace URL.

4. **Verify**:
   - Crawl Screaming Frog giới hạn `wp-content/uploads/*`, báo cáo 404.
   - Spot-check top 100 product detail page.

5. **Sunset**:
   - Sau khi verify, WordPress origin vẫn chạy phase 1. Phase 3 (sunset): disable `wp-admin/upload-new-media`, tất cả upload mới qua admin-fe.

---

## 11. Chưa verify (NEEDS_CONFIRMATION)

1. Quy mô `woocommerce_uploads/` (có file downloadable thật không).
2. Quy mô `wpcf7_uploads/`.
3. Tỷ lệ orphan (DB record không có file, hoặc ngược lại).
4. Có dùng video MP4 trực tiếp trong `uploads/` không, hay toàn YouTube embed.
5. `_wp_attachment_metadata` đủ tin cậy để bỏ qua generate lại thumb không.
6. Tỷ lệ SVG trong uploads.
7. CF7 form có trường file upload không.
