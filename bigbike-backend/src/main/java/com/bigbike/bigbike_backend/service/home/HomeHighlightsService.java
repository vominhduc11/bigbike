package com.bigbike.bigbike_backend.service.home;

import com.bigbike.bigbike_backend.api.admin.dto.home.AdminSaveHighlightsRequest;
import com.bigbike.bigbike_backend.api.public_.dto.HomeHighlightItemDto;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.home.HomeHighlightEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.home.HomeHighlightJpaRepository;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class HomeHighlightsService {

    private final HomeHighlightJpaRepository highlightRepo;
    private final ProductJpaRepository productRepo;
    private final WebRevalidationService webRevalidationService;
    private final AuditLogWriter auditLogWriter;

    @Transactional(readOnly = true)
    public List<HomeHighlightItemDto> listHighlights(String lang) {
        return listHighlights(lang, false);
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
    public List<HomeHighlightItemDto> saveHighlights(AdminSaveHighlightsRequest body, UUID adminId) {
        for (var input : body.slots()) {
            if (!productRepo.existsById(input.productId())) {
                throw new ResponseStatusException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        "Product not found: " + input.productId());
            }
        }

        String before = highlightsSnapshot(highlightRepo.findAllWithProductAndCategoryOrderBySlot());

        highlightRepo.deleteAllInBatch();

        var entities = body.slots().stream()
                .map(input -> {
                    var entity = new HomeHighlightEntity();
                    entity.setSlot(input.slot().shortValue());
                    entity.setProduct(productRepo.getReferenceById(input.productId()));
                    entity.setUpdatedAt(Instant.now());
                    return entity;
                })
                .toList();

        highlightRepo.saveAllAndFlush(entities);
        auditLog(adminId, before, highlightsSnapshot(entities));

        // ISR on-demand: khối "sản phẩm nổi bật" đầu trang chủ (web đọc tag "home-highlights",
        // revalidate nền 300s). Phát tag sau commit để admin lưu xong là web cập nhật ngay,
        // không phải chờ hết TTL. WebRevalidationService tự hoãn tới afterCommit khi đang trong
        // transaction (@Transactional ở method này).
        webRevalidationService.revalidate("home-highlights");

        return listHighlights("vi");
    }

    private void auditLog(UUID adminId, String before, String after) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(adminId);
        log.setAction("HOME_HIGHLIGHTS_SET");
        log.setResourceType("HOME_HIGHLIGHT");
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setCreatedAt(Instant.now());
        auditLogWriter.save(log);
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
