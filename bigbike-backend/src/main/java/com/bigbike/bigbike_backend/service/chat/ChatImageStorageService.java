package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.service.media.CompressionProfile;
import com.bigbike.bigbike_backend.service.media.ImageCompressionService;
import io.minio.GetObjectArgs;
import io.minio.GetBucketPolicyArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.errors.ErrorResponseException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageReader;
import javax.imageio.ImageIO;
import javax.imageio.stream.ImageInputStream;
import lombok.RequiredArgsConstructor;
import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class ChatImageStorageService {

    public static final long MAX_UPLOAD_BYTES = 8L * 1024 * 1024;
    private static final int HEADER_BYTES = 8192;
    private static final Set<String> ALLOWED = Set.of("image/jpeg", "image/png", "image/webp");
    private static final CompressionProfile PROFILE = new CompressionProfile(1600, 1600, 0.85f, false);
    private static final Tika TIKA = new Tika();

    private final MinioClient minioClient;
    private final ImageCompressionService compressionService;

    @Value("${bigbike.minio.chat-private-bucket:bigbike-chat-private}")
    private String privateBucket = "bigbike-chat-private";

    public StoredImage store(UUID conversationId, UUID imageId, MultipartFile file) {
        String declaredMime = validate(file);
        byte[] original;
        try {
            original = file.getBytes();
        } catch (Exception exception) {
            throw ValidationException.fromField(
                    "file", "CHAT_IMAGE_INVALID", "Không đọc được tệp ảnh này.");
        }
        validateSourceDimensions(original, declaredMime);
        byte[] bytes = compressionService.reencodeWithoutMetadata(original, declaredMime, PROFILE);
        if (bytes == null && "image/webp".equals(declaredMime)) {
            bytes = stripWebpPrivateMetadata(original);
        }
        if (bytes == null) {
            throw ValidationException.fromField(
                    "file", "CHAT_IMAGE_INVALID", "Tệp không phải ảnh hợp lệ hoặc ảnh đã bị hỏng.");
        }
        if (bytes.length > MAX_UPLOAD_BYTES) {
            throw ValidationException.fromField(
                    "file", "CHAT_IMAGE_TOO_LARGE",
                    "Ảnh sau khi làm sạch dữ liệu riêng tư vẫn vượt quá 8 MB.");
        }
        String storedMime = detectStoredMime(bytes, declaredMime);
        Dimensions dimensions = dimensions(bytes, storedMime);
        if (dimensions.width() > PROFILE.maxWidth() || dimensions.height() > PROFILE.maxHeight()) {
            throw ValidationException.fromField(
                    "file", "CHAT_IMAGE_INVALID",
                    "Ảnh không thể thu nhỏ an toàn về kích thước tối đa 1.600 px.");
        }
        String extension = switch (storedMime) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "jpg";
        };
        String objectKey = "chat/" + conversationId + "/" + imageId + "." + extension;
        String bucket = privateBucket.trim();
        requireBucketWithoutPolicy(bucket);
        try {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .stream(new ByteArrayInputStream(bytes), bytes.length, -1)
                    .contentType(storedMime)
                    .build());
        } catch (Exception exception) {
            throw new IllegalStateException("Không lưu được ảnh khách gửi vào kho ảnh nội bộ.", exception);
        }
        return new StoredImage(
                bucket, objectKey, storedMime, dimensions.width(), dimensions.height(),
                bytes.length, sha256(bytes));
    }

    public StoredContent read(String bucket, String objectKey, String mimeType) {
        try (InputStream input = minioClient.getObject(GetObjectArgs.builder()
                .bucket(bucket).object(objectKey).build())) {
            return new StoredContent(input.readAllBytes(), mimeType);
        } catch (Exception exception) {
            throw new IllegalStateException("Không đọc được ảnh trong kho nội bộ.", exception);
        }
    }

    public void delete(String bucket, String objectKey) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket).object(objectKey).build());
        } catch (Exception exception) {
            throw new IllegalStateException("Không xoá được ảnh trong kho nội bộ.", exception);
        }
    }

    private void requireBucketWithoutPolicy(String bucket) {
        try {
            String policy = minioClient.getBucketPolicy(
                    GetBucketPolicyArgs.builder().bucket(bucket).build());
            if (policy != null && !policy.isBlank()) {
                throw new IllegalStateException(
                        "Kho ảnh khách đang có chính sách truy cập ngoài; đã chặn lưu ảnh để bảo vệ riêng tư.");
            }
        } catch (ErrorResponseException exception) {
            String code = exception.errorResponse() == null
                    ? "" : exception.errorResponse().code();
            if ("NoSuchBucketPolicy".equals(code)) return;
            throw new IllegalStateException(
                    "Không xác minh được quyền riêng tư của kho ảnh khách.", exception);
        } catch (IllegalStateException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalStateException(
                    "Không xác minh được quyền riêng tư của kho ảnh khách.", exception);
        }
    }

    private static String validate(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() <= 0) {
            throw ValidationException.fromField(
                    "file", "CHAT_IMAGE_INVALID", "Anh/chị vui lòng chọn một ảnh.");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw ValidationException.fromField(
                    "file", "CHAT_IMAGE_TOO_LARGE", "Ảnh không được vượt quá 8 MB.");
        }
        String declared = file.getContentType() == null
                ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!ALLOWED.contains(declared)) {
            throw ValidationException.fromField(
                    "file", "CHAT_IMAGE_UNSUPPORTED_TYPE", "Chỉ nhận ảnh JPG, PNG hoặc WebP.");
        }
        byte[] header = new byte[HEADER_BYTES];
        int read;
        try (InputStream input = file.getInputStream()) {
            read = input.read(header);
        } catch (Exception exception) {
            throw ValidationException.fromField(
                    "file", "CHAT_IMAGE_INVALID", "Không đọc được tệp ảnh này.");
        }
        if (read <= 0) {
            throw ValidationException.fromField(
                    "file", "CHAT_IMAGE_INVALID", "Tệp ảnh đang trống.");
        }
        String detected = TIKA.detect(
                Arrays.copyOf(header, read), file.getOriginalFilename()).toLowerCase(Locale.ROOT);
        if (!ALLOWED.contains(detected) || !detected.equals(declared)) {
            throw ValidationException.fromField(
                    "file", "CHAT_IMAGE_UNSUPPORTED_TYPE",
                    "Loại tệp không khớp nội dung ảnh; chỉ nhận JPG, PNG hoặc WebP.");
        }
        return declared;
    }

    private static String detectStoredMime(byte[] bytes, String fallback) {
        String detected = TIKA.detect(bytes).toLowerCase(Locale.ROOT);
        return ALLOWED.contains(detected) ? detected : fallback;
    }

    /** Read only image headers before raster allocation to reject compressed image bombs. */
    private static void validateSourceDimensions(byte[] bytes, String mimeType) {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = input == null
                    ? java.util.Collections.emptyIterator() : ImageIO.getImageReaders(input);
            if (readers.hasNext()) {
                ImageReader reader = readers.next();
                try {
                    reader.setInput(input, true, true);
                    checkedDimensions(reader.getWidth(0), reader.getHeight(0));
                    return;
                } finally {
                    reader.dispose();
                }
            }
            if ("image/webp".equals(mimeType)) {
                Dimensions parsed = webpDimensions(bytes);
                if (parsed != null) {
                    checkedDimensions(parsed.width(), parsed.height());
                    return;
                }
            }
        } catch (ValidationException exception) {
            throw exception;
        } catch (Exception ignored) {
            // The stable public error below deliberately avoids exposing decoder details.
        }
        throw ValidationException.fromField(
                "file", "CHAT_IMAGE_INVALID", "Tệp không phải ảnh hợp lệ hoặc ảnh đã bị hỏng.");
    }

    private static Dimensions dimensions(byte[] bytes, String mimeType) {
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image != null && image.getWidth() > 0 && image.getHeight() > 0) {
                return checkedDimensions(image.getWidth(), image.getHeight());
            }
        } catch (Exception ignored) {
            // WebP is not supported by every JRE ImageIO installation; parse its header below.
        }
        if ("image/webp".equals(mimeType)) {
            Dimensions parsed = webpDimensions(bytes);
            if (parsed != null) return checkedDimensions(parsed.width(), parsed.height());
        }
        throw ValidationException.fromField(
                "file", "CHAT_IMAGE_INVALID", "Tệp không phải ảnh hợp lệ hoặc ảnh đã bị hỏng.");
    }

    private static Dimensions checkedDimensions(int width, int height) {
        if (width <= 0 || height <= 0 || width > 20_000 || height > 20_000
                || (long) width * height > 25_000_000L) {
            throw ValidationException.fromField(
                    "file", "CHAT_IMAGE_INVALID", "Kích thước ảnh không hợp lệ.");
        }
        return new Dimensions(width, height);
    }

    private static Dimensions webpDimensions(byte[] bytes) {
        if (bytes.length < 30
                || !"RIFF".equals(new String(bytes, 0, 4, StandardCharsets.US_ASCII))
                || !"WEBP".equals(new String(bytes, 8, 4, StandardCharsets.US_ASCII))) return null;
        String chunk = new String(bytes, 12, 4, StandardCharsets.US_ASCII);
        if ("VP8X".equals(chunk) && bytes.length >= 30) {
            int width = 1 + little24(bytes, 24);
            int height = 1 + little24(bytes, 27);
            return new Dimensions(width, height);
        }
        if ("VP8 ".equals(chunk) && bytes.length >= 30) {
            int width = (bytes[26] & 0xff) | ((bytes[27] & 0x3f) << 8);
            int height = (bytes[28] & 0xff) | ((bytes[29] & 0x3f) << 8);
            return new Dimensions(width, height);
        }
        if ("VP8L".equals(chunk) && bytes.length >= 25 && (bytes[20] & 0xff) == 0x2f) {
            int b1 = bytes[21] & 0xff;
            int b2 = bytes[22] & 0xff;
            int b3 = bytes[23] & 0xff;
            int b4 = bytes[24] & 0xff;
            int width = 1 + b1 + ((b2 & 0x3f) << 8);
            int height = 1 + ((b2 & 0xc0) >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10);
            return new Dimensions(width, height);
        }
        return null;
    }

    /** Remove standard EXIF/XMP WebP chunks when no ImageIO WebP decoder is installed. */
    static byte[] stripWebpPrivateMetadata(byte[] bytes) {
        if (bytes == null || bytes.length < 20
                || !"RIFF".equals(new String(bytes, 0, 4, StandardCharsets.US_ASCII))
                || !"WEBP".equals(new String(bytes, 8, 4, StandardCharsets.US_ASCII))) return null;
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream(bytes.length);
            output.write(bytes, 0, 12);
            int offset = 12;
            while (offset + 8 <= bytes.length) {
                String chunk = new String(bytes, offset, 4, StandardCharsets.US_ASCII);
                long sizeLong = little32(bytes, offset + 4);
                if (sizeLong > Integer.MAX_VALUE) return null;
                int size = (int) sizeLong;
                int padded = size + (size & 1);
                if (offset + 8L + padded > bytes.length) return null;
                if (!"EXIF".equals(chunk) && !"XMP ".equals(chunk)) {
                    byte[] data = Arrays.copyOfRange(bytes, offset + 8, offset + 8 + size);
                    if ("VP8X".equals(chunk) && data.length > 0) {
                        data[0] = (byte) (data[0] & ~0x0c); // clear EXIF and XMP flags
                    }
                    output.write(bytes, offset, 8);
                    output.write(data);
                    if ((size & 1) == 1) output.write(0);
                }
                offset += 8 + padded;
            }
            if (offset != bytes.length) return null;
            byte[] clean = output.toByteArray();
            writeLittle32(clean, 4, clean.length - 8L);
            return clean;
        } catch (Exception exception) {
            return null;
        }
    }

    private static int little24(byte[] bytes, int offset) {
        return (bytes[offset] & 0xff)
                | ((bytes[offset + 1] & 0xff) << 8)
                | ((bytes[offset + 2] & 0xff) << 16);
    }

    private static long little32(byte[] bytes, int offset) {
        return (bytes[offset] & 0xffL)
                | ((bytes[offset + 1] & 0xffL) << 8)
                | ((bytes[offset + 2] & 0xffL) << 16)
                | ((bytes[offset + 3] & 0xffL) << 24);
    }

    private static void writeLittle32(byte[] bytes, int offset, long value) {
        for (int index = 0; index < 4; index++) {
            bytes[offset + index] = (byte) ((value >>> (index * 8)) & 0xff);
        }
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public record StoredImage(
            String bucket,
            String objectKey,
            String mimeType,
            int width,
            int height,
            long sizeBytes,
            String sha256
    ) {}

    public record StoredContent(byte[] bytes, String mimeType) {}
    private record Dimensions(int width, int height) {}
}
