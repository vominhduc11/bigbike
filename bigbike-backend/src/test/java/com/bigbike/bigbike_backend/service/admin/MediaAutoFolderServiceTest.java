package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaFolderEntity;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaFolderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class MediaAutoFolderServiceTest {

    @Mock private MediaJpaRepository mediaRepo;
    @Mock private MediaFolderJpaRepository folderRepo;
    @Mock private JdbcTemplate jdbc;
    @Mock private ObjectProvider<EntityManager> entityManagerProvider;

    private MediaAutoFolderService service;
    private UUID targetFolderId;
    private MediaEntity unassignedMedia;
    private MediaEntity manuallyPlacedMedia;

    @BeforeEach
    void setUp() {
        service = new MediaAutoFolderService(mediaRepo, folderRepo, jdbc, entityManagerProvider);
        targetFolderId = UUID.randomUUID();
        unassignedMedia = media(UUID.randomUUID(), null);
        manuallyPlacedMedia = media(UUID.randomUUID(), UUID.randomUUID());

        MediaFolderEntity targetFolder = new MediaFolderEntity();
        targetFolder.setId(targetFolderId);
        targetFolder.setName("Mũ LS2 đã đổi tên");
        targetFolder.setSystemKey("products:ls2");
        when(folderRepo.findBySystemKey("products:ls2")).thenReturn(Optional.of(targetFolder));
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0, String.class);
            if (sql.startsWith("SELECT * FROM products WHERE id")) {
                return List.of(row("id", "product-1", "cover_image_id", unassignedMedia.getId()));
            }
            if (sql.startsWith("SELECT b.name, b.slug")) {
                return List.of(row("name", "LS2", "slug", "ls2"));
            }
            return List.of();
        });
    }

    @Test
    void placesOnlyUnassignedProductMediaAndPreservesManualFolderChoice() {
        when(mediaRepo.findAll()).thenReturn(List.of(unassignedMedia, manuallyPlacedMedia));
        when(mediaRepo.save(any(MediaEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.placeProduct("product-1");

        assertThat(unassignedMedia.getFolderId()).isEqualTo(targetFolderId);
        assertThat(manuallyPlacedMedia.getFolderId()).isNotEqualTo(targetFolderId);
        verify(mediaRepo).save(unassignedMedia);
        verify(mediaRepo, never()).save(manuallyPlacedMedia);
    }

    @Test
    void leavesNewProductMediaUncategorizedWhenItsSystemFolderWasDeleted() {
        when(folderRepo.findBySystemKey("products:ls2")).thenReturn(Optional.empty());

        service.placeProduct("product-1");

        assertThat(unassignedMedia.getFolderId()).isNull();
        verify(mediaRepo, never()).save(unassignedMedia);
    }

    private static MediaEntity media(UUID id, UUID folderId) {
        MediaEntity media = new MediaEntity();
        Instant now = Instant.parse("2026-08-29T00:00:00Z");
        media.setId(id);
        media.setFilePath("uploads/" + id + ".jpg");
        media.setPublicUrl("/media/uploads/" + id + ".jpg");
        media.setStatus("ACTIVE");
        media.setFolderId(folderId);
        media.setUpdatedAt(now);
        return media;
    }

    private static Map<String, Object> row(Object... values) {
        Map<String, Object> row = new HashMap<>();
        for (int i = 0; i < values.length; i += 2) {
            row.put((String) values[i], values[i + 1]);
        }
        return row;
    }
}
