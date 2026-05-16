package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.shipping.CreateShippingMethodRequest;
import com.bigbike.bigbike_backend.api.admin.dto.shipping.CreateShippingZoneRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.shipping.ShippingMethodEntity;
import com.bigbike.bigbike_backend.persistence.entity.shipping.ShippingZoneEntity;
import com.bigbike.bigbike_backend.persistence.repository.shipping.ShippingMethodJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.shipping.ShippingZoneJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import tools.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminShippingService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final ShippingZoneJpaRepository zoneRepo;
    private final ShippingMethodJpaRepository methodRepo;
    private final PaginationService paginationService;

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
    public Map<String, Object> createZone(CreateShippingZoneRequest req) {
        ShippingZoneEntity entity = new ShippingZoneEntity();
        Instant now = Instant.now();
        entity.setName(req.name().trim());
        entity.setRegionCode(req.regionCode() != null ? req.regionCode().trim() : null);
        entity.setSortOrder(req.sortOrder() != null ? req.sortOrder() : 0);
        entity.setEnabled(req.enabled() != null ? req.enabled() : true);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return toZoneMap(zoneRepo.save(entity));
    }

    @Transactional
    public Map<String, Object> updateZone(UUID id, JsonNode body) {
        ShippingZoneEntity entity = zoneRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Shipping zone not found."));

        List<ApiErrorDetail> errors = new ArrayList<>();

        if (body.has("name")) {
            String name = body.get("name").isNull() ? "" : body.get("name").asText().trim();
            if (name.isBlank()) {
                errors.add(new ApiErrorDetail("name", "NOT_BLANK", "Zone name must not be blank."));
            } else if (name.length() > 255) {
                errors.add(new ApiErrorDetail("name", "SIZE", "Zone name must not exceed 255 characters."));
            } else {
                entity.setName(name);
            }
        }
        if (!errors.isEmpty()) throw new ValidationException("Validation failed.", errors);

        if (body.has("regionCode")) {
            // explicitly present — null or empty string clears the field
            String rc = body.get("regionCode").isNull() ? null : body.get("regionCode").asText().trim();
            entity.setRegionCode(rc != null && rc.isEmpty() ? null : rc);
        }
        if (body.has("sortOrder") && !body.get("sortOrder").isNull()) {
            entity.setSortOrder(body.get("sortOrder").asInt());
        }
        if (body.has("enabled") && !body.get("enabled").isNull()) {
            entity.setEnabled(body.get("enabled").asBoolean());
        }

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
    public Map<String, Object> createMethod(UUID zoneId, CreateShippingMethodRequest req) {
        ShippingZoneEntity zone = zoneRepo.findById(zoneId)
                .orElseThrow(() -> new NotFoundException("Shipping zone not found."));
        Instant now = Instant.now();
        ShippingMethodEntity entity = new ShippingMethodEntity();
        entity.setZone(zone);
        entity.setMethodCode(req.methodCode().trim());
        entity.setTitle(req.title().trim());
        entity.setDescription(req.description() != null ? req.description().trim() : null);
        entity.setCost(req.cost() != null ? req.cost() : BigDecimal.ZERO);
        entity.setMinOrderAmount(req.minOrderAmount() != null ? req.minOrderAmount() : BigDecimal.ZERO);
        entity.setFreeShippingThreshold(req.freeShippingThreshold());
        entity.setSortOrder(req.sortOrder() != null ? req.sortOrder() : 0);
        entity.setEnabled(req.enabled() != null ? req.enabled() : true);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return toMethodMap(methodRepo.save(entity));
    }

    @Transactional
    public Map<String, Object> updateMethod(UUID zoneId, UUID methodId, JsonNode body) {
        ShippingMethodEntity entity = methodRepo.findById(methodId)
                .orElseThrow(() -> new NotFoundException("Shipping method not found."));
        if (!entity.getZone().getId().equals(zoneId)) {
            throw new NotFoundException("Shipping method not found in zone.");
        }

        List<ApiErrorDetail> errors = new ArrayList<>();

        if (body.has("methodCode")) {
            String code = body.get("methodCode").isNull() ? "" : body.get("methodCode").asText().trim();
            if (code.isBlank()) {
                errors.add(new ApiErrorDetail("methodCode", "NOT_BLANK", "Method code must not be blank."));
            } else if (!code.matches("[a-z0-9_-]+")) {
                errors.add(new ApiErrorDetail("methodCode", "PATTERN",
                        "methodCode must contain only lowercase letters, digits, underscores, or hyphens."));
            } else {
                entity.setMethodCode(code);
            }
        }
        if (body.has("title")) {
            String title = body.get("title").isNull() ? "" : body.get("title").asText().trim();
            if (title.isBlank()) {
                errors.add(new ApiErrorDetail("title", "NOT_BLANK", "Title must not be blank."));
            } else {
                entity.setTitle(title);
            }
        }
        if (!errors.isEmpty()) throw new ValidationException("Validation failed.", errors);

        if (body.has("description")) {
            // null or empty clears description
            String desc = body.get("description").isNull() ? null : body.get("description").asText().trim();
            entity.setDescription(desc != null && desc.isEmpty() ? null : desc);
        }
        if (body.has("cost")) {
            if (body.get("cost").isNull()) {
                entity.setCost(BigDecimal.ZERO);
            } else {
                BigDecimal cost = new BigDecimal(body.get("cost").asText());
                if (cost.compareTo(BigDecimal.ZERO) < 0) {
                    throw ValidationException.fromField("cost", "MIN_VALUE", "cost must be >= 0.");
                }
                entity.setCost(cost);
            }
        }
        if (body.has("minOrderAmount")) {
            if (body.get("minOrderAmount").isNull()) {
                entity.setMinOrderAmount(BigDecimal.ZERO);
            } else {
                BigDecimal min = new BigDecimal(body.get("minOrderAmount").asText());
                if (min.compareTo(BigDecimal.ZERO) < 0) {
                    throw ValidationException.fromField("minOrderAmount", "MIN_VALUE", "minOrderAmount must be >= 0.");
                }
                entity.setMinOrderAmount(min);
            }
        }
        if (body.has("freeShippingThreshold")) {
            if (body.get("freeShippingThreshold").isNull()) {
                entity.setFreeShippingThreshold(null);
            } else {
                BigDecimal threshold = new BigDecimal(body.get("freeShippingThreshold").asText());
                if (threshold.compareTo(BigDecimal.ZERO) < 0) {
                    throw ValidationException.fromField("freeShippingThreshold", "MIN_VALUE",
                            "freeShippingThreshold must be >= 0.");
                }
                entity.setFreeShippingThreshold(threshold);
            }
        }
        if (body.has("sortOrder") && !body.get("sortOrder").isNull()) {
            entity.setSortOrder(body.get("sortOrder").asInt());
        }
        if (body.has("enabled") && !body.get("enabled").isNull()) {
            entity.setEnabled(body.get("enabled").asBoolean());
        }

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
