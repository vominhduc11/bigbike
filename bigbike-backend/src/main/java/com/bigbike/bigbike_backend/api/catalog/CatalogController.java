package com.bigbike.bigbike_backend.api.catalog;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
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
@RequestMapping("/api/v1")
public class CatalogController {

    private static final String SLUG_REGEX = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

    private final CatalogReadService catalogReadService;
    private final ApiResponseFactory apiResponseFactory;

    public CatalogController(CatalogReadService catalogReadService, ApiResponseFactory apiResponseFactory) {
        this.catalogReadService = catalogReadService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping("/products")
    public ApiListResponse<Product> listProducts(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) @Pattern(regexp = SLUG_REGEX, message = "Invalid category slug.") String category,
            @RequestParam(required = false) @Pattern(regexp = SLUG_REGEX, message = "Invalid brand slug.") String brand,
            @RequestParam(required = false) @Size(max = 100) String q,
            HttpServletRequest request
    ) {
        return apiResponseFactory.list(
                catalogReadService.listProducts(page, size, sort, category, brand, q),
                request
        );
    }

    @GetMapping("/products/{slug}")
    public ApiDataResponse<Product> getProductBySlug(
            @PathVariable @Pattern(regexp = SLUG_REGEX, message = "Invalid slug.") String slug,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(catalogReadService.getProductBySlug(slug), request);
    }

    @GetMapping("/categories")
    public ApiListResponse<Category> listCategories(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String sort,
            HttpServletRequest request
    ) {
        return apiResponseFactory.list(catalogReadService.listCategories(page, size, sort), request);
    }

    @GetMapping("/categories/{slug}")
    public ApiDataResponse<Category> getCategoryBySlug(
            @PathVariable @Pattern(regexp = SLUG_REGEX, message = "Invalid slug.") String slug,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(catalogReadService.getCategoryBySlug(slug), request);
    }

    @GetMapping("/brands")
    public ApiListResponse<Brand> listBrands(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String sort,
            HttpServletRequest request
    ) {
        return apiResponseFactory.list(catalogReadService.listBrands(page, size, sort), request);
    }

    @GetMapping("/brands/{slug}")
    public ApiDataResponse<Brand> getBrandBySlug(
            @PathVariable @Pattern(regexp = SLUG_REGEX, message = "Invalid slug.") String slug,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(catalogReadService.getBrandBySlug(slug), request);
    }
}

