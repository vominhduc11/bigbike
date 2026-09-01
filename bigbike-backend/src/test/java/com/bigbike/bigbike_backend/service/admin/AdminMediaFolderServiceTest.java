package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.admin.dto.media.UpsertMediaFolderRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.mapper.MediaFolderMapper;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaFolderEntity;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaFolderJpaRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class AdminMediaFolderServiceTest {

    @Mock private MediaFolderJpaRepository folderRepo;
    @Mock private JdbcTemplate jdbc;
    @Mock private AuditLogWriter auditLogWriter;
    @Mock private MediaFolderMapper mediaFolderMapper;
    @Mock private AuditLogFactory auditLogFactory;

    private AdminMediaFolderService service;

    @BeforeEach
    void setUp() {
        service = new AdminMediaFolderService(folderRepo, jdbc, auditLogWriter, mediaFolderMapper, auditLogFactory);
    }

    @Test
    void update_allowsRenamingAndMovingSystemLeafWhileKeepingSystemKeyAndAppendingAtDestination() {
        MediaFolderEntity agv = folder("AGV", "agv", "products:agv", null, 115);
        MediaFolderEntity articleRoot = folder("Bài viết", "bai-viet", "root:articles", null, 20);
        MediaFolderEntity year = folder("2026", "2026", "articles:2026", articleRoot.getId(), 207);
        List<MediaFolderEntity> folders = List.of(agv, articleRoot, year);
        when(folderRepo.findById(agv.getId())).thenReturn(Optional.of(agv));
        when(folderRepo.findAll()).thenReturn(folders);
        when(folderRepo.saveAndFlush(any(MediaFolderEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.update(
                agv.getId(),
                new UpsertMediaFolderRequest("Mũ AGV", null, null, articleRoot.getId()),
                UUID.randomUUID());

        assertThat(agv.getName()).isEqualTo("Mũ AGV");
        assertThat(agv.getSystemKey()).isEqualTo("products:agv");
        assertThat(agv.getParentId()).isEqualTo(articleRoot.getId());
        assertThat(agv.getSortOrder()).isEqualTo(208);
    }

    @Test
    void update_rejectsMovingFolderWithChildrenBelowAnotherFolderBeforeSaving() {
        MediaFolderEntity products = folder("Sản phẩm", "san-pham", "root:products", null, 10);
        MediaFolderEntity agv = folder("AGV", "agv", "products:agv", products.getId(), 115);
        MediaFolderEntity articles = folder("Bài viết", "bai-viet", "root:articles", null, 20);
        when(folderRepo.findById(products.getId())).thenReturn(Optional.of(products));
        when(folderRepo.findAll()).thenReturn(List.of(products, agv, articles));

        assertThatThrownBy(() -> service.update(
                products.getId(),
                new UpsertMediaFolderRequest("Sản phẩm", null, null, articles.getId()),
                UUID.randomUUID()))
                .isInstanceOfSatisfying(ConflictException.class,
                        error -> assertThat(error.code()).isEqualTo("MEDIA_FOLDER_HAS_CHILDREN"));
    }

    @Test
    void update_rejectsSelectingTheFolderItselfAsParent() {
        MediaFolderEntity folder = folder("Kho tạm", "kho-tam", null, null, 1);
        when(folderRepo.findById(folder.getId())).thenReturn(Optional.of(folder));
        when(folderRepo.findAll()).thenReturn(List.of(folder));

        assertThatThrownBy(() -> service.update(
                folder.getId(),
                new UpsertMediaFolderRequest("Kho tạm", null, null, folder.getId()),
                UUID.randomUUID()))
                .isInstanceOfSatisfying(ConflictException.class,
                        error -> assertThat(error.code()).isEqualTo("MEDIA_FOLDER_INVALID_PARENT"));
    }

    @Test
    void create_customFolderLeavesSystemKeyEmptyAndPlacesItAtEndOfParentGroup() {
        MediaFolderEntity products = folder("Sản phẩm", "san-pham", "root:products", null, 10);
        MediaFolderEntity existingChild = folder("AGV", "agv", "products:agv", products.getId(), 115);
        when(folderRepo.findById(products.getId())).thenReturn(Optional.of(products));
        when(folderRepo.findAll()).thenReturn(List.of(products, existingChild));
        when(folderRepo.existsBySlug("phu-kien")).thenReturn(false);
        when(folderRepo.saveAndFlush(any(MediaFolderEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.create(new UpsertMediaFolderRequest("Phụ kiện", null, null, products.getId()), UUID.randomUUID());

        ArgumentCaptor<MediaFolderEntity> saved = ArgumentCaptor.forClass(MediaFolderEntity.class);
        verify(folderRepo).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getSystemKey()).isNull();
        assertThat(saved.getValue().getParentId()).isEqualTo(products.getId());
        assertThat(saved.getValue().getSortOrder()).isEqualTo(116);
    }

    @Test
    void delete_allowsSystemLeafButRejectsAParentWithChildren() {
        MediaFolderEntity agv = folder("AGV", "agv", "products:agv", null, 115);
        when(folderRepo.findById(agv.getId())).thenReturn(Optional.of(agv));
        when(folderRepo.findAll()).thenReturn(List.of(agv));

        service.delete(agv.getId(), UUID.randomUUID());
        verify(folderRepo).delete(agv);

        MediaFolderEntity products = folder("Sản phẩm", "san-pham", "root:products", null, 10);
        MediaFolderEntity child = folder("AGV", "agv-2", "products:agv-2", products.getId(), 115);
        when(folderRepo.findById(products.getId())).thenReturn(Optional.of(products));
        when(folderRepo.findAll()).thenReturn(List.of(products, child));

        assertThatThrownBy(() -> service.delete(products.getId(), UUID.randomUUID()))
                .isInstanceOfSatisfying(ConflictException.class,
                        error -> assertThat(error.code()).isEqualTo("MEDIA_FOLDER_HAS_CHILDREN"));
    }

    private static MediaFolderEntity folder(
            String name, String slug, String systemKey, UUID parentId, int sortOrder) {
        MediaFolderEntity folder = new MediaFolderEntity();
        folder.setId(UUID.randomUUID());
        folder.setName(name);
        folder.setSlug(slug);
        folder.setSystemKey(systemKey);
        folder.setParentId(parentId);
        folder.setSortOrder(sortOrder);
        return folder;
    }
}
