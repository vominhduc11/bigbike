HISTORICAL_REPORT_ONLY - Not canonical. Validate against current code and canonical docs.

# Content / Blog / Page Module Audit

> **Audit date**: 2026-05-06  
> **Auditor**: Senior Software Architect + QA Lead (Claude Sonnet 4.6)  
> **Method**: Direct code inspection — không dùng docs để kết luận. Mọi nhận định đều có dẫn chứng file + line cụ thể.

---

## Executive Summary

| | |
|---|---|
| **Trạng thái** | NOT READY |
| **Mức sẵn sàng production** | **38 / 100** |

**Kết luận ngắn gọn**: Module Content/Blog/Page có kiến trúc API đúng hướng và validation cơ bản đủ dùng, nhưng tồn tại 3 lỗi kiến trúc P0 là showstopper: (1) full table scan + N+1 query trên mọi list request, (2) không có test nào active cho module, (3) AdminContentItem không trả `tags`/`author`/`category` khiến admin FE không thể hiển thị metadata của article. Ngoài ra còn nhiều P1 nghiêm trọng về UX admin, SEO canonical, và mobile không hỗ trợ pages.

---

## Scope Checked

### Backend files

| File | Loại |
|---|---|
| `bigbike-backend/src/main/java/.../api/content/ContentController.java` | Public controller |
| `bigbike-backend/src/main/java/.../api/admin/AdminContentController.java` | Admin controller |
| `bigbike-backend/src/main/java/.../service/content/ContentReadService.java` | Public read service |
| `bigbike-backend/src/main/java/.../service/admin/AdminContentReadService.java` | Admin read service |
| `bigbike-backend/src/main/java/.../service/admin/AdminContentMutationService.java` | Mutation service |
| `bigbike-backend/src/main/java/.../service/auth/DevAdminAuthService.java` | Auth service |
| `bigbike-backend/src/main/java/.../domain/content/Article.java` | Domain record |
| `bigbike-backend/src/main/java/.../domain/content/Page.java` | Domain record |
| `bigbike-backend/src/main/java/.../domain/content/AdminContentItem.java` | Admin DTO record |
| `bigbike-backend/src/main/java/.../persistence/entity/content/ArticleEntity.java` | JPA entity |
| `bigbike-backend/src/main/java/.../persistence/entity/content/PageEntity.java` | JPA entity |
| `bigbike-backend/src/main/java/.../persistence/entity/content/ContentCategoryEntity.java` | JPA entity |
| `bigbike-backend/src/main/java/.../persistence/entity/content/ContentAuthorEntity.java` | JPA entity |
| `bigbike-backend/src/main/java/.../persistence/entity/content/BlogTagEntity.java` | JPA entity |
| `bigbike-backend/src/main/java/.../repository/content/ContentReadRepository.java` | Interface |
| `bigbike-backend/src/main/java/.../repository/content/JpaContentReadRepository.java` | JPA impl |
| `bigbike-backend/src/main/java/.../repository/content/InMemoryContentReadRepository.java` | Mock impl |
| `bigbike-backend/src/main/java/.../persistence/repository/content/ArticleJpaRepository.java` | Spring Data repo |
| `bigbike-backend/src/main/java/.../persistence/repository/content/PageJpaRepository.java` | Spring Data repo |
| `bigbike-backend/src/main/java/.../persistence/repository/content/BlogTagJpaRepository.java` | Spring Data repo |
| `bigbike-backend/src/main/resources/db/migration/V1__create_catalog_content_tables.sql` | Migration |
| `bigbike-backend/src/main/resources/db/migration/V15__normalize_wp_relations_and_attributes.sql` | Migration |
| `bigbike-backend/src/main/resources/db/migration/V21__seed_static_pages.sql` | Migration |
| `bigbike-backend/src/main/resources/db/migration/V32__add_article_product_image_and_home_exp_settings.sql` | Migration |
| `bigbike-backend/src/test/java/.../api/PublicReadApiTest.java` | Test |
| `bigbike-backend/src/test/java/.../api/AdminMutationApiTest.java` | Test |
| `bigbike-backend/src/test/java/.../api/AdminReadApiTest.java` | Test |

### Admin Frontend files

| File | Loại |
|---|---|
| `bigbike-admin/src/screens/ContentListScreen.jsx` | List screen |
| `bigbike-admin/src/screens/ContentDetailScreen.jsx` | Create/edit screen |

### Web Frontend files

| File | Loại |
|---|---|
| `bigbike-web/app/tin-tuc/page.tsx` | Article list route |
| `bigbike-web/app/tin-tuc/[slug]/page.tsx` | Article detail route |
| `bigbike-web/app/[slug]/page.tsx` | Static page catch-all |
| `bigbike-web/app/chinh-sach/[slug]/page.tsx` | Policy page route |
| `bigbike-web/app/huong-dan-mua-hang/page.tsx` | Static help page |
| `bigbike-web/app/lien-he/page.tsx` | Static contact page |
| `bigbike-web/app/gioi-thieu/page.tsx` | Static about page |

### Mobile files

| File | Loại |
|---|---|
| `bigbike_mobile/lib/core/models/article.dart` | Article model |
| `bigbike_mobile/lib/features/articles/article_list_screen.dart` | Article list |
| `bigbike_mobile/lib/features/articles/article_detail_screen.dart` | Article detail |
| `bigbike_mobile/lib/features/home/widgets/article_row.dart` | Home widget |

---

## Route Matrix

