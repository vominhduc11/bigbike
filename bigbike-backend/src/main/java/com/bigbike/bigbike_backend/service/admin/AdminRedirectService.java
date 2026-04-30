package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.redirect.AdminRedirectDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.redirect.AdminRedirectListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.redirect.CreateRedirectRequest;
import com.bigbike.bigbike_backend.api.admin.dto.redirect.UpdateRedirectEnabledRequest;
import com.bigbike.bigbike_backend.api.admin.dto.redirect.UpdateRedirectRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectSpecification;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminRedirectService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final Set<Integer> ALLOWED_STATUS_CODES = Set.of(301, 302, 307, 308);

    private static final String CACHE_TAG = "redirects";

    private final RedirectJpaRepository redirectRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final WebRevalidationService webRevalidationService;

    public AdminRedirectService(
            RedirectJpaRepository redirectRepo,
            AuditLogJpaRepository auditLogRepo,
            WebRevalidationService webRevalidationService
    ) {
        this.redirectRepo = redirectRepo;
        this.auditLogRepo = auditLogRepo;
        this.webRevalidationService = webRevalidationService;
    }

    // ── List ──────────────────────────────────────────────────────────────────

    public PageResult<AdminRedirectListItemResponse> listRedirects(
            int page, int size, String q, Boolean enabled, Integer statusCode
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        PageRequest pageable = PageRequest.of(
                normalizedPage - 1, normalizedSize,
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<RedirectEntity> dbPage = redirectRepo.findAll(
                RedirectSpecification.withFilters(q, enabled, statusCode), pageable);

        List<AdminRedirectListItemResponse> items = dbPage.getContent().stream()
                .map(this::toListItem)
                .toList();

        return new PageResult<>(items, normalizedPage, normalizedSize, dbPage.getTotalElements(), dbPage.getTotalPages());
    }

    // ── Detail ────────────────────────────────────────────────────────────────

    public AdminRedirectDetailResponse getRedirectDetail(UUID redirectId) {
        RedirectEntity redirect = redirectRepo.findById(redirectId)
                .orElseThrow(() -> new NotFoundException("Redirect not found."));
        return toDetail(redirect);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    @Transactional
    public AdminRedirectDetailResponse createRedirect(UUID adminId, CreateRedirectRequest req) {
        String source = req.sourcePattern().trim();
        String target = req.targetUrl().trim();
        int code = req.statusCode() != null ? req.statusCode() : 301;
        boolean isEnabled = req.enabled() == null || req.enabled();
        String type = (req.redirectType() != null && !req.redirectType().isBlank())
                ? req.redirectType().toUpperCase(Locale.ROOT) : "EXACT";

        validateStatusCode(code);
        validateNoSelfLoop(source, target);

        if (isEnabled) {
            checkNoDuplicateEnabledSource(source, null);
        }

        Instant now = Instant.now();
        RedirectEntity entity = new RedirectEntity();
        entity.setSourcePattern(source);
        entity.setTargetUrl(target);
        entity.setRedirectType(type);
        entity.setStatusCode(code);
        entity.setEnabled(isEnabled);
        entity.setNotes(req.notes());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        entity = redirectRepo.save(entity);

        auditLogRepo.save(buildAudit(adminId, "REDIRECT_CREATED", entity.getId(), null,
                "{\"source\":\"" + escapeJson(source) + "\",\"target\":\"" + escapeJson(target) +
                "\",\"statusCode\":" + code + ",\"enabled\":" + isEnabled + "}"));

        webRevalidationService.revalidate(CACHE_TAG);
        return toDetail(entity);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    @Transactional
    public AdminRedirectDetailResponse updateRedirect(UUID redirectId, UUID adminId, UpdateRedirectRequest req) {
        RedirectEntity entity = redirectRepo.findById(redirectId)
                .orElseThrow(() -> new NotFoundException("Redirect not found."));

        String before = snapshot(entity);

        String source = req.sourcePattern() != null ? req.sourcePattern().trim() : entity.getSourcePattern();
        String target = req.targetUrl() != null ? req.targetUrl().trim() : entity.getTargetUrl();
        int code = req.statusCode() != null ? req.statusCode() : entity.getStatusCode();
        boolean isEnabled = req.enabled() != null ? req.enabled() : entity.isEnabled();
        String type = (req.redirectType() != null && !req.redirectType().isBlank())
                ? req.redirectType().toUpperCase(Locale.ROOT) : entity.getRedirectType();

        validateStatusCode(code);
        validateNoSelfLoop(source, target);

        // Check for duplicate enabled source if source changed or enabled state changed to true
        boolean sourceChanged = !source.equals(entity.getSourcePattern());
        boolean nowEnabled = isEnabled && !entity.isEnabled();
        if (isEnabled && (sourceChanged || nowEnabled)) {
            checkNoDuplicateEnabledSource(source, redirectId);
        }

        entity.setSourcePattern(source);
        entity.setTargetUrl(target);
        entity.setRedirectType(type);
        entity.setStatusCode(code);
        entity.setEnabled(isEnabled);
        if (req.notes() != null) entity.setNotes(req.notes());
        entity.setUpdatedAt(Instant.now());
        redirectRepo.save(entity);

        auditLogRepo.save(buildAudit(adminId, "REDIRECT_UPDATED", redirectId, before, snapshot(entity)));

        webRevalidationService.revalidate(CACHE_TAG);
        return toDetail(entity);
    }

    // ── Toggle enabled ────────────────────────────────────────────────────────

    @Transactional
    public AdminRedirectDetailResponse updateEnabled(UUID redirectId, UUID adminId, UpdateRedirectEnabledRequest req) {
        RedirectEntity entity = redirectRepo.findById(redirectId)
                .orElseThrow(() -> new NotFoundException("Redirect not found."));

        boolean before = entity.isEnabled();
        boolean newEnabled = req.enabled();

        // Enabling — check for duplicate active source
        if (newEnabled && !before) {
            checkNoDuplicateEnabledSource(entity.getSourcePattern(), redirectId);
        }

        entity.setEnabled(newEnabled);
        entity.setUpdatedAt(Instant.now());
        redirectRepo.save(entity);

        auditLogRepo.save(buildAudit(adminId, "REDIRECT_ENABLED_UPDATED", redirectId,
                "{\"enabled\":" + before + "}",
                "{\"enabled\":" + newEnabled + "}"));

        webRevalidationService.revalidate(CACHE_TAG);
        return toDetail(entity);
    }

    // ── Delete (logical) ─────────────────────────────────────────────────────

    @Transactional
    public void deleteRedirect(UUID redirectId, UUID adminId) {
        RedirectEntity entity = redirectRepo.findById(redirectId)
                .orElseThrow(() -> new NotFoundException("Redirect not found."));

        String before = snapshot(entity);
        entity.setEnabled(false);
        entity.setUpdatedAt(Instant.now());
        redirectRepo.save(entity);

        auditLogRepo.save(buildAudit(adminId, "REDIRECT_DELETED", redirectId, before,
                "{\"enabled\":false,\"deleted\":true}"));

        webRevalidationService.revalidate(CACHE_TAG);
    }

    // ── Validation ────────────────────────────────────────────────────────────

    private void validateStatusCode(int code) {
        if (!ALLOWED_STATUS_CODES.contains(code)) {
            throw ValidationException.fromField("statusCode", "INVALID",
                    "statusCode must be one of 301, 302, 307, 308.");
        }
    }

    private void validateNoSelfLoop(String source, String target) {
        if (source.equals(target)) {
            throw ValidationException.fromField("sourcePattern", "SELF_LOOP",
                    "sourcePattern and targetUrl must not be equal (redirect loop).");
        }
    }

    private void checkNoDuplicateEnabledSource(String source, UUID excludeId) {
        redirectRepo.findBySourcePattern(source).ifPresent(existing -> {
            if (existing.isEnabled() && !existing.getId().equals(excludeId)) {
                throw new ConflictException(
                        "An enabled redirect for sourcePattern '" + source + "' already exists.");
            }
        });
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private AdminRedirectListItemResponse toListItem(RedirectEntity r) {
        return new AdminRedirectListItemResponse(
                r.getId(), r.getSourcePattern(), r.getTargetUrl(), r.getRedirectType(),
                r.getStatusCode(), r.isEnabled(), r.getHitCount(), r.getLastHitAt(), r.getCreatedAt()
        );
    }

    private AdminRedirectDetailResponse toDetail(RedirectEntity r) {
        return new AdminRedirectDetailResponse(
                r.getId(), r.getLegacyId(), r.getSourcePattern(), r.getTargetUrl(),
                r.getRedirectType(), r.getStatusCode(), r.isEnabled(),
                r.getHitCount(), r.getLastHitAt(), r.getNotes(), r.getCreatedAt(), r.getUpdatedAt()
        );
    }

    // ── Build helpers ─────────────────────────────────────────────────────────

    private AuditLogEntity buildAudit(UUID adminId, String action, UUID resourceId,
            String before, String after) {
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

    private static String snapshot(RedirectEntity r) {
        return "{\"source\":\"" + escapeJson(r.getSourcePattern()) +
               "\",\"target\":\"" + escapeJson(r.getTargetUrl()) +
               "\",\"statusCode\":" + r.getStatusCode() +
               ",\"enabled\":" + r.isEnabled() + "}";
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
