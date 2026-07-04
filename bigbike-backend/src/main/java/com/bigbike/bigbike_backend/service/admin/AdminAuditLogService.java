package com.bigbike.bigbike_backend.service.admin;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.bigbike.bigbike_backend.api.admin.dto.audit.AdminAuditLogListItemResponse;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.mapper.AuditLogMapper;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AdminAuditLogService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final ObjectMapper OBJECT_MAPPER = JsonMapper.builder().findAndAddModules().build();

    // REPORT_RULE_008: all date boundaries parsed in Asia/Ho_Chi_Minh (UTC+7),
    // consistent with AdminDashboardService and AdminReportService.
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /**
     * Per-resource-type candidate field names (checked in order) for pulling a human
     * display name out of the before/after JSON snapshot already recorded by the
     * mutation services. Covers every resource type whose entity id is not a UUID
     * (so no DB join is possible) or whose relevant service does not otherwise
     * enrich the response (ORDER/REVIEW have their own resolution below).
     */
    private static final Map<String, List<String>> RESOURCE_NAME_FIELDS = Map.ofEntries(
            Map.entry("PRODUCT", List.of("name")),
            Map.entry("CATEGORY", List.of("name")),
            Map.entry("BRAND", List.of("name")),
            Map.entry("CONTENT", List.of("title")),
            Map.entry("MENU", List.of("name")),
            Map.entry("MENU_ITEM", List.of("label")),
            Map.entry("REDIRECT", List.of("sourcePattern")),
            Map.entry("SITE_SETTING", List.of("key")),
            Map.entry("ADMIN_USER", List.of("displayName", "email")),
            Map.entry("ADMIN_ROLE", List.of("roleId")),
            Map.entry("ADMIN_AUTH", List.of("email")),
            Map.entry("SLIDER", List.of("location")),
            Map.entry("HOME_VIDEO", List.of("title")),
            Map.entry("MEDIA", List.of("title")),
            Map.entry("REPORT", List.of("exportType")),
            Map.entry("CUSTOMER", List.of("displayName", "email")),
            Map.entry("MEDIA_FOLDER", List.of("name")),
            Map.entry("ATTRIBUTE", List.of("name"))
    );

    private final AuditLogJpaRepository auditLogRepo;
    private final AdminUserJpaRepository adminUserRepo;
    private final OrderJpaRepository orderRepo;
    private final AuditLogMapper auditLogMapper;

    public PageResult<AdminAuditLogListItemResponse> listAuditLogs(
            int page, int size,
            String actorType, String actorId,
            String resourceType, String resourceId,
            String action, String q,
            String from, String to
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        // Malformed filters fail loudly (400) instead of being silently dropped —
        // a request like ?actorId=not-a-uuid must not quietly return the unfiltered list.
        UUID actorUuid = parseUuidOrThrow(actorId, "actorId");
        UUID resourceUuid = parseUuidOrThrow(resourceId, "resourceId");
        Instant fromInstant = parseFromDate(from);
        Instant toInstant = parseToDate(to);

        // q is the primary search term (general, case-insensitive); action param is
        // kept for backward compatibility — q takes precedence.
        final String searchTerm = (q != null && !q.isBlank()) ? q : action;

        Specification<AuditLogEntity> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (actorType != null && !actorType.isBlank()) {
                predicates.add(cb.equal(root.get("actorType"), actorType));
            }
            if (actorUuid != null) {
                predicates.add(cb.equal(root.get("actorId"), actorUuid));
            }
            if (resourceType != null && !resourceType.isBlank()) {
                predicates.add(cb.equal(root.get("resourceType"), resourceType));
            }
            if (resourceUuid != null) {
                predicates.add(cb.equal(root.get("resourceId"), resourceUuid));
            }
            if (searchTerm != null && !searchTerm.isBlank()) {
                predicates.add(buildSearchPredicate(root, query, cb, searchTerm));
            }
            if (fromInstant != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromInstant));
            }
            if (toInstant != null) {
                predicates.add(cb.lessThan(root.get("createdAt"), toInstant));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };

        // Secondary sort key: rows written in the same batch (e.g. bulk save) can share
        // the exact same createdAt instant — id as tiebreaker keeps pagination stable.
        PageRequest pageable = PageRequest.of(
                normalizedPage - 1, normalizedSize,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))
        );

        Page<AuditLogEntity> pageResult = auditLogRepo.findAll(spec, pageable);
        List<AdminAuditLogListItemResponse> items = enrichItems(pageResult.getContent());

        return new PageResult<>(items, normalizedPage, normalizedSize,
                pageResult.getTotalElements(), pageResult.getTotalPages());
    }

    /**
     * Search matches: action code, the recorded before/after JSON (covers product/
     * category/brand/content names, SKUs, slugs — anything already embedded by the
     * mutation service), the acting admin's display name/email, the order number for
     * ORDER-resource rows, and the customer's display name/email for CUSTOMER-resource
     * rows. This is what `auditLog.searchPlaceholder` (vi.json) actually promises:
     * "Tìm mã đơn, sản phẩm, khách hàng, người thao tác".
     */
    private Predicate buildSearchPredicate(
            Root<AuditLogEntity> root, CriteriaQuery<?> query, CriteriaBuilder cb, String searchTerm
    ) {
        String pattern = "%" + searchTerm.toUpperCase() + "%";
        List<Predicate> alternatives = new ArrayList<>();
        alternatives.add(cb.like(cb.upper(root.get("action")), pattern));
        alternatives.add(cb.like(cb.upper(cb.coalesce(root.get("beforeData"), "")), pattern));
        alternatives.add(cb.like(cb.upper(cb.coalesce(root.get("afterData"), "")), pattern));

        Subquery<UUID> actorSub = query.subquery(UUID.class);
        Root<AdminUserEntity> actorRoot = actorSub.from(AdminUserEntity.class);
        actorSub.select(actorRoot.get("id"))
                .where(cb.or(
                        cb.like(cb.upper(actorRoot.get("displayName")), pattern),
                        cb.like(cb.upper(actorRoot.get("email")), pattern)
                ));
        Path<UUID> actorIdPath = root.get("actorId");
        alternatives.add(actorIdPath.in(actorSub));

        Subquery<UUID> orderSub = query.subquery(UUID.class);
        Root<OrderEntity> orderRoot = orderSub.from(OrderEntity.class);
        orderSub.select(orderRoot.get("id"))
                .where(cb.like(cb.upper(orderRoot.get("orderNumber")), pattern));
        Path<UUID> resourceIdPath = root.get("resourceId");
        alternatives.add(resourceIdPath.in(orderSub));

        Subquery<UUID> customerSub = query.subquery(UUID.class);
        Root<CustomerEntity> customerRoot = customerSub.from(CustomerEntity.class);
        customerSub.select(customerRoot.get("id"))
                .where(cb.or(
                        cb.like(cb.upper(customerRoot.get("displayName")), pattern),
                        cb.like(cb.upper(customerRoot.get("email")), pattern)
                ));
        alternatives.add(resourceIdPath.in(customerSub));

        return cb.or(alternatives.toArray(Predicate[]::new));
    }

    private UUID parseUuidOrThrow(String value, String fieldName) {
        if (value == null || value.isBlank()) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            throw ValidationException.fromField(fieldName, "INVALID_UUID_FORMAT",
                    fieldName + " must be a valid UUID: " + value);
        }
    }

    private List<AdminAuditLogListItemResponse> enrichItems(List<AuditLogEntity> entities) {
        // Batch-lookup admin users for ADMIN actors — avoids N+1
        Set<UUID> adminActorIds = entities.stream()
                .filter(e -> "ADMIN".equals(e.getActorType()) && e.getActorId() != null)
                .map(AuditLogEntity::getActorId)
                .collect(Collectors.toSet());

        Map<UUID, AdminUserEntity> adminUserMap = adminActorIds.isEmpty()
                ? Collections.emptyMap()
                : adminUserRepo.findAllById(adminActorIds).stream()
                        .collect(Collectors.toMap(AdminUserEntity::getId, u -> u));

        // Batch-lookup orders for ORDER resources
        Set<UUID> orderResourceIds = entities.stream()
                .filter(e -> "ORDER".equals(e.getResourceType()) && e.getResourceId() != null)
                .map(AuditLogEntity::getResourceId)
                .collect(Collectors.toSet());

        Map<UUID, String> orderNumberMap = orderResourceIds.isEmpty()
                ? Collections.emptyMap()
                : orderRepo.findAllById(orderResourceIds).stream()
                        .collect(Collectors.toMap(OrderEntity::getId, OrderEntity::getOrderNumber));

        return entities.stream()
                .map(e -> toEnrichedResponse(e, adminUserMap, orderNumberMap))
                .toList();
    }

    private AdminAuditLogListItemResponse toEnrichedResponse(
            AuditLogEntity e,
            Map<UUID, AdminUserEntity> adminUserMap,
            Map<UUID, String> orderNumberMap
    ) {
        String actorDisplayName = null;
        String actorEmail = null;
        if ("ADMIN".equals(e.getActorType()) && e.getActorId() != null) {
            AdminUserEntity adminUser = adminUserMap.get(e.getActorId());
            if (adminUser != null) {
                actorDisplayName = adminUser.getDisplayName();
                actorEmail = adminUser.getEmail();
            }
        }

        String resourceCode = null;
        String resourceDisplayName = null;
        if ("ORDER".equals(e.getResourceType()) && e.getResourceId() != null) {
            String orderNumber = orderNumberMap.get(e.getResourceId());
            if (orderNumber != null) {
                resourceCode = orderNumber;
            }
        } else if ("REVIEW".equals(e.getResourceType())) {
            ReviewAuditResource reviewResource = resolveReviewAuditResource(e);
            if (reviewResource != null) {
                resourceCode = reviewResource.resourceCode();
                resourceDisplayName = reviewResource.resourceDisplayName();
            }
        } else {
            // Every other resource type either has a String (non-UUID) entity id — so no
            // DB join is possible — or is simply not enriched yet. Pull the display name
            // straight out of the before/after snapshot the mutation service already wrote.
            resourceDisplayName = extractDisplayName(e);
        }

        return auditLogMapper.toListItemResponse(
                e,
                actorDisplayName,
                actorEmail,
                resourceDisplayName,
                resourceCode
        );
    }

    private ReviewAuditResource resolveReviewAuditResource(AuditLogEntity entity) {
        Map<String, Object> payload = parseAuditPayload(entity.getAfterData());
        if (payload.isEmpty()) {
            payload = parseAuditPayload(entity.getBeforeData());
        }
        if (payload.isEmpty()) {
            return null;
        }

        Object reviewId = payload.get("id");
        Object productName = payload.get("productName");
        String resourceCode = reviewId != null ? "Review #" + reviewId : null;
        String resourceDisplayName = productName instanceof String name && !name.isBlank() ? name : null;
        if (resourceCode == null && resourceDisplayName == null) {
            return null;
        }
        return new ReviewAuditResource(resourceCode, resourceDisplayName);
    }

    /** Generalized version of {@link #resolveReviewAuditResource} for every other resource type. */
    private String extractDisplayName(AuditLogEntity e) {
        List<String> candidateFields = RESOURCE_NAME_FIELDS.get(e.getResourceType());
        if (candidateFields == null) {
            return null;
        }
        Map<String, Object> payload = parseAuditPayload(e.getAfterData());
        if (payload.isEmpty()) {
            payload = parseAuditPayload(e.getBeforeData());
        }
        for (String field : candidateFields) {
            Object value = payload.get(field);
            if (value instanceof String s && !s.isBlank()) {
                return s;
            }
        }
        return null;
    }

    private Map<String, Object> parseAuditPayload(String rawPayload) {
        if (rawPayload == null || rawPayload.isBlank()) {
            return Map.of();
        }
        try {
            return OBJECT_MAPPER.readValue(rawPayload, new TypeReference<LinkedHashMap<String, Object>>() {});
        } catch (Exception ignored) {
            return Map.of();
        }
    }

    private Instant parseFromDate(String from) {
        if (from == null || from.isBlank()) return null;
        try {
            // REPORT_RULE_008: parse in VN timezone so "2026-05-08" → 2026-05-07T17:00:00Z
            return LocalDate.parse(from).atStartOfDay(VN_ZONE).toInstant();
        } catch (Exception e) {
            try {
                return Instant.parse(from);
            } catch (Exception ignored) {
                throw ValidationException.fromField("from", "INVALID_DATE_FORMAT",
                        "from must be in YYYY-MM-DD format: " + from);
            }
        }
    }

    private Instant parseToDate(String to) {
        if (to == null || to.isBlank()) return null;
        try {
            // REPORT_RULE_008: exclusive end boundary — next day start in VN timezone
            return LocalDate.parse(to).plusDays(1).atStartOfDay(VN_ZONE).toInstant();
        } catch (Exception e) {
            try {
                return Instant.parse(to);
            } catch (Exception ignored) {
                throw ValidationException.fromField("to", "INVALID_DATE_FORMAT",
                        "to must be in YYYY-MM-DD format: " + to);
            }
        }
    }

    private record ReviewAuditResource(String resourceCode, String resourceDisplayName) {}
}