| Layer | Route / Screen | File | Status | Ghi chú |
|---|---|---|---|---|
| Backend | `GET /api/v1/articles` | `ContentController.java:36` | ✅ Hoạt động | Full scan P0 |
| Backend | `GET /api/v1/articles/{slug}` | `ContentController.java:48` | ✅ Hoạt động | Slug-based lookup OK |
| Backend | `GET /api/v1/pages/{slug}` | `ContentController.java:57` | ✅ Hoạt động | Slug-based lookup OK |
| Backend | `GET /api/v1/admin/content` | `AdminContentController.java:56` | ✅ Hoạt động | Full scan P0 |
| Backend | `GET /api/v1/admin/content/{type}/{id}` | `AdminContentController.java:84` | ✅ Hoạt động | — |
| Backend | `POST /api/v1/admin/content/articles` | `AdminContentController.java:94` | ✅ Hoạt động | Mock profile throws |
| Backend | `PATCH /api/v1/admin/content/articles/{id}` | `AdminContentController.java:103` | ⚠️ Partial | Không clear productImage/tags/seo |
| Backend | `POST /api/v1/admin/content/pages` | `AdminContentController.java:113` | ✅ Hoạt động | Mock profile throws |
| Backend | `PATCH /api/v1/admin/content/pages/{id}` | `AdminContentController.java:122` | ⚠️ Partial | Không clear seo đầy đủ |
| Backend | `DELETE /api/v1/admin/content/{type}/{id}` | `AdminContentController.java:132` | ✅ Soft delete | ARCHIVED |
| Admin FE | Content list | `ContentListScreen.jsx` | ✅ Hoạt động | — |
| Admin FE | Article create | `ContentDetailScreen.jsx` | ⚠️ Partial | Không có author/category fields |
| Admin FE | Article edit | `ContentDetailScreen.jsx` | ⚠️ Partial | Không thấy tags hiện tại, không clear productImage |
| Admin FE | Page create | `ContentDetailScreen.jsx` | ⚠️ Partial | Không có parentId field |
| Admin FE | Page edit | `ContentDetailScreen.jsx` | ⚠️ Partial | pageType read-only sau create |
| Web | `/tin-tuc` | `app/tin-tuc/page.tsx` | ✅ Hoạt động | noIndex khi filter ✓ |
| Web | `/tin-tuc/[slug]` | `app/tin-tuc/[slug]/page.tsx` | ✅ Hoạt động | HTML sanitized ✓ |
| Web | `/[slug]` (static page) | `app/[slug]/page.tsx` | ✅ Hoạt động | HTML sanitized ✓ |
| Web | `/chinh-sach/[slug]` | `app/chinh-sach/[slug]/page.tsx` | ⚠️ Broken | Canonical URL trong DB dùng short slug nhưng DB slug là dài |
| Mobile | Article list | `article_list_screen.dart` | ✅ Hoạt động | — |
| Mobile | Article detail | `article_detail_screen.dart` | ✅ Hoạt động | `body` field map đúng |
| Mobile | Page (policy/help) | _không tồn tại_ | ❌ Missing | Không có page detail screen |

---

## API Matrix

| Endpoint | Method | Permission | Request | Response | Validation | Status |
|---|---|---|---|---|---|---|
| `/api/v1/articles` | GET | None | `page`(1-999), `size`(1-100), `sort`, `category`(slug), `q`(max 100) | `ApiListResponse<Article>` | ✅ Jakarta Bean Validation | ⚠️ Full scan |
| `/api/v1/articles/{slug}` | GET | None | path `slug` regex | `ApiDataResponse<Article>` | ✅ Slug regex | ✅ OK |
| `/api/v1/pages/{slug}` | GET | None | path `slug` regex | `ApiDataResponse<Page>` | ✅ Slug regex | ✅ OK |
| `/api/v1/admin/content` | GET | `content.read` | `page`, `size`/`pageSize`, `sort`, `q`/`search`, `type`, `publishStatus` | `ApiListResponse<AdminContentItem>` | ✅ | ⚠️ Full scan |
| `/api/v1/admin/content/{type}/{id}` | GET | `content.read` | path `type`(article\|page), `id` regex | `ApiDataResponse<AdminContentItem>` | ✅ | ✅ OK |
| `/api/v1/admin/content/articles` | POST | `content.update` | `UpsertArticleRequest` | `ApiDataResponse<AdminContentItem>` | ✅ bean + biz | ✅ OK |
| `/api/v1/admin/content/articles/{id}` | PATCH | `content.update` | partial `UpsertArticleRequest` | `ApiDataResponse<AdminContentItem>` | ✅ | ⚠️ Cannot clear productImage, tags, seo |
| `/api/v1/admin/content/pages` | POST | `content.update` | `UpsertPageRequest` | `ApiDataResponse<AdminContentItem>` | ✅ | ✅ OK |
| `/api/v1/admin/content/pages/{id}` | PATCH | `content.update` | partial `UpsertPageRequest` | `ApiDataResponse<AdminContentItem>` | ✅ | ⚠️ Cannot clear seo |
| `/api/v1/admin/content/{type}/{id}` | DELETE | `content.update` | path `type`, `id` | `ApiDataResponse<AdminContentItem>` | ✅ | ✅ Soft delete |

---

## Feature Matrix

