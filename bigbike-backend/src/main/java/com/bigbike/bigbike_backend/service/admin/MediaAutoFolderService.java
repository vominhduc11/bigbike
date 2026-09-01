package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaFolderEntity;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaFolderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import jakarta.persistence.EntityManager;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Places newly attached media without overriding an existing folder choice.
 *
 * <p>Mutation services call one method after their successful save. The lookup is intentionally
 * based on persisted IDs/URLs and the update only touches {@code folder_id} and {@code updated_at}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MediaAutoFolderService {

    private static final Set<String> KNOWN_BRANDS = Set.of(
            "ilm", "taichi", "ls2", "komine", "givi", "scs", "kewig", "caberg", "nic",
            "hevik", "spyke", "xpeed", "rok-straps", "bigbike", "agv", "spirit-moto",
            "sixs", "quadlock", "dainese");

    private final MediaJpaRepository mediaRepo;
    private final MediaFolderJpaRepository folderRepo;
    private final JdbcTemplate jdbc;
    private final ObjectProvider<EntityManager> entityManagerProvider;

    @Transactional
    public void placeProduct(String productId) {
        if (productId == null || productId.isBlank()) return;
        flushPendingEntityChanges();
        Map<String, Object> product = first("SELECT * FROM products WHERE id = ?", productId);
        if (product.isEmpty()) return;
        Map<String, Object> brand = first(
                "SELECT b.name, b.slug FROM products p LEFT JOIN brands b ON b.id = p.brand_id WHERE p.id = ?",
                productId);
        String brandKey = knownBrand(value(brand, "name"), value(brand, "slug"));
        String target = "products:" + (brandKey == null ? "unknown" : brandKey);
        assignRows(List.of(product), target);
        assignRows(rows("SELECT * FROM product_variants WHERE product_id = ?", productId), target);
        assignRows(rows("SELECT pvg.* FROM product_variant_gallery_images pvg"
                + " JOIN product_variants pv ON pv.id = pvg.variant_id WHERE pv.product_id = ?", productId), target);
    }

    @Transactional
    public void placeArticle(String articleId) {
        if (articleId == null || articleId.isBlank()) return;
        flushPendingEntityChanges();
        Map<String, Object> article = first("SELECT * FROM articles WHERE id = ?", articleId);
        if (article.isEmpty()) return;
        Integer year = year(article);
        if (year != null && year >= 2020 && year <= 2026) {
            assignRows(List.of(article), "articles:" + year);
        }
    }

    @Transactional
    public void placeBrand(String brandId) {
        if (brandId == null || brandId.isBlank()) return;
        flushPendingEntityChanges();
        Map<String, Object> brand = first("SELECT * FROM brands WHERE id = ?", brandId);
        if (brand.isEmpty()) return;
        assignFields(brand, "root:brands", "logo_id", "logo_url", "logo_alt");
        assignFields(brand, "root:banners", "banner_url", "banner_alt");
    }

    @Transactional
    public void placeCategory(String categoryId) {
        if (categoryId == null || categoryId.isBlank()) return;
        flushPendingEntityChanges();
        Map<String, Object> category = first("SELECT * FROM categories WHERE id = ?", categoryId);
        if (category.isEmpty()) return;
        assignFields(category, "root:categories",
                "image_id", "image_url", "image_alt", "icon_id", "icon_url", "icon_alt", "menu_icon_url");
        assignFields(category, "root:banners", "banner_url", "banner_alt");
    }

    @Transactional
    public void placeSlider(String sliderId) {
        if (sliderId == null || sliderId.isBlank()) return;
        flushPendingEntityChanges();
        assignRows(rows("SELECT * FROM sliders WHERE id = ?", sliderId), "root:banners");
    }

    @Transactional
    public void placeSetting(String settingKey) {
        if (settingKey == null || settingKey.isBlank() || !isBannerSetting(settingKey)) return;
        flushPendingEntityChanges();
        assignRows(rows("SELECT * FROM site_settings WHERE setting_key = ?", settingKey), "root:banners");
    }

    private void assignFields(Map<String, Object> row, String systemKey, String... fields) {
        StringBuilder blob = new StringBuilder();
        for (String field : fields) {
            String fieldValue = value(row, field);
            if (fieldValue != null) blob.append(' ').append(fieldValue);
        }
        assignBlob(blob.toString(), systemKey);
    }

    private void assignRows(List<Map<String, Object>> rows, String systemKey) {
        for (Map<String, Object> row : rows) assignBlob(rowBlob(row), systemKey);
    }

    private void assignBlob(String blob, String systemKey) {
        if (blob == null || blob.isBlank()) return;
        Optional<MediaFolderEntity> folder = folderRepo.findBySystemKey(systemKey);
        if (folder.isEmpty()) {
            log.warn("Media auto-placement skipped because system folder '{}' is missing", systemKey);
            return;
        }
        UUID folderId = folder.get().getId();
        for (MediaEntity media : mediaRepo.findAll()) {
            if ("DELETED".equalsIgnoreCase(media.getStatus()) || media.getFolderId() != null) continue;
            if (!matches(blob, media)) continue;
            media.setFolderId(folderId);
            media.setUpdatedAt(Instant.now());
            mediaRepo.save(media);
        }
    }

    private void flushPendingEntityChanges() {
        EntityManager entityManager = entityManagerProvider.getIfAvailable();
        if (entityManager != null) entityManager.flush();
    }

    private List<Map<String, Object>> rows(String sql, Object... args) {
        try {
            return jdbc.queryForList(sql, args);
        } catch (DataAccessException exception) {
            log.warn("Media auto-placement source query skipped ({}): {}", sql, exception.getMessage());
            return List.of();
        }
    }

    private Map<String, Object> first(String sql, Object... args) {
        List<Map<String, Object>> values = rows(sql, args);
        return values.isEmpty() ? Map.of() : values.get(0);
    }

    private static boolean matches(String blob, MediaEntity media) {
        if (media.getId() != null && blob.contains(media.getId().toString())) return true;
        String lower = blob.toLowerCase(Locale.ROOT);
        return (media.getFilePath() != null && lower.contains(media.getFilePath().toLowerCase(Locale.ROOT)))
                || (media.getPublicUrl() != null && lower.contains(media.getPublicUrl().toLowerCase(Locale.ROOT)));
    }

    private static String knownBrand(String name, String slug) {
        for (String candidate : List.of(name, slug)) {
            if (candidate == null) continue;
            String normalized = normalizeKey(candidate);
            for (String known : KNOWN_BRANDS) {
                if (normalizeKey(known).equals(normalized)) return known;
            }
        }
        return null;
    }

    private static Integer year(Map<String, Object> row) {
        Instant effective = toInstant(rowObject(row, "published_at"));
        if (effective == null) effective = toInstant(rowObject(row, "created_at"));
        return effective == null ? null : effective.atOffset(ZoneOffset.UTC).getYear();
    }

    private static Instant toInstant(Object value) {
        if (value == null) return null;
        if (value instanceof Instant instant) return instant;
        if (value instanceof java.sql.Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof OffsetDateTime offset) return offset.toInstant();
        if (value instanceof LocalDateTime local) return local.toInstant(ZoneOffset.UTC);
        if (value instanceof LocalDate date) return date.atStartOfDay().toInstant(ZoneOffset.UTC);
        try {
            return Instant.parse(value.toString());
        } catch (RuntimeException ignored) {
            try {
                return OffsetDateTime.parse(value.toString()).toInstant();
            } catch (RuntimeException ignoredAgain) {
                return null;
            }
        }
    }

    private static boolean isBannerSetting(String key) {
        String normalized = key.toLowerCase(Locale.ROOT);
        return normalized.contains("hero") || normalized.contains("banner") || normalized.contains("public_hero");
    }

    private static String normalizeKey(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .replace('đ', 'd').replace('Đ', 'D')
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }

    private static String rowBlob(Map<String, Object> row) {
        return row.values().stream().filter(Objects::nonNull).map(Object::toString).collect(Collectors.joining(" "));
    }

    private static String value(Map<String, Object> row, String key) {
        Object value = rowObject(row, key);
        return value == null ? null : value.toString();
    }

    private static Object rowObject(Map<String, Object> row, String key) {
        for (Map.Entry<String, Object> entry : row.entrySet()) {
            if (entry.getKey().equalsIgnoreCase(key)) return entry.getValue();
        }
        return null;
    }
}
