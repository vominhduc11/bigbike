package com.bigbike.bigbike_backend.repository.content;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.AuthorSummary;
import com.bigbike.bigbike_backend.domain.content.ContentCategorySummary;
import com.bigbike.bigbike_backend.domain.content.ContentCategoryWithCount;
import com.bigbike.bigbike_backend.domain.content.Page;
import com.bigbike.bigbike_backend.domain.content.PageType;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;

@Repository
@Profile("mock")
public class InMemoryContentReadRepository implements ContentReadRepository {

    private final List<Article> articles;
    private final List<Page> pages;

    public InMemoryContentReadRepository() {
        ContentCategorySummary ridingGuide = new ContentCategorySummary("content_cat_guide", "huong-dan", "Hướng dẫn");
        ContentCategorySummary news = new ContentCategorySummary("content_cat_news", "tin-tuc", "Tin tức");
        AuthorSummary editor = new AuthorSummary("author_bigbike_editor", "BigBike Team");

        Article article1 = new Article(
                "article_chon_mu_fullface",
                "chon-mu-fullface-phu-hop",
                "Cách Chọn Mũ Fullface Phù Hợp",
                "Hướng dẫn chọn mũ fullface theo nhu cầu sử dụng.",
                "<p>Chọn mũ theo nhu cầu đi phố, touring, track day và form đầu.</p>",
                new ImageAsset(
                        "img_article_fullface",
                        "https://cdn.bigbike.local/articles/chon-mu-fullface.jpg",
                        "Cách chọn mũ fullface",
                        1600,
                        900,
                        "image/jpeg"
                ),
                null,
                editor,
                ridingGuide,
                List.of(ridingGuide),
                List.of("mu-bao-hiem", "huong-dan"),
                PublishStatus.PUBLISHED,
                new SeoMeta(
                        "Cách Chọn Mũ Fullface Phù Hợp",
                        "Hướng dẫn chọn mũ fullface cho biker.",
                        "https://bigbike.vn/tin-tuc/chon-mu-fullface-phu-hop.html",
                        null,
                        false
                ),
                null,
                Instant.parse("2026-04-10T03:00:00Z"),
                Instant.parse("2026-04-09T02:00:00Z"),
                Instant.parse("2026-04-10T03:00:00Z"),
                List.of(),
                null
        );

        Article article2 = new Article(
                "article_xu_huong_gear_2026",
                "xu-huong-do-bao-ho-2026",
                "Xu Hướng Đồ Bảo Hộ 2026",
                "Những xu hướng bảo hộ nổi bật cho biker năm 2026.",
                "<p>Tổng hợp xu hướng về vật liệu, công nghệ và tiêu chuẩn an toàn.</p>",
                new ImageAsset(
                        "img_article_gear_2026",
                        "https://cdn.bigbike.local/articles/xu-huong-gear-2026.jpg",
                        "Xu hướng đồ bảo hộ 2026",
                        1600,
                        900,
                        "image/jpeg"
                ),
                null,
                editor,
                news,
                List.of(news),
                List.of("tin-tuc", "bao-ho"),
                PublishStatus.DRAFT,
                new SeoMeta(
                        "Xu Hướng Đồ Bảo Hộ 2026",
                        "Tin tức và phân tích xu hướng đồ bảo hộ biker 2026.",
                        "https://bigbike.vn/tin-tuc/xu-huong-do-bao-ho-2026.html",
                        null,
                        false
                ),
                null,
                Instant.parse("2026-04-15T03:00:00Z"),
                Instant.parse("2026-04-14T03:00:00Z"),
                Instant.parse("2026-04-15T03:00:00Z"),
                List.of(),
                null
        );

        this.articles = List.of(article1, article2);

        Page pageAbout = new Page(
                "page_gioi_thieu",
                "gioi-thieu",
                "Giới Thiệu BigBike",
                "<p>BigBike là cửa hàng đồ bảo hộ và phụ kiện biker.</p>",
                PageType.ABOUT,
                null,
                PublishStatus.PUBLISHED,
                new SeoMeta(
                        "Giới Thiệu BigBike",
                        "Thông tin về BigBike.",
                        "https://bigbike.vn/gioi-thieu/",
                        null,
                        false
                ),
                null,
                null,
                null,
                null,
                null,
                null,
                Instant.parse("2026-04-01T01:00:00Z"),
                Instant.parse("2026-04-01T01:00:00Z"),
                Instant.parse("2026-04-18T05:00:00Z"),
                null
        );

        Page pageWarranty = new Page(
                "page_chinh_sach_bao_hanh",
                "chinh-sach-bao-hanh",
                "Chính Sách Bảo Hành",
                "<p>Chính sách bảo hành áp dụng theo từng nhóm sản phẩm.</p>",
                PageType.POLICY,
                null,
                PublishStatus.PUBLISHED,
                new SeoMeta(
                        "Chính Sách Bảo Hành",
                        "Chính sách bảo hành tại BigBike.",
                        "https://bigbike.vn/chinh-sach-bao-hanh/",
                        null,
                        false
                ),
                null,
                null,
                null,
                null,
                null,
                null,
                Instant.parse("2026-04-01T01:00:00Z"),
                Instant.parse("2026-04-01T01:00:00Z"),
                Instant.parse("2026-04-18T05:00:00Z"),
                null
        );

        this.pages = List.of(pageAbout, pageWarranty);
    }