| Feature | Backend | Admin FE | Web FE | Mobile | DB | Test | Status |
|---|---|---|---|---|---|---|---|
| Article list public | ✅ | N/A | ✅ | ✅ | ✅ | ❌ disabled | ⚠️ |
| Article detail public | ✅ | N/A | ✅ | ✅ | ✅ | ❌ disabled | ⚠️ |
| Page detail public | ✅ | N/A | ✅ | ❌ | ✅ | ❌ disabled | ❌ |
| Article search/filter | ✅ | ✅ | ✅ | ❌ | ⚠️ no index | ❌ | ⚠️ |
| Article sort | ✅ | ✅ | ✅ | ❌ | ⚠️ no index | ❌ | ⚠️ |
| Article pagination | ✅ | ✅ | ✅ | ✅ | N/A | ❌ | ✅ |
| Admin article create | ✅ | ⚠️ missing author/cat | N/A | N/A | ✅ | ❌ | ⚠️ |
| Admin article edit | ✅ | ⚠️ cannot see/clear tags | N/A | N/A | ✅ | ❌ | ⚠️ |
| Admin page create | ✅ | ⚠️ missing parentId | N/A | N/A | ✅ | ❌ | ⚠️ |
| Admin page edit | ✅ | ⚠️ pageType locked | N/A | N/A | ✅ | ❌ | ⚠️ |
| Admin content delete (archive) | ✅ | ✅ | N/A | N/A | ✅ | ❌ | ✅ |
| Tags manage | ✅ backend | ⚠️ invisible in form | ⚠️ show-only | ✅ | ✅ | ❌ | ⚠️ |
| Author assign | ✅ backend | ❌ no UI field | ✅ show | ✅ | ✅ | ❌ | ⚠️ |
| Category assign | ✅ backend | ❌ no UI field | ✅ show | ✅ | ✅ | ❌ | ⚠️ |
| SEO metadata | ✅ | ✅ | ✅ | N/A | ✅ | ❌ | ✅ |
| JSON-LD article | N/A | N/A | ✅ | N/A | N/A | ❌ | ✅ |
| HTML sanitization | ❌ backend | N/A | ✅ | ✅ via `flutter_widget_from_html` | N/A | ❌ | ⚠️ |
| Article static generation | N/A | N/A | ⚠️ top 100 only | N/A | N/A | ❌ | ⚠️ |
| Sitemap | ❌ | ❌ | ❌ | N/A | N/A | N/A | ❌ |
| RSS | ❌ | ❌ | ❌ | N/A | N/A | N/A | ❌ |
| Web revalidation on mutation | ✅ | N/A | ✅ tags | N/A | N/A | ✅ (WebRevalidationServiceTest) | ✅ |
| Page hierarchy | ✅ backend | ❌ no UI | ✅ not used | N/A | ✅ | ❌ | ⚠️ |
| Permission guard admin | ✅ | ✅ canUpdate | N/A | N/A | N/A | ⚠️ partial | ✅ |

---

## Permission Matrix

### Được xác nhận qua code

| Role | `content.read` | `content.update` | Public Articles | Public Pages |
|---|---|---|---|---|
| ADMIN | ✅ (via `AdminRolePermissions.MAP`) | ✅ | ✅ không cần auth | ✅ không cần auth |
| Viewer / Staff | Phụ thuộc `AdminRolePermissions.MAP` | Phụ thuộc | ✅ | ✅ |
| Unauthenticated | ❌ admin blocked | ❌ admin blocked | ✅ | ✅ |

**Ghi chú permission guard**: `AdminContentController` dùng `devAdminAuthService.requirePermission(request, "content.read")` tại mỗi GET endpoint và `"content.update"` tại mỗi mutation. Khi có JWT `AdminPrincipal` trong SecurityContext (production path), permission được check từ `AdminRolePermissions.MAP`. Khi không có JWT (dev/mock profile), header `X-Admin-Permissions` được dùng thay thế — **không bao giờ bypass được nếu prod profile active**.

**Rủi ro permission**: `DevAdminAuthService.ensureDevMockProfile()` ném `AuthNotImplementedException` nếu profile `prod` active nhưng không có JWT principal. Vì Spring Security JWT filter chưa được tìm thấy trong codebase, trong môi trường production thật sự toàn bộ admin API sẽ bị block trừ khi JWT infrastructure được setup.

---

## Validation Matrix

| Field | Rule | Backend (DTO) | Backend (Service) | Admin FE | Status |
|---|---|---|---|---|---|
| `slug` | `^[a-z0-9]+(?:-[a-z0-9]+)*$` | ✅ `@Pattern` | ✅ duplicate check | ✅ Zod regex | ✅ |
| `title` | required, max 255 | ✅ | ✅ | ✅ | ✅ |
| `body` | required | ✅ | ✅ | ✅ | ✅ |
| `excerpt` | max 5000 | ✅ `@Size` | — | ✅ | ✅ |
| `publishStatus` | required on create; enum DRAFT/PUBLISHED/HIDDEN/ARCHIVED | ✅ | ✅ | ✅ | ✅ |
| `pageType` | required on create; enum ABOUT/CONTACT/POLICY/HELP/CUSTOM | ✅ | ✅ | ⚠️ text input, no dropdown | ⚠️ |
| `authorId` | optional, existence check | ✅ | ✅ | ❌ no UI field | ❌ |
| `categoryId` | optional, existence check | ✅ | ✅ | ❌ no UI field | ❌ |
| `parentId` | optional, existence + no self-ref | ✅ | ✅ no cycle check | ❌ no UI field | ⚠️ |
| `tags` | list of strings | ✅ | ✅ auto-create | ⚠️ cannot clear | ⚠️ |
| `coverImage.url` | optional; `^(?:https?://|/).*` | ✅ `@Pattern` | ✅ | ✅ ImageUrlInput | ✅ |
| `productImage.url` | optional; same pattern | ✅ | ✅ | ⚠️ cannot clear | ⚠️ |
| `seo.canonicalUrl` | optional, max 2048 | ✅ `@Size` | — | ✅ | ✅ |
| `seo.ogImage.url` | optional; same URL pattern | ✅ | — | ✅ | ✅ |
| `seo.noIndex` | optional boolean | ✅ | — | ✅ | ✅ |
| HTML body sanitize | backend? | ❌ raw text stored | ❌ no sanitize | N/A | ⚠️ trust frontend |
| Slug duplicate | unique constraint + service check | ✅ DB unique + service check | ✅ | ✅ server error shown | ✅ |
| Tag slug normalization | lowercase, `[^a-z0-9]+→-` | — | ✅ `toSlug()` in mutation service | — | ✅ |

---

## DB Behavior

### Schema confirmed (từ V1, V15, V32 migrations)

