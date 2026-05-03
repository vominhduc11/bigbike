package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.audit.AdminAuditLogListItemResponse;
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
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

@Service
public class AdminAuditLogService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final AuditLogJpaRepository auditLogRepo;
    private final AdminUserJpaRepository adminUserRepo;
    private final OrderJpaRepository orderRepo;

    public AdminAuditLogService(
            AuditLogJpaRepository auditLogRepo,
            AdminUserJpaRepository adminUserRepo,
            OrderJpaRepository orderRepo
    ) {
        this.auditLogRepo = auditLogRepo;
        this.adminUserRepo = adminUserRepo;
        this.orderRepo = orderRepo;
    }

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

        return new AdminAuditLogListItemResponse(
                e.getId(),
                e.getActorType(),
                e.getActorId(),
                actorDisplayName,
                actorEmail,
                e.getAction(),
                e.getResourceType(),
                e.getResourceId(),
                resourceDisplayName,
                resourceCode,
                e.getBeforeData(),
                e.getAfterData(),
                e.getIpAddress(),
                e.getCreatedAt()
        );
    }

    private Instant parseFromDate(String from) {
        if (from == null || from.isBlank()) return null;
        try {
            return LocalDate.parse(from).atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (Exception e) {
            try { return Instant.parse(from); } catch (Exception ignored) { return null; }
        }
    }

    private Instant parseToDate(String to) {
        if (to == null || to.isBlank()) return null;
        try {
            return LocalDate.parse(to).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (Exception e) {
            try { return Instant.parse(to); } catch (Exception ignored) { return null; }
        }
    }
}
