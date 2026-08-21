package com.bigbike.bigbike_backend.service.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductRichHtmlImageEnricherTest {

    @Test
    void makesAllHandAuthoredImagesLazyButAddsDimensionsOnlyForKnownInternalMedia() {
        MediaJpaRepository media = mock(MediaJpaRepository.class);
        MediaEntity internal = new MediaEntity();
        internal.setPublicUrl("/media/inside.webp");
        internal.setWidth(1280);
        internal.setHeight(720);
        when(media.findByPublicUrlIn(anyCollection())).thenReturn(List.of(internal));

        Product result = new ProductRichHtmlImageEnricher(media).enrich(product(
                "<p><img src=\"/media/inside.webp\"><img src=\"https://legacy.example/old.jpg\" width=\"300\"></p>"));

        assertThat(result.description()).contains("src=\"/media/inside.webp\"", "loading=\"lazy\"", "decoding=\"async\"", "width=\"1280\"", "height=\"720\"");
        assertThat(result.description()).contains("src=\"https://legacy.example/old.jpg\"", "loading=\"lazy\"", "decoding=\"async\"", "width=\"300\"");
        assertThat(result.description()).doesNotContain("https://legacy.example/old.jpg\" width=\"1280\"");
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