**Table `articles`**:
```sql
slug VARCHAR(200) NOT NULL UNIQUE          -- idx_articles_slug ✓
publish_status VARCHAR(32) NOT NULL        -- ❌ NO INDEX
category_id VARCHAR(64)                    -- FK, ❌ NO INDEX
published_at TIMESTAMP WITH TIME ZONE      -- ❌ NO INDEX
author_id VARCHAR(64)                      -- FK, ❌ NO INDEX
product_image_url TEXT                     -- added V32, nullable ✓
```

**Table `pages`**:
```sql
slug VARCHAR(200) NOT NULL UNIQUE          -- idx_pages_slug ✓
publish_status VARCHAR(32) NOT NULL        -- ❌ NO INDEX
parent_id VARCHAR(64)                      -- FK to pages(id), ❌ NO INDEX
```

**Table `article_category_map`**:
```sql
PRIMARY KEY (article_id, category_id)      -- covers article_id lookup
category_id                                -- ❌ NO INDEX on inverse FK
```

**Table `article_tag_map`**:
```sql
PRIMARY KEY (article_id, tag_id)           -- covers article_id lookup
tag_id                                     -- ❌ NO INDEX on inverse FK
```

**Soft delete behavior**: `DELETE` endpoint → `publishStatus = ARCHIVED`. Không có hard delete. Articles/pages ARCHIVED vẫn tồn tại trong DB nhưng không trả về public API (chỉ trả `PUBLISHED`).

**Legacy table `article_tags`**: Tạo ở V1 (denormalized `tag VARCHAR(120)`), còn tồn tại sau V15. V15 migrate sang `blog_tags` + `article_tag_map`. `AdminContentMutationService` chỉ dùng `article_tag_map`, không write vào `article_tags`. Table cũ là dead schema nhưng chưa bị drop.

**Category dual structure**: `ArticleEntity` có cả:
- `category_id` (ManyToOne FK direct)
- `categories` (ManyToMany via `article_category_map`)

`JpaContentReadRepository.toCategorySummaries()` ưu tiên `categories` nếu không rỗng. `AdminContentMutationService.applyArticlePatch()` khi PATCH chỉ update `entity.setCategory()`, **không update `entity.setCategories()`** → `article_category_map` stale sau update qua admin.

**Page canonical URL mismatch**: V21 seed canonical URLs như `https://bigbike.vn/chinh-sach/bao-mat/` cho trang có slug `chinh-sach-bao-ve-thong-tin-ca-nhan`. Web route `/chinh-sach/[slug]` với `slug="bao-mat"` gọi `getPageBySlug("bao-mat")` → 404. Canonical URL trong SEO metadata trỏ đến URL dead.

**`publishedAt` behavior**: Được set khi transition → `PUBLISHED`. Được clear khi transition → non-PUBLISHED. Logic đúng tại `AdminContentMutationService.java:327-333`.

---

## Test Coverage

### Tests đã có

| Test file | Bao gồm content? | Active? |
|---|---|---|
| `PublicReadApiTest.java` | `shouldReturnArticleAndPageBySlug()` | ❌ `@Disabled` — "Requires V1000 catalog seed" |
| `AdminReadApiTest.java` | Chỉ có products | ❌ không có content |
| `AdminMutationApiTest.java` | Import `ArticleJpaRepository`, `PageJpaRepository` nhưng không test content | ❌ không có content tests |
| `WebRevalidationServiceTest.java` | Test web revalidation gọi đúng | ✅ Active |
| `AdminAuthSecurityTest.java` | Test auth headers | ✅ Active |
| `Phase1BSchemaTest.java` | Schema migration | ✅ Active nhưng không check content tables |

### Tests còn thiếu (toàn bộ)

**Backend — bắt buộc cho production**:
- `ContentPublicApiTest` — `GET /api/v1/articles` pagination, filter, sort, category, noResult
- `ContentPublicApiTest` — `GET /api/v1/articles/{slug}` found/notfound/invalid-slug
- `ContentPublicApiTest` — `GET /api/v1/pages/{slug}` found/notfound
- `ContentPublicApiTest` — chỉ trả PUBLISHED, không trả DRAFT/HIDDEN/ARCHIVED
- `AdminContentCrudApiTest` — create article, edit article, delete article (soft)
- `AdminContentCrudApiTest` — create page, edit page, delete page
- `AdminContentCrudApiTest` — permission denied khi thiếu `content.read`/`content.update`
- `AdminContentCrudApiTest` — validation error khi thiếu required fields
- `AdminContentCrudApiTest` — duplicate slug rejected
- `AdminContentCrudApiTest` — clear productImage/tags/seo via PATCH
- `AdminContentCrudApiTest` — `AdminContentItem` response có đủ fields

**Web Frontend — bắt buộc**:
- Article list render với pagination
- Article detail SEO metadata (title, canonical, noIndex, og:image)
- Article detail JSON-LD
- Page detail sanitize HTML
- noIndex khi filter active
- 404 cho slug invalid/notfound

**Mobile**:
- Article model parse `body` → `content`
- HtmlWidget render với XSS payload (regression test)

### Kết luận coverage

**0 active integration test** cho content module. `WebRevalidationServiceTest` là test duy nhất gián tiếp liên quan. Không thể kết luận module production-ready khi không có test nào chạy.

---

## Findings

### P0 — Must Fix Before Production

---

#### CONTENT-P0-001 — Full Table Scan + N+1 Queries trên mọi article list request

**Severity**: P0  
**Files**: 
- `bigbike-backend/src/main/java/.../repository/content/JpaContentReadRepository.java:39-41`
- `bigbike-backend/src/main/java/.../service/content/ContentReadService.java:41-48`
- `bigbike-backend/src/main/java/.../service/admin/AdminContentReadService.java:52-54`
- `bigbike-backend/src/main/java/.../persistence/entity/content/ArticleEntity.java:56-80`

**Hiện trạng**:

`JpaContentReadRepository.findAllArticles()`:
```java
public List<Article> findAllArticles() {
    return articleJpaRepository.findAll().stream().map(this::toDomain).toList();
    //                          ^^^^^^^^^ loads ENTIRE articles table
}
```

