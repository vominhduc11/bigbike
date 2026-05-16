package com.bigbike.bigbike_backend.service.admin;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.bigbike.bigbike_backend.api.admin.dto.audit.AdminAuditLogListItemResponse;
import com.bigbike.bigbike_backend.mapper.AuditLogMapper;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.persistence.criteria.Predicate;
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

        Instant fromInstant = parseFromDate(from);
        Instant toInstant = parseToDate(to);

        // q is the primary search term (general, case-insensitive LIKE on action);
        // action param is kept for backward compatibility — q takes precedence.
        final String searchTerm = (q != null && !q.isBlank()) ? q : action;

        Specification<AuditLogEntity> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (actorType != null && !actorType.isBlank()) {
                predicates.add(cb.equal(root.get("actorType"), actorType));
            }
            if (actorId != null && !actorId.isBlank()) {
                try {
                    predicates.add(cb.equal(root.get("actorId"), UUID.fromString(actorId)));
                } catch (IllegalArgumentException ignored) { /* skip malformed UUID */ }
            }
            if (resourceType != null && !resourceType.isBlank()) {
                predicates.add(cb.equal(root.get("resourceType"), resourceType));
            }
            if (resourceId != null && !resourceId.isBlank()) {
                try {
                    predicates.add(cb.equal(root.get("resourceId"), UUID.fromString(resourceId)));
                } catch (IllegalArgumentException ignored) { /* skip malformed UUID */ }
            }
            if (searchTerm != null && !searchTerm.isBlank()) {
                predicates.add(cb.like(cb.upper(root.get("action")), "%" + searchTerm.toUpperCase() + "%"));
            }
            if (fromInstant != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromInstant));
            }
            if (toInstant != null) {
                predicates.add(cb.lessThan(root.get("createdAt"), toInstant));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };

        PageRequest pageable = PageRequest.of(
                normalizedPage - 1, normalizedSize,
                Sort.by(Sort.Order.desc("createdAt"))
        );

        Page<AuditLogEntity> pageResult = auditLogRepo.findAll(spec, pageable);
        List<AdminAuditLogListItemResponse> items = enrichItems(pageResult.getContent());

        return new PageResult<>(items, normalizedPage, normalizedSize,
                pageResult.getTotalElements(), pageResult.getTotalPages());
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
        }
        if ("REVIEW".equals(e.getResourceType())) {
            ReviewAuditResource reviewResource = resolveReviewAuditResource(e);
            if (reviewResource != null) {
                resourceCode = reviewResource.resourceCode();
                resourceDisplayName = reviewResource.resourceDisplayName();
            }
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
            try { return Instant.parse(from); } catch (Exception ignored) { return null; }
        }
    }

    private Instant parseToDate(String to) {
        if (to == null || to.isBlank()) return null;
        try {
            // REPORT_RULE_008: exclusive end boundary — next day start in VN timezone
            return LocalDate.parse(to).plusDays(1).atStartOfDay(VN_ZONE).toInstant();
        } catch (Exception e) {
            try { return Instant.parse(to); } catch (Exception ignored) { return null; }
        }
    }

    private record ReviewAuditResource(String resourceCode, String resourceDisplayName) {}
}
