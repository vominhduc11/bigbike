package com.bigbike.bigbike_backend.api.content;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.ContentCategoryWithCount;
import com.bigbike.bigbike_backend.domain.content.Page;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.content.ContentReadService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ContentController {

    private static final String SLUG_REGEX = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

    private final ContentReadService contentReadService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/articles")
    public ApiListResponse<Article> listArticles(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) @Pattern(regexp = SLUG_REGEX, message = "Invalid category slug.") String category,
            @RequestParam(required = false) @Size(max = 100) String q,
            @RequestParam(defaultValue = "vi") @Pattern(regexp = "^(vi|en)$", message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        return apiResponseFactory.list(contentReadService.listArticles(page, size, sort, category, q, lang), request);
    }

    @GetMapping("/articles/{slug}")
    public ApiDataResponse<Article> getArticleBySlug(
            @PathVariable @Pattern(regexp = SLUG_REGEX, message = "Invalid slug.") String slug,
            @RequestParam(defaultValue = "vi") @Pattern(regexp = "^(vi|en)$", message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(contentReadService.getArticleBySlug(slug, lang), request);
    }

    @GetMapping("/content-categories")
    public ApiListResponse<ContentCategoryWithCount> listContentCategories(HttpServletRequest request) {
        List<ContentCategoryWithCount> categories = contentReadService.listContentCategories();
        PageResult<ContentCategoryWithCount> result =
                new PageResult<>(categories, 1, categories.size(), categories.size(), 1);
        return apiResponseFactory.list(result, request);
    }

    @GetMapping("/pages")
    public ApiListResponse<Page> listPages(HttpServletRequest request) {
        List<Page> pages = contentReadService.listPublishedPages();
        PageResult<Page> result = new PageResult<>(pages, 1, pages.size(), pages.size(), 1);
        return apiResponseFactory.list(result, request);
    }

    @GetMapping("/pages/{slug}")
    public ApiDataResponse<Page> getPageBySlug(
            @PathVariable @Pattern(regexp = SLUG_REGEX, message = "Invalid slug.") String slug,
            @RequestParam(defaultValue = "vi") @Pattern(regexp = "^(vi|en)$", message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(contentReadService.getPageBySlug(slug, lang), request);
    }
}

