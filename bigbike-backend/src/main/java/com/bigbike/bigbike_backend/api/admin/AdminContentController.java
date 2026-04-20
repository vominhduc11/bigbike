package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.content.AdminContentItem;
import com.bigbike.bigbike_backend.service.admin.AdminContentReadService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
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
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminContentController(
            AdminContentReadService adminContentReadService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminContentReadService = adminContentReadService;
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
