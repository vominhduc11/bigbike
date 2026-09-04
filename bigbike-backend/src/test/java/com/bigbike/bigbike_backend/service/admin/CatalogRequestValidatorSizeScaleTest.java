package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.domain.catalog.SizeScale;
import com.bigbike.bigbike_backend.domain.catalog.SizeScaleGroup;
import com.bigbike.bigbike_backend.domain.catalog.SizeScaleValue;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.service.catalog.SizeScaleCatalog;
import com.bigbike.bigbike_backend.service.catalog.SizeScaleCatalogService;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

/**
 * The "a size must belong to the product's size chart" guard had no test of its own even though it
 * is what keeps the public size filter from mixing shoe 42 with waist 42. These tests pin the three
 * error codes the admin now translates into Vietnamese, and pin that the guard still refuses.
 */
class CatalogRequestValidatorSizeScaleTest {

    private static final SizeScaleGroup CLOTHING =
            new SizeScaleGroup("clothing-letter", "Cỡ đồ mặc (chữ)", "Apparel letter sizes", 10, true);

    // The real helmet chart: 9 sizes, no 3XL.
    private static final SizeScale HELMET = new SizeScale(
            "size-scale-helmet-letter", "helmet-letter", "Cỡ chữ mũ bảo hiểm", "Cỡ chữ mũ bảo hiểm",
            CLOTHING, "clothing-letter", 10, true,
            List.of("XS", "XS/S", "S", "M", "M/L", "L", "XL", "XL/2XL", "XXL").stream()
                    .map(v -> new SizeScaleValue(v, v, v, null, null, null, 10, true))
                    .toList());

    @Test
    void requiresASizeChartWhenTheProductHasSizeOptions() {
        List<ApiErrorDetail> errors = validate(product(null, option("Size", "M")));

        assertThat(errors).singleElement().satisfies(detail -> {
            assertThat(detail.field()).isEqualTo("sizeScaleId");
            assertThat(detail.code()).isEqualTo("REQUIRED");
        });
    }

    @Test
    void reportsAnUnknownSizeChart() {
        List<ApiErrorDetail> errors = validate(product("size-scale-gone", option("Size", "M")));

        assertThat(errors).singleElement().satisfies(detail -> {
            assertThat(detail.field()).isEqualTo("sizeScaleId");
            assertThat(detail.code()).isEqualTo("NOT_FOUND");
        });
    }

    @Test
    void rejectsASizeThatDoesNotBelongToTheChosenChartAndPointsAtTheExactOption() {
        // Real case: a helmet product carrying 3XL, which the helmet chart does not define.
        List<ApiErrorDetail> errors =
                validate(product(HELMET.id(), option("Size", "M"), option("Size", "3XL")));

        assertThat(errors).singleElement().satisfies(detail -> {
            assertThat(detail.field()).isEqualTo("variants[0].options[1].optionValue");
            assertThat(detail.code()).isEqualTo("INVALID_SIZE_SCALE_VALUE");
        });
    }

    @Test
    void acceptsEverySizeOfTheChosenChartAndFoldsEquivalentSpellings() {
        // 2XL folds to XXL and "kích cỡ"/"Kích thước" are size options too — the admin size picker
        // filters on the very same rules, so what it offers is exactly what saves.
        List<ApiErrorDetail> errors = validate(product(HELMET.id(),
                option("Size", "XS/S"), option("Kích cỡ", "2XL"), option("Kích thước", " m ")));

        assertThat(errors).isEmpty();
    }

    @Test
    void ignoresProductsWithoutAnySizeOption() {
        assertThat(validate(product(null, option("màu sắc", "Đen")))).isEmpty();
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private static List<ApiErrorDetail> validate(ProductEntity product) {
        SizeScaleCatalogService catalogService = mock(SizeScaleCatalogService.class);
        when(catalogService.allCatalog()).thenReturn(new SizeScaleCatalog(List.of(HELMET)));

        @SuppressWarnings("unchecked")
        ObjectProvider<SizeScaleCatalogService> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(catalogService);

        @SuppressWarnings("unchecked")
        ObjectProvider<Object> empty = mock(ObjectProvider.class);
        when(empty.getIfAvailable()).thenReturn(null);

        CatalogRequestValidator validator = new CatalogRequestValidator(
                cast(empty), cast(empty), cast(empty), cast(empty),
                null, null, provider, null);

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductSizeScale(product, errors);
        return errors;
    }

    @SuppressWarnings("unchecked")
    private static <T> ObjectProvider<T> cast(ObjectProvider<?> provider) {
        return (ObjectProvider<T>) provider;
    }

    private static ProductEntity product(String sizeScaleId, ProductVariantOptionEntity... options) {
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setOptions(new ArrayList<>(List.of(options)));
        ProductEntity product = new ProductEntity();
        product.setSizeScaleId(sizeScaleId);
        product.setVariants(new ArrayList<>(List.of(variant)));
        return product;
    }

    private static ProductVariantOptionEntity option(String name, String value) {
        ProductVariantOptionEntity option = new ProductVariantOptionEntity();
        option.setOptionName(name);
        option.setOptionValue(value);
        return option;
    }
}
