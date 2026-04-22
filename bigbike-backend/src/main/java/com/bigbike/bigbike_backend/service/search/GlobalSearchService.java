package com.bigbike.bigbike_backend.service.search;

import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.repository.content.ContentReadRepository;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Cross-domain search across catalog products and content articles. Mirrors
 * the in-memory filter style of CatalogReadService / ContentReadService —
 * good enough for cutover scale; swap to a Postgres tsvector / dedicated
 * search engine later if result counts grow.
 */
@Service
public class GlobalSearchService {

    private final CatalogReadRepository catalogReadRepository;
    private final ContentReadRepository contentReadRepository;

    public GlobalSearchService(
            CatalogReadRepository catalogReadRepository,
            ContentReadRepository contentReadRepository
    ) {
        this.catalogReadRepository = catalogReadRepository;
        this.contentReadRepository = contentReadRepository;
    }

    public record SearchResults(List<Product> products, List<Article> articles) {}

    public SearchResults search(String q, Set<String> types, int limit) {
        String term = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        if (term.isEmpty()) {
            return new SearchResults(List.of(), List.of());
        }

        boolean wantProducts = types == null || types.isEmpty() || types.contains("product");
        boolean wantArticles = types == null || types.isEmpty() || types.contains("article");

        List<Product> products = wantProducts
                ? catalogReadRepository.findAllProducts().stream()
                        .filter(p -> p.publishStatus() == PublishStatus.PUBLISHED)
                        .filter(p -> matchesProduct(p, term))
                        .limit(limit)
                        .toList()
                : List.of();

        List<Article> articles = wantArticles
                ? contentReadRepository.findAllArticles().stream()
                        .filter(a -> a.publishStatus() == PublishStatus.PUBLISHED)
                        .filter(a -> matchesArticle(a, term))
                        .limit(limit)
                        .toList()
                : List.of();

        return new SearchResults(products, articles);
    }

    private static boolean matchesProduct(Product p, String term) {
        if (containsLower(p.name(), term)) return true;
        if (containsLower(p.shortDescription(), term)) return true;
        return containsLower(p.description(), term);
    }

    private static boolean matchesArticle(Article a, String term) {
        if (containsLower(a.title(), term)) return true;
        if (containsLower(a.excerpt(), term)) return true;
        return containsLower(a.body(), term);
    }

    private static boolean containsLower(String haystack, String needleLower) {
        return haystack != null && haystack.toLowerCase(Locale.ROOT).contains(needleLower);
    }
}
