package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.service.admin.AdminCatalogReadService;
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
@RequestMapping("/api/v1/admin")
public class AdminCatalogController {

    private static final String ID_REGEX = "^[A-Za-z0-9_-]+$";
    private static final String PUBLISH_STATUS_REGEX = "^(DRAFT|PUBLISHED|HIDDEN|ARCHIVED)$";
    private static final String STOCK_STATE_REGEX = "^(IN_STOCK|LOW_STOCK|OUT_OF_STOCK|PREORDER|CONTACT_FOR_STOCK)$";
    private static final String VISIBILITY_REGEX = "^(VISIBLE|HIDDEN)$";

    private final AdminCatalogReadService adminCatalogReadService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminCatalogController(
            AdminCatalogReadService adminCatalogReadService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminCatalogReadService = adminCatalogReadService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping("/products")
    public ApiListResponse<Product> listProducts(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(required = false) @Min(1) @Max(100) Integer size,
            @RequestParam(name = "pageSize", required = false) @Min(1) @Max(100) Integer pageSize,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) @Size(max = 100) String q,
            @RequestParam(required = false) @Size(max = 100) String search,
            @RequestParam(required = false) @Pattern(regexp = PUBLISH_STATUS_REGEX, message = "Invalid publishStatus.") String publishStatus,
            @RequestParam(required = false) @Pattern(regexp = STOCK_STATE_REGEX, message = "Invalid stockState.") String stockState,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.read");

        return apiResponseFactory.list(
                adminCatalogReadService.listProducts(
                        page,
                        resolveSize(size, pageSize),
                        sort,
                        q,
                        search,
                        publishStatus,
                        stockState
                ),
                request
        );
    }

    @GetMapping("/products/{id}")
    public ApiDataResponse<Product> getProductById(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.read");
        return apiResponseFactory.data(adminCatalogReadService.getProductById(id), request);
    }

    @GetMapping("/categories")
    public ApiListResponse<Category> listCategories(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(required = false) @Min(1) @Max(100) Integer size,
            @RequestParam(name = "pageSize", required = false) @Min(1) @Max(100) Integer pageSize,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) @Size(max = 100) String q,
            @RequestParam(required = false) @Size(max = 100) String search,
            @RequestParam(required = false) @Pattern(regexp = VISIBILITY_REGEX, message = "Invalid visibility.") String visibility,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.read");

        return apiResponseFactory.list(
                adminCatalogReadService.listCategories(
                        page,
                        resolveSize(size, pageSize),
                        sort,
                        q,
                        search,
                        visibility
                ),
                request
        );
    }

    @GetMapping("/categories/{id}")
    public ApiDataResponse<Category> getCategoryById(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.read");
        return apiResponseFactory.data(adminCatalogReadService.getCategoryById(id), request);
    }

    @GetMapping("/brands")
    public ApiListResponse<Brand> listBrands(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(required = false) @Min(1) @Max(100) Integer size,
            @RequestParam(name = "pageSize", required = false) @Min(1) @Max(100) Integer pageSize,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) @Size(max = 100) String q,
            @RequestParam(required = false) @Size(max = 100) String search,
            @RequestParam(required = false) @Pattern(regexp = VISIBILITY_REGEX, message = "Invalid visibility.") String visibility,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.read");

        return apiResponseFactory.list(
                adminCatalogReadService.listBrands(
                        page,
                        resolveSize(size, pageSize),
                        sort,
                        q,
                        search,
                        visibility
                ),
                request
        );
    }

    @GetMapping("/brands/{id}")
    public ApiDataResponse<Brand> getBrandById(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.read");
        return apiResponseFactory.data(adminCatalogReadService.getBrandById(id), request);
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
