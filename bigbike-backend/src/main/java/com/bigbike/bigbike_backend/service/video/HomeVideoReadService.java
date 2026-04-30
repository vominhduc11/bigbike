package com.bigbike.bigbike_backend.service.video;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.video.HomeVideo;
import com.bigbike.bigbike_backend.persistence.entity.video.HomeVideoEntity;
import com.bigbike.bigbike_backend.persistence.repository.video.HomeVideoJpaRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HomeVideoReadService {

    private final HomeVideoJpaRepository homeVideoJpaRepository;

    public HomeVideoReadService(HomeVideoJpaRepository homeVideoJpaRepository) {
        this.homeVideoJpaRepository = homeVideoJpaRepository;
    }

    @Transactional(readOnly = true)
    public List<HomeVideo> listActive() {
        return homeVideoJpaRepository.findByIsActiveTrueOrderBySortOrderAsc().stream()
                .map(HomeVideoReadService::toDomain)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<HomeVideo> listAll() {
        return homeVideoJpaRepository.findAllByOrderBySortOrderAsc().stream()
                .map(HomeVideoReadService::toDomain)
                .toList();
    }

    @Transactional(readOnly = true)
    public HomeVideo findById(String id) {
        return homeVideoJpaRepository.findById(id)
                .map(HomeVideoReadService::toDomain)
                .orElseThrow(() -> new NotFoundException("Home video not found."));
    }

    public static HomeVideo toDomain(HomeVideoEntity entity) {
        return new HomeVideo(
                entity.getId(),
                entity.getSortOrder(),
                entity.getTitle(),
                entity.getVideoUrl(),
                entity.getYoutubeId(),
                entity.getThumbnail(),
                entity.isActive(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
