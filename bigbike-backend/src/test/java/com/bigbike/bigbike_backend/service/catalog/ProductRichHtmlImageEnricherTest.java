package com.bigbike.bigbike_backend.service.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;
import org.jsoup.Jsoup;

import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.SuitabilitySection;
import com.bigbike.bigbike_backend.domain.catalog.SizeGuideSection;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductRichHtmlImageEnricherTest {

    @Test
    void makesAllHandAuthoredImagesLazyButAddsDimensionsOnlyForKnownInternalMedia() {
        MediaJpaRepository media = mock(MediaJpaRepository.class);
        var internal = dimensions("/media/inside.webp", 1280, 720);
        when(media.findImageDimensionsByPublicUrlIn(anyCollection())).thenReturn(List.of(internal));

        Product result = new ProductRichHtmlImageEnricher(media).enrich(product(
                "<p><img src=\"/media/inside.webp\"><img src=\"https://legacy.example/old.jpg\" width=\"300\"></p>"));

        assertThat(result.description()).contains("src=\"/media/inside.webp\"", "loading=\"lazy\"", "decoding=\"async\"", "width=\"1280\"", "height=\"720\"");
        assertThat(result.description()).contains("src=\"https://legacy.example/old.jpg\"", "loading=\"lazy\"", "decoding=\"async\"", "width=\"300\"");
        assertThat(result.description()).doesNotContain("https://legacy.example/old.jpg\" width=\"1280\"");
    }

    @Test
    void preservesExistingAttributesAndNormalizesRepeatedHtmlAcrossAllRichSections() {
        MediaJpaRepository media = mock(MediaJpaRepository.class);
        when(media.findImageDimensionsByPublicUrlIn(anyCollection())).thenReturn(List.of(
                dimensions("/media/inside.webp", 1280, 720),
                dimensions("/media/invalid.webp", 0, 720)));
        String html = "<P>Tiếng Việt &amp; nội dung<img src='/media/inside.webp' width='300' "
                + "loading='eager' decoding='sync'><img src='/media/invalid.webp'></P>";
        var heading = DescriptionBlock.HeadingBlock.builder().type("heading").text("Thông tin").build();
        Product input = product(html).withRichHtml(html, List.of(
                DescriptionBlock.ParagraphBlock.builder().type("paragraph").html(html).build(),
                DescriptionBlock.CalloutBlock.builder().type("callout").variant("info").html(html).build(),
                DescriptionBlock.FeatureBlock.builder().type("feature").heading("Đặc điểm").html(html).build(),
                heading), SuitabilitySection.builder().title("Phù hợp").html(html).build(),
                SizeGuideSection.builder().title("Kích thước").html(html).build());

        Product result = new ProductRichHtmlImageEnricher(media).enrich(input);
        var document = Jsoup.parseBodyFragment(result.description());
        assertThat(document.select("img").get(0).attr("width")).isEqualTo("300");
        assertThat(document.select("img").get(0).attr("height")).isEqualTo("720");
        assertThat(document.select("img").get(0).attr("loading")).isEqualTo("eager");
        assertThat(document.select("img").get(0).attr("decoding")).isEqualTo("sync");
        assertThat(document.select("img").get(1).hasAttr("width")).isFalse();
        assertThat(result.suitabilitySection().getHtml()).isEqualTo(result.description());
        assertThat(result.sizeGuideSection().getHtml()).isEqualTo(result.description());
        assertThat(((DescriptionBlock.ParagraphBlock) result.descriptionBlocks().get(0)).getHtml())
                .isEqualTo(result.description());
        assertThat(((DescriptionBlock.CalloutBlock) result.descriptionBlocks().get(1)).getHtml())
                .isEqualTo(result.description());
        assertThat(((DescriptionBlock.FeatureBlock) result.descriptionBlocks().get(2)).getHtml())
                .isEqualTo(result.description());
        assertThat(result.descriptionBlocks().get(3)).isSameAs(heading);
        assertThat(input.description()).isEqualTo(html);
        verify(media).findImageDimensionsByPublicUrlIn(java.util.Set.of("/media/inside.webp", "/media/invalid.webp"));
        verify(media, never()).findByPublicUrlIn(anyCollection());
    }

    @Test
    void preservesAbsentAndBlankFragmentsAndSkipsDatabaseWithoutImageSources() {
        MediaJpaRepository media = mock(MediaJpaRepository.class);
        var enricher = new ProductRichHtmlImageEnricher(media);
        assertThat(enricher.enrich(null)).isNull();
        assertThat(enricher.enrich(product(null)).description()).isNull();
        assertThat(enricher.enrich(product("  ")).description()).isEqualTo("  ");
        assertThat(enricher.enrich(product("<P>Text &amp; text</P>")).description())
                .isEqualTo("<p>Text &amp; text</p>");
        verifyNoInteractions(media);
    }

    private static MediaJpaRepository.PublicImageDimensions dimensions(String url, Integer width, Integer height) {
        return new MediaJpaRepository.PublicImageDimensions() {
            public String getPublicUrl() { return url; }
            public Integer getWidth() { return width; }
            public Integer getHeight() { return height; }
        };
    }

    private static Product product(String description) {
        Instant now = Instant.parse("2026-08-21T00:00:00Z");
        return new Product(
                "product-1", "SKU-1", "product-1", null, "Sản phẩm", null, description, null, null,
                List.of(), null, List.of(), List.of(), new ProductPrice(BigDecimal.TEN, null, "VND"), List.of(),
                ProductStockState.IN_STOCK, true, PublishStatus.PUBLISHED, false, null, HomepageBlock.NONE, null,
                null, null, List.of(), List.of(), ProductHighlights.EMPTY, null, null, null, null, null, null,
                null, null, List.of(), List.of(), null, null, null, null, null, now, now);
    }
}
