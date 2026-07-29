package com.bigbike.bigbike_backend.service.public_;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewPhotoUploadEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewPhotoUploadJpaRepository;
import com.bigbike.bigbike_backend.service.media.CompressionProfile;
import com.bigbike.bigbike_backend.service.media.ImageCompressionService;
import io.minio.MinioClient;
import io.minio.RemoveObjectArgs;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

class ReviewPhotoStorageServiceTest {

    @Test
    void traversalOnlyFilename_fallsBackToClaimableAndCleanableKey() {
        assertThat(ReviewPhotoStorageService.sanitizeFilename(".")).isEqualTo("photo");
        assertThat(ReviewPhotoStorageService.sanitizeFilename("..")).isEqualTo("photo");
        assertThat(ReviewPhotoStorageService.canonicalFilename("photo.webp", "image/png"))
                .isEqualTo("photo.png");

        String key = "reviews/00000000-0000-0000-0000-000000000000/"
                + ReviewPhotoStorageService.canonicalFilename("..", "image/png");
        assertThat(ReviewPhotoStorageService.reviewObjectKey("/media/" + key)).isEqualTo(key);
    }

    @Test
    void storeWithTraversalOnlyFilename_persistsSafeUploadLedgerEntry() throws Exception {
        MinioClient minioClient = mock(MinioClient.class);
        MinioProperties minioProperties = mock(MinioProperties.class);
        ImageCompressionService compressionService = mock(ImageCompressionService.class);
        ReviewPhotoUploadJpaRepository uploadRepo = mock(ReviewPhotoUploadJpaRepository.class);
        when(minioProperties.getBucket()).thenReturn("test-bucket");

        byte[] png = new byte[] {
                (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
                0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
        };
        when(compressionService.compress(
                any(byte[].class), any(String.class), any(CompressionProfile.class)))
                .thenReturn(png);
        when(uploadRepo.saveAndFlush(any(ReviewPhotoUploadEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ReviewPhotoStorageService service = new ReviewPhotoStorageService(
                minioClient, minioProperties, compressionService, uploadRepo);
        MockMultipartFile upload = new MockMultipartFile(
                "file", "..", "image/png", png);

        String url = service.store("product-1", upload);

        assertThat(url).matches("^/media/reviews/[0-9a-f-]+/photo\\.png$");
        assertThat(ReviewPhotoStorageService.reviewObjectKey(url))
                .isEqualTo(url.substring("/media/".length()));
        ArgumentCaptor<ReviewPhotoUploadEntity> ledger =
                ArgumentCaptor.forClass(ReviewPhotoUploadEntity.class);
        verify(uploadRepo).saveAndFlush(ledger.capture());
        assertThat(ledger.getValue().getObjectKey()).endsWith("/photo.png");
        assertThat(ledger.getValue().getPublicUrl()).isEqualTo(url);
        assertThat(ledger.getValue().getProductId()).isEqualTo("product-1");
    }

    @Test
    void storeLedgerFailure_rollsBackUploadedObject() throws Exception {
        MinioClient minioClient = mock(MinioClient.class);
        MinioProperties minioProperties = mock(MinioProperties.class);
        ImageCompressionService compressionService = mock(ImageCompressionService.class);
        ReviewPhotoUploadJpaRepository uploadRepo = mock(ReviewPhotoUploadJpaRepository.class);
        when(minioProperties.getBucket()).thenReturn("test-bucket");

        byte[] png = new byte[] {
                (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
                0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
        };
        when(compressionService.compress(
                any(byte[].class), any(String.class), any(CompressionProfile.class)))
                .thenReturn(png);
        when(uploadRepo.saveAndFlush(any(ReviewPhotoUploadEntity.class)))
                .thenThrow(new IllegalStateException("ledger unavailable"));

        ReviewPhotoStorageService service = new ReviewPhotoStorageService(
                minioClient, minioProperties, compressionService, uploadRepo);
        MockMultipartFile upload = new MockMultipartFile(
                "file", "photo.png", "image/png", png);

        assertThatThrownBy(() -> service.store("product-1", upload))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("ledger unavailable");
        verify(minioClient).removeObject(any(RemoveObjectArgs.class));
    }

    @Test
    void declaredMimeMustMatchDetectedBytesExactly() {
        MinioClient minioClient = mock(MinioClient.class);
        MinioProperties minioProperties = mock(MinioProperties.class);
        ImageCompressionService compressionService = mock(ImageCompressionService.class);
        ReviewPhotoUploadJpaRepository uploadRepo = mock(ReviewPhotoUploadJpaRepository.class);
        ReviewPhotoStorageService service = new ReviewPhotoStorageService(
                minioClient, minioProperties, compressionService, uploadRepo);

        byte[] png = new byte[] {
                (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
                0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
        };
        MockMultipartFile spoofed = new MockMultipartFile(
                "file", "photo.webp", "image/webp", png);

        assertThatThrownBy(() -> service.store("product-1", spoofed))
                .isInstanceOf(ValidationException.class)
                .satisfies(exception -> {
                    ValidationException validation = (ValidationException) exception;
                    assertThat(validation.details()).singleElement().satisfies(detail -> {
                        assertThat(detail.field()).isEqualTo("file");
                        assertThat(detail.code()).isEqualTo("MIME_MISMATCH");
                        assertThat(detail.message())
                                .isEqualTo("Loại ảnh khai báo không khớp với nội dung tệp.");
                    });
                });
        verifyNoInteractions(minioClient, compressionService, uploadRepo);
    }
}
