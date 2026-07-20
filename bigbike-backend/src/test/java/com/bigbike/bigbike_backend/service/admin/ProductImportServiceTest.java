package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.HighlightRequest;
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
}
