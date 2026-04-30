package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.audit.AdminAuditLogListItemResponse;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
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

    public AdminAuditLogService(AuditLogJpaRepository auditLogRepo) {
        this.auditLogRepo = auditLogRepo;
    }

    public PageResult<AdminAuditLogListItemResponse> listAuditLogs(
            int page, int size,
            String actorType, String actorId,
            String resourceType, String resourceId,
            String action, String from, String to
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        Instant fromInstant = parseFromDate(from);
        Instant toInstant = parseToDate(to);

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
            if (action != null && !action.isBlank()) {
                predicates.add(cb.like(root.get("action"), "%" + action + "%"));
            }
            if (fromInstant != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromInstant));
            }
            if (toInstant != null) {
                predicates.add(cb.lessThan(root.get("createdAt"), toInstant));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        PageRequest pageable = PageRequest.of(
                normalizedPage - 1, normalizedSize,
                Sort.by(Sort.Order.desc("createdAt"))
        );

        Page<AuditLogEntity> pageResult = auditLogRepo.findAll(spec, pageable);
        List<AdminAuditLogListItemResponse> items = pageResult.getContent()
                .stream()
                .map(this::toResponse)
                .toList();

        return new PageResult<>(items, normalizedPage, normalizedSize,
                pageResult.getTotalElements(), pageResult.getTotalPages());
    }

    private AdminAuditLogListItemResponse toResponse(AuditLogEntity e) {
        return new AdminAuditLogListItemResponse(
                e.getId(),
                e.getActorType(),
                e.getActorId(),
                e.getAction(),
                e.getResourceType(),
                e.getResourceId(),
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
