package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ProductPublishRequest;
import com.bigbike.bigbike_backend.api.admin.dto.CategoryPermanentDeleteImpactRequest;
import com.bigbike.bigbike_backend.api.admin.dto.CategoryPermanentDeleteImpactResponse;
import com.bigbike.bigbike_backend.api.admin.dto.SetHomepageBlocksRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertBrandRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertCategoryRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import java.util.List;
import com.bigbike.bigbike_backend.service.admin.ProductMutationService;
import com.bigbike.bigbike_backend.service.admin.CategoryMutationService;
import com.bigbike.bigbike_backend.service.admin.CategoryDeletionImpactService;
import com.bigbike.bigbike_backend.service.admin.BrandMutationService;
import com.bigbike.bigbike_backend.service.admin.HomepageBlockMutationService;
import com.bigbike.bigbike_backend.service.admin.AdminCatalogReadService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
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
@RequiredArgsConstructor
public class AdminCatalogController extends AdminControllerSupport {

    private static final String ID_REGEX = "^[A-Za-z0-9_-]+$";
    private static final String PUBLISH_STATUS_REGEX =
            "^(DRAFT|PUBLISHED|TRASH|ALL_INCLUDING_TRASH)$";
    private static final String STOCK_STATE_REGEX = "^(IN_STOCK|OUT_OF_STOCK)$";
    private static final String VISIBILITY_REGEX = "^(VISIBLE|HIDDEN)$";
    private static final String HOMEPAGE_BLOCK_REGEX =
            "^(NONE|FEATURED_GRID)$";
    private static final String LANG_REGEX = "^(vi|en)$";