    @Override
    public List<Article> findAllArticles() {
        return articles;
    }

    @Override
    public Optional<Article> findArticleBySlug(String slug) {
        return articles.stream().filter(a -> a.slug().equals(slug)).findFirst();
    }

    @Override
    public Optional<Article> findArticleBySlug(String slug, String locale) {
        return findArticleBySlug(slug);
    }

    @Override
    public Optional<Article> findArticleById(String id) {
        return articles.stream().filter(a -> a.id().equals(id)).findFirst();
    }

    @Override
    public Optional<Page> findPageBySlug(String slug) {
        return pages.stream().filter(p -> p.slug().equals(slug)).findFirst();
    }

    @Override
    public Optional<Page> findPageBySlug(String slug, String locale) {
        return findPageBySlug(slug);
    }

    @Override
    public Optional<Page> findPageById(String id) {
        return pages.stream().filter(p -> p.id().equals(id)).findFirst();
    }

    @Override
    public org.springframework.data.domain.Page<Article> listPublishedArticles(
            String categorySlug, String q, Pageable pageable, String locale) {
        List<Article> filtered = articles.stream()
                .filter(a -> a.publishStatus() == PublishStatus.PUBLISHED)
                .filter(a -> matchesCategory(a, categorySlug))
                .filter(a -> matchesArticleQuery(a, q))
                .toList();
        return toSpringPage(filtered, pageable, InMemoryContentReadRepository::articleComparator);
    }

    @Override
    public org.springframework.data.domain.Page<Article> listArticlesAdmin(
            PublishStatus publishStatus, String q, Pageable pageable) {
        List<Article> filtered = articles.stream()
                .filter(a -> publishStatus == null || a.publishStatus() == publishStatus)
                .filter(a -> matchesArticleAdminQuery(a, q))
                .toList();
        return toSpringPage(filtered, pageable, InMemoryContentReadRepository::articleComparator);
    }

    @Override
    public org.springframework.data.domain.Page<Page> listPagesAdmin(
            PublishStatus publishStatus, String q, Pageable pageable) {
        List<Page> filtered = pages.stream()
                .filter(p -> publishStatus == null || p.publishStatus() == publishStatus)
                .filter(p -> matchesPageQuery(p, q))
                .toList();
        return toSpringPage(filtered, pageable, InMemoryContentReadRepository::pageComparator);
    }

    @Override
    public List<Article> findArticlesByFilter(PublishStatus publishStatus, String q) {
        return articles.stream()
                .filter(a -> publishStatus == null || a.publishStatus() == publishStatus)
                .filter(a -> matchesArticleAdminQuery(a, q))
                .toList();
    }

    @Override
    public List<Page> findPagesByFilter(PublishStatus publishStatus, String q) {
        return pages.stream()
                .filter(p -> publishStatus == null || p.publishStatus() == publishStatus)
                .filter(p -> matchesPageQuery(p, q))
                .toList();
    }