`ContentReadService.listArticles()`:
```java
List<Article> result = contentReadRepository.findAllArticles().stream()
    .filter(article -> article.publishStatus() == PublishStatus.PUBLISHED)
    .filter(article -> matchesCategory(article, category))
    .filter(article -> matchesQuery(article, q))
    .sorted(articleComparator(sortSpec))
    .toList();
// Pagination applied AFTER in-memory filter
```

`AdminContentReadService.listContent()`:
```java
Stream.concat(
    contentReadRepository.findAllArticles().stream()...,
    contentReadRepository.findAllPages().stream()...
)
.filter(...).sorted(...).toList();
```

`ArticleEntity` có 4 `FetchType.LAZY` associations (author, category, categories, tags). Mỗi lần `toDomain()` access chúng là 1 query. Với N articles = 4N+1 queries.

**Rủi ro**: Với 500 articles mỗi có 5KB body: ~2.5MB load vào heap + 2001 DB queries mỗi list request. Với 1000 articles: ~5MB heap + 4001 queries. OOM và timeout tại production load.

**Đề xuất sửa**:
1. Thêm Spring Data `Pageable` + JPQL query với `WHERE publish_status = 'PUBLISHED'` trực tiếp tại DB layer
2. Dùng `@EntityGraph` hoặc `JOIN FETCH` để resolve author/category/categories/tags trong một query
3. Refactor `ContentReadRepository` interface: thay `findAllArticles()` bằng `findPublishedArticles(Pageable, String category, String q)`
4. `AdminContentReadService` cần riêng `findAllAdminContent(Pageable, type, status, q)` với UNION query hoặc separate pagination per type

**Test cần thêm**: Integration test khẳng định list endpoint không load toàn bộ DB (mock Pageable, check query count)

---

#### CONTENT-P0-002 — Missing DB Indexes cho publish_status, published_at, category_id

**Severity**: P0  
**Files**: 
- `bigbike-backend/src/main/resources/db/migration/V1__create_catalog_content_tables.sql`
- `bigbike-backend/src/main/resources/db/migration/V15__normalize_wp_relations_and_attributes.sql`

**Hiện trạng**: Chỉ có `idx_articles_slug` và `idx_pages_slug`. Không có index nào trên:
- `articles.publish_status` — mọi public read phải full scan để lọc PUBLISHED
- `articles.published_at` — sort theo ngày cần index
- `articles.category_id` — filter theo category cần index
- `article_category_map.category_id` — inverse FK không có index
- `article_tag_map.tag_id` — inverse FK không có index
- `pages.publish_status` — full scan để lọc PUBLISHED pages

**Rủi ro**: Với P0-001 đã có (full scan rồi), indexes sẽ critical khi refactor sang DB-level query. Nếu không có index sau refactor, query `WHERE publish_status = 'PUBLISHED' ORDER BY published_at DESC` sẽ vẫn full scan.

**Đề xuất sửa**: Thêm migration mới:
```sql
CREATE INDEX idx_articles_publish_status ON articles(publish_status);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_category_id ON articles(category_id);
CREATE INDEX idx_article_category_map_category_id ON article_category_map(category_id);
CREATE INDEX idx_article_tag_map_tag_id ON article_tag_map(tag_id);
CREATE INDEX idx_pages_publish_status ON pages(publish_status);
```

---

#### CONTENT-P0-003 — AdminContentItem thiếu tags/author/category — Admin FE không hiển thị được

**Severity**: P0  
**Files**:
- `bigbike-backend/src/main/java/.../domain/content/AdminContentItem.java:1-23`
- `bigbike-backend/src/main/java/.../service/admin/AdminContentReadService.java:78-93`
- `bigbike-admin/src/screens/ContentDetailScreen.jsx:49-71`

**Hiện trạng**:

`AdminContentItem` record:
```java
public record AdminContentItem(
    String id, String type, String slug, String title,
    String excerpt, String body, ImageAsset coverImage, ImageAsset productImage,
    PublishStatus publishStatus, SeoMeta seo,
    Instant publishedAt, Instant createdAt, Instant updatedAt
    // ❌ MISSING: tags, author, category, categories, pageType, parentId
)
```

`AdminContentReadService.fromArticle()` build `AdminContentItem` không có `tags`, `author`, `category`.

Admin FE `buildFormFromItem()`:
```js
tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
// item.tags === undefined → form.tags = ''
```

Khi admin edit một article đã có tags: form hiển thị tags rỗng. Nếu save ngay, `payload.tags` không được gửi (empty array) → backend `applyArticlePatch()` không update tags (vì `request.getTags() == null`) → tags được preserve. **Tuy nhiên**: nếu admin vô tình type tags mới và save, toàn bộ tags cũ bị overwrite mà không biết.

Worse: admin không thể thấy article hiện đang có author nào, category nào. Không có field hiển thị.

**Rủi ro**: (1) Data integrity — admin cắt mất tags mà không hay biết; (2) UX broken — tất cả article metadata không visible trong edit form.

**Đề xuất sửa**:
1. Thêm `List<String> tags`, `AuthorSummary author`, `ContentCategorySummary category`, `List<ContentCategorySummary> categories`, `PageType pageType` vào `AdminContentItem`
2. Update `fromArticle()` và `fromPage()` trong `AdminContentReadService`
3. Update admin FE `buildFormFromItem()` và `toPayload()` để handle author/category selects (cần thêm admin endpoints để fetch danh sách authors/categories)

**Test cần thêm**: `AdminContentCrudApiTest` verify response có `tags`, `author`, `category` fields.

---

#### CONTENT-P0-004 — Không có active backend test nào cho Content module

**Severity**: P0  
**Files**: 
- `bigbike-backend/src/test/java/.../api/PublicReadApiTest.java:109-117`

