package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.admin.dto.media.MediaReferenceItem;
import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaFolderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaTagJdbc;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.media.ImageCompressionService;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class AdminMediaServiceUploadTest {
    @Mock MediaJpaRepository mediaRepo;
    @Mock MediaFolderJpaRepository folderRepo;
    @Mock AuditLogWriter auditWriter;
    @Mock AuditLogFactory auditFactory;
    @Mock MinioClient minio;
    @Mock MediaReferenceService references;
    @Mock MediaTagJdbc tags;
    @Mock ImageVariantService variants;
    private AdminMediaService service;

    @BeforeEach
    void setUp() {
        service = new AdminMediaService(mediaRepo, folderRepo, auditWriter, auditFactory,
                minio, new MinioProperties(), new ObjectMapper(), references, tags, variants,
                new ImageCompressionService());
    }

    @Test
    void newUploadReturnsAccurateEmptyUsageWithoutScanningExistingContent() throws Exception {
        when(mediaRepo.findByContentSha256(anyString())).thenReturn(Optional.empty());
        when(variants.generateAndUpload(any(), anyString(), anyString())).thenReturn(Map.of());
        when(mediaRepo.save(any())).thenAnswer(call -> {
            MediaEntity media = call.getArgument(0);
            media.setId(UUID.randomUUID());
            return media;
        });

        var result = service.storeMediaBytes(jpeg(), "ảnh-mới.jpg", "image/jpeg",
                "Ảnh mới", null, false, UUID.randomUUID());

        assertThat(result.usageCount()).isZero();
        assertThat(result.references()).isEmpty();
        assertThat(result.tags()).isEmpty();
        assertThat(result.width()).isEqualTo(12);
        assertThat(result.height()).isEqualTo(10);
        assertThat(result.publicUrl()).startsWith("/media/uploads/");
        verify(minio).putObject(any(PutObjectArgs.class));
        verify(references, never()).getReferences(any());
        verify(tags, never()).tagsFor(any());
    }

    @Test
    void duplicateUploadKeepsExistingUsageAndTagsWithoutWritingAnotherObject() throws Exception {
        MediaEntity existing = new MediaEntity();
        existing.setId(UUID.randomUUID());
        existing.setFilePath("uploads/shared/photo.jpg");
        existing.setStatus("ACTIVE");
        when(mediaRepo.findByContentSha256(anyString())).thenReturn(Optional.of(existing));
        when(references.getReferences(existing)).thenReturn(List.of(
                new MediaReferenceItem("PRODUCT", "product-1", "Mũ bảo hiểm", "/admin/products/product-1")));
        when(tags.tagsFor(existing.getId())).thenReturn(List.of("mũ bảo hiểm"));

        var result = service.storeMediaBytes(jpeg(), "photo.jpg", "image/jpeg",
                "", null, false, UUID.randomUUID());

        assertThat(result.id()).isEqualTo(existing.getId());
        assertThat(result.usageCount()).isEqualTo(1);
        assertThat(result.references()).hasSize(1);
        assertThat(result.tags()).containsExactly("mũ bảo hiểm");
        verify(minio, never()).putObject(any(PutObjectArgs.class));
        verify(references).getReferences(existing);
    }

    private static byte[] jpeg() throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(12, 10, BufferedImage.TYPE_INT_RGB), "jpeg", bytes);
        return bytes.toByteArray();
    }
}
