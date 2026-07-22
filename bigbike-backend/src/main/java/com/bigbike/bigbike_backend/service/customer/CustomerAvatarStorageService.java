package com.bigbike.bigbike_backend.service.customer;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.service.media.CompressionProfile;
import com.bigbike.bigbike_backend.service.media.ImageCompressionService;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import java.io.ByteArrayInputStream;
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
import org.springframework.web.multipart.MultipartFile;

/**
 * Stores a customer's own avatar photo in MinIO and returns its public URL
 * ({@code /media/customers/{customerId}/{uuid}/{filename}}). Owner decision 2026-07-21
 * (MEDIA_RULE_005): stricter than review photos — max 5 MB — and only the account owner
 * may upload; admins may only view/remove. Reuses the same MinIO client + Apache Tika
 * magic-byte detection as {@link com.bigbike.bigbike_backend.service.public_.ReviewPhotoStorageService}.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CustomerAvatarStorageService {

    private static final Tika TIKA = new Tika();
    private static final int TIKA_HEADER_BYTES = 8192;
    private static final long MAX_UPLOAD_BYTES = 5L * 1024 * 1024; // 5 MB
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    static final String MEDIA_PATH_PREFIX = "/media/";
    // Owner-approved (MEDIA_RULE_006): avatars only ever render at 32-56px, so a square-cropped
    // 400x400 keeps every circular avatar surface sharp without storing far more detail than
    // will ever be shown.
    private static final CompressionProfile AVATAR_PROFILE = new CompressionProfile(400, 400, 0.85f, true);

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;
    private final ImageCompressionService imageCompressionService;

    /**
     * Validate + store one avatar image for a customer. Returns the relative public URL
     * ({@code /media/customers/...}).
     */
    public String store(UUID customerId, MultipartFile file) {
        String mimeType = validateImage(file);

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read upload bytes: " + e.getMessage(), e);
        }
        bytes = imageCompressionService.compress(bytes, mimeType, AVATAR_PROFILE);

        String safeFilename = sanitizeFilename(file.getOriginalFilename());
        String objectKey = "customers/" + customerId + "/" + UUID.randomUUID() + "/" + safeFilename;
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
            throw new IllegalStateException("Failed to upload avatar to storage: " + e.getMessage(), e);
        }

        return MEDIA_PATH_PREFIX + objectKey;
    }

    /**
     * Best-effort delete of an avatar object from MinIO by its stored public URL
     * ({@code /media/customers/...}). Only touches objects under the {@code customers/}
     * prefix — a defence so a tampered URL can't target unrelated media. Failures are
     * logged, not thrown: cleanup must never block the surrounding profile update.
     */
    public void deleteAvatar(String url) {
        String objectKey = toCustomerObjectKey(url);
        if (objectKey == null) return;
        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder().bucket(minioProperties.getBucket()).object(objectKey).build());
        } catch (Exception e) {
            log.warn("Failed to delete avatar object '{}': {}", objectKey, e.getMessage());
        }
    }

    /** Extract the MinIO object key from a stored avatar URL; null if it isn't a customer avatar object. */
    private static String toCustomerObjectKey(String url) {
        if (url == null || url.isBlank()) return null;
        int idx = url.indexOf(MEDIA_PATH_PREFIX + "customers/");
        if (idx < 0) return null;
        String key = url.substring(idx + MEDIA_PATH_PREFIX.length());
        return key.startsWith("customers/") ? key : null;
    }

    /**
     * Declared Content-Type and Tika magic-byte detection must both be an allowed image type.
     * Returns the normalised mime type. SVG/GIF/video are rejected for customer avatars.
     */
    private String validateImage(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() == 0) {
            throw ValidationException.fromField("file", "EMPTY_FILE", "Vui lòng chọn một ảnh.");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw ValidationException.fromField("file", "FILE_TOO_LARGE", "Ảnh không được vượt quá 5MB.");
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
        if (!ALLOWED_MIME_TYPES.contains(detected)) {
            throw ValidationException.fromField(
                    "file", "MIME_MISMATCH", "Nội dung tệp không phải ảnh hợp lệ.");
        }
        return declared;
    }

    private static String sanitizeFilename(String original) {
        if (original == null || original.isBlank()) {
            return "avatar";
        }
        String name = original.replaceAll("[^a-zA-Z0-9._-]", "_").toLowerCase(Locale.ROOT);
        return name.length() > 200 ? name.substring(0, 200) : name;
    }
}