    @Override
    public List<ContentCategoryWithCount> listContentCategoriesWithCounts() {
        // Collect every category referenced by any article (primary or many-to-many).
        Map<String, ContentCategorySummary> bySlug = new LinkedHashMap<>();
        for (Article a : articles) {
            if (a.category() != null) {
                bySlug.putIfAbsent(a.category().slug(), a.category());
            }
            if (a.categories() != null) {
                for (ContentCategorySummary c : a.categories()) {
                    if (c != null) bySlug.putIfAbsent(c.slug(), c);
                }
            }
        }
        return bySlug.values().stream()
                .map(c -> new ContentCategoryWithCount(
                        c.id(), c.slug(), c.name(),
                        articles.stream()
                                .filter(a -> a.publishStatus() == PublishStatus.PUBLISHED)
                                .filter(a -> matchesCategory(a, c.slug()))
                                .count()))
                .sorted(Comparator.comparing(ContentCategoryWithCount::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    // --- Filter helpers ---

    private static boolean matchesCategory(Article a, String categorySlug) {
        if (categorySlug == null || categorySlug.isBlank()) return true;
        if (a.category() != null && categorySlug.equals(a.category().slug())) return true;
        return a.categories() != null && a.categories().stream()
                .anyMatch(c -> c != null && categorySlug.equals(c.slug()));
    }

    private static boolean matchesArticleQuery(Article a, String q) {
        if (q == null || q.isBlank()) return true;
        String term = q.toLowerCase(Locale.ROOT);
        return containsLower(a.title(), term) || containsLower(a.excerpt(), term);
    }

    private static boolean matchesArticleAdminQuery(Article a, String q) {
        if (q == null || q.isBlank()) return true;
        String term = q.toLowerCase(Locale.ROOT);
        return containsLower(a.title(), term) || containsLower(a.excerpt(), term) || containsLower(a.slug(), term);
    }

    private static boolean matchesPageQuery(Page p, String q) {
        if (q == null || q.isBlank()) return true;
        String term = q.toLowerCase(Locale.ROOT);
        return containsLower(p.title(), term) || containsLower(p.slug(), term);
    }

    private static boolean containsLower(String s, String termLower) {
        return s != null && s.toLowerCase(Locale.ROOT).contains(termLower);
    }

    // --- Sort helpers ---

    private static Comparator<Article> articleComparator(String field, Sort.Direction dir) {
        Comparator<Article> comp = switch (field) {
            case "title" -> Comparator.comparing(Article::title, String.CASE_INSENSITIVE_ORDER);
            case "createdAt" -> Comparator.comparing(Article::createdAt);
            case "updatedAt" -> Comparator.comparing(Article::updatedAt);
            case "publishedAt" -> Comparator.comparing(
                    a -> a.publishedAt() != null ? a.publishedAt() : a.createdAt());
            default -> Comparator.comparing(a -> a.publishedAt() != null ? a.publishedAt() : a.createdAt());
        };
        return dir == Sort.Direction.ASC ? comp : comp.reversed();
    }

    private static Comparator<Page> pageComparator(String field, Sort.Direction dir) {
        Comparator<Page> comp = switch (field) {
            case "title" -> Comparator.comparing(Page::title, String.CASE_INSENSITIVE_ORDER);
            case "createdAt" -> Comparator.comparing(Page::createdAt);
            case "updatedAt" -> Comparator.comparing(Page::updatedAt);
            default -> Comparator.comparing(Page::updatedAt);
        };
        return dir == Sort.Direction.ASC ? comp : comp.reversed();
    }

    @FunctionalInterface
    private interface ComparatorFactory<T> {
        Comparator<T> make(String field, Sort.Direction dir);
    }

    private static <T> org.springframework.data.domain.Page<T> toSpringPage(
            List<T> all, Pageable pageable, ComparatorFactory<T> factory) {
        List<T> sorted = all;
        if (pageable.getSort().isSorted()) {
            Comparator<T> comp = null;
            for (Sort.Order order : pageable.getSort()) {
                Comparator<T> c = factory.make(order.getProperty(), order.getDirection());
                comp = comp == null ? c : comp.thenComparing(c);
            }
            if (comp != null) {
                sorted = all.stream().sorted(comp).toList();
            }
        }
        int total = sorted.size();
        int offset = (int) pageable.getOffset();
        List<T> content = offset >= total
                ? List.of()
                : sorted.subList(offset, Math.min(offset + pageable.getPageSize(), total));
        return new PageImpl<>(content, pageable, total);
    }
}
