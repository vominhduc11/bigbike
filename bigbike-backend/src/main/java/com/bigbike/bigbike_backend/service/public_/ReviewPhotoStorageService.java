package com.bigbike.bigbike_backend.service.public_;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.MinioProperties;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
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

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    /**
     * Validate + store one image. Returns the relative public URL ({@code /media/reviews/...}).
     */
    public String store(MultipartFile file) {
        String mimeType = validateImage(file);

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read upload bytes: " + e.getMessage(), e);
        }

        String safeFilename = sanitizeFilename(file.getOriginalFilename());
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

        return MEDIA_PATH_PREFIX + objectKey;
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
        if (!ALLOWED_MIME_TYPES.contains(detected)) {
            throw ValidationException.fromField(
                    "file", "MIME_MISMATCH", "Nội dung tệp không phải ảnh hợp lệ.");
        }
        return declared;
    }

    private static String sanitizeFilename(String original) {
        if (original == null || original.isBlank()) {
            return "photo";
        }
        String name = original.replaceAll("[^a-zA-Z0-9._-]", "_").toLowerCase(Locale.ROOT);
        return name.length() > 200 ? name.substring(0, 200) : name;
    }
}
