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
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/search")
public class PublicSearchController {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 50;

    private final GlobalSearchService searchService;
    private final ApiResponseFactory apiResponseFactory;

    public PublicSearchController(
            GlobalSearchService searchService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.searchService = searchService;
        this.apiResponseFactory = apiResponseFactory;
    }

    public record SearchPayload(
            String query,
            List<Product> products,
            List<Article> articles
    ) {}

    @GetMapping
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

    private static Set<String> parseTypes(String raw) {
        if (raw == null || raw.isBlank()) return Set.of();
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .map(s -> s.toLowerCase(java.util.Locale.ROOT))
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }
}
