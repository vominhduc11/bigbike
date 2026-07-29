package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.HighlightRequest;
import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductImportServiceTest {

    @Test
    void removesEmbeddedImagesFromImportedHighlightsWithoutRemovingTheirText() {
        HighlightRequest highlight = HighlightRequest.builder()
                .content("<p><strong>Nhẹ</strong><img src=\"https://example.com/weight.jpg\">, thoáng khí</p>")
                .contentEn("<p><img src=\"https://example.com/weight-en.jpg\">Lightweight</p>")
                .build();

        ProductImportService.stripHighlightInlineImages(List.of(highlight));

        assertThat(highlight.getContent()).contains("<strong>Nhẹ</strong>").contains("thoáng khí").doesNotContain("<img");
        assertThat(highlight.getContentEn()).contains("Lightweight").doesNotContain("<img");
    }

    @Test
    void exportKeepsOnlyImportableFeaturesAndNormalizesLegacyAutoSides() {
        DescriptionBlock.ParagraphBlock paragraph = DescriptionBlock.ParagraphBlock.builder()
                .type("paragraph")
                .html("<p>Legacy paragraph</p>")
                .build();
        DescriptionBlock.FeatureBlock firstAuto = DescriptionBlock.FeatureBlock.builder()
                .type("feature")
                .side("auto")
                .heading("Khối một")
                .html("<p>Nội dung một</p>")
                .build();
        DescriptionBlock.ImageBlock image = DescriptionBlock.ImageBlock.builder()
                .type("image")
                .url("https://example.com/legacy.jpg")
                .build();
        DescriptionBlock.FeatureBlock secondAuto = DescriptionBlock.FeatureBlock.builder()
                .type("feature")
                .heading("Khối hai")
                .html("<p>Nội dung hai</p>")
                .build();
        DescriptionBlock.FeatureBlock explicitLeft = DescriptionBlock.FeatureBlock.builder()
                .type("feature")
                .side("left")
                .heading("Khối ba")
                .build();

        List<DescriptionBlock> exported = ProductImportService.exportableProductDescriptionBlocks(
                List.of(paragraph, firstAuto, image, secondAuto, explicitLeft));

        assertThat(exported).hasSize(3).allMatch(DescriptionBlock.FeatureBlock.class::isInstance);
        assertThat(exported)
                .extracting(block -> ((DescriptionBlock.FeatureBlock) block).getSide())
                .containsExactly("right", "left", "left");
        assertThat(((DescriptionBlock.FeatureBlock) exported.get(0)).getHeading()).isEqualTo("Khối một");
        assertThat(firstAuto.getSide()).isEqualTo("auto");
        assertThat(secondAuto.getSide()).isNull();
    }
}
