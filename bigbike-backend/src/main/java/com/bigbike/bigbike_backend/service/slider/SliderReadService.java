package com.bigbike.bigbike_backend.service.slider;

import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.slider.Slider;
import com.bigbike.bigbike_backend.persistence.entity.slider.SliderEntity;
import com.bigbike.bigbike_backend.persistence.repository.slider.SliderJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SliderReadService {

    private final SliderJpaRepository sliderJpaRepository;
    private final CatalogReadRepository catalogReadRepository;

    @Transactional(readOnly = true)
    public List<Slider> listByLocation(String location) {
        return sliderJpaRepository.findByLocationOrderBySortOrderAsc(location).stream()
                .map(this::toDomain)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Slider> listActiveByLocation(String location) {
        return sliderJpaRepository.findByLocationAndIsActiveTrueOrderBySortOrderAsc(location).stream()
                .map(this::toDomain)
                .toList();
    }

    @Transactional(readOnly = true)
    public Slider findById(String id) {
        return sliderJpaRepository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new IllegalStateException("Slider was saved but not found: " + id));
    }

    Slider toDomain(SliderEntity entity) {
        Product product = null;
        String productId = null;
        String productLink = null;

        if (entity.getProduct() != null) {
            productId = entity.getProduct().getId();
            // Listing projection — the slider only ever reads slug/name/category/sku for
            // the link + caption, not the full 11-relation product-detail graph (gallery/
            // videos/specs/faqs/commitments/specStats/trustBadges/highlights/related/
            // accessory). "vi" matches the previous findProductById() behaviour, which
            // had no locale param and always resolved Vietnamese-canonical content.
            product = catalogReadRepository.findProductByIdPublicViewForListing(productId, "vi").orElse(null);
            if (product != null) {
                productLink = "/sp/" + product.slug() + ".html";
            }
        }

        String link = productLink;

        return new Slider(
                entity.getId(),
                entity.getSortOrder(),
                entity.getLocation(),
                entity.isActive(),
                entity.getDesktopImage(),
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
}
