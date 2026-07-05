package com.bigbike.bigbike_backend.api.error;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import org.junit.jupiter.api.Test;

/**
 * Reproduces the "Operation violates a data integrity constraint" 409 report on
 * product EN-slug/SKU saves: known constraint violations must surface a
 * friendly, field-level error instead of the generic sentence with empty
 * details (see BUSINESS_RULES.md PRODUCT_RULE_003 / PRODUCT_RULE_SKU_001).
 */
class GlobalExceptionHandlerTest {

    @Test
    void slugEnConstraint_mapsToTranslationsEnSlugField() {
        ApiErrorDetail detail = GlobalExceptionHandler.friendlyConstraintError(
                "ERROR: duplicate key value violates unique constraint \"ux_products_slug_en\"\n"
                        + "  Detail: Key (slug_en)=(agv-k1s) already exists.");

        assertThat(detail).isNotNull();
        assertThat(detail.field()).isEqualTo("translations.en.slug");
        assertThat(detail.code()).isEqualTo("DUPLICATE");
        assertThat(detail.message()).isNotBlank();
    }

    @Test
    void viSlugConstraint_mapsToSlugField() {
        ApiErrorDetail detail = GlobalExceptionHandler.friendlyConstraintError(
                "ERROR: duplicate key value violates unique constraint \"products_slug_key\"\n"
                        + "  Detail: Key (slug)=(mu-bao-hiem-agv-k1s) already exists.");

        assertThat(detail).isNotNull();
        assertThat(detail.field()).isEqualTo("slug");
        assertThat(detail.code()).isEqualTo("DUPLICATE");
    }

    @Test
    void variantSkuConstraint_mapsToVariantsField() {
        ApiErrorDetail detail = GlobalExceptionHandler.friendlyConstraintError(
                "ERROR: duplicate key value violates unique constraint \"ux_product_variants_sku_lower\"\n"
                        + "  Detail: Key (lower(sku::text))=(sena50s-d) already exists.");

        assertThat(detail).isNotNull();
        assertThat(detail.field()).isEqualTo("variants");
        assertThat(detail.code()).isEqualTo("DUPLICATE");
    }

    @Test
    void unknownConstraint_fallsBackToNull_soCallerKeepsGenericMessage() {
        ApiErrorDetail detail = GlobalExceptionHandler.friendlyConstraintError(
                "ERROR: duplicate key value violates unique constraint \"some_other_constraint\"");

        assertThat(detail).isNull();
    }

    @Test
    void nullCause_fallsBackToNull() {
        assertThat(GlobalExceptionHandler.friendlyConstraintError(null)).isNull();
    }
}
