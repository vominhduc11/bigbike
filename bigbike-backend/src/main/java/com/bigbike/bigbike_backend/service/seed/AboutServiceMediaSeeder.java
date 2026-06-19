package com.bigbike.bigbike_backend.service.seed;

import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.StatObjectArgs;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.util.Optional;
import javax.imageio.ImageIO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Nạp 5 ảnh ô dịch vụ mặc định của trang Giới thiệu lên MinIO + thư viện ảnh, rồi trỏ các setting
 * {@code about_page_service{i}_image} sang URL MinIO (/media/...). Chạy idempotent lúc khởi động:
 *
 * <ul>
 *   <li>Chỉ tác động khi setting còn trống hoặc còn trỏ vào ảnh theme cũ ({@code /wp-content/themes/});
 *       khi đã là {@code /media/...} (đã seed hoặc admin tự đổi) thì BỎ QUA — không đè lựa chọn của admin.</li>
 *   <li>Object trên MinIO dùng key cố định ({@code uploads/seed/about-service-{i}.png}) + media row tra theo
 *       {@code file_path} nên chạy lại nhiều lần không tạo bản trùng.</li>
 *   <li>MinIO mỗi môi trường (local/VPS) tách biệt và không replicate qua DB migration, nên việc seed
 *       phải nằm ở runtime per-env như thế này. Lỗi MinIO chỉ log cảnh báo, KHÔNG chặn khởi động —
 *       web vẫn có ảnh theme dự phòng trong code.</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AboutServiceMediaSeeder implements ApplicationRunner {

    private static final int TILE_COUNT = 5;
    private static final String THEME_PREFIX = "/wp-content/themes/";
    private static final String MEDIA_PATH_PREFIX = "/media/";
    private static final String MINIO_PROVIDER = "MINIO";

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;
    private final MediaJpaRepository mediaRepo;
    private final SiteSettingJpaRepository settingRepo;

    @Override
    public void run(ApplicationArguments args) {
        for (int i = 1; i <= TILE_COUNT; i++) {
            try {
                seedTile(i);
            } catch (Exception e) {
                log.warn("AboutServiceMediaSeeder: bỏ qua ô {} do lỗi: {}", i, e.getMessage());
            }
        }
    }

    private void seedTile(int index) throws Exception {
        String settingKey = "about_page_service" + index + "_image";
        Optional<SiteSettingEntity> settingOpt = settingRepo.findBySettingKey(settingKey);
        if (settingOpt.isEmpty()) {
            return; // migration V223 chưa chạy — không có gì để gắn
        }
        SiteSettingEntity setting = settingOpt.get();
        String current = setting.getSettingValue() == null ? "" : setting.getSettingValue().trim();
        boolean needsSeed = current.isEmpty() || current.startsWith(THEME_PREFIX);
        if (!needsSeed) {
            return; // đã là /media/... hoặc admin đã tự đặt — giữ nguyên
        }

        String objectKey = "uploads/seed/about-service-" + index + ".png";
        String publicUrl = MEDIA_PATH_PREFIX + objectKey;

        MediaEntity media = mediaRepo.findFirstByFilePath(objectKey).orElse(null);
        if (media == null) {
            byte[] bytes = readSeedImage(index);
            ensureObject(objectKey, bytes);
            media = saveMediaRow(objectKey, publicUrl, bytes, index);
            log.info("AboutServiceMediaSeeder: đã nạp ảnh ô {} lên MinIO ({})", index, publicUrl);
        }

        setting.setSettingValue(media.getPublicUrl());
        setting.setUpdatedAt(Instant.now());
        settingRepo.save(setting);
    }

    private byte[] readSeedImage(int index) throws Exception {
        ClassPathResource resource = new ClassPathResource("seed/about-services/a-" + index + ".png");
        try (var in = resource.getInputStream()) {
            return in.readAllBytes();
        }
    }

    /** Upload nếu object chưa tồn tại trên MinIO (tránh ghi đè vô ích). */
    private void ensureObject(String objectKey, byte[] bytes) throws Exception {
        String bucket = minioProperties.getBucket();
        try {
            minioClient.statObject(StatObjectArgs.builder().bucket(bucket).object(objectKey).build());
            return; // đã có
        } catch (Exception ignored) {
            // chưa có → upload bên dưới
        }
        minioClient.putObject(
                PutObjectArgs.builder()
                        .bucket(bucket)
                        .object(objectKey)
                        .stream(new ByteArrayInputStream(bytes), bytes.length, -1)
                        .contentType("image/png")
                        .build());
    }

    private MediaEntity saveMediaRow(String objectKey, String publicUrl, byte[] bytes, int index) {
        Integer width = null;
        Integer height = null;
        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(bytes));
            if (img != null) {
                width = img.getWidth();
                height = img.getHeight();
            }
        } catch (Exception e) {
            log.debug("AboutServiceMediaSeeder: không đọc được kích thước ảnh ô {}: {}", index, e.getMessage());
        }

        Instant now = Instant.now();
        MediaEntity media = new MediaEntity();
        media.setFilePath(objectKey);
        media.setPublicUrl(publicUrl);
        media.setStorageProvider(MINIO_PROVIDER);
        media.setBucket(minioProperties.getBucket());
        media.setMimeType("image/png");
        media.setFileSize((long) bytes.length);
        media.setWidth(width);
        media.setHeight(height);
        media.setAltText("BigBike - dịch vụ " + index);
        media.setTitle("about-service-" + index + ".png");
        media.setStatus("ACTIVE");
        media.setCreatedAt(now);
        media.setUpdatedAt(now);
        return mediaRepo.save(media);
    }
}
