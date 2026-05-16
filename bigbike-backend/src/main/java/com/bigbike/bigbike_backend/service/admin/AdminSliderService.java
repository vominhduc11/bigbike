package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.PatchSliderRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ReorderSlidersRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertSliderRequest;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.slider.Slider;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.slider.SliderEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.slider.SliderJpaRepository;
import com.bigbike.bigbike_backend.service.security.SafeMediaAssetUrlPolicy;
import com.bigbike.bigbike_backend.service.security.SafePublicLinkPolicy;
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
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminSliderService {

    private final SliderJpaRepository sliderJpaRepository;
    private final ProductJpaRepository productJpaRepository;
    private final SliderReadService sliderReadService;
    private final WebRevalidationService webRevalidationService;
    private final SafeMediaAssetUrlPolicy safeMediaAssetUrlPolicy;
    private final AuditLogJpaRepository auditLogRepo;

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
        String before = sliderSnapshot(entity);
        sliderJpaRepository.delete(entity);
        webRevalidationService.revalidate("sliders");
        auditLog("SLIDER_DELETED", sliderId, before, null);
    }

    @Transactional
    public String create(UpsertSliderRequest request) {
        String productId = blankToNull(request.getProductId());
        String externalLink = blankToNull(request.getExternalLink());
        if (productId == null && externalLink == null) {
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

        validateImageAssets(request.getDesktopImage(), "desktopImage");
        validateImageAssets(request.getMobileImage(), "mobileImage");

        if (externalLink != null) {
            externalLink = SafePublicLinkPolicy.validateOrThrow(externalLink, "externalLink");
        }

        ProductEntity product = null;
        if (productId != null) {
            product = productJpaRepository.findById(productId)
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
        entity.setExternalLink(externalLink);
        entity.setActive(request.getIsActive() == null || request.getIsActive());
        entity.setUpdatedAt(now);

        sliderJpaRepository.save(entity);
        webRevalidationService.revalidate("sliders");
        auditLog("SLIDER_CREATED", entity.getId(), null, sliderSnapshot(entity));
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
        auditLog("SLIDER_REORDERED", location,
                null, "{\"location\":\"" + esc(location) + "\",\"itemCount\":" + items.size() + "}");
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
            String productId = blankToNull(request.getProductId());
            String externalLink = blankToNull(request.getExternalLink());
            if (productId == null && externalLink == null) {
                throw ValidationException.fromField("link", "REQUIRED",
                        "Either productId or externalLink is required.");
            }
            validateImageAssets(request.getDesktopImage(), "desktopImage");
            validateImageAssets(request.getMobileImage(), "mobileImage");
            if (externalLink != null) {
                externalLink = SafePublicLinkPolicy.validateOrThrow(externalLink, "externalLink");
            }

            entity.setLocation(request.getLocation());
            entity.setDesktopImage(toImageAsset(request.getDesktopImage()));
            entity.setMobileImage(toImageAsset(request.getMobileImage()));
            entity.setExternalLink(externalLink);

            if (productId != null) {
                ProductEntity product = productJpaRepository.findById(productId)
                        .orElseThrow(() -> new NotFoundException("Product not found."));
                entity.setProduct(product);
            } else {
                entity.setProduct(null);
            }
        }

        entity.setUpdatedAt(now);
        sliderJpaRepository.save(entity);
        webRevalidationService.revalidate("sliders");
        auditLog("SLIDER_UPDATED", sliderId, null, sliderSnapshot(entity));
    }

    private static ImageAsset toImageAsset(ImageAssetRequest request) {
        if (request == null) {
            return new ImageAsset(null, null, null, null, null, null);
        }
        return new ImageAsset(null, request.getUrl(), request.getAlt(), request.getWidth(), request.getHeight(), request.getMimeType());
    }

    private void validateImageAssets(ImageAssetRequest request, String fieldPrefix) {
        if (request == null) {
            return;
        }
        safeMediaAssetUrlPolicy.validateImageUrlOrThrow(request.getUrl(), fieldPrefix + ".url");
        if (request.getWidth() != null && request.getWidth() < 0) {
            throw ValidationException.fromField(fieldPrefix + ".width", "INVALID_VALUE", "Image width must be >= 0.");
        }
        if (request.getHeight() != null && request.getHeight() < 0) {
            throw ValidationException.fromField(fieldPrefix + ".height", "INVALID_VALUE", "Image height must be >= 0.");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    // ── Audit helpers (CMS-010) ───────────────────────────────────────────────

    private void auditLog(String action, String sliderId, String before, String after) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(resolveActorId());
        log.setAction(action);
        log.setResourceType("SLIDER");
        // Slider IDs are strings (not UUIDs); store in before/after JSON, leave resourceId null.
        log.setResourceId(null);
        log.setBeforeData(before);
        log.setAfterData(after != null ? after : "{\"id\":\"" + esc(sliderId) + "\"}");
        log.setCreatedAt(Instant.now());
        auditLogRepo.save(log);
    }

    private static String sliderSnapshot(SliderEntity e) {
        return "{\"id\":\"" + esc(e.getId())
                + "\",\"location\":\"" + esc(e.getLocation())
                + "\",\"sortOrder\":" + e.getSortOrder()
                + ",\"active\":" + e.isActive() + "}";
    }

    /** Resolves the authenticated admin's UUID from the Spring Security context, or null. */
    private static UUID resolveActorId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try { return UUID.fromString(principal.id()); } catch (IllegalArgumentException ignored) {}
        }
        return null;
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
