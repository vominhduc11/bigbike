package com.bigbike.bigbike_backend.service.search;

import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.repository.content.ContentReadRepository;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadSupport;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Cross-domain storefront typeahead using the customer search rules. */
@Service
@RequiredArgsConstructor
public class GlobalSearchService {

    private final CatalogReadRepository catalogReadRepository;
    private final ContentReadRepository contentReadRepository;

    public record SearchResults(List<Product> products, List<Article> articles) {}

    // The 3-arg overload (default "vi") was removed with GET /api/v1/search (AUD-066);
    // search-suggest always passes an explicit lang.
    public SearchResults search(String q, Set<String> types, int limit, String locale) {
        if (q == null || q.isBlank()) {
            return new SearchResults(List.of(), List.of());
        }

        boolean wantProducts = types == null || types.isEmpty() || types.contains("product");
        boolean wantArticles = types == null || types.isEmpty() || types.contains("article");

        List<Product> products = wantProducts
                ? StorefrontSearchRules.rankMatchingProducts(
                        catalogReadRepository.findAllPublishedProductsForListing(locale), q, limit).stream()
                        .map(CatalogReadSupport::toListView)
                        .toList()
                : List.of();

        List<Article> articles = wantArticles
                ? contentReadRepository.searchPublishedArticles(StorefrontSearchRules.literalTerms(q), locale, limit)
                : List.of();

        return new SearchResults(products, articles);
    }
}
