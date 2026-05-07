package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.UpsertArticleRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertAuthorRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertCategoryRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertPageRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.content.AdminContentItem;
import com.bigbike.bigbike_backend.domain.content.ContentAuthorItem;
import com.bigbike.bigbike_backend.domain.content.ContentCategoryItem;
import com.bigbike.bigbike_backend.domain.content.ContentPageRefItem;
import com.bigbike.bigbike_backend.service.admin.AdminContentMutationService;
import com.bigbike.bigbike_backend.service.admin.AdminContentReadService;
import com.bigbike.bigbike_backend.service.admin.AdminContentReferenceService;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin/content")
public class AdminContentController {

    private static final String ID_REGEX = "^[A-Za-z0-9_-]+$";
    private static final String CONTENT_TYPE_REGEX = "^(?i)(ARTICLE|PAGE)$";
    private static final String CONTENT_PATH_TYPE_REGEX = "^(?i)(article|page)$";
    private static final String PUBLISH_STATUS_REGEX = "^(DRAFT|PUBLISHED|HIDDEN|ARCHIVED)$";

    private final AdminContentReadService adminContentReadService;
    private final AdminContentMutationService adminContentMutationService;
    private final AdminContentReferenceService adminContentReferenceService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminContentController(
            AdminContentReadService adminContentReadService,
            AdminContentMutationService adminContentMutationService,
            AdminContentReferenceService adminContentReferenceService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminContentReadService = adminContentReadService;
        this.adminContentMutationService = adminContentMutationService;
        this.adminContentReferenceService = adminContentReferenceService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping
    public ApiListResponse<AdminContentItem> listContent(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(required = false) @Min(1) @Max(100) Integer size,
            @RequestParam(name = "pageSize", required = false) @Min(1) @Max(100) Integer pageSize,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) @Size(max = 100) String q,
            @RequestParam(required = false) @Size(max = 100) String search,
            @RequestParam(required = false) @Pattern(regexp = CONTENT_TYPE_REGEX, message = "Invalid type.") String type,
            @RequestParam(required = false) @Pattern(regexp = PUBLISH_STATUS_REGEX, message = "Invalid publishStatus.") String publishStatus,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "content.read");

        return apiResponseFactory.list(
                adminContentReadService.listContent(
                        page,
                        resolveSize(size, pageSize),
                        sort,
                        q,
                        search,
                        type,
                        publishStatus
                ),
                request
        );
    }

    @GetMapping("/{type}/{id}")
    public ApiDataResponse<AdminContentItem> getContentByTypeAndId(
            @PathVariable @Pattern(regexp = CONTENT_PATH_TYPE_REGEX, message = "Invalid content type.") String type,
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "content.read");
        return apiResponseFactory.data(adminContentReadService.getContentByTypeAndId(type, id), request);
    }

    @PostMapping("/articles")
    public ApiDataResponse<AdminContentItem> createArticle(
            @Valid @RequestBody UpsertArticleRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "content.update");
        return apiResponseFactory.data(adminContentMutationService.createArticle(payload, resolveAdminId()), request);
    }

    @PatchMapping("/articles/{id}")
    public ApiDataResponse<AdminContentItem> updateArticle(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            @Valid @RequestBody UpsertArticleRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "content.update");
        return apiResponseFactory.data(adminContentMutationService.updateArticle(id, payload, resolveAdminId()), request);
    }

    @PostMapping("/pages")
    public ApiDataResponse<AdminContentItem> createPage(
            @Valid @RequestBody UpsertPageRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "content.update");
        return apiResponseFactory.data(adminContentMutationService.createPage(payload, resolveAdminId()), request);
    }

    @PatchMapping("/pages/{id}")
    public ApiDataResponse<AdminContentItem> updatePage(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            @Valid @RequestBody UpsertPageRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "content.update");
        return apiResponseFactory.data(adminContentMutationService.updatePage(id, payload, resolveAdminId()), request);
    }

    @DeleteMapping("/{type}/{id}")
    public ApiDataResponse<AdminContentItem> deleteContent(
            @PathVariable @Pattern(regexp = CONTENT_PATH_TYPE_REGEX, message = "Invalid content type.") String type,
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "content.update");
        if ("page".equalsIgnoreCase(type)) {
            return apiResponseFactory.data(adminContentMutationService.deletePage(id, resolveAdminId()), request);
        }
        return apiResponseFactory.data(adminContentMutationService.deleteArticle(id, resolveAdminId()), request);
    }

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try { return UUID.fromString(principal.id()); } catch (IllegalArgumentException ignored) {}
        }
        return DEV_ADMIN_ID;
    }

    // ── Reference lists (for article/page form dropdowns) ────────────────────

    @GetMapping("/reference/authors")
    public ApiListResponse<ContentAuthorItem> listAuthorRefs(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "content.read");
        List<ContentAuthorItem> items = adminContentReferenceService.listAuthors();
        return apiResponseFactory.list(new PageResult<>(items, 1, items.size(), items.size(), 1), request);
    }

    @GetMapping("/reference/categories")
    public ApiListResponse<ContentCategoryItem> listCategoryRefs(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "content.read");
        List<ContentCategoryItem> items = adminContentReferenceService.listCategories();
        return apiResponseFactory.list(new PageResult<>(items, 1, items.size(), items.size(), 1), request);
    }

    @GetMapping("/reference/pages")
    public ApiListResponse<ContentPageRefItem> listPageRefs(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "content.read");
        List<ContentPageRefItem> items = adminContentReferenceService.listPageRefs();
        return apiResponseFactory.list(new PageResult<>(items, 1, items.size(), items.size(), 1), request);
    }

    // ── Author CRUD ──────────────────────────────────────────────────────────

    @PostMapping("/authors")
    public ApiDataResponse<ContentAuthorItem> createAuthor(
            @Valid @RequestBody UpsertAuthorRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "content.update");
        return apiResponseFactory.data(adminContentReferenceService.createAuthor(payload), request);
    }

    @PatchMapping("/authors/{id}")
    public ApiDataResponse<ContentAuthorItem> updateAuthor(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            @Valid @RequestBody UpsertAuthorRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "content.update");
        return apiResponseFactory.data(adminContentReferenceService.updateAuthor(id, payload), request);
    }

    // ── Content Category CRUD ────────────────────────────────────────────────

    @PostMapping("/content-categories")
    public ApiDataResponse<ContentCategoryItem> createCategory(
            @Valid @RequestBody UpsertCategoryRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "content.update");
        return apiResponseFactory.data(adminContentReferenceService.createCategory(payload), request);
    }

    @PatchMapping("/content-categories/{id}")
    public ApiDataResponse<ContentCategoryItem> updateCategory(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            @Valid @RequestBody UpsertCategoryRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "content.update");
        return apiResponseFactory.data(adminContentReferenceService.updateCategory(id, payload), request);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static int resolveSize(Integer size, Integer pageSize) {
        if (size != null) {
            return size;
        }
        if (pageSize != null) {
            return pageSize;
        }
        return 20;
    }
}