**Hiện trạng**:
```java
@Test
@Disabled("Requires V1000 catalog seed (disabled) — data not available in H2 test context")
void shouldReturnArticleAndPageBySlug() throws Exception {
    // ...
}
```

Đây là test duy nhất liên quan content, và nó `@Disabled`. Không có test nào cho:
- Public article list API (filter, sort, pagination, only PUBLISHED)
- Public article detail 404
- Public page detail
- Admin create/update/delete article
- Admin create/update/delete page
- Permission enforcement
- Validation errors

**Rủi ro**: Mọi bug regression về permission, validation, data contract sẽ không được phát hiện tự động.

**Đề xuất sửa**: Tạo `ContentPublicApiTest` và `AdminContentCrudApiTest` sử dụng H2 + seed data trong test-seed.sql. Không dùng V1000 seed — tạo seed riêng cho content tests trong `src/test/resources/db/content-test-seed.sql`.

---

### P1 — Should Fix

---

#### CONTENT-P1-001 — Admin FE không có fields cho author và category

**Severity**: P1  
**File**: `bigbike-admin/src/screens/ContentDetailScreen.jsx:82-125`

**Hiện trạng**: `toPayload()` không include `authorId` hay `categoryId`. Form không có input nào cho hai field này. Article tạo qua admin UI luôn có `author = null` và `category = null`.

**Rủi ro**: Toàn bộ content được tạo/sửa qua admin sẽ không có author và category. Web FE hiển thị tác giả và danh mục trống. Ảnh hưởng UX và SEO (breadcrumb danh mục).

**Đề xuất sửa**: Thêm `GET /api/v1/admin/content/authors` và `GET /api/v1/admin/content/categories` endpoints. Render dropdown `<select>` trong form cho `authorId` và `categoryId`. Update `toPayload()` để include.

---

#### CONTENT-P1-002 — Admin FE không thể xóa productImage qua PATCH

**Severity**: P1  
**Files**:
- `bigbike-admin/src/screens/ContentDetailScreen.jsx:95-99`
- `bigbike-backend/src/main/java/.../service/admin/AdminContentMutationService.java:342-345`

**Hiện trạng**:

Admin FE `toPayload()`:
```js
if (form.productImageUrl.trim()) {
    payload.productImage = { url: form.productImageUrl.trim(), ... }
}
// Nếu URL blank: payload.productImage không được set → undefined
```

Backend `applyArticlePatch()`:
```java
if (request.getProductImage() != null) {
    applyProductImage(entity, request.getProductImage());
} else if (create) {
    clearProductImage(entity);
}
// PATCH với productImage null → không làm gì → existing URL preserved
```

**Rủi ro**: Sau khi set product image, admin không thể xóa nó.

**Đề xuất sửa**: Trong `toPayload()`: khi `form.productImageUrl` blank, gửi `payload.productImage = { url: '' }` (tương tự coverImage). Backend khi nhận `ImageAssetRequest` với URL rỗng → `trimToNull('')` → null → `clearProductImage()`.

---

#### CONTENT-P1-003 — Admin FE không thể xóa tất cả tags qua PATCH

**Severity**: P1  
**Files**:
- `bigbike-admin/src/screens/ContentDetailScreen.jsx:98-99`
- `bigbike-backend/src/main/java/.../service/admin/AdminContentMutationService.java:361-363`

**Hiện trạng**:

Admin FE:
```js
const tags = normalizeTagsInput(form.tags)  // split by comma
if (tags.length > 0) payload.tags = tags
// Nếu form.tags = '' → tags = [] → payload.tags không được set
```

Backend:
```java
if (create || request.getTags() != null) {
    entity.setTags(resolveTags(request.getTags()));
}
// PATCH với tags = null → không update → existing tags preserved
```

**Rủi ro**: Admin không thể clear tất cả tags. Phải nhập ít nhất 1 tag giả để "ghi đè".

**Đề xuất sửa**: Gửi `payload.tags = []` (empty array) khi form tags rỗng. Backend nhận `List<String>` rỗng → `resolveTags([])` returns empty list → tags cleared.

---

#### CONTENT-P1-004 — Admin FE không thể clear toàn bộ SEO khi seoNoIndex = false

**Severity**: P1  
**File**: `bigbike-admin/src/screens/ContentDetailScreen.jsx:106-122`

**Hiện trạng**:
```js
if (form.seoTitle.trim() || form.seoDescription.trim() || 
    form.seoCanonicalUrl.trim() || form.seoOgImageUrl.trim() || form.seoNoIndex) {
    payload.seo = { ... }
}
// Nếu tất cả fields blank và noIndex = false → payload.seo không được gửi
// Backend không nhận seo block → existing SEO preserved
```

**Rủi ro**: Không thể clear hoàn toàn SEO data của article/page qua admin.

**Đề xuất sửa**: Luôn gửi `payload.seo = { ... }` trong PATCH. Nếu tất cả fields rỗng, gửi `payload.seo = null` để backend biết cần xóa. Backend `applyArticlePatch()` cần handle `seo = null` as explicit clear signal (distinct từ `seo` field not present).

---

#### CONTENT-P1-005 — article_category_map không được sync khi PATCH category

**Severity**: P1  
**Files**:
- `bigbike-backend/src/main/java/.../service/admin/AdminContentMutationService.java:348-360`
- `bigbike-backend/src/main/java/.../repository/content/JpaContentReadRepository.java:150-170`

**Hiện trạng**:

`applyArticlePatch()` khi update:
```java
if (create || request.getCategoryId() != null) {
    entity.setCategory(category);   // updates articles.category_id ✓
    if (create) {
        // only on create:
        entity.setCategories(categories);   // updates article_category_map
    }
    // PATCH: entity.setCategories() NOT called → article_category_map stale
}
```

`JpaContentReadRepository.toCategorySummaries()`:
```java
if (entity.getCategories() == null || entity.getCategories().isEmpty()) {
    ContentCategorySummary primary = toCategorySummary(entity.getCategory());
    return primary == null ? List.of() : List.of(primary);
}
return entity.getCategories().stream()...  // prefers article_category_map if non-empty
```

