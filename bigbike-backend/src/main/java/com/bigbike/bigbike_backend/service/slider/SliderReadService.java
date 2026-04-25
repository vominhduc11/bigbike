package com.bigbike.bigbike_backend.service.slider;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.slider.Slider;
import com.bigbike.bigbike_backend.persistence.entity.slider.SliderEntity;
import com.bigbike.bigbike_backend.persistence.repository.slider.SliderJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SliderReadService {

    private final SliderJpaRepository sliderJpaRepository;
    private final CatalogReadRepository catalogReadRepository;

    public SliderReadService(
            SliderJpaRepository sliderJpaRepository,
            CatalogReadRepository catalogReadRepository
    ) {
        this.sliderJpaRepository = sliderJpaRepository;
        this.catalogReadRepository = catalogReadRepository;
    }

    @Transactional(readOnly = true)
    public List<Slider> listByLocation(String location) {
        return sliderJpaRepository.findByLocationOrderBySortOrderAsc(location).stream()
                .map(this::toDomain)
                .toList();
    }

    private Slider toDomain(SliderEntity entity) {
        Product product = null;
        String productId = null;
        String productLink = null;

        if (entity.getProduct() != null) {
            productId = entity.getProduct().getId();
            product = catalogReadRepository.findProductById(productId).orElse(null);
            if (product != null) {
                productLink = "/sp/" + product.slug() + ".html";
            }
        }

        String link = productLink != null && !productLink.isBlank()
                ? productLink
                : entity.getExternalLink();

        return new Slider(
                entity.getId(),
                entity.getSortOrder(),
                entity.getLocation(),
                imageOrEmpty(entity.getDesktopImage()),
                entity.getMobileImage(),
                productId,
                entity.getExternalLink(),
                productLink,
                link,
                product,
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private static ImageAsset imageOrEmpty(ImageAsset image) {
        return image == null ? new ImageAsset(null, null, null, null, null, null) : image;
    }
}
