package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import io.minio.MinioClient;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.Arrays;
import java.util.Optional;
import java.util.UUID;
import javax.imageio.ImageIO;
import okhttp3.Headers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class BrandLogoValidationServiceTest {

    @Mock
    private MediaJpaRepository mediaRepo;

    @Mock
    private MinioClient minioClient;

    private BrandLogoValidationService service;

    @BeforeEach
    void setUp() {
        MinioProperties minioProperties = new MinioProperties();
        minioProperties.setBucket("bigbike-media");
        service = new BrandLogoValidationService(mediaRepo, minioClient, minioProperties);
    }

    @Test
    void acceptsLargeSquareLogoAndReportsItAsValidAfterStoredByteInspection() throws Exception {
        byte[] bytes = paddedPngBytes(800, 800);
        MediaEntity media = media(bytes, 800, 800);
        BrandEntity brand = brand(media, Instant.now());
        BrandEntity current = brand(media, Instant.now());
        current.setLogoUrl("/media/old-logo.png");
        stubMediaObject(media, bytes);

        BrandLogoValidationService.LogoMutation mutation = service.validateForWrite(
                current,
                ImageAssetRequest.builder()
                        .url(media.getPublicUrl())
                        .mediaId(media.getId())
                        .build());

        assertThat(mutation.media()).isSameAs(media);

        var quality = service.qualityFor(brand);
        assertThat(quality.status()).isEqualTo("VALID");
        assertThat(quality.fileSize()).isEqualTo((long) bytes.length);
        assertThat(quality.width()).isEqualTo(800);
        assertThat(quality.height()).isEqualTo(800);
        assertThat(quality.issues()).doesNotContain("TOO_LARGE");
    }

    @Test
    void legacyLargeLogoRemainsReadableWithoutAStaleSizeWarning() throws Exception {
        byte[] bytes = paddedPngBytes(800, 800);
        MediaEntity media = media(bytes, 800, 800);
        BrandEntity brand = brand(media, null);
        stubMediaObject(media, bytes);

        var quality = service.qualityFor(brand);

        assertThat(quality.status()).isEqualTo("LEGACY");
        assertThat(quality.issues()).contains("LEGACY_LOGO");
        assertThat(quality.issues()).doesNotContain("TOO_LARGE");
        assertThat(quality.fileSize()).isEqualTo((long) bytes.length);
    }

    @Test
    void rejectsLogoBelowMinimumPixels() throws Exception {
        byte[] bytes = paddedPngBytes(300, 300);
        MediaEntity media = media(bytes, 300, 300);
        BrandEntity brand = brand(media, null);
        brand.setLogoUrl("/media/old-logo.png");
        stubMediaObject(media, bytes);

        assertThatThrownBy(() -> service.validateForWrite(
                brand,
                ImageAssetRequest.builder()
                        .url(media.getPublicUrl())
                        .mediaId(media.getId())
                        .build()))
                .isInstanceOf(ValidationException.class)
                .satisfies(error -> {
                    ValidationException validation = (ValidationException) error;
                    assertThat(validation.details().get(0).code()).isEqualTo("BRAND_LOGO_TOO_SMALL");
                });
    }

    private void stubMediaObject(MediaEntity media, byte[] bytes) throws Exception {
        when(mediaRepo.findById(media.getId())).thenReturn(Optional.of(media));
        when(minioClient.getObject(any(GetObjectArgs.class))).thenAnswer(ignored -> new GetObjectResponse(
                Headers.of(), "bigbike-media", media.getFilePath(), null,
                new ByteArrayInputStream(bytes)));
    }

    private static MediaEntity media(byte[] bytes, int width, int height) {
        MediaEntity media = new MediaEntity();
        media.setId(UUID.randomUUID());
        media.setFilePath("uploads/brand-logo/" + media.getId() + "/logo.png");
        media.setPublicUrl("/media/" + media.getFilePath());
        media.setStorageProvider("MINIO");
        media.setBucket("bigbike-media");
        media.setMimeType("image/png");
        media.setFileSize((long) bytes.length);
        media.setWidth(width);
        media.setHeight(height);
        media.setStatus("ACTIVE");
        return media;
    }

    private static BrandEntity brand(MediaEntity media, Instant standardizedAt) {
        BrandEntity brand = new BrandEntity();
        brand.setId("brand-" + media.getId());
        brand.setSlug("brand-" + media.getId());
        brand.setName("Test brand");
        brand.setLogoId(media.getId().toString());
        brand.setLogoUrl(media.getPublicUrl());
        brand.setLogoStandardizedAt(standardizedAt);
        return brand;
    }

    private static byte[] paddedPngBytes(int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", output);
            byte[] encoded = output.toByteArray();
            return Arrays.copyOf(encoded, Math.max(encoded.length, 1024 * 1024));
        }
    }
}