Sau PATCH: `category_id` updated nhưng `article_category_map` still có old category → public API trả `categories` theo mapping cũ.

**Rủi ro**: Data inconsistency giữa `article.category` (updated) và `article.categories` (stale) sau admin edit. Article list filter theo category slug có thể bỏ sót article mới được assign category.

**Đề xuất sửa**: Trong `applyArticlePatch()` khi PATCH với `categoryId != null`:
```java
entity.setCategory(category);
List<ContentCategoryEntity> newCategories = new ArrayList<>();
if (category != null) newCategories.add(category);
entity.setCategories(newCategories);   // sync article_category_map
```

---

#### CONTENT-P1-006 — Canonical URL trong V21 seed không khớp web route

**Severity**: P1  
**Files**:
- `bigbike-backend/src/main/resources/db/migration/V21__seed_static_pages.sql:31,68,93`
- `bigbike-web/app/[slug]/page.tsx:37-42`

**Hiện trạng**:

V21 seed page slug `chinh-sach-bao-ve-thong-tin-ca-nhan` với:
```sql
seo_canonical_url = 'https://bigbike.vn/chinh-sach/bao-mat/'
```

Web FE render metadata:
```tsx
canonicalPath: page.seo?.canonicalUrl ?? toPagePath(page.slug),
```

Kết quả: `<link rel="canonical" href="https://bigbike.vn/chinh-sach/bao-mat/" />`

Nhưng URL `https://bigbike.vn/chinh-sach/bao-mat/` → route `/chinh-sach/[slug]` với `slug = "bao-mat"` → `getPageBySlug("bao-mat")` → 404 (DB không có slug `bao-mat`).

Trang thực tế accessible tại `https://bigbike.vn/chinh-sach-bao-ve-thong-tin-ca-nhan` (via `/[slug]`).

**Rủi ro**: Search engine crawl canonical URL → 404. Google deindex. Đây là critical SEO regression.

**Đề xuất sửa** (chọn 1 trong 2):
- Option A: Xóa `seo_canonical_url` khỏi V21 seed → web FE dùng `toPagePath(page.slug)` tự build canonical đúng. Thêm migration V40 xóa các canonical_url đó.
- Option B: Đổi DB slug thành `bao-mat`, `doi-tra`, `dieu-khoan`, `mua-hang`, `size-mu`, `size-gang-tay`, `lien-he`. Nhưng cần update tất cả routes tương ứng.

---

#### CONTENT-P1-007 — Không có Sitemap.xml và RSS feed

**Severity**: P1  
**File**: `bigbike-web/app/` (directory — không có sitemap.ts hoặc rss.xml)

**Hiện trạng**: Không tìm thấy `sitemap.ts`, `sitemap.xml`, `rss.ts`, `feed.xml` trong web frontend. Articles và pages là main SEO content của BigBike nhưng không có sitemap để search engine discover.

**Rủi ro**: Search engine crawl chậm, bỏ sót articles. Đặc biệt nghiêm trọng với Vietnamese market (gg.com.vn Googlebot).

**Đề xuất sửa**: Tạo `bigbike-web/app/sitemap.ts` (Next.js static sitemap generation):
```ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const articles = await listArticles({ page: 1, size: 1000, sort: 'publishedAt:desc' })
    return articles.data.map(a => ({
        url: toCanonicalUrl(toArticlePath(a.slug)),
        lastModified: a.updatedAt,
    }))
}
```

---

#### CONTENT-P1-008 — Mobile không hỗ trợ Page (policy/help/contact)

**Severity**: P1  
**File**: `bigbike_mobile/lib/features/` (directory)

**Hiện trạng**: Mobile chỉ có `article_list_screen.dart` và `article_detail_screen.dart`. Không có screen nào gọi `GET /api/v1/pages/{slug}`. Pages (chính sách đổi trả, bảo mật, hướng dẫn mua hàng, liên hệ) không accessible từ app.

**Rủi ro**: Người dùng không thể đọc chính sách quan trọng trong app. Có thể vi phạm yêu cầu pháp lý (privacy policy phải accessible trong app store listing).

**Đề xuất sửa**: Tạo `content_page_screen.dart` gọi `GET /api/v1/pages/{slug}`, render `HtmlWidget(page.body)`. Route từ menu/account screen tới các slug cố định.

---

#### CONTENT-P1-009 — Admin FE không có parentId field cho Page hierarchy

**Severity**: P1  
**File**: `bigbike-admin/src/screens/ContentDetailScreen.jsx`

**Hiện trạng**: Form page không có field cho `parentId`. Backend hỗ trợ page hierarchy qua `parent_id` FK trong DB và `resolveParentPage()` trong mutation service. Nhưng admin không thể set hoặc clear parent page qua UI.

**Rủi ro**: Page hierarchy feature unusable. Pages có parent relationship chỉ có thể tạo/sửa qua API trực tiếp.

---

#### CONTENT-P1-010 — Không có admin CRUD cho Authors và Categories

**Severity**: P1  
**Files**: Không có `AdminContentAuthorsController.java` hay `AdminContentCategoriesController.java`

**Hiện trạng**: `content_authors` và `content_categories` tables chỉ được populate qua DB migration/seed. Không có API hay UI để:
- Tạo tác giả mới
- Sửa tên tác giả
- Tạo danh mục bài viết mới
- Sửa slug/tên danh mục

**Rủi ro**: Admin phải chạy SQL trực tiếp để thêm authors/categories. Không scalable.

---

### P2 — Nice To Have

---

#### CONTENT-P2-001 — generateStaticParams chỉ pre-render 100 articles

**Severity**: P2  
**File**: `bigbike-web/app/tin-tuc/[slug]/page.tsx:22-25`

