package com.bigbike.bigbike_backend.service.public_;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewPhotoUploadEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewPhotoUploadJpaRepository;
import com.bigbike.bigbike_backend.service.media.CompressionProfile;
import com.bigbike.bigbike_backend.service.media.ImageCompressionService;
import io.minio.ListObjectsArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.Result;
import io.minio.messages.Item;
import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

/**
 * Stores a single customer-uploaded review photo in MinIO and returns its public URL
 * ({@code /media/reviews/{uuid}/{filename}}). Public, no-auth path (REVIEW_RULE_005) so it is
 * deliberately stricter than the admin media upload: image only (jpeg/png/webp), ≤ 8 MB, and the
 * object is NOT registered in the admin media library — it lives purely as a MinIO object referenced
 * by {@code reviews.photos}. Reuses the same MinIO client + Apache Tika magic-byte detection as
 * {@link com.bigbike.bigbike_backend.service.admin.AdminMediaService} but without variants or DB rows.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ReviewPhotoStorageService {

    private static final Tika TIKA = new Tika();
    private static final int TIKA_HEADER_BYTES = 8192;
    private static final long MAX_UPLOAD_BYTES = 8L * 1024 * 1024; // 8 MB
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    static final String MEDIA_PATH_PREFIX = "/media/";
    // Owner-approved (MEDIA_RULE_006): review photos are viewed full-size in a lightbox, so keep
    // more headroom than the avatar/admin ceilings.
    private static final CompressionProfile REVIEW_PROFILE = new CompressionProfile(1600, 1600, 0.85f, false);

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;
    private final ImageCompressionService imageCompressionService;
    private final ReviewPhotoUploadJpaRepository uploadRepo;

    /**
     * Validate + store one image. Returns the relative public URL ({@code /media/reviews/...}).
     */
    @Transactional
    public String store(String productId, MultipartFile file) {
        String mimeType = validateImage(file);

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read upload bytes: " + e.getMessage(), e);
        }
        bytes = imageCompressionService.compress(bytes, mimeType, REVIEW_PROFILE);

        String safeFilename = canonicalFilename(file.getOriginalFilename(), mimeType);
        String objectKey = "reviews/" + UUID.randomUUID() + "/" + safeFilename;
        String bucket = minioProperties.getBucket();

        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .stream(new ByteArrayInputStream(bytes), bytes.length, -1)
                            .contentType(mimeType)
                            .build());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to upload review photo to storage: " + e.getMessage(), e);
        }

        String publicUrl = MEDIA_PATH_PREFIX + objectKey;
        try {
            ReviewPhotoUploadEntity upload = new ReviewPhotoUploadEntity();
            upload.setObjectKey(objectKey);
            upload.setPublicUrl(publicUrl);
            upload.setProductId(productId);
            upload.setUploadedAt(Instant.now());
            uploadRepo.saveAndFlush(upload);
            deleteObjectIfTransactionRollsBack(objectKey);
            return publicUrl;
        } catch (RuntimeException exception) {
            deleteObject(objectKey);
            throw exception;
        }
    }

    /**
     * Best-effort delete of review photo objects from MinIO by their stored public URL
     * ({@code /media/reviews/...}). Called when a review is removed so its photos don't
     * linger as orphans (AUD-037). Only touches objects under the {@code reviews/} prefix —
     * a defence so a tampered URL can't target unrelated media. Failures are logged, not thrown:
     * cleanup must never block the review deletion itself.
     */
    public void deletePhotos(List<String> urls) {
        if (urls == null || urls.isEmpty()) return;
        String bucket = minioProperties.getBucket();
        for (String url : urls) {
            String objectKey = reviewObjectKey(url);
            if (objectKey == null) continue;
            try {
                minioClient.removeObject(
                        RemoveObjectArgs.builder().bucket(bucket).object(objectKey).build());
            } catch (Exception e) {
                log.warn("Failed to delete review photo object '{}': {}", objectKey, e.getMessage());
            } finally {
                try {
                    uploadRepo.deleteById(objectKey);
                } catch (Exception exception) {
                    log.warn("Failed to remove review photo claim '{}': {}",
                            objectKey, exception.getMessage());
                }
            }
        }
    }

    /**
     * Lists old objects so the scheduled cleanup can recover the narrow crash
     * window between the MinIO put and upload-ledger insert.
     */
    public List<StoredReviewObject> listObjectsOlderThan(Instant cutoff) {
        List<StoredReviewObject> objects = new ArrayList<>();
        try {
            Iterable<Result<Item>> results = minioClient.listObjects(
                    ListObjectsArgs.builder()
                            .bucket(minioProperties.getBucket())
                            .prefix("reviews/")
                            .recursive(true)
                            .build());
            for (Result<Item> result : results) {
                Item item = result.get();
                if (item.lastModified() != null
                        && item.lastModified().toInstant().isBefore(cutoff)) {
                    objects.add(new StoredReviewObject(
                            item.objectName(),
                            MEDIA_PATH_PREFIX + item.objectName(),
                            item.lastModified().toInstant()));
                }
            }
        } catch (Exception exception) {
            log.warn("Failed to list old review photo objects: {}", exception.getMessage());
        }
        return objects;
    }

    /**
     * Extract the canonical MinIO object key from a stored review photo URL.
     * Accepts canonical relative URLs and legacy absolute URLs, but never keys
     * outside {@code reviews/}.
     */
    public static String reviewObjectKey(String url) {
        if (url == null || url.isBlank()) return null;
        int idx = url.indexOf(MEDIA_PATH_PREFIX + "reviews/");
        if (idx < 0) return null;
        String key = url.substring(idx + MEDIA_PATH_PREFIX.length());
        int suffix = key.indexOf('?');
        if (suffix >= 0) {
            key = key.substring(0, suffix);
        }
        suffix = key.indexOf('#');
        if (suffix >= 0) {
            key = key.substring(0, suffix);
        }
        if (!key.startsWith("reviews/") || key.isBlank()) {
            return null;
        }
        for (String segment : key.split("/")) {
            if (segment.equals(".") || segment.equals("..")) {
                return null;
            }
        }
        return key;
    }

    private void deleteObjectIfTransactionRollsBack(String objectKey) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != TransactionSynchronization.STATUS_COMMITTED) {
                    deleteObject(objectKey);
                }
            }
        });
    }

    private void deleteObject(String objectKey) {
        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(minioProperties.getBucket())
                            .object(objectKey)
                            .build());
        } catch (Exception exception) {
            log.warn("Failed to roll back review photo object '{}': {}",
                    objectKey, exception.getMessage());
        }
    }

    /**
     * Declared Content-Type and Tika magic-byte detection must both be an allowed image type.
     * Returns the normalised mime type. SVG/GIF/video are rejected for customer review photos.
     */
    private String validateImage(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() == 0) {
            throw ValidationException.fromField("file", "EMPTY_FILE", "Vui lòng chọn một ảnh.");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw ValidationException.fromField("file", "FILE_TOO_LARGE", "Ảnh không được vượt quá 8MB.");
        }
        String declared = file.getContentType() != null ? file.getContentType().toLowerCase(Locale.ROOT) : "";
        if (!ALLOWED_MIME_TYPES.contains(declared)) {
            throw ValidationException.fromField(
                    "file", "INVALID_MIME", "Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.");
        }
        byte[] header = new byte[TIKA_HEADER_BYTES];
        int read;
        try (InputStream is = file.getInputStream()) {
            read = is.read(header, 0, header.length);
        } catch (IOException e) {
            throw new IllegalStateException("Could not read file for MIME validation.", e);
        }
        if (read <= 0) {
            throw ValidationException.fromField("file", "EMPTY_FILE", "Vui lòng chọn một ảnh.");
        }
        String detected = TIKA.detect(Arrays.copyOf(header, read), file.getOriginalFilename());
        if (!ALLOWED_MIME_TYPES.contains(detected) || !detected.equals(declared)) {
            throw ValidationException.fromField(
                    "file",
                    "MIME_MISMATCH",
                    "Loại ảnh khai báo không khớp với nội dung tệp.");
        }
        return declared;
    }

    static String canonicalFilename(String original, String mimeType) {
        String safeName = sanitizeFilename(original);
        int separator = safeName.lastIndexOf('.');
        String stem = separator > 0 ? safeName.substring(0, separator) : safeName;
        if (stem.isBlank() || ".".equals(stem) || "..".equals(stem)) {
            stem = "photo";
        }
        String extension = switch (mimeType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> "";
        };
        int maxStemLength = Math.max(1, 200 - extension.length());
        if (stem.length() > maxStemLength) {
            stem = stem.substring(0, maxStemLength);
        }
        return stem + extension;
    }

    static String sanitizeFilename(String original) {
        if (original == null || original.isBlank()) {
            return "photo";
        }
        String name = original.replaceAll("[^a-zA-Z0-9._-]", "_").toLowerCase(Locale.ROOT);
        if (name.isBlank() || ".".equals(name) || "..".equals(name)) {
            return "photo";
        }
        return name.length() > 200 ? name.substring(0, 200) : name;
    }

    public record StoredReviewObject(String objectKey, String publicUrl, Instant lastModified) {}
}
