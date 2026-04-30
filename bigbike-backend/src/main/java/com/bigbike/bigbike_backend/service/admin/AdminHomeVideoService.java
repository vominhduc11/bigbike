package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.PatchHomeVideoRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ReorderHomeVideosRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertHomeVideoRequest;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.video.HomeVideo;
import com.bigbike.bigbike_backend.persistence.entity.video.HomeVideoEntity;
import com.bigbike.bigbike_backend.persistence.repository.video.HomeVideoJpaRepository;
import com.bigbike.bigbike_backend.service.video.HomeVideoReadService;
import com.bigbike.bigbike_backend.service.video.YouTubeUrlParser;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
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
public class AdminHomeVideoService {

    private final HomeVideoJpaRepository homeVideoJpaRepository;
    private final HomeVideoReadService homeVideoReadService;
    private final WebRevalidationService webRevalidationService;

    public AdminHomeVideoService(
            HomeVideoJpaRepository homeVideoJpaRepository,
            HomeVideoReadService homeVideoReadService,
            WebRevalidationService webRevalidationService
    ) {
        this.homeVideoJpaRepository = homeVideoJpaRepository;
        this.homeVideoReadService = homeVideoReadService;
        this.webRevalidationService = webRevalidationService;
    }

    @Transactional(readOnly = true)
    public List<HomeVideo> list() {
        return homeVideoReadService.listAll();
    }

    @Transactional
    public HomeVideo create(UpsertHomeVideoRequest request) {
        Instant now = Instant.now();
        HomeVideoEntity entity = new HomeVideoEntity();
        String videoUrl = request.getVideoUrl().trim();
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
            String videoUrl = request.getVideoUrl().trim();
            entity.setVideoUrl(videoUrl);
            entity.setYoutubeId(YouTubeUrlParser.extractId(videoUrl));
        }
        if (request.getSortOrder() != null) entity.setSortOrder(request.getSortOrder());
        if (request.getIsActive() != null) entity.setActive(request.getIsActive());
        if (request.isClearThumbnail()) {
            entity.setThumbnail(null);
        } else if (request.getThumbnail() != null) {
            entity.setThumbnail(toImageAsset(request.getThumbnail()));
        }

        entity.setUpdatedAt(Instant.now());
        homeVideoJpaRepository.save(entity);
        webRevalidationService.revalidate("home-videos");
        return homeVideoReadService.findById(entity.getId());
    }

    @Transactional
    public void delete(String id) {
        HomeVideoEntity entity = homeVideoJpaRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Home video not found."));
        homeVideoJpaRepository.delete(entity);
        webRevalidationService.revalidate("home-videos");
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
        return list();
    }

    private static ImageAsset toImageAsset(ImageAssetRequest req) {
        if (req == null) return null;
        return new ImageAsset(null, req.getUrl(), req.getAlt(), req.getWidth(), req.getHeight(), req.getMimeType());
    }
}
