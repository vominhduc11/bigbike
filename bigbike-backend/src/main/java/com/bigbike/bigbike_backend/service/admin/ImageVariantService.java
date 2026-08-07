package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.service.media.CompressionProfile;
import com.bigbike.bigbike_backend.service.media.ImageCompressionService;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.imageio.ImageIO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Generates responsive image variants (thumb / medium / large) on upload and
 * stores them in MinIO alongside the original. Skips a size when the source
 * is already smaller than the target dimension — no point upscaling.
 *
 * <p>Variant keys are derived from the original object key:
 * {@code uploads/{uuid}/photo.jpg} → {@code uploads/{uuid}/photo.thumb.jpg}
 *
 * <p>The returned map lives in {@code media.sizes} as JSON, e.g.
 * {@code {"thumb":"/media/uploads/.../photo.thumb.jpg","medium":"/media/.../photo.medium.jpg"}}.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ImageVariantService {

    /** Target widths in pixels. Variants smaller than the source are skipped. */
    private static final Map<String, Integer> VARIANTS = Map.of(
            "thumb", 300,
            "medium", 800,
            "large", 1600
    );

    /** JPEG quality 0..1 — 0.85 is a good tradeoff between fidelity and bytes. */
    private static final float JPEG_QUALITY = 0.85f;

    private static final String MEDIA_PATH_PREFIX = "/media/";

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;
    private final ImageCompressionService imageCompressionService;

    /**
     * Generate and upload variants for a freshly-uploaded raster image.
     *
     * @param sourceBytes  raw bytes of the original image
     * @param originalKey  MinIO object key of the original (e.g. "uploads/uuid/file.jpg")
     * @param mimeType     source mime type — currently only image/* is processed
     * @return map of variant name → public URL ({@code /media/...}), empty if not applicable
     */
    public Map<String, String> generateAndUpload(byte[] sourceBytes, String originalKey, String mimeType) {
        return generateAndUpload(sourceBytes, originalKey, mimeType, minioProperties.getBucket());
    }

    /** Generate variants in the same bucket as an existing media record. */
    public Map<String, String> generateAndUpload(
            byte[] sourceBytes,
            String originalKey,
            String mimeType,
            String bucket
    ) {
        if (sourceBytes == null || sourceBytes.length == 0) return Map.of();
        if (mimeType == null || !mimeType.toLowerCase().startsWith("image/")) return Map.of();
        // Don't variant SVG/GIF — Thumbnailator can't handle them well, and animations would lose frames
        if (mimeType.equalsIgnoreCase("image/svg+xml") || mimeType.equalsIgnoreCase("image/gif")) {
            return Map.of();
        }

        BufferedImage source;
        try {
            source = ImageIO.read(new ByteArrayInputStream(sourceBytes));
            if (source == null) return Map.of();
        } catch (IOException e) {
            log.warn("Could not decode image for variant generation: {}", e.getMessage());
            return Map.of();
        }

        // Preserve transparency for formats that have an alpha channel (PNG, WebP).
        // JPEG variants would composite a black/white background and ruin transparent logos.
        boolean preserveAlpha = mimeType.equalsIgnoreCase("image/png")
                || mimeType.equalsIgnoreCase("image/webp")
                || source.getColorModel().hasAlpha();

        String outputMime = preserveAlpha ? "image/png" : "image/jpeg";
        String outputExt = preserveAlpha ? ".png" : ".jpg";

        Map<String, String> result = new LinkedHashMap<>();
        int sourceWidth = source.getWidth();

        for (Map.Entry<String, Integer> entry : VARIANTS.entrySet()) {
            String name = entry.getKey();
            int targetWidth = entry.getValue();

            // Skip variants that would upscale — keep storage tight
            if (sourceWidth <= targetWidth) continue;

            String variantKey = deriveVariantKey(originalKey, name, outputExt);
            try {
                CompressionProfile profile = new CompressionProfile(targetWidth, targetWidth, JPEG_QUALITY, false);
                byte[] resized = imageCompressionService.compress(sourceBytes, mimeType, profile);
                uploadToMinio(bucket, variantKey, resized, outputMime);
                result.put(name, MEDIA_PATH_PREFIX + variantKey);
            } catch (Exception e) {
                log.warn("Failed to generate variant '{}' for {}: {}", name, originalKey, e.getMessage());
            }
        }

        return result;
    }

    /** Removes all known variant objects from MinIO. Used by hard delete. */
    public void deleteVariants(String originalKey) {
        deleteVariants(originalKey, minioProperties.getBucket());
    }

    /** Remove variants from the bucket recorded on the media row. */
    public void deleteVariants(String originalKey, String bucket) {
        if (originalKey == null) return;
        // Try both extensions because we don't know what the variant format was at delete time
        for (String name : VARIANTS.keySet()) {
            for (String ext : new String[] { ".jpg", ".png" }) {
                String key = deriveVariantKey(originalKey, name, ext);
                try {
                    minioClient.removeObject(RemoveObjectArgs.builder()
                            .bucket(bucket)
                            .object(key)
                            .build());
                } catch (Exception ignored) {
                    // Variant may not exist — that's fine
                }
            }
        }
    }

    private static String deriveVariantKey(String originalKey, String variantName, String ext) {
        int dot = originalKey.lastIndexOf('.');
        if (dot < 0) return originalKey + "." + variantName + ext;
        return originalKey.substring(0, dot) + "." + variantName + ext;
    }

    private void uploadToMinio(String bucket, String key, byte[] bytes, String contentType) throws Exception {
        minioClient.putObject(PutObjectArgs.builder()
                .bucket(bucket)
                .object(key)
                .stream(new ByteArrayInputStream(bytes), bytes.length, -1)
                .contentType(contentType)
                .build());
    }
}
