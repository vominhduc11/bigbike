package com.bigbike.bigbike_backend.service.search;

import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.repository.content.ContentReadRepository;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Cross-domain search using token-AND DB queries.
 * Query is split on whitespace into tokens; each token must match at least
 * one indexed field (AND logic). "ba lo" → ["ba","lo"] → finds "balo" and
 * "balo moto phượt" without loading the full table into memory.
 */
@Service
@RequiredArgsConstructor
public class GlobalSearchService {

    private static final int MAX_TOKENS = 5;

    private final CatalogReadRepository catalogReadRepository;
    private final ContentReadRepository contentReadRepository;

    public record SearchResults(List<Product> products, List<Article> articles) {}

    public SearchResults search(String q, Set<String> types, int limit) {
        if (q == null || q.isBlank()) {
            return new SearchResults(List.of(), List.of());
        }

        List<String> tokens = Arrays.stream(q.trim().split("\\s+"))
                .filter(t -> !t.isEmpty())
                .limit(MAX_TOKENS)
                .toList();

        if (tokens.isEmpty()) {
            return new SearchResults(List.of(), List.of());
        }

        boolean wantProducts = types == null || types.isEmpty() || types.contains("product");
        boolean wantArticles = types == null || types.isEmpty() || types.contains("article");

        List<Product> products = wantProducts
                ? catalogReadRepository.searchPublishedProducts(tokens, "vi", limit)
                : List.of();

        List<Article> articles = wantArticles
                ? contentReadRepository.searchPublishedArticles(tokens, limit)
                : List.of();

        return new SearchResults(products, articles);
    }
}
