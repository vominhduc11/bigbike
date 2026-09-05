package com.bigbike.bigbike_backend.api.catalog;

import com.bigbike.bigbike_backend.api.catalog.dto.ProductSnapshotResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.CatalogFacets;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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
public class CatalogController {

    private static final String SLUG_REGEX = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
    // Snapshot accepts both slug format (a-z0-9 with hyphens) and internal product-id format
    // (prefix_uuid, e.g. prod_a1b2c3d4...). Underscores and hyphens are both valid separators.
    private static final String ID_OR_SLUG_REGEX = "^[a-z0-9][a-z0-9_-]*$";
    private static final String HOMEPAGE_BLOCK_REGEX =
            "^(NONE|FEATURED_GRID)$";
    // Storefront content language. Vietnamese is canonical; English falls back
    // field-by-field (see BUSINESS_RULES.md PRODUCT_RULE_002).
    private static final String LANG_REGEX = "^(vi|en)$";

    private static final Map<ProductStockState, String> STOCK_LABELS = Map.of(
            ProductStockState.IN_STOCK, "Còn hàng",
            ProductStockState.OUT_OF_STOCK, "Hết hàng"
    );

    private final CatalogReadService catalogReadService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/products")
    public ApiListResponse<Product> listProducts(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) @Pattern(regexp = SLUG_REGEX, message = "Invalid category slug.") String category,
            @RequestParam(name = "pwb-brand", required = false)
                List<@Pattern(regexp = SLUG_REGEX, message = "Invalid brand slug.") String> brands,
            @RequestParam(required = false) @Size(max = 100) String q,
            @RequestParam(name = "filter_color", required = false)
                List<@Pattern(regexp = SLUG_REGEX, message = "Invalid color slug.") String> filterColors,
            @RequestParam(name = "filter_finish", required = false)
                List<@Pattern(regexp = SLUG_REGEX, message = "Invalid finish slug.") String> filterFinishes,
            @RequestParam(name = "filter_gender", required = false)
                List<@Size(max = 20) @Pattern(regexp = "(?iu)^\\s*(Nam|Nữ)?\\s*$", message = "Invalid filter_gender.") String> filterGender,
            @RequestParam(name = "kich-co", required = false)
                List<@Size(max = 32) String> sizeFilters,
            @RequestParam(name = "min_price", required = false) @Min(0) Long minPrice,
            @RequestParam(name = "max_price", required = false) @Min(0) Long maxPrice,
            @RequestParam(name = "in_stock", required = false) Boolean inStock,
            @RequestParam(name = "homepage_block", required = false)
                @Pattern(regexp = HOMEPAGE_BLOCK_REGEX, message = "Invalid homepage_block.")
                String homepageBlock,
            @RequestParam(defaultValue = "vi") @Pattern(regexp = LANG_REGEX, message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
            throw com.bigbike.bigbike_backend.api.error.ValidationException.fromField(
                    "min_price",
                    "INVALID_RANGE",
                    "min_price must be less than or equal to max_price."
            );
        }
        HomepageBlock block = homepageBlock == null ? null : HomepageBlock.valueOf(homepageBlock);
        return apiResponseFactory.list(
                catalogReadService.listProducts(
                        page, size, sort, category, brands, q, filterColors, filterFinishes,
                        filterGender, sizeFilters, minPrice, maxPrice, inStock, block, lang),
                request
        );
    }

    @GetMapping("/products/{slug}")
    public ApiDataResponse<Product> getProductBySlug(
            @PathVariable @Pattern(regexp = SLUG_REGEX, message = "Invalid slug.") String slug,
            @RequestParam(defaultValue = "vi") @Pattern(regexp = LANG_REGEX, message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(catalogReadService.getProductBySlug(slug, lang), request);
    }

    /**
     * Lightweight pricing/stock snapshot used by the storefront and mobile to refresh
     * the buy-box without re-fetching the whole product. Accepts both slug and internal id.
     */
    @GetMapping("/products/{idOrSlug}/snapshot")
    public ApiDataResponse<ProductSnapshotResponse> getProductSnapshot(
            @PathVariable @Pattern(regexp = ID_OR_SLUG_REGEX, message = "Invalid product key.") String idOrSlug,
            @RequestParam(defaultValue = "vi") @Pattern(regexp = LANG_REGEX, message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        // Pricing/stock have no translatable text, but the variant options carried in the
        // snapshot DO (attribute name + value, e.g. "Màu sắc"/"Đỏ"), so resolve them by lang
        // — see API_CONTRACT.md "Product bilingual content — lang param". Uses the lighter
        // listing projection (not the full product-detail load) — see
        // CatalogReadService.getProductSnapshotByIdOrSlug.
        Product product = catalogReadService.getProductSnapshotByIdOrSlug(idOrSlug, lang);
        return apiResponseFactory.data(toSnapshot(product), request);
    }

    private static ProductSnapshotResponse toSnapshot(Product product) {
        ProductPrice price = product.price();
        BigDecimal retail = price != null && price.retailPrice() != null
                ? price.retailPrice() : BigDecimal.ZERO;
        BigDecimal sale = price != null ? price.salePrice() : null;

        int discountPercent = 0;
        if (sale != null && sale.signum() > 0 && retail.compareTo(sale) > 0) {
            BigDecimal ratio = sale.divide(retail, 4, RoundingMode.HALF_UP);
            discountPercent = BigDecimal.ONE.subtract(ratio)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(0, RoundingMode.HALF_UP)
                    .intValue();
        }

        ProductStockState state = product.stockState() != null
                ? product.stockState() : ProductStockState.IN_STOCK;

        ProductSnapshotResponse.Pricing pricing = new ProductSnapshotResponse.Pricing(
                retail,
                sale,
                discountPercent,
                price != null && price.currency() != null ? price.currency() : "VND"
        );
        ProductSnapshotResponse.Stock stock = new ProductSnapshotResponse.Stock(
                state.name(),
                STOCK_LABELS.getOrDefault(state, state.name())
        );
        return new ProductSnapshotResponse(
                pricing,
                stock,
                product.variants() != null ? product.variants() : Collections.emptyList()
        );
    }

    @GetMapping("/categories")
    public ApiListResponse<Category> listCategories(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) Boolean showOnHomepage,
            @RequestParam(required = false) Boolean filterHome,
            @RequestParam(defaultValue = "vi") @Pattern(regexp = LANG_REGEX, message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        Boolean homepageFilter = showOnHomepage != null ? showOnHomepage : filterHome;
        return apiResponseFactory.list(catalogReadService.listCategories(page, size, sort, homepageFilter, lang), request);
    }

    @GetMapping("/categories/{slug}")
    public ApiDataResponse<Category> getCategoryBySlug(
            @PathVariable @Pattern(regexp = SLUG_REGEX, message = "Invalid slug.") String slug,
            @RequestParam(defaultValue = "vi") @Pattern(regexp = LANG_REGEX, message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(catalogReadService.getCategoryBySlug(slug, lang), request);
    }

    /**
     * Aggregated product counts per filter value, used by the storefront catalog
     * filter sidebar. See {@link CatalogReadService#computeFacets} for the v1
     * counting semantics.
     */
    @GetMapping("/catalog/facets")
    public ApiDataResponse<CatalogFacets> getCatalogFacets(
            @RequestParam(required = false) @Pattern(regexp = SLUG_REGEX, message = "Invalid category slug.") String category,
            @RequestParam(name = "pwb-brand", required = false)
                List<@Pattern(regexp = SLUG_REGEX, message = "Invalid brand slug.") String> brands,
            @RequestParam(required = false) @Size(max = 100) String q,
            @RequestParam(name = "filter_color", required = false)
                List<@Pattern(regexp = SLUG_REGEX, message = "Invalid color slug.") String> filterColors,
            @RequestParam(name = "filter_finish", required = false)
                List<@Pattern(regexp = SLUG_REGEX, message = "Invalid finish slug.") String> filterFinishes,
            @RequestParam(name = "filter_gender", required = false)
                List<@Size(max = 20) @Pattern(regexp = "(?iu)^\\s*(Nam|Nữ)?\\s*$", message = "Invalid filter_gender.") String> filterGender,
            @RequestParam(name = "kich-co", required = false)
                List<@Size(max = 32) String> sizeFilters,
            @RequestParam(name = "min_price", required = false) @Min(0) Long minPrice,
            @RequestParam(name = "max_price", required = false) @Min(0) Long maxPrice,
            @RequestParam(name = "in_stock", required = false) Boolean inStock,
            @RequestParam(defaultValue = "vi") @Pattern(regexp = LANG_REGEX, message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
            throw com.bigbike.bigbike_backend.api.error.ValidationException.fromField(
                    "min_price",
                    "INVALID_RANGE",
                    "min_price must be less than or equal to max_price."
            );
        }
        return apiResponseFactory.data(catalogReadService.computeFacets(
                category, brands, q, filterColors, filterFinishes, filterGender, sizeFilters,
                minPrice, maxPrice, inStock, lang), request);
    }

    @GetMapping("/brands")
    public ApiListResponse<Brand> listBrands(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) Boolean showOnHomepage,
            @RequestParam(defaultValue = "vi") @Pattern(regexp = LANG_REGEX, message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        return apiResponseFactory.list(catalogReadService.listBrands(page, size, sort, showOnHomepage, lang), request);
    }

    @GetMapping("/brands/{slug}")
    public ApiDataResponse<Brand> getBrandBySlug(
            @PathVariable @Pattern(regexp = SLUG_REGEX, message = "Invalid slug.") String slug,
            @RequestParam(defaultValue = "vi") @Pattern(regexp = LANG_REGEX, message = "Invalid lang.") String lang,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(catalogReadService.getBrandBySlug(slug, lang), request);
    }
}
