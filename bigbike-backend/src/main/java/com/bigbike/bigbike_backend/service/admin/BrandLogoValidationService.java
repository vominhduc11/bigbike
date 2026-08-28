package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.domain.catalog.BrandLogoQuality;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import javax.imageio.ImageIO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.stereotype.Service;

/**
 * Brand-logo-specific validation. The generic Media Library deliberately has no pixel floor;
 * this service is the only place that applies the stricter {@code brand.logo} contract.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BrandLogoValidationService {

    public static final long MAX_BYTES = 300L * 1024;
    public static final int MIN_PIXELS = 400;
    public static final double RATIO_TOLERANCE = 0.01d;
    public static final String PNG_MIME = "image/png";

    private static final String MINIO_PROVIDER = "MINIO";
    private static final Tika TIKA = new Tika();

    private final MediaJpaRepository mediaRepo;
    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    /**
     * Validates a logo only when the request actually changes the stored URL. An omitted logo
     * is handled by the Brand patch caller and means "preserve"; an unchanged URL is
     * grandfathered so old brands remain editable.
     */
    public LogoMutation validateForWrite(BrandEntity current, ImageAssetRequest request) {
        if (request == null) {
            return LogoMutation.preserve();
        }

        String url = trimToNull(request.getUrl());
        if (url == null) {
            if (request.getMediaId() != null) {
                throw validation("logo.mediaId", "BRAND_LOGO_MEDIA_ID_WITHOUT_URL",
                        "Logo mediaId phải đi kèm URL / logo mediaId must be sent with a URL.");
            }
            return LogoMutation.newCleared();
        }

        String currentUrl = current == null ? null : trimToNull(current.getLogoUrl());
        if (url.equals(currentUrl)) {
            if (request.getMediaId() != null) {
                MediaEntity media = findById(request.getMediaId());
                ensureUrlMatches(media, url);
            }
            return LogoMutation.newUnchanged();
        }

        MediaEntity media = request.getMediaId() == null
                ? findByPublicUrl(url)
                : findById(request.getMediaId());
        if (media == null) {
            throw validation(
                    request.getMediaId() == null ? "logo.url" : "logo.mediaId",
                    request.getMediaId() == null ? "BRAND_LOGO_MEDIA_REQUIRED" : "BRAND_LOGO_MEDIA_NOT_FOUND",
                    request.getMediaId() == null
                            ? "Logo mới phải dùng media đã tải vào kho ảnh BigBike / a new logo must reference media stored in BigBike Media Library."
                            : "Không tìm thấy media logo / the selected logo media was not found.");
        }
        ensureUrlMatches(media, url);
        if (!MINIO_PROVIDER.equalsIgnoreCase(trimToNull(media.getStorageProvider()) == null
                ? "" : media.getStorageProvider())
                || media.getFilePath() == null || media.getFilePath().isBlank()
                || !"ACTIVE".equalsIgnoreCase(media.getStatus())) {
            throw validation("logo.mediaId", "BRAND_LOGO_MEDIA_UNAVAILABLE",
                    "Media logo không còn sẵn sàng trong kho BigBike / the logo media is not available in BigBike storage.");
        }

        Inspection inspection = inspect(media);
        throwIfInvalid(inspection);
        return LogoMutation.replaced(media);
    }

    /** Returns the non-blocking quality diagnostics exposed only by admin Brand reads. */
    public BrandLogoQuality qualityFor(BrandEntity entity) {
        String url = entity == null ? null : trimToNull(entity.getLogoUrl());
        if (url == null) {
            return new BrandLogoQuality("MISSING", List.of("MISSING_LOGO"),
                    null, null, null, null, null, null);
        }

        MediaEntity media = resolveExistingMedia(entity);
        Integer width = media != null && media.getWidth() != null ? media.getWidth() : entity.getLogoWidth();
        Integer height = media != null && media.getHeight() != null ? media.getHeight() : entity.getLogoHeight();
        Long fileSize = media == null ? null : media.getFileSize();
        String mimeType = media != null && media.getMimeType() != null
                ? media.getMimeType() : entity.getLogoMimeType();
        Boolean transparent = null;
        List<String> issues = new ArrayList<>();
        if (entity.getLogoStandardizedAt() == null) {
            issues.add("LEGACY_LOGO");
        }

        if (media == null || !MINIO_PROVIDER.equalsIgnoreCase(media.getStorageProvider())
                || media.getFilePath() == null || media.getFilePath().isBlank()
                || !"ACTIVE".equalsIgnoreCase(media.getStatus())) {
            issues.addAll(metadataIssues(width, height, fileSize, mimeType));
            issues.add("MEDIA_UNAVAILABLE");
            issues.add("TRANSPARENCY_UNVERIFIED");
        } else {
            Inspection inspection = inspect(media);
            if (inspection.available()) {
                width = inspection.width();
                height = inspection.height();
                fileSize = inspection.fileSize();
                mimeType = inspection.mimeType();
                transparent = inspection.transparent();
                issues.addAll(inspection.issues());
            } else {
                issues.addAll(metadataIssues(width, height, fileSize, mimeType));
                issues.add("MEDIA_UNAVAILABLE");
                issues.add("TRANSPARENCY_UNVERIFIED");
            }
        }

        issues = new ArrayList<>(dedupe(issues));
        String status;
        if (entity.getLogoStandardizedAt() != null && issues.isEmpty()) {
            status = "VALID";
            issues = List.of();
        } else if (entity.getLogoStandardizedAt() != null) {
            status = "INVALID";
        } else {
            status = "LEGACY";
        }

        Double ratio = width != null && height != null && height > 0
                ? width.doubleValue() / height.doubleValue() : null;
        return new BrandLogoQuality(status, issues, width, height, fileSize, mimeType, transparent, ratio);
    }

    private MediaEntity resolveExistingMedia(BrandEntity entity) {
        UUID logoId = parseUuid(entity.getLogoId());
        if (logoId != null) {
            Optional<MediaEntity> byId = mediaRepo.findById(logoId);
            if (byId.isPresent()) return byId.get();
        }
        String url = trimToNull(entity.getLogoUrl());
        if (url == null) return null;
        return findByPublicUrl(url);
    }

    private MediaEntity findById(UUID id) {
        return mediaRepo.findById(id).orElse(null);
    }

    private MediaEntity findByPublicUrl(String url) {
        return mediaRepo.findByPublicUrlIn(List.of(url)).stream().findFirst().orElse(null);
    }

    private void ensureUrlMatches(MediaEntity media, String url) {
        if (media == null) {
            throw validation("logo.mediaId", "BRAND_LOGO_MEDIA_NOT_FOUND",
                    "Không tìm thấy media logo / the selected logo media was not found.");
        }
        if (!url.equals(trimToNull(media.getPublicUrl()))) {
            throw validation("logo.mediaId", "BRAND_LOGO_MEDIA_MISMATCH",
                    "URL không khớp với media đã chọn / the logo URL does not match the selected media.");
        }
    }

    private Inspection inspect(MediaEntity media) {
        byte[] bytes;
        try {
            bytes = readStoredObject(media);
        } catch (Exception e) {
            log.warn("Could not inspect brand logo media {}: {}", media.getId(), e.getMessage());
            return Inspection.unavailable();
        }

        long fileSize = bytes.length;
        if (fileSize > MAX_BYTES) {
            return new Inspection(true, null, null, fileSize, TIKA.detect(bytes, "logo.png"),
                    null, List.of("TOO_LARGE"));
        }

        String detected = TIKA.detect(bytes, "logo.png");
        if (!PNG_MIME.equalsIgnoreCase(detected)) {
            return new Inspection(true, null, null, fileSize, detected, null, List.of("NOT_PNG"));
        }

        BufferedImage image;
        try {
            image = ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (Exception e) {
            return new Inspection(true, null, null, fileSize, detected, null,
                    List.of("NOT_PNG"));
        }
        if (image == null) {
            return new Inspection(true, null, null, fileSize, detected, null,
                    List.of("NOT_PNG"));
        }

        int width = image.getWidth();
        int height = image.getHeight();
        List<String> issues = new ArrayList<>();
        if (width <= 0 || height <= 0 || Math.abs(width - height) / (double) Math.max(width, height)
                > RATIO_TOLERANCE) {
            issues.add("NOT_SQUARE");
        }
        if (width < MIN_PIXELS || height < MIN_PIXELS) {
            issues.add("TOO_SMALL");
        }
        boolean transparent = hasTransparentPixel(image);
        if (!transparent) {
            issues.add("NOT_TRANSPARENT");
        }
        return new Inspection(true, width, height, fileSize, detected, transparent, dedupe(issues));
    }

    private byte[] readStoredObject(MediaEntity media) throws Exception {
        String bucket = media.getBucket() == null || media.getBucket().isBlank()
                ? minioProperties.getBucket() : media.getBucket();
        try (InputStream input = minioClient.getObject(GetObjectArgs.builder()
                .bucket(bucket)
                .object(media.getFilePath())
                .build())) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
                if (output.size() > MAX_BYTES) {
                    return output.toByteArray();
                }
            }
            return output.toByteArray();
        }
    }

    private static boolean hasTransparentPixel(BufferedImage image) {
        if (!image.getColorModel().hasAlpha()) return false;
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                if (((image.getRGB(x, y) >>> 24) & 0xff) < 255) return true;
            }
        }
        return false;
    }

    private static List<String> metadataIssues(
            Integer width,
            Integer height,
            Long fileSize,
            String mimeType
    ) {
        List<String> issues = new ArrayList<>();
        if (width != null && height != null) {
            if (width <= 0 || height <= 0
                    || Math.abs(width - height) / (double) Math.max(width, height)
                    > RATIO_TOLERANCE) {
                issues.add("NOT_SQUARE");
            }
            if (width < MIN_PIXELS || height < MIN_PIXELS) {
                issues.add("TOO_SMALL");
            }
        }
        if (fileSize != null && fileSize > MAX_BYTES) issues.add("TOO_LARGE");
        if (mimeType != null && !mimeType.isBlank() && !PNG_MIME.equalsIgnoreCase(mimeType)) {
            issues.add("NOT_PNG");
        }
        return dedupe(issues);
    }

    private static void throwIfInvalid(Inspection inspection) {
        if (!inspection.available()) {
            throw validation("logo.mediaId", "BRAND_LOGO_MEDIA_UNAVAILABLE",
                    "Không đọc được object logo trong kho BigBike / the logo object could not be read from BigBike storage.");
        }
        if (inspection.issues().isEmpty()) return;
        String issue = inspection.issues().get(0);
        String code = "BRAND_LOGO_" + issue;
        String message = switch (issue) {
            case "NOT_SQUARE" -> "Logo phải vuông, tỉ lệ 1:1 (sai lệch tối đa 1%) / the logo must be square, 1:1 (maximum 1% tolerance).";
            case "TOO_SMALL" -> "Ảnh logo tối thiểu 400 × 400 điểm ảnh / the logo must be at least 400 × 400 pixels.";
            case "TOO_LARGE" -> "Ảnh logo tối đa 300 KB / the logo must be at most 300 KB.";
            case "NOT_PNG" -> "Logo phải là PNG / the logo must be a PNG file.";
            case "NOT_TRANSPARENT" -> "Logo phải có nền trong suốt / the logo must have a transparent background.";
            default -> "Logo không đạt chuẩn / the logo does not meet the brand-logo standard.";
        };
        throw validation("logo", code, message);
    }

    private static ValidationException validation(String field, String code, String message) {
        return ValidationException.fromField(field, code, message);
    }

    private static UUID parseUuid(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private static String trimToNull(String raw) {
        if (raw == null) return null;
        String value = raw.trim();
        return value.isEmpty() ? null : value;
    }

    private static List<String> dedupe(List<String> values) {
        if (values == null || values.isEmpty()) return List.of();
        return values.stream().filter(value -> value != null && !value.isBlank()).distinct().toList();
    }

    public record LogoMutation(boolean unchanged, boolean cleared, MediaEntity media) {
        public static LogoMutation preserve() {
            return new LogoMutation(true, false, null);
        }

        public static LogoMutation newUnchanged() {
            return new LogoMutation(true, false, null);
        }

        public static LogoMutation newCleared() {
            return new LogoMutation(false, true, null);
        }

        public static LogoMutation replaced(MediaEntity media) {
            return new LogoMutation(false, false, media);
        }
    }

    private record Inspection(
            boolean available,
            Integer width,
            Integer height,
            Long fileSize,
            String mimeType,
            Boolean transparent,
            List<String> issues
    ) {
        static Inspection unavailable() {
            return new Inspection(false, null, null, null, null, null, List.of());
        }
    }
}
