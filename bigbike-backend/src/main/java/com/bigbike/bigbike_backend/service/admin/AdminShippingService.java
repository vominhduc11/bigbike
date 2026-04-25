package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.shipping.ShippingMethodEntity;
import com.bigbike.bigbike_backend.persistence.entity.shipping.ShippingZoneEntity;
import com.bigbike.bigbike_backend.persistence.repository.shipping.ShippingMethodJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.shipping.ShippingZoneJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminShippingService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final ShippingZoneJpaRepository zoneRepo;
    private final ShippingMethodJpaRepository methodRepo;
    private final PaginationService paginationService;

    public AdminShippingService(
            ShippingZoneJpaRepository zoneRepo,
            ShippingMethodJpaRepository methodRepo,
            PaginationService paginationService
    ) {
        this.zoneRepo = zoneRepo;
        this.methodRepo = methodRepo;
        this.paginationService = paginationService;
    }

    // ── Zones ─────────────────────────────────────────────────────────────────

    public PageResult<Map<String, Object>> listZones(int page, int size, String q) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        List<ShippingZoneEntity> all = zoneRepo.findAll();
        if (q != null && !q.isBlank()) {
            String qLower = q.toLowerCase(Locale.ROOT);
            all = all.stream()
                    .filter(z -> z.getName().toLowerCase(Locale.ROOT).contains(qLower))
                    .toList();
        }
        List<Map<String, Object>> mapped = all.stream().map(this::toZoneMap).toList();
        return paginationService.paginate(mapped, normalizedPage, normalizedSize);
    }

    public Map<String, Object> getZone(UUID id) {
        return toZoneMap(zoneRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Shipping zone not found.")));
    }

    @Transactional
    public Map<String, Object> createZone(String name, String regionCode, int sortOrder, boolean enabled) {
        ShippingZoneEntity entity = new ShippingZoneEntity();
        Instant now = Instant.now();
        entity.setName(name);
        entity.setRegionCode(regionCode);
        entity.setSortOrder(sortOrder);
        entity.setEnabled(enabled);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return toZoneMap(zoneRepo.save(entity));
    }

    @Transactional
    public Map<String, Object> updateZone(UUID id, String name, String regionCode, Integer sortOrder, Boolean enabled) {
        ShippingZoneEntity entity = zoneRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Shipping zone not found."));
        if (name != null) entity.setName(name);
        if (regionCode != null) entity.setRegionCode(regionCode);
        if (sortOrder != null) entity.setSortOrder(sortOrder);
        if (enabled != null) entity.setEnabled(enabled);
        entity.setUpdatedAt(Instant.now());
        return toZoneMap(zoneRepo.save(entity));
    }

    @Transactional
    public void deleteZone(UUID id) {
        ShippingZoneEntity entity = zoneRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Shipping zone not found."));
        methodRepo.deleteAll(methodRepo.findByZoneId(id));
        zoneRepo.delete(entity);
    }

    // ── Methods ───────────────────────────────────────────────────────────────

    public List<Map<String, Object>> listMethods(UUID zoneId) {
        zoneRepo.findById(zoneId)
                .orElseThrow(() -> new NotFoundException("Shipping zone not found."));
        return methodRepo.findByZoneId(zoneId).stream().map(this::toMethodMap).toList();
    }

    @Transactional
    public Map<String, Object> createMethod(UUID zoneId, String methodCode, String title, String description,
            BigDecimal cost, BigDecimal minOrderAmount, BigDecimal freeShippingThreshold,
            int sortOrder, boolean enabled) {
        ShippingZoneEntity zone = zoneRepo.findById(zoneId)
                .orElseThrow(() -> new NotFoundException("Shipping zone not found."));
        Instant now = Instant.now();
        ShippingMethodEntity entity = new ShippingMethodEntity();
        entity.setZone(zone);
        entity.setMethodCode(methodCode);
        entity.setTitle(title);
        entity.setDescription(description);
        entity.setCost(cost);
        entity.setMinOrderAmount(minOrderAmount);
        entity.setFreeShippingThreshold(freeShippingThreshold);
        entity.setSortOrder(sortOrder);
        entity.setEnabled(enabled);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return toMethodMap(methodRepo.save(entity));
    }

    @Transactional
    public Map<String, Object> updateMethod(UUID zoneId, UUID methodId, String methodCode, String title,
            String description, BigDecimal cost, BigDecimal minOrderAmount, BigDecimal freeShippingThreshold,
            Integer sortOrder, Boolean enabled) {
        ShippingMethodEntity entity = methodRepo.findById(methodId)
                .orElseThrow(() -> new NotFoundException("Shipping method not found."));
        if (!entity.getZone().getId().equals(zoneId)) {
            throw new NotFoundException("Shipping method not found in zone.");
        }
        if (methodCode != null) entity.setMethodCode(methodCode);
        if (title != null) entity.setTitle(title);
        if (description != null) entity.setDescription(description);
        if (cost != null) entity.setCost(cost);
        if (minOrderAmount != null) entity.setMinOrderAmount(minOrderAmount);
        if (freeShippingThreshold != null) entity.setFreeShippingThreshold(freeShippingThreshold);
        if (sortOrder != null) entity.setSortOrder(sortOrder);
        if (enabled != null) entity.setEnabled(enabled);
        entity.setUpdatedAt(Instant.now());
        return toMethodMap(methodRepo.save(entity));
    }

    @Transactional
    public void deleteMethod(UUID zoneId, UUID methodId) {
        ShippingMethodEntity entity = methodRepo.findById(methodId)
                .orElseThrow(() -> new NotFoundException("Shipping method not found."));
        if (!entity.getZone().getId().equals(zoneId)) {
            throw new NotFoundException("Shipping method not found in zone.");
        }
        methodRepo.delete(entity);
    }

    // ── Mappers ───────────────────────────────────────────────────────────────

    private Map<String, Object> toZoneMap(ShippingZoneEntity z) {
        return Map.of(
                "id", z.getId().toString(),
                "name", z.getName(),
                "regionCode", z.getRegionCode() != null ? z.getRegionCode() : "",
                "sortOrder", z.getSortOrder(),
                "enabled", z.isEnabled(),
                "createdAt", z.getCreatedAt() != null ? z.getCreatedAt().toString() : "",
                "updatedAt", z.getUpdatedAt() != null ? z.getUpdatedAt().toString() : ""
        );
    }

    private Map<String, Object> toMethodMap(ShippingMethodEntity m) {
        java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
        map.put("id", m.getId().toString());
        map.put("zoneId", m.getZone().getId().toString());
        map.put("methodCode", m.getMethodCode());
        map.put("title", m.getTitle());
        map.put("description", m.getDescription() != null ? m.getDescription() : "");
        map.put("cost", m.getCost() != null ? m.getCost() : BigDecimal.ZERO);
        map.put("minOrderAmount", m.getMinOrderAmount() != null ? m.getMinOrderAmount() : BigDecimal.ZERO);
        map.put("freeShippingThreshold", m.getFreeShippingThreshold());
        map.put("sortOrder", m.getSortOrder());
        map.put("enabled", m.isEnabled());
        return java.util.Collections.unmodifiableMap(map);
    }
}
