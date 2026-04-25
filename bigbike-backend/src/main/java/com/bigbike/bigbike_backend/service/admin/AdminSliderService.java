package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertSliderRequest;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.slider.Slider;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.slider.SliderEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.slider.SliderJpaRepository;
import com.bigbike.bigbike_backend.service.slider.SliderReadService;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminSliderService {

    private final SliderJpaRepository sliderJpaRepository;
    private final ProductJpaRepository productJpaRepository;
    private final SliderReadService sliderReadService;

    public AdminSliderService(
            SliderJpaRepository sliderJpaRepository,
            ProductJpaRepository productJpaRepository,
            SliderReadService sliderReadService
    ) {
        this.sliderJpaRepository = sliderJpaRepository;
        this.productJpaRepository = productJpaRepository;
        this.sliderReadService = sliderReadService;
    }

    @Transactional(readOnly = true)
    public List<Slider> list(String location) {
        return sliderReadService.listByLocation(location);
    }

    @Transactional
    public void delete(String sliderId) {
        SliderEntity entity = sliderJpaRepository.findById(sliderId)
                .orElseThrow(() -> new NotFoundException("Slider not found."));
        sliderJpaRepository.delete(entity);
    }

    @Transactional
    public Slider upsert(UpsertSliderRequest request) {
        if ((request.getProductId() == null || request.getProductId().isBlank())
                && (request.getExternalLink() == null || request.getExternalLink().isBlank())) {
            throw ValidationException.fromField(
                    "link",
                    "REQUIRED",
                    "Either productId or externalLink is required."
            );
        }

        Instant now = Instant.now();
        SliderEntity entity = sliderJpaRepository
                .findByLocationAndSortOrder(request.getLocation(), request.getSortOrder())
                .orElseGet(() -> {
                    SliderEntity created = new SliderEntity();
                    created.setId("slider_" + request.getLocation() + "_" + request.getSortOrder());
                    created.setCreatedAt(now);
                    return created;
                });

        ProductEntity product = null;
        if (request.getProductId() != null && !request.getProductId().isBlank()) {
            product = productJpaRepository.findById(request.getProductId())
                    .orElseThrow(() -> new NotFoundException("Product not found."));
        }

        entity.setLocation(request.getLocation());
        entity.setSortOrder(request.getSortOrder());
        entity.setDesktopImage(toImageAsset(request.getDesktopImage()));
        entity.setMobileImage(toImageAsset(request.getMobileImage()));
        entity.setProduct(product);
        entity.setExternalLink(blankToNull(request.getExternalLink()));
        entity.setUpdatedAt(now);

        sliderJpaRepository.save(entity);
        return sliderReadService.listByLocation(entity.getLocation()).stream()
                .filter(slider -> slider.id().equals(entity.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Slider was saved but not found."));
    }

    private static ImageAsset toImageAsset(ImageAssetRequest request) {
        if (request == null) {
            return new ImageAsset(null, null, null, null, null, null);
        }
        return new ImageAsset(null, request.getUrl(), request.getAlt(), request.getWidth(), request.getHeight(), request.getMimeType());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
