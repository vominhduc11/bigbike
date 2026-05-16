package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.PatchHomeVideoRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ReorderHomeVideosRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertHomeVideoRequest;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.video.HomeVideo;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.video.HomeVideoEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.video.HomeVideoJpaRepository;
import com.bigbike.bigbike_backend.service.security.HomeVideoUrlPolicy;
import com.bigbike.bigbike_backend.service.security.SafeMediaAssetUrlPolicy;
import com.bigbike.bigbike_backend.service.video.HomeVideoReadService;
import com.bigbike.bigbike_backend.service.video.YouTubeUrlParser;
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
public class AdminHomeVideoService {

    private final HomeVideoJpaRepository homeVideoJpaRepository;
    private final HomeVideoReadService homeVideoReadService;
    private final WebRevalidationService webRevalidationService;
    private final HomeVideoUrlPolicy homeVideoUrlPolicy;
    private final SafeMediaAssetUrlPolicy safeMediaAssetUrlPolicy;
    private final AuditLogJpaRepository auditLogRepo;

    @Transactional(readOnly = true)
    public List<HomeVideo> list() {
        return homeVideoReadService.listAll();
    }

    @Transactional
    public HomeVideo create(UpsertHomeVideoRequest request) {
        ensureSortOrderAvailable(request.getSortOrder(), null);
        validateThumbnail(request.getThumbnail());

        Instant now = Instant.now();
        HomeVideoEntity entity = new HomeVideoEntity();
        String videoUrl = homeVideoUrlPolicy.validateOrThrow(request.getVideoUrl(), "videoUrl");
        entity.setId("hv_" + UUID.randomUUID());
        entity.setSortOrder(request.getSortOrder());
        entity.setTitle(request.getTitle().trim());
        entity.setVideoUrl(videoUrl);
        entity.setYoutubeId(YouTubeUrlParser.extractId(videoUrl));
        entity.setThumbnail(toImageAsset(request.getThumbnail()));
        entity.setActive(request.getIsActive() == null || request.getIsActive());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        homeVideoJpaRepository.save(entity);
        webRevalidationService.revalidate("home-videos");
        auditLog("HOME_VIDEO_CREATED", entity.getId(), null, videoSnapshot(entity));
        return homeVideoReadService.findById(entity.getId());
    }

    @Transactional
    public HomeVideo patch(String id, PatchHomeVideoRequest request) {
        HomeVideoEntity entity = homeVideoJpaRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Home video not found."));

        if (request.getTitle() != null) {
            if (request.getTitle().isBlank()) {
                throw ValidationException.fromField("title", "REQUIRED", "title must not be blank.");
            }
            entity.setTitle(request.getTitle().trim());
        }
        if (request.getVideoUrl() != null) {
            if (request.getVideoUrl().isBlank()) {
                throw ValidationException.fromField("videoUrl", "REQUIRED", "videoUrl must not be blank.");
            }
            String videoUrl = homeVideoUrlPolicy.validateOrThrow(request.getVideoUrl(), "videoUrl");
            entity.setVideoUrl(videoUrl);
            entity.setYoutubeId(YouTubeUrlParser.extractId(videoUrl));
        }
        if (request.getSortOrder() != null) {
            ensureSortOrderAvailable(request.getSortOrder(), entity.getId());
            entity.setSortOrder(request.getSortOrder());
        }
        if (request.getIsActive() != null) entity.setActive(request.getIsActive());
        if (request.isClearThumbnail()) {
            entity.setThumbnail(null);
        } else if (request.getThumbnail() != null) {
            validateThumbnail(request.getThumbnail());
            entity.setThumbnail(toImageAsset(request.getThumbnail()));
        }

        entity.setUpdatedAt(Instant.now());
        homeVideoJpaRepository.save(entity);
        webRevalidationService.revalidate("home-videos");
        auditLog("HOME_VIDEO_UPDATED", id, null, videoSnapshot(entity));
        return homeVideoReadService.findById(entity.getId());
    }

