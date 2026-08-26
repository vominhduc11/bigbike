package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.domain.catalog.BrandSummary;
import com.bigbike.bigbike_backend.domain.catalog.CategorySummary;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatProductImageFingerprintEntity;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatProductImageFingerprintJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import io.minio.MinioClient;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import javax.imageio.ImageIO;
import okhttp3.Headers;
import org.junit.jupiter.api.Test;

class ChatProductImageFingerprintServiceTest {

    @Test
    void exactInternalCatalogBytesProduceOneEvidenceBoundMatch() throws Exception {
        byte[] catalogBytes = patternedPng(Color.RED, Color.WHITE, 240);
        Fixture fixture = fixture(catalogBytes, sha256(catalogBytes));

        var result = fixture.service.findStrictMatch(
                catalogBytes, sha256(catalogBytes), List.of(fixture.product));

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().slug()).isEqualTo("mu-tanami");
        assertThat(result.orElseThrow().evidence()).isEqualTo("CONTENT_SHA256");
        assertThat(fixture.saved.getProductId()).isEqualTo("product-tanami");
        assertThat(fixture.saved.getFingerprintVersion()).isEqualTo("local-visual-v1");
    }

    @Test
    void resizedCopyCanMatchButDifferentColourCannot() throws Exception {
        byte[] catalogBytes = patternedPng(Color.RED, Color.WHITE, 240);
        Fixture similarFixture = fixture(catalogBytes, sha256(catalogBytes));
        byte[] resized = patternedPng(Color.RED, Color.WHITE, 120);

        var similar = similarFixture.service.findStrictMatch(
                resized, sha256(resized), List.of(similarFixture.product));

        assertThat(similar).isPresent();
        assertThat(similar.orElseThrow().evidence()).isEqualTo("LOCAL_VISUAL_FINGERPRINT");

        Fixture differentFixture = fixture(catalogBytes, sha256(catalogBytes));
        byte[] different = patternedPng(Color.BLUE, Color.BLACK, 120);
        assertThat(differentFixture.service.findStrictMatch(
                different, sha256(different), List.of(differentFixture.product))).isEmpty();
    }

    @Test
    void oneImageAssignedToTwoProductsIsAmbiguousAndNeverChoosesOne() throws Exception {
        byte[] bytes = patternedPng(Color.RED, Color.WHITE, 240);
        Fixture fixture = fixture(bytes, sha256(bytes));
        Product second = product(
                "product-other", "mu-khac", fixture.media.getId().toString(), "/media/products/helmet.png");

        assertThat(fixture.service.findStrictMatch(
                bytes, sha256(bytes), List.of(fixture.product, second))).isEmpty();
    }

    private static Fixture fixture(byte[] catalogBytes, String contentSha) throws Exception {
        ChatProductImageFingerprintJpaRepository fingerprintRepo = mock(
                ChatProductImageFingerprintJpaRepository.class);
        MediaJpaRepository mediaRepo = mock(MediaJpaRepository.class);
        MinioClient minio = mock(MinioClient.class);
        MinioProperties properties = new MinioProperties();
        properties.setBucket("bigbike-media");

        MediaEntity media = new MediaEntity();
        media.setId(UUID.randomUUID());
        media.setFilePath("products/helmet.png");
        media.setPublicUrl("/media/products/helmet.png");
        media.setStorageProvider("MINIO");
        media.setBucket("bigbike-media");
        media.setMimeType("image/png");
        media.setFileSize((long) catalogBytes.length);
        media.setContentSha256(contentSha);
        media.setUpdatedAt(Instant.parse("2026-08-26T00:00:00Z"));

        when(mediaRepo.findAllById(any())).thenReturn(List.of(media));
        when(mediaRepo.findByPublicUrlIn(any())).thenReturn(List.of(media));
        when(mediaRepo.findByFilePathIn(any())).thenReturn(List.of(media));
        when(fingerprintRepo.findByProductIdInAndFingerprintVersion(any(), any()))
                .thenReturn(List.of());
        ChatProductImageFingerprintEntity saved = new ChatProductImageFingerprintEntity();
        when(fingerprintRepo.save(any(ChatProductImageFingerprintEntity.class)))
                .thenAnswer(invocation -> {
                    ChatProductImageFingerprintEntity source = invocation.getArgument(0);
                    saved.setProductId(source.getProductId());
                    saved.setMediaId(source.getMediaId());
                    saved.setImageRef(source.getImageRef());
                    saved.setSourceVersionHash(source.getSourceVersionHash());
                    saved.setFingerprintVersion(source.getFingerprintVersion());
                    saved.setDHashHex(source.getDHashHex());
                    saved.setColorHistogram(source.getColorHistogram());
                    saved.setAspectRatio(source.getAspectRatio());
                    return source;
                });
        when(minio.getObject(any(GetObjectArgs.class))).thenAnswer(ignored ->
                new GetObjectResponse(
                        Headers.of(), "bigbike-media", null, "products/helmet.png",
                        new ByteArrayInputStream(catalogBytes)));

        Product product = product(
                "product-tanami", "mu-tanami", media.getId().toString(), media.getPublicUrl());
        return new Fixture(
                new ChatProductImageFingerprintService(
                        fingerprintRepo, mediaRepo, minio, properties),
                product, media, saved);
    }

    private static Product product(String id, String slug, String imageId, String imageUrl) {
        CategorySummary category = new CategorySummary(
                "category-helmet", "mu-bao-hiem", null, "Mũ bảo hiểm", true, false);
        return new Product(
                id, "SKU-" + id, slug, null, "Mũ Tanami",
                null, null,
                new BrandSummary("brand-tanami", "tanami", "Tanami"),
                category, List.of(category),
                new ImageAsset(imageId, imageUrl, "Mũ", 240, 240, "image/png"),
                List.of(), List.of(),
                new ProductPrice(BigDecimal.valueOf(2_000_000), null, "VND"),
                List.of(), ProductStockState.IN_STOCK, Boolean.TRUE, PublishStatus.PUBLISHED,
                false, null, HomepageBlock.NONE, null, null, null, List.of(), List.of(),
                ProductHighlights.EMPTY, null, null, null, null, null, null, null,
                List.of(), List.of(), List.of(), null, null, null, null, null,
                Instant.now(), Instant.now());
    }

    private static byte[] patternedPng(Color foreground, Color background, int size) throws Exception {
        BufferedImage image = new BufferedImage(size, size, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(background);
        graphics.fillRect(0, 0, size, size);
        graphics.setColor(foreground);
        graphics.fillOval(size / 8, size / 4, size * 3 / 4, size / 2);
        graphics.fillRect(size / 3, size / 8, size / 3, size * 3 / 4);
        graphics.dispose();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }

    private static String sha256(byte[] value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
    }

    private record Fixture(
            ChatProductImageFingerprintService service,
            Product product,
            MediaEntity media,
            ChatProductImageFingerprintEntity saved
    ) {}
}
