package com.bigbike.bigbike_backend.service.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CatalogVisualLabelLocalizerTest {

    private final CatalogVisualFacetCatalog catalog = new CatalogVisualFacetCatalog(List.of(
            definition("COLOR", "do", "Đỏ", "Red"),
            definition("COLOR", "xanh-duong", "Xanh dương", "Blue"),
            definition("FINISH", "bong", "Bóng", "Gloss")));

    @Test
    void translatesOnlyConfiguredBaseFacetLabelsForTheAssistantPath() {
        assertThat(CatalogVisualLabelLocalizer.localizeFacetLabels(
                "Đỏ bóng CYBORG BLUE tem-do", catalog))
                .isEqualTo("Red Gloss CYBORG BLUE tem-do");
    }

    @Test
    void supplementsOnlyTheAccessibilityPathWithApprovedDisplayTerms() {
        var terms = List.of(
                new CatalogVisualLabelLocalizer.Replacement("SỌC", "Stripe"),
                new CatalogVisualLabelLocalizer.Replacement("XANH NHẠT", "Light Blue"),
                new CatalogVisualLabelLocalizer.Replacement("XANH RÊU", "Olive"),
                new CatalogVisualLabelLocalizer.Replacement("XANH ĐẬM", "Dark Blue"),
                new CatalogVisualLabelLocalizer.Replacement("tem-do", "Red decal"),
                new CatalogVisualLabelLocalizer.Replacement("tem-trang", "White decal"),
                new CatalogVisualLabelLocalizer.Replacement("tem-xam", "Gray decal"));

        assertThat(CatalogVisualLabelLocalizer.localizeAccessibilityLabel(
                "SỌC XANH NHẠT XANH RÊU XANH ĐẬM tem-do tem-trang tem-xam Đỏ bóng CYBORG BLUE",
                catalog,
                terms))
                .isEqualTo(
                        "Stripe Light Blue Olive Dark Blue Red decal White decal Gray decal Red Gloss CYBORG BLUE");
    }

    private static CatalogVisualFacetCatalog.Definition definition(
            String type,
            String key,
            String labelVi,
            String labelEn
    ) {
        return new CatalogVisualFacetCatalog.Definition(type, key, labelVi, labelEn, null, 0, Set.of());
    }
}
