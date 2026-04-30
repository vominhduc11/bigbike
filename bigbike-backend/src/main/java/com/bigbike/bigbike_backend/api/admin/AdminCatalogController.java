package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ProductPublishRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertBrandRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertCategoryRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.service.admin.AdminCatalogMutationService;
import com.bigbike.bigbike_backend.service.admin.AdminCatalogReadService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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
@RequestMapping("/api/v1/admin")
public class AdminCatalogController {

    private static final String ID_REGEX = "^[A-Za-z0-9_-]+$";
    private static final String PUBLISH_STATUS_REGEX =
            "^(DRAFT|PUBLISHED|HIDDEN|ARCHIVED|PENDING|PRIVATE|TRASH)$";
    private static final String STOCK_STATE_REGEX = "^(IN_STOCK|LOW_STOCK|OUT_OF_STOCK|PREORDER|CONTACT_FOR_STOCK)$";
    private static final String VISIBILITY_REGEX = "^(VISIBLE|HIDDEN)$";

    private final AdminCatalogReadService adminCatalogReadService;
    private final AdminCatalogMutationService adminCatalogMutationService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminCatalogController(
            AdminCatalogReadService adminCatalogReadService,
            AdminCatalogMutationService adminCatalogMutationService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminCatalogReadService = adminCatalogReadService;
        this.adminCatalogMutationService = adminCatalogMutationService;
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
            @RequestParam(required = false) @Size(max = 100) String brandId,
            @RequestParam(required = false) @Size(max = 100) String categoryId,
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
                        stockState,
                        brandId,
                        categoryId
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

    @PostMapping("/products")
    public ApiDataResponse<Product> createProduct(
            @Valid @RequestBody UpsertProductRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(adminCatalogMutationService.createProduct(payload), request);
    }

    @PatchMapping("/products/{id}")
    public ApiDataResponse<Product> updateProduct(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            @Valid @RequestBody UpsertProductRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(adminCatalogMutationService.updateProduct(id, payload), request);
    }

    @PatchMapping("/products/{id}/publish")
    public ApiDataResponse<Product> publishProduct(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            @Valid @RequestBody ProductPublishRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(
                adminCatalogMutationService.updateProductPublishStatus(id, payload.getPublishStatus()),
                request
        );
    }

    /**
     * Soft-delete: marks the product as TRASH instead of physical removal so it
     * can be restored from the admin trash view. Idempotent: deleting a product
     * that's already TRASH returns 204 without touching the row.
     */
    @DeleteMapping("/products/{id}")
    public ApiDataResponse<Product> softDeleteProduct(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(adminCatalogMutationService.softDeleteProduct(id), request);
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

    @PostMapping("/categories")
    public ApiDataResponse<Category> createCategory(
            @Valid @RequestBody UpsertCategoryRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.update");
        return apiResponseFactory.data(adminCatalogMutationService.createCategory(payload), request);
    }

    @PatchMapping("/categories/{id}")
    public ApiDataResponse<Category> updateCategory(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            @Valid @RequestBody UpsertCategoryRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.update");
        return apiResponseFactory.data(adminCatalogMutationService.updateCategory(id, payload), request);
    }

    /**
     * Soft-delete: there is no publish_status column on categories, so the
     * closest equivalent is flipping is_visible=false. The category row is
     * preserved (restoration = re-enable visibility via PATCH).
     */
    @DeleteMapping("/categories/{id}")
    public ApiDataResponse<Category> softDeleteCategory(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.update");
        return apiResponseFactory.data(adminCatalogMutationService.softDeleteCategory(id), request);
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

    @PostMapping("/brands")
    public ApiDataResponse<Brand> createBrand(
            @Valid @RequestBody UpsertBrandRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.update");
        return apiResponseFactory.data(adminCatalogMutationService.createBrand(payload), request);
    }

    @PatchMapping("/brands/{id}")
    public ApiDataResponse<Brand> updateBrand(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            @Valid @RequestBody UpsertBrandRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.update");
        return apiResponseFactory.data(adminCatalogMutationService.updateBrand(id, payload), request);
    }

    @DeleteMapping("/brands/{id}")
    public ApiDataResponse<Brand> deleteBrand(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.update");
        return apiResponseFactory.data(adminCatalogMutationService.deleteBrand(id), request);
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
