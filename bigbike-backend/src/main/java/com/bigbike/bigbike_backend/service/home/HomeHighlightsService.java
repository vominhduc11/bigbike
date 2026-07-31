package com.bigbike.bigbike_backend.service.home;

import com.bigbike.bigbike_backend.api.admin.dto.home.AdminHomeHighlightsResponse;
import com.bigbike.bigbike_backend.api.admin.dto.home.AdminSaveHighlightsRequest;
import com.bigbike.bigbike_backend.api.error.ApiException;
import com.bigbike.bigbike_backend.api.public_.dto.HomeHighlightItemDto;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.home.HomeHighlightEntity;
import com.bigbike.bigbike_backend.persistence.repository.home.HomeHighlightsConfigJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.home.HomeHighlightJpaRepository;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class HomeHighlightsService {

    private static final Short CONFIG_ID = 1;

    private final HomeHighlightJpaRepository highlightRepo;
    private final HomeHighlightsConfigJpaRepository configRepo;
    private final ProductJpaRepository productRepo;
    private final EntityManager entityManager;
    private final WebRevalidationService webRevalidationService;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;

    @Transactional(readOnly = true)
    public List<HomeHighlightItemDto> listHighlights(String lang) {
        return listHighlights(lang, false);
    }

    @Transactional(readOnly = true)
    public AdminHomeHighlightsResponse listAdminHighlights(String lang) {
        var config = configRepo.findById(CONFIG_ID)
                .orElseThrow(() -> new IllegalStateException("Home highlights config row is missing."));
        return new AdminHomeHighlightsResponse(listHighlights(lang, false), config.getVersion());
    }

    /**
     * @param strictEnglish admin VI/EN switch: khi true (chế độ EN ở admin), ẩn hẳn
     *                      slot có sản phẩm chưa đặt tên tiếng Anh (không fallback).
     *                      Public/web luôn truyền false (giữ fallback tiếng Việt).
     */
    @Transactional(readOnly = true)
    public List<HomeHighlightItemDto> listHighlights(String lang, boolean strictEnglish) {
        return highlightRepo.findAllWithProductAndCategoryOrderBySlot()
                .stream()
                .filter(e -> !strictEnglish
                        || (e.getProduct().getNameEn() != null && !e.getProduct().getNameEn().isBlank()))
                .map(e -> HomeHighlightItemDto.from(e, lang))
                .toList();
    }

    @Transactional
    public AdminHomeHighlightsResponse saveHighlights(AdminSaveHighlightsRequest body, UUID adminId) {
        var config = configRepo.findByIdForUpdate(CONFIG_ID)
                .orElseThrow(() -> new IllegalStateException("Home highlights config row is missing."));
        if (!body.expectedVersion().equals(config.getVersion())) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "CONCURRENT_MODIFICATION",
                    "Cấu hình highlights đã được cập nhật ở cửa sổ khác. Vui lòng tải lại dữ liệu trước khi lưu lại.",
                    List.of());
        }

        for (var input : body.slots()) {
            var product = productRepo.findById(input.productId())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.UNPROCESSABLE_ENTITY,
                            "Product not found: " + input.productId()));
            if (product.getPublishStatus() != PublishStatus.PUBLISHED) {
                throw new ResponseStatusException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        "Product '" + input.productId() + "' must be PUBLISHED to appear on the homepage.");
            }
        }

        String before = highlightsSnapshot(highlightRepo.findAllWithProductAndCategoryOrderBySlot());
        long nextVersion = config.getVersion() + 1;

        // Touch the singleton first so @Version advances once for the whole replacement.
        // The row lock above serializes saves even when the slot table is temporarily empty.
        config.touch(Instant.now());
        entityManager.flush();

        // Bulk delete bypasses the persistence context. Clear it before inserting rows that
        // reuse the assigned slot primary keys; otherwise saveAll() merges stale entities.
        highlightRepo.deleteAllInBatch();
        entityManager.clear();

        var entities = body.slots().stream()
                .map(input -> {
                    var entity = new HomeHighlightEntity();
                    entity.setSlot(input.slot().shortValue());
                    entity.setProduct(productRepo.getReferenceById(input.productId()));
                    entity.setUpdatedAt(Instant.now());
                    return entity;
                })
                .toList();

        entities.forEach(entityManager::persist);
        entityManager.flush();
        auditLog(adminId, before, highlightsSnapshot(entities));

        // ISR on-demand: khối "sản phẩm nổi bật" đầu trang chủ (web đọc tag "home-highlights",
        // revalidate nền 300s). Phát tag sau commit để admin lưu xong là web cập nhật ngay,
        // không phải chờ hết TTL. WebRevalidationService tự hoãn tới afterCommit khi đang trong
        // transaction (@Transactional ở method này).
        webRevalidationService.revalidate("home-highlights");

        return new AdminHomeHighlightsResponse(listHighlights("vi"), nextVersion);
    }

    private void auditLog(UUID adminId, String before, String after) {
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "HOME_HIGHLIGHTS_SET", "HOME_HIGHLIGHT", null, before, after));
    }

    private static String highlightsSnapshot(List<HomeHighlightEntity> entities) {
        String items = entities.stream()
                .map(e -> "{\"slot\":" + e.getSlot()
                        + ",\"productId\":\"" + esc(e.getProduct() == null ? null : e.getProduct().getId())
                        + "\",\"productName\":\"" + esc(e.getProduct() == null ? null : e.getProduct().getName()) + "\"}")
                .collect(java.util.stream.Collectors.joining(","));
        return "{\"slots\":[" + items + "]}";
    }

    private static String esc(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