**Hiện trạng**:
```tsx
const result = await listArticles({ page: 1, size: 100, sort: "publishedAt:desc" });
```

Articles ngoài top 100 không được pre-render lúc build. Chúng render on-demand với ISR (revalidate 3600s). Acceptable nhưng không tối ưu cho SEO của bài cũ.

**Đề xuất sửa**: Tăng `size` lên 500 hoặc implement pagination trong `generateStaticParams` nếu cần.

---

#### CONTENT-P2-002 — Indirect circular reference trong page hierarchy không bị chặn

**Severity**: P2  
**File**: `bigbike-backend/src/main/java/.../service/admin/AdminContentMutationService.java:436-450`

**Hiện trạng**: `resolveParentPage()` chỉ check `currentPageId === parentId` (direct self-reference). Indirect cycle (A→B→C→A) không bị phát hiện.

**Đề xuất sửa**: Traverse up parent chain trước khi set, reject nếu gặp `currentPageId` trong chain.

---

#### CONTENT-P2-003 — Không sanitize HTML tại backend

**Severity**: P2  
**File**: `bigbike-backend/src/main/java/.../service/admin/AdminContentMutationService.java`

**Hiện trạng**: `body` HTML được store as-is vào DB. Web FE sanitize trước `dangerouslySetInnerHTML`. Mobile dùng `HtmlWidget` từ `flutter_widget_from_html` (stripping dangerous elements by default). Vẫn là defense-in-depth thiếu layer backend.

**Đề xuất sửa**: Thêm `jsoup.clean(body, Safelist.relaxed())` trong `applyArticlePatch()` trước khi set body. Tránh XSS từ API clients không phải admin FE.

---

#### CONTENT-P2-004 — category filter chip trên web dùng in-page data thay vì dedicated API

**Severity**: P2  
**File**: `bigbike-web/app/tin-tuc/page.tsx:34-48`

**Hiện trạng**: `collectArticleCategories()` build danh sách category chips từ articles đang hiển thị trên trang hiện tại, không phải toàn bộ categories. Nếu không có article PUBLISHED trong page 1 thuộc category X, chip X không hiện.

**Đề xuất sửa**: Thêm `GET /api/v1/content-categories` public endpoint, web FE fetch riêng.

---

#### CONTENT-P2-005 — Không có pageType dropdown trong admin form

**Severity**: P2  
**File**: `bigbike-admin/src/screens/ContentDetailScreen.jsx:387-400`

**Hiện trạng**:
```jsx
<input
    className="control-input"
    value={form.pageType}
    disabled={isReadOnly || !isCreate}
/>
```

`pageType` là free-text input khi create, locked sau create. Nên dùng `<select>` với các option ABOUT/CONTACT/POLICY/HELP/CUSTOM để tránh typo.

---

## Final Verdict

| Layer | Ready? | Lý do |
|---|---|---|
| **Backend** | ❌ NOT READY | P0-001 full scan, P0-002 missing indexes, P0-003 AdminContentItem thiếu fields |
| **Admin FE** | ❌ NOT READY | P1-001 no author/category UI, P1-002/003/004 cannot clear fields, P1-009 no parentId |
| **Web SEO** | ⚠️ PARTIAL | HTML sanitize ✓, metadata ✓, noIndex ✓, JSON-LD ✓ — nhưng P1-006 canonical broken, P1-007 no sitemap |
| **Mobile** | ⚠️ PARTIAL | Article list/detail ✓ — nhưng P1-008 no page detail |
| **DB** | ⚠️ PARTIAL | Schema đúng — nhưng P0-002 missing indexes, P1-005 category map stale, P1-006 canonical mismatch |
| **Test Coverage** | ❌ NOT READY | 0 active test cho content. Không thể release |
| **AI agent implement tiếp** | ⚠️ Có thể — sau khi fix P0 | P0-001 cần refactor service + repo. P0-003 cần extend AdminContentItem. Sau đó P1 có thể implement theo thứ tự |

---

## Implementation Plan

### Phase 1 — Fix P0 (prerequisite for production)

1. **CONTENT-P0-002** — Thêm DB migration cho indexes trước (V41): nhanh, không break anything
2. **CONTENT-P0-003** — Extend `AdminContentItem` record + update `fromArticle()`/`fromPage()` + update admin FE `buildFormFromItem()` (data contract fix)
3. **CONTENT-P0-001** — Refactor `ContentReadRepository` interface, `JpaContentReadRepository`, `ContentReadService`, `AdminContentReadService` sang DB-level pagination + JOIN FETCH. Đây là task lớn nhất.
4. **CONTENT-P0-004** — Viết `ContentPublicApiTest` + `AdminContentCrudApiTest` sau khi refactor xong

### Phase 2 — Fix P1 (required for QA sign-off)

5. **CONTENT-P1-006** — Fix canonical URLs trong V21 (migration V41 or V42 UPDATE)
6. **CONTENT-P1-005** — Fix `article_category_map` sync trong `applyArticlePatch()`
7. **CONTENT-P1-002** + **CONTENT-P1-003** + **CONTENT-P1-004** — Fix clear fields trong admin FE `toPayload()`
8. **CONTENT-P1-001** + **CONTENT-P1-010** — Thêm admin Authors/Categories endpoints + admin FE dropdowns
9. **CONTENT-P1-009** — Thêm parentId field trong admin FE
10. **CONTENT-P1-007** — Thêm sitemap.ts vào web frontend
11. **CONTENT-P1-008** — Thêm page detail screen trong mobile

### Phase 3 — Fix P2 (polish)

12. **CONTENT-P2-001** — Tăng generateStaticParams limit
13. **CONTENT-P2-002** — Circular reference check cho page hierarchy
14. **CONTENT-P2-003** — Backend HTML sanitization với Jsoup
15. **CONTENT-P2-004** — Dedicated categories API cho web filter chips
16. **CONTENT-P2-005** — pageType dropdown trong admin form
