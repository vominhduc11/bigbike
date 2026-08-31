package com.bigbike.bigbike_backend.repository.content;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.service.search.StorefrontSearchRules;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
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

    public InMemoryContentReadRepository() {
        Article article1 = new Article(
                "article_chon_mu_fullface",
                "chon-mu-fullface-phu-hop",
                null,                       // slugEn
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
                PublishStatus.PUBLISHED,
                true,                       // featured
                true,                       // homeExperience
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
                null,
                null                       // authorName
        );

        Article article2 = new Article(
                "article_xu_huong_gear_2026",
                "xu-huong-do-bao-ho-2026",
                null,                       // slugEn
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
                PublishStatus.DRAFT,
                false,                      // featured
                false,                      // homeExperience
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
                null,
                null                       // authorName
        );

        this.articles = List.of(article1, article2);
    }

    @Override
    public List<Article> findAllArticles() {
        return articles;
    }

    @Override
    public List<Article> searchPublishedArticles(java.util.List<String> tokens, String locale, int limit) {
        if (tokens == null || tokens.isEmpty() || limit <= 0) {
            return List.of();
        }
        return articles.stream()
                .filter(a -> a.publishStatus() == PublishStatus.PUBLISHED)
                .filter(a -> StorefrontSearchRules.matchesLiteralTerms(
                        java.util.Arrays.asList(a.title(), a.excerpt()), tokens))
                .limit(limit)
                .toList();
    }

    @Override
    public List<ContentReadRepository.ArticleKnowledge> searchPublishedArticleKnowledge(
            java.util.List<String> tokens, String locale, int limit) {
        if ("en".equalsIgnoreCase(locale)) return List.of();
        return articles.stream()
                .filter(article -> article.publishStatus() == PublishStatus.PUBLISHED)
                .filter(article -> tokens == null || tokens.isEmpty() || tokens.stream().allMatch(token -> {
                    String term = token.toLowerCase(Locale.ROOT);
                    return containsLower(article.title(), term)
                            || containsLower(article.excerpt(), term)
                            || containsLower(article.body(), term);
                }))
                .limit(Math.min(3, limit))
                .map(article -> new ContentReadRepository.ArticleKnowledge(
                        article.title(), article.excerpt(), article.body()))
                .toList();
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
    public org.springframework.data.domain.Page<Article> listPublishedArticles(
            String q, Boolean featured, Boolean homeExperience, Pageable pageable, String locale) {
        List<Article> filtered = articles.stream()
                .filter(a -> a.publishStatus() == PublishStatus.PUBLISHED)
                .filter(a -> featured == null || a.featured() == featured)
                .filter(a -> homeExperience == null || a.homeExperience() == homeExperience)
                .filter(a -> matchesArticleQuery(a, q))
                .toList();
        return toSpringPage(filtered, pageable, InMemoryContentReadRepository::articleComparator);
    }

    @Override
    public org.springframework.data.domain.Page<Article> listArticlesAdmin(
            PublishStatus publishStatus, String q, Pageable pageable, String locale) {
        List<Article> filtered = articles.stream()
                .filter(a -> publishStatus == null
                        ? a.publishStatus() != PublishStatus.TRASH
                        : a.publishStatus() == publishStatus)
                .filter(a -> matchesArticleAdminQuery(a, q))
                .toList();
        return toSpringPage(filtered, pageable, InMemoryContentReadRepository::articleComparator);
    }

    @Override
    public List<Article> findArticlesByFilter(PublishStatus publishStatus, String q, String locale) {
        return articles.stream()
                .filter(a -> publishStatus == null
                        ? a.publishStatus() != PublishStatus.TRASH
                        : a.publishStatus() == publishStatus)
                .filter(a -> matchesArticleAdminQuery(a, q))
                .toList();
    }

    // --- Filter helpers ---

    private static boolean matchesArticleQuery(Article a, String q) {
        if (q == null || q.isBlank()) return true;
        return StorefrontSearchRules.matchesLiteralTerms(
                java.util.Arrays.asList(a.title(), a.excerpt()), StorefrontSearchRules.literalTerms(q));
    }

    private static boolean matchesArticleAdminQuery(Article a, String q) {
        if (q == null || q.isBlank()) return true;
        String term = q.toLowerCase(Locale.ROOT);
        return containsLower(a.title(), term) || containsLower(a.excerpt(), term) || containsLower(a.slug(), term);
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
