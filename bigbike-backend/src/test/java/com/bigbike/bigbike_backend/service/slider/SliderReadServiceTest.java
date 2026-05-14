package com.bigbike.bigbike_backend.service.slider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.slider.Slider;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.slider.SliderEntity;
import com.bigbike.bigbike_backend.persistence.repository.slider.SliderJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SliderReadServiceTest {

    @Test
    void toDomain_prefersResolvedProductLink() {
        CatalogReadRepository catalogReadRepository = mock(CatalogReadRepository.class);
        SliderReadService service = new SliderReadService(mock(SliderJpaRepository.class), catalogReadRepository);

        ProductEntity productEntity = new ProductEntity();
        productEntity.setId("prod_ls2_ff800");

        SliderEntity entity = new SliderEntity();
        entity.setId("slider_home_product");
        entity.setLocation("home");
        entity.setSortOrder(0);
        entity.setDesktopImage(new ImageAsset(null, "/media/sliders/home.jpg", "Slide", 1200, 600, "image/jpeg"));
        entity.setProduct(productEntity);
        entity.setExternalLink("/fallback");
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());

        when(catalogReadRepository.findProductById("prod_ls2_ff800"))
                .thenReturn(Optional.of(new Product(
                        "prod_ls2_ff800",
                        "sku-1",
                        "mu-bao-hiem-ls2-ff800",
                        "LS2 FF800",
                        null,
                        null,
                        null,
                        null,
                        List.of(),
                        null,
                        List.of(),
                        List.of(),
                        new ProductPrice(BigDecimal.valueOf(3290000), null, null, "VND"),
                        List.of(),
                        List.of(),
                        ProductStockState.IN_STOCK,
                        null,
                        null,
                        PublishStatus.PUBLISHED,
                        com.bigbike.bigbike_backend.domain.catalog.HomepageBlock.FEATURED_GRID,
                        null,
                        null,
                        null,
                        null,
                        null,
                        Instant.now(),
                        Instant.now()
                )));

        Slider slider = service.toDomain(entity);
        assertThat(slider.productLink()).isEqualTo("/sp/mu-bao-hiem-ls2-ff800.html");
        assertThat(slider.link()).isEqualTo("/sp/mu-bao-hiem-ls2-ff800.html");
    }

    @Test
    void toDomain_fallsBackToExternalLinkWhenProductMissing() {
        SliderReadService service = new SliderReadService(mock(SliderJpaRepository.class), mock(CatalogReadRepository.class));

        SliderEntity entity = new SliderEntity();
        entity.setId("slider_home_external");
        entity.setLocation("home");
        entity.setSortOrder(1);
        entity.setDesktopImage(new ImageAsset(null, "/media/sliders/home-2.jpg", "Slide", 1200, 600, "image/jpeg"));
        entity.setExternalLink("/tai-nghe-bluetooth.html");
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());

        Slider slider = service.toDomain(entity);
        assertThat(slider.productLink()).isNull();
        assertThat(slider.link()).isEqualTo("/tai-nghe-bluetooth.html");
    }
}
