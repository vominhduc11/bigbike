package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.service.search.GlobalSearchService;
import com.bigbike.bigbike_backend.service.search.GlobalSearchService.SearchResults;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PublicSearchController {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 50;

    private final GlobalSearchService searchService;
    private final ApiResponseFactory apiResponseFactory;

    public record SearchPayload(
            String query,
            List<Product> products,
            List<Article> articles
    ) {}

    @GetMapping("/search")
    public ApiDataResponse<SearchPayload> search(
            @RequestParam("q") @Size(min = 1, max = 200) String q,
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "limit", required = false) @Min(1) @Max(MAX_LIMIT) Integer limit,
            HttpServletRequest request
    ) {
        Set<String> types = parseTypes(type);
        int resolvedLimit = limit == null ? DEFAULT_LIMIT : limit;

        SearchResults results = searchService.search(q, types, resolvedLimit);
        return apiResponseFactory.data(
                new SearchPayload(q, results.products(), results.articles()),
                request
        );
    }

    /**
     * Lightweight typeahead endpoint used by mobile (and the web BFF). Returns up to {@code limit}
     * product matches; returns empty for blank queries.
     */
    @GetMapping("/search-suggest")
    public ApiDataResponse<SearchPayload> searchSuggest(
            @RequestParam(value = "q", required = false) @Size(max = 200) String q,
            @RequestParam(value = "limit", required = false) @Min(1) @Max(MAX_LIMIT) Integer limit,
            HttpServletRequest request
    ) {
        String trimmed = q == null ? "" : q.strip();
        if (trimmed.isEmpty()) {
            return apiResponseFactory.data(
                    new SearchPayload(trimmed, List.of(), List.of()),
                    request
            );
        }
        int resolvedLimit = limit == null ? 8 : limit;
        SearchResults results = searchService.search(trimmed, null, resolvedLimit);
        return apiResponseFactory.data(
                new SearchPayload(trimmed, results.products(), results.articles()),
                request
        );
    }

    private static Set<String> parseTypes(String raw) {
        if (raw == null || raw.isBlank()) return Set.of();
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .map(s -> s.toLowerCase(java.util.Locale.ROOT))
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }
}
