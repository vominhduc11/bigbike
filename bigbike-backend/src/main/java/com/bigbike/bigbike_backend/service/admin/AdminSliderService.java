package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.PatchSliderRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ReorderSlidersRequest;
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
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminSliderService {

    private final SliderJpaRepository sliderJpaRepository;
    private final ProductJpaRepository productJpaRepository;
    private final SliderReadService sliderReadService;
    private final WebRevalidationService webRevalidationService;

    public AdminSliderService(
            SliderJpaRepository sliderJpaRepository,
            ProductJpaRepository productJpaRepository,
            SliderReadService sliderReadService,
            WebRevalidationService webRevalidationService
    ) {
        this.sliderJpaRepository = sliderJpaRepository;
        this.productJpaRepository = productJpaRepository;
        this.sliderReadService = sliderReadService;
        this.webRevalidationService = webRevalidationService;
    }

    @Transactional(readOnly = true)
    public List<Slider> list(String location) {
        return sliderReadService.listByLocation(location);
    }

    @Transactional(readOnly = true)
    public Slider findById(String id) {
        return sliderReadService.findById(id);
    }

    @Transactional
    public void delete(String sliderId) {
        SliderEntity entity = sliderJpaRepository.findById(sliderId)
                .orElseThrow(() -> new NotFoundException("Slider not found."));
        sliderJpaRepository.delete(entity);
        webRevalidationService.revalidate("sliders");
    }

    @Transactional
    public String create(UpsertSliderRequest request) {
        if ((request.getProductId() == null || request.getProductId().isBlank())
                && (request.getExternalLink() == null || request.getExternalLink().isBlank())) {
            throw ValidationException.fromField(
                    "link",
                    "REQUIRED",
                    "Either productId or externalLink is required."
            );
        }

        sliderJpaRepository.findByLocationAndSortOrder(request.getLocation(), request.getSortOrder())
                .ifPresent(existing -> {
                    throw new ConflictException(
                            "Sort order " + request.getSortOrder() + " is already occupied in location '"
                                    + request.getLocation() + "'. Use PATCH to update or pick a different order.");
                });

        ProductEntity product = null;
        if (request.getProductId() != null && !request.getProductId().isBlank()) {
            product = productJpaRepository.findById(request.getProductId())
                    .orElseThrow(() -> new NotFoundException("Product not found."));
        }

        Instant now = Instant.now();
        SliderEntity entity = new SliderEntity();
        entity.setId("slider_" + UUID.randomUUID());
        entity.setCreatedAt(now);
        entity.setLocation(request.getLocation());
        entity.setSortOrder(request.getSortOrder());
        entity.setDesktopImage(toImageAsset(request.getDesktopImage()));
        entity.setMobileImage(toImageAsset(request.getMobileImage()));
        entity.setProduct(product);
        entity.setExternalLink(blankToNull(request.getExternalLink()));
        entity.setActive(request.getIsActive() == null || request.getIsActive());
        entity.setUpdatedAt(now);

        sliderJpaRepository.save(entity);
        webRevalidationService.revalidate("sliders");
        return entity.getId();
    }

    @Transactional
    public void reorder(ReorderSlidersRequest request) {
        String location = request.getLocation();
        List<ReorderSlidersRequest.Item> items = request.getItems();

        Map<String, SliderEntity> byId = sliderJpaRepository
                .findByLocationOrderBySortOrderAsc(location)
                .stream()
                .collect(Collectors.toMap(SliderEntity::getId, e -> e));

        for (ReorderSlidersRequest.Item item : items) {
            if (!byId.containsKey(item.getId())) {
                throw new NotFoundException("Slider not found in location '" + location + "': " + item.getId());
            }
        }

        Set<Integer> seenOrders = new HashSet<>();
        for (ReorderSlidersRequest.Item item : items) {
            if (!seenOrders.add(item.getSortOrder())) {
                throw ValidationException.fromField("sortOrder", "DUPLICATE",
                        "Duplicate sortOrder value in request: " + item.getSortOrder());
            }
        }

        Instant now = Instant.now();

        // Step 1: move to unique negative space to avoid UNIQUE(location, sort_order) violations
        // when final positions overlap with current positions (e.g. two items swapping).
        for (ReorderSlidersRequest.Item item : items) {
            SliderEntity entity = byId.get(item.getId());
            entity.setSortOrder(-(item.getSortOrder() + 1));
            entity.setUpdatedAt(now);
        }
        sliderJpaRepository.flush();

        // Step 2: apply final sort orders (no conflicts since negative space is now clear)
        for (ReorderSlidersRequest.Item item : items) {
            byId.get(item.getId()).setSortOrder(item.getSortOrder());
        }

        webRevalidationService.revalidate("sliders");
        // NOTE: caller (controller) fetches the updated list in a fresh read-only transaction
        // after this write transaction commits, avoiding lazy-loading within a write context.
    }

    @Transactional
    public void patch(String sliderId, PatchSliderRequest request) {
        SliderEntity entity = sliderJpaRepository.findById(sliderId)
                .orElseThrow(() -> new NotFoundException("Slider not found."));

        Instant now = Instant.now();

        boolean sortOrderChanging = request.getSortOrder() != null
                && !request.getSortOrder().equals(entity.getSortOrder());
        boolean locationChanging = request.isFullEdit()
                && !request.getLocation().equals(entity.getLocation());
        if (sortOrderChanging || locationChanging) {
            int targetSortOrder = request.getSortOrder() != null ? request.getSortOrder() : entity.getSortOrder();
            String targetLocation = request.isFullEdit() ? request.getLocation() : entity.getLocation();
            sliderJpaRepository.findByLocationAndSortOrder(targetLocation, targetSortOrder)
                    .ifPresent(existing -> {
                        if (!existing.getId().equals(sliderId)) {
                            throw new ConflictException(
                                    "Sort order " + targetSortOrder + " is already occupied in location '"
                                            + targetLocation + "'.");
                        }
                    });
        }

        if (request.getSortOrder() != null) entity.setSortOrder(request.getSortOrder());
        if (request.getIsActive() != null) entity.setActive(request.getIsActive());

        if (request.isFullEdit()) {
            entity.setLocation(request.getLocation());
            entity.setDesktopImage(toImageAsset(request.getDesktopImage()));
            entity.setMobileImage(toImageAsset(request.getMobileImage()));
            entity.setExternalLink(blankToNull(request.getExternalLink()));

            if (request.getProductId() != null && !request.getProductId().isBlank()) {
                ProductEntity product = productJpaRepository.findById(request.getProductId())
                        .orElseThrow(() -> new NotFoundException("Product not found."));
                entity.setProduct(product);
            } else {
                entity.setProduct(null);
            }

            if ((request.getProductId() == null || request.getProductId().isBlank())
                    && (request.getExternalLink() == null || request.getExternalLink().isBlank())) {
                throw ValidationException.fromField("link", "REQUIRED",
                        "Either productId or externalLink is required.");
            }
        }

        entity.setUpdatedAt(now);
        sliderJpaRepository.save(entity);
        webRevalidationService.revalidate("sliders");
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
