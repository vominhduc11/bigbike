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
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
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

    private static final int MAX_LIMIT = 50;

    private final GlobalSearchService searchService;
    private final ApiResponseFactory apiResponseFactory;

    public record SearchPayload(
            String query,
            List<Product> products,
            List<Article> articles
    ) {}

    // GET /api/v1/search (cross-domain search) removed 2026-07-15 (AUD-066, decision #8):
    // no client called it — the storefront search page fetches /api/v1/products and the
    // header dropdown uses /api/v1/search-suggest below.

    /**
     * Lightweight typeahead endpoint used by the web BFF header dropdown. Returns up to
     * {@code limit} product/article matches; returns empty for blank queries.
     */
    @GetMapping("/search-suggest")
    public ApiDataResponse<SearchPayload> searchSuggest(
            @RequestParam(value = "q", required = false) @Size(max = 200) String q,
            @RequestParam(value = "limit", required = false) @Min(1) @Max(MAX_LIMIT) Integer limit,
            @RequestParam(defaultValue = "vi")
            @Pattern(regexp = "^(vi|en)$", message = "Invalid lang.") String lang,
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
        SearchResults results = searchService.search(trimmed, null, resolvedLimit, lang);
        return apiResponseFactory.data(
                new SearchPayload(trimmed, results.products(), results.articles()),
                request
        );
    }
}
