package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.AdminRedirectController.CreateRedirectRequest;
import com.bigbike.bigbike_backend.api.admin.AdminRedirectController.UpdateRedirectRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectSpecification;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminRedirectService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final Set<Integer> ALLOWED_STATUS_CODES = Set.of(301, 302, 307, 308);
    private static final Map<Integer, String> DEFAULT_TYPE_BY_STATUS = Map.of(
            301, "PERMANENT",
            302, "TEMPORARY",
            307, "TEMPORARY",
            308, "PERMANENT"
    );

    private final RedirectJpaRepository redirectRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final PaginationService paginationService;
    private final WebRevalidationService webRevalidationService;

    public AdminRedirectService(
            RedirectJpaRepository redirectRepo,
            AuditLogJpaRepository auditLogRepo,
            PaginationService paginationService,
            WebRevalidationService webRevalidationService
    ) {
        this.redirectRepo = redirectRepo;
        this.auditLogRepo = auditLogRepo;
        this.paginationService = paginationService;
        this.webRevalidationService = webRevalidationService;
    }

    public record AdminRedirectResponse(
            UUID id,
            String sourcePattern,
            String targetUrl,
            String redirectType,
            int statusCode,
            boolean enabled,
            long hitCount,
            Instant lastHitAt,
            String notes,
            Long legacyId,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record CreateRedirectRequest(
            String sourcePattern,
            String targetUrl,
            String redirectType,
            Integer statusCode,
            Boolean enabled,
            String notes,
            Long legacyId
    ) {}

    public record UpdateRedirectRequest(
            String sourcePattern,
            String targetUrl,
            String redirectType,
            Integer statusCode,
            Boolean enabled,
            String notes,
            Long legacyId
    ) {}

    public PageResult<AdminRedirectResponse> listRedirects(
            int page,
            int size,
            String q,
            Boolean enabled,
            Integer statusCode
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = size <= 0 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        Specification<RedirectEntity> spec = RedirectSpecification.withFilters(q, enabled, statusCode);
        List<AdminRedirectResponse> items = redirectRepo.findAll(spec).stream()
                .sorted(Comparator.comparing(RedirectEntity::getUpdatedAt).reversed()
                        .thenComparing(RedirectEntity::getCreatedAt, Comparator.reverseOrder()))
                .map(this::toResponse)
                .toList();

        return paginationService.paginate(items, normalizedPage, normalizedSize);
    }

    public AdminRedirectResponse getRedirect(UUID id) {
        RedirectEntity entity = redirectRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Redirect not found."));
        return toResponse(entity);
    }

    @Transactional
    public AdminRedirectResponse createRedirect(UUID adminId, CreateRedirectRequest request) {
        String sourcePattern = normalizeSourcePattern(request.sourcePattern());
        String targetUrl = normalizeRequiredUrl(request.targetUrl(), "targetUrl");
        validateNoSelfLoop(sourcePattern, targetUrl);
        ensureUniqueSourcePattern(sourcePattern, null);

        int statusCode = normalizeStatusCode(request.statusCode());
        String redirectType = normalizeRedirectType(request.redirectType(), statusCode);
        boolean enabled = request.enabled() == null || request.enabled();

        Instant now = Instant.now();
        RedirectEntity entity = new RedirectEntity();
        entity.setSourcePattern(sourcePattern);
        entity.setTargetUrl(targetUrl);
        entity.setRedirectType(redirectType);
        entity.setStatusCode(statusCode);
        entity.setEnabled(enabled);
        entity.setHitCount(0);
        entity.setLastHitAt(null);
        entity.setNotes(normalizeNotes(request.notes()));
        entity.setLegacyId(request.legacyId());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        entity = redirectRepo.save(entity);

        auditLogRepo.save(buildAudit(adminId, "REDIRECT_CREATED", entity.getId(), null, snapshot(entity)));
        webRevalidationService.revalidate("redirects");

        return toResponse(entity);
    }

    @Transactional
    public AdminRedirectResponse updateRedirect(UUID id, UUID adminId, UpdateRedirectRequest request) {
        RedirectEntity entity = redirectRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Redirect not found."));
        String before = snapshot(entity);

        String nextSourcePattern = entity.getSourcePattern();
        if (request.sourcePattern() != null) {
            nextSourcePattern = normalizeSourcePattern(request.sourcePattern());
        }
        String nextTargetUrl = entity.getTargetUrl();
        if (request.targetUrl() != null) {
            nextTargetUrl = normalizeRequiredUrl(request.targetUrl(), "targetUrl");
        }
        validateNoSelfLoop(nextSourcePattern, nextTargetUrl);
        ensureUniqueSourcePattern(nextSourcePattern, id);

        if (request.sourcePattern() != null) {
            entity.setSourcePattern(nextSourcePattern);
        }
        if (request.targetUrl() != null) {
            entity.setTargetUrl(nextTargetUrl);
        }
        if (request.statusCode() != null) {
            entity.setStatusCode(normalizeStatusCode(request.statusCode()));
            if (request.redirectType() == null || request.redirectType().isBlank()) {
                entity.setRedirectType(defaultRedirectType(entity.getStatusCode()));
            }
        }
        if (request.redirectType() != null && !request.redirectType().isBlank()) {
            entity.setRedirectType(normalizeRedirectType(request.redirectType(), entity.getStatusCode()));
        }
        if (request.enabled() != null) {
            entity.setEnabled(request.enabled());
        }
        if (request.notes() != null) {
            entity.setNotes(normalizeNotes(request.notes()));
        }
        if (request.legacyId() != null) {
            entity.setLegacyId(request.legacyId());
        }
        if (entity.getRedirectType() == null || entity.getRedirectType().isBlank()) {
            entity.setRedirectType(defaultRedirectType(entity.getStatusCode()));
        }
        entity.setUpdatedAt(Instant.now());
        entity = redirectRepo.save(entity);

        auditLogRepo.save(buildAudit(adminId, "REDIRECT_UPDATED", entity.getId(), before, snapshot(entity)));
        webRevalidationService.revalidate("redirects");

        return toResponse(entity);
    }

    @Transactional
    public void deleteRedirect(UUID id, UUID adminId) {
        RedirectEntity entity = redirectRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Redirect not found."));
        String before = snapshot(entity);
        redirectRepo.delete(entity);
        auditLogRepo.save(buildAudit(adminId, "REDIRECT_DELETED", entity.getId(), before, null));
        webRevalidationService.revalidate("redirects");
    }

    private AdminRedirectResponse toResponse(RedirectEntity entity) {
        return new AdminRedirectResponse(
                entity.getId(),
                entity.getSourcePattern(),
                entity.getTargetUrl(),
                entity.getRedirectType(),
                entity.getStatusCode(),
                entity.isEnabled(),
                entity.getHitCount(),
                entity.getLastHitAt(),
                entity.getNotes(),
                entity.getLegacyId(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private String normalizeSourcePattern(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            throw ValidationException.fromField("sourcePattern", "REQUIRED", "Source pattern is required.");
        }
        return trimmed.startsWith("/") ? trimmed : "/" + trimmed;
    }

    private String normalizeRequiredUrl(String value, String field) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            throw ValidationException.fromField(field, "REQUIRED", "Target URL is required.");
        }
        return trimmed;
    }

    private String normalizeNotes(String value) {
        return trimToNull(value);
    }

    private int normalizeStatusCode(Integer statusCode) {
        int value = statusCode == null ? 301 : statusCode;
        if (!ALLOWED_STATUS_CODES.contains(value)) {
            throw ValidationException.fromField(
                    "statusCode",
                    "INVALID",
                    "Status code must be 301, 302, 307 or 308."
            );
        }
        return value;
    }

    private String normalizeRedirectType(String redirectType, int statusCode) {
        String trimmed = trimToNull(redirectType);
        if (trimmed == null) {
            return defaultRedirectType(statusCode);
        }

        String normalized = trimmed.toUpperCase(Locale.ROOT);
        if (!Set.of("PERMANENT", "TEMPORARY", "CUSTOM").contains(normalized)) {
            throw ValidationException.fromField(
                    "redirectType",
                    "INVALID",
                    "Redirect type must be PERMANENT, TEMPORARY or CUSTOM."
            );
        }
        return normalized;
    }

    private String defaultRedirectType(int statusCode) {
        return DEFAULT_TYPE_BY_STATUS.getOrDefault(statusCode, "PERMANENT");
    }

    private void validateNoSelfLoop(String sourcePattern, String targetUrl) {
        if (sourcePattern.equals(targetUrl)) {
            throw ValidationException.fromField(
                    "targetUrl",
                    "SELF_LOOP",
                    "Redirect target must differ from the source pattern."
            );
        }
    }

    private void ensureUniqueSourcePattern(String sourcePattern, UUID currentId) {
        redirectRepo.findBySourcePattern(sourcePattern).ifPresent(existing -> {
            if (currentId == null || !existing.getId().equals(currentId)) {
                throw new ConflictException("Redirect source already exists: " + sourcePattern);
            }
        });
    }

    private String snapshot(RedirectEntity entity) {
        if (entity == null) {
            return null;
        }
        return "{" +
                "\"id\":\"" + escape(entity.getId()) + "\"," +
                "\"sourcePattern\":\"" + escape(entity.getSourcePattern()) + "\"," +
                "\"targetUrl\":\"" + escape(entity.getTargetUrl()) + "\"," +
                "\"redirectType\":\"" + escape(entity.getRedirectType()) + "\"," +
                "\"statusCode\":" + entity.getStatusCode() + "," +
                "\"enabled\":" + entity.isEnabled() + "," +
                "\"hitCount\":" + entity.getHitCount() + "," +
                "\"legacyId\":" + (entity.getLegacyId() == null ? "null" : entity.getLegacyId()) + "," +
                "\"notes\":\"" + escape(entity.getNotes()) + "\"" +
                "}";
    }

    private AuditLogEntity buildAudit(UUID adminId, String action, UUID resourceId, String before, String after) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(adminId);
        log.setAction(action);
        log.setResourceType("REDIRECT");
        log.setResourceId(resourceId);
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setCreatedAt(Instant.now());
        return log;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String escape(Object value) {
        if (value == null) {
            return "";
        }
        return value.toString()
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }
}