    private final AdminCatalogReadService adminCatalogReadService;
    private final ProductMutationService productMutationService;
    private final CategoryMutationService categoryMutationService;
    private final CategoryDeletionImpactService categoryDeletionImpactService;
    private final BrandMutationService brandMutationService;
    private final HomepageBlockMutationService homepageBlockMutationService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

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
            @RequestParam(name = "filter_gender", required = false) @Size(max = 20) String filterGender,
            @RequestParam(required = false) @Pattern(regexp = HOMEPAGE_BLOCK_REGEX, message = "Invalid homepageBlock.") String homepageBlock,
            @RequestParam(defaultValue = "vi") @Pattern(regexp = LANG_REGEX, message = "Invalid lang.") String lang,
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
                        categoryId,
                        filterGender,
                        homepageBlock,
                        lang
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
        return apiResponseFactory.data(productMutationService.createProduct(payload, resolveAdminId()), request);
    }

    /**
     * Live-preview dry-run: renders the unsaved upsert payload to the public
     * {@link Product} shape without persisting anything. Powers the in-editor
     * storefront preview. Same permission as create/edit (it's a sub-step of
     * authoring and accepts the full upsert body).
     */
    @PostMapping("/products/preview")
    public ApiDataResponse<Product> previewProduct(
            @Valid @RequestBody UpsertProductRequest payload,
            @RequestParam(name = "lang", defaultValue = "vi")
            @Pattern(regexp = LANG_REGEX, message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(productMutationService.previewProduct(payload, lang), request);
    }

    @PatchMapping("/products/{id}")
    public ApiDataResponse<Product> updateProduct(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            @Valid @RequestBody UpsertProductRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(productMutationService.updateProduct(id, payload, resolveAdminId()), request);
    }

    @PatchMapping("/products/{id}/publish")
    public ApiDataResponse<Product> publishProduct(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            @Valid @RequestBody ProductPublishRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(
                productMutationService.updateProductPublishStatus(id, payload.getPublishStatus(), resolveAdminId()),
                request
        );
    }

    /**
     * Soft-delete: marks the product as TRASH instead of physical removal so it
     * can be restored from the admin trash view. Idempotent: deleting a product
     * that's already TRASH returns the current product without touching the row.
     */
    @DeleteMapping("/products/{id}")
    public ApiDataResponse<Product> softDeleteProduct(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(productMutationService.softDeleteProduct(id, resolveAdminId()), request);
    }

    /**
     * Restore a trashed product back to DRAFT. Product is not published by
     * this command; admins must publish explicitly afterwards.
     */
    @PostMapping("/products/{id}/restore")
    public ApiDataResponse<Product> restoreProduct(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(productMutationService.restoreProduct(id, resolveAdminId()), request);
    }

    @DeleteMapping("/products/{id}/permanent")
    public org.springframework.http.ResponseEntity<Void> permanentDeleteProduct(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        productMutationService.hardDeleteProduct(id, resolveAdminId());
        return org.springframework.http.ResponseEntity.noContent().build();
    }

    @PostMapping("/products/homepage-blocks")
    public ApiDataResponse<List<Product>> setHomepageBlocks(
            @Valid @RequestBody SetHomepageBlocksRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(homepageBlockMutationService.setHomepageBlocks(payload, resolveAdminId()), request);
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
            @RequestParam(required = false) Boolean deleted,
            @RequestParam(defaultValue = "vi") @Pattern(regexp = LANG_REGEX, message = "Invalid lang.") String lang,
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
                        visibility,
                        deleted,
                        lang
                ),
                request
        );
    }

    /**
     * Returns every category in a single response (no pagination).
     * The list endpoint above caps pageSize at 100, which silently truncates
     * the tree once the catalog grows. The admin tree-view and the parent
     * picker need the full set to render correctly, so they call this
     * endpoint instead. Sorted by parent_id NULLS FIRST, sortOrder, name.
     */
    @GetMapping("/categories/tree")
    public ApiDataResponse<List<Category>> listCategoryTree(
            @RequestParam(defaultValue = "vi") @Pattern(regexp = LANG_REGEX, message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.read");
        return apiResponseFactory.data(adminCatalogReadService.listAllCategoriesForTree(lang), request);
    }

    @PostMapping("/categories/permanent-delete-impact")
    public ApiDataResponse<CategoryPermanentDeleteImpactResponse> previewCategoryPermanentDelete(
            @Valid @RequestBody CategoryPermanentDeleteImpactRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.read");
        return apiResponseFactory.data(categoryDeletionImpactService.preview(payload.categoryIds()), request);
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
        return apiResponseFactory.data(categoryMutationService.createCategory(payload, resolveAdminId()), request);
    }

    @PatchMapping("/categories/{id}")
    public ApiDataResponse<Category> updateCategory(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            @Valid @RequestBody UpsertCategoryRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.update");
        return apiResponseFactory.data(categoryMutationService.updateCategory(id, payload, resolveAdminId()), request);
    }

    /**
     * Hard-delete: physically removes the category and its entire sub-tree
     * (all descendant categories) from the database. Rejected only if any
     * category in the sub-tree still has products assigned as their primary
     * category — products are never deleted as a side effect.
     */
    @DeleteMapping("/categories/{id}")
    public ApiDataResponse<Category> softDeleteCategory(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.update");
        return apiResponseFactory.data(categoryMutationService.softDeleteCategory(id, resolveAdminId()), request);
    }

    @PostMapping("/categories/{id}/restore")
    public ApiDataResponse<Category> restoreCategory(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.update");
        return apiResponseFactory.data(categoryMutationService.restoreCategory(id, resolveAdminId()), request);
    }

    @DeleteMapping("/categories/{id}/permanent")
    public org.springframework.http.ResponseEntity<Void> permanentDeleteCategory(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.update");
        categoryMutationService.hardDeleteCategory(id, resolveAdminId());
        return org.springframework.http.ResponseEntity.noContent().build();
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
            @RequestParam(defaultValue = "vi") @Pattern(regexp = LANG_REGEX, message = "Invalid lang.") String lang,
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
                        visibility,
                        lang
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
        return apiResponseFactory.data(brandMutationService.createBrand(payload, resolveAdminId()), request);
    }

    @PatchMapping("/brands/{id}")
    public ApiDataResponse<Brand> updateBrand(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            @Valid @RequestBody UpsertBrandRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.update");
        return apiResponseFactory.data(brandMutationService.updateBrand(id, payload, resolveAdminId()), request);
    }

    @DeleteMapping("/brands/{id}")
    public ApiDataResponse<Brand> softDeleteBrand(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.update");
        return apiResponseFactory.data(brandMutationService.deleteBrand(id, resolveAdminId()), request);
    }

    @PostMapping("/brands/{id}/restore")
    public ApiDataResponse<Brand> restoreBrand(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.update");
        return apiResponseFactory.data(brandMutationService.restoreBrand(id, resolveAdminId()), request);
    }

    @DeleteMapping("/brands/{id}/permanent")
    public ApiDataResponse<java.util.Map<String, Object>> permanentDeleteBrand(
            @PathVariable @Pattern(regexp = ID_REGEX, message = "Invalid id.") String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "catalog.update");
        int reassignedProductCount = brandMutationService.hardDeleteBrand(id, resolveAdminId());
        return apiResponseFactory.data(
                java.util.Map.of("reassignedProductCount", reassignedProductCount), request);
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
