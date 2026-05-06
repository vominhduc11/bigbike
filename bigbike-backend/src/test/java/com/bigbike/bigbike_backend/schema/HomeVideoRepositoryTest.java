package com.bigbike.bigbike_backend.schema;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.persistence.entity.video.HomeVideoEntity;
import com.bigbike.bigbike_backend.persistence.repository.video.HomeVideoJpaRepository;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;

@SpringBootTest
class HomeVideoRepositoryTest {

    @Autowired
    private HomeVideoJpaRepository homeVideoJpaRepository;

    @Test
    void saveAndRead_persistsThumbnailJson() {
        HomeVideoEntity entity = homeVideo("hv_repo_thumb", 100);
        entity.setThumbnail(new ImageAsset(null, "/media/thumb-hv.jpg", "Thumb", 1280, 720, "image/jpeg"));

        homeVideoJpaRepository.saveAndFlush(entity);

        HomeVideoEntity found = homeVideoJpaRepository.findById("hv_repo_thumb").orElseThrow();
        assertThat(found.getThumbnail()).isNotNull();
        assertThat(found.getThumbnail().url()).isEqualTo("/media/thumb-hv.jpg");
    }

    @Test
    void sortOrderUniqueConstraint_isEnforced() {
        homeVideoJpaRepository.saveAndFlush(homeVideo("hv_repo_unique_1", 101));

        assertThatThrownBy(() -> homeVideoJpaRepository.saveAndFlush(homeVideo("hv_repo_unique_2", 101)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private static HomeVideoEntity homeVideo(String id, int sortOrder) {
        HomeVideoEntity entity = new HomeVideoEntity();
        entity.setId(id);
        entity.setSortOrder(sortOrder);
        entity.setTitle("Video " + id);
        entity.setVideoUrl("/media-proxy/uploads/" + id + ".mp4");
        entity.setYoutubeId(null);
        entity.setActive(true);
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        return entity;
    }
}