    @Transactional
    public void delete(String id) {
        HomeVideoEntity entity = homeVideoJpaRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Home video not found."));
        String before = videoSnapshot(entity);
        homeVideoJpaRepository.delete(entity);
        webRevalidationService.revalidate("home-videos");
        auditLog("HOME_VIDEO_DELETED", id, before, null);
    }

    @Transactional
    public List<HomeVideo> reorder(ReorderHomeVideosRequest request) {
        List<ReorderHomeVideosRequest.Item> items = request.getItems();

        Map<String, HomeVideoEntity> byId = homeVideoJpaRepository.findAllByOrderBySortOrderAsc()
                .stream()
                .collect(Collectors.toMap(HomeVideoEntity::getId, e -> e));

        for (ReorderHomeVideosRequest.Item item : items) {
            if (!byId.containsKey(item.getId())) {
                throw new NotFoundException("Home video not found: " + item.getId());
            }
        }

        Set<Integer> seenOrders = new HashSet<>();
        for (ReorderHomeVideosRequest.Item item : items) {
            if (!seenOrders.add(item.getSortOrder())) {
                throw ValidationException.fromField("sortOrder", "DUPLICATE",
                        "Duplicate sortOrder in request: " + item.getSortOrder());
            }
        }

        Instant now = Instant.now();

        // Two-pass: first move all to negative temp values, then apply final values.
        // Prevents sort_order conflicts within the same flush if a UNIQUE constraint is ever added.
        for (ReorderHomeVideosRequest.Item item : items) {
            HomeVideoEntity entity = byId.get(item.getId());
            entity.setSortOrder(-(item.getSortOrder() + 1));
            entity.setUpdatedAt(now);
        }
        homeVideoJpaRepository.flush();

        for (ReorderHomeVideosRequest.Item item : items) {
            byId.get(item.getId()).setSortOrder(item.getSortOrder());
        }

        webRevalidationService.revalidate("home-videos");
        auditLog("HOME_VIDEO_REORDERED", "batch",
                null, "{\"itemCount\":" + items.size() + "}");
        return list();
    }

    private static ImageAsset toImageAsset(ImageAssetRequest req) {
        if (req == null) return null;
        return new ImageAsset(null, req.getUrl(), req.getAlt(), req.getWidth(), req.getHeight(), req.getMimeType());
    }

    private void ensureSortOrderAvailable(Integer sortOrder, String currentId) {
        homeVideoJpaRepository.findBySortOrder(sortOrder)
                .ifPresent(existing -> {
                    if (currentId == null || !existing.getId().equals(currentId)) {
                        throw new ConflictException("Sort order " + sortOrder + " is already occupied.");
                    }
                });
    }

    private void validateThumbnail(ImageAssetRequest req) {
        if (req == null) {
            return;
        }
        safeMediaAssetUrlPolicy.validateImageUrlOrThrow(req.getUrl(), "thumbnail.url");
        if (req.getWidth() != null && req.getWidth() < 0) {
            throw ValidationException.fromField("thumbnail.width", "INVALID_VALUE", "Thumbnail width must be >= 0.");
        }
        if (req.getHeight() != null && req.getHeight() < 0) {
            throw ValidationException.fromField("thumbnail.height", "INVALID_VALUE", "Thumbnail height must be >= 0.");
        }
    }

    // ── Audit helpers (CMS-010) ───────────────────────────────────────────────

    private void auditLog(String action, String videoId, String before, String after) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(resolveActorId());
        log.setAction(action);
        log.setResourceType("HOME_VIDEO");
        // HomeVideo IDs are strings (not UUIDs); store in before/after JSON, leave resourceId null.
        log.setResourceId(null);
        log.setBeforeData(before);
        log.setAfterData(after != null ? after : "{\"id\":\"" + esc(videoId) + "\"}");
        log.setCreatedAt(Instant.now());
        auditLogRepo.save(log);
    }

    private static String videoSnapshot(HomeVideoEntity e) {
        return "{\"id\":\"" + esc(e.getId())
                + "\",\"title\":\"" + esc(e.getTitle())
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
