package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.redirect.AdminRedirectResponse;
import com.bigbike.bigbike_backend.api.admin.dto.redirect.CreateRedirectRequest;
import com.bigbike.bigbike_backend.api.admin.dto.redirect.UpdateRedirectRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.mapper.RedirectMapper;
import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectSpecification;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.net.URI;
import java.time.Instant;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminRedirectService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final RedirectJpaRepository redirectRepo;
    private final RedirectMapper redirectMapper;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;
    private final WebRevalidationService webRevalidationService;
    private final ObjectMapper objectMapper;

    @Value("${bigbike.site.base-url:https://bigbike.vn}")
    private String siteBaseUrl;

    public PageResult<AdminRedirectResponse> listRedirects(
            int page,
            int size,
            String q,
            Boolean enabled
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = size <= 0 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        Specification<RedirectEntity> spec = RedirectSpecification.withFilters(q, enabled);
        Sort stableSort = Sort.by(
                Sort.Order.desc("updatedAt"),
                Sort.Order.desc("createdAt"),
                Sort.Order.desc("id"));
        Page<RedirectEntity> dbPage = redirectRepo.findAll(
                spec,
                PageRequest.of(normalizedPage - 1, normalizedSize, stableSort));
        return new PageResult<>(
                dbPage.getContent().stream().map(redirectMapper::toResponse).toList(),
                normalizedPage,
                normalizedSize,
                dbPage.getTotalElements(),
                dbPage.getTotalPages());
    }

    public AdminRedirectResponse getRedirect(UUID id) {
        RedirectEntity entity = redirectRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Redirect not found."));
        return redirectMapper.toResponse(entity);
    }

    @Transactional
    public AdminRedirectResponse createRedirect(UUID adminId, CreateRedirectRequest request) {
        rejectLegacyStatusConfiguration(request.statusCode(), request.redirectType());
        String sourcePattern = normalizeSourcePattern(request.sourcePattern());
        String targetUrl = normalizeRequiredUrl(request.targetUrl(), "targetUrl");
        validateTargetUrl(targetUrl);
        validateNoRedirectLoop(sourcePattern, targetUrl, null);
        ensureUniqueSourcePattern(sourcePattern, null);

        boolean enabled = request.enabled() == null || request.enabled();

        Instant now = Instant.now();
        RedirectEntity entity = new RedirectEntity();
        entity.setSourcePattern(sourcePattern);
        entity.setTargetUrl(targetUrl);
        entity.setEnabled(enabled);
        entity.setHitCount(0);
        entity.setLastHitAt(null);
        entity.setNotes(normalizeNotes(request.notes()));
        entity.setLegacyId(request.legacyId());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        try {
            entity = redirectRepo.saveAndFlush(entity);
        } catch (DataIntegrityViolationException e) {
            // uq_redirects_source_pattern is the DB-level safety net for concurrent inserts
            // that race past the ensureUniqueSourcePattern application-level check above —
            // translate it into the same conflict shape the happy-path check produces.
            throw new ConflictException("Redirect source already exists: " + sourcePattern);
        }

        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "REDIRECT_CREATED", "REDIRECT", entity.getId(), null, snapshot(entity)));
        webRevalidationService.revalidateRedirects();

        return redirectMapper.toResponse(entity);
    }

    @Transactional
    public AdminRedirectResponse updateRedirect(UUID id, UUID adminId, UpdateRedirectRequest request) {
        rejectLegacyStatusConfiguration(request.statusCode(), request.redirectType());
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
            validateTargetUrl(nextTargetUrl);
        }
        validateNoRedirectLoop(nextSourcePattern, nextTargetUrl, id);
        ensureUniqueSourcePattern(nextSourcePattern, id);

        if (request.sourcePattern() != null) {
            entity.setSourcePattern(nextSourcePattern);
        }
        if (request.targetUrl() != null) {
            entity.setTargetUrl(nextTargetUrl);
        }
        if (request.enabled() != null) {
            entity.setEnabled(request.enabled());
        }
        // Presence-guarded like every other field above — a partial PATCH (eg. toggle-enabled
        // sending only {enabled}) must not silently null out notes/legacyId. To clear notes,
        // send an explicit empty string; legacyId, once set, can only be overwritten with a new
        // id via this endpoint (a bare JSON null is indistinguishable from "field omitted").
        if (request.notes() != null) {
            entity.setNotes(normalizeNotes(request.notes()));
        }
        if (request.legacyId() != null) {
            entity.setLegacyId(request.legacyId());
        }
        entity.setUpdatedAt(Instant.now());
        try {
            entity = redirectRepo.saveAndFlush(entity);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("Redirect source already exists: " + nextSourcePattern);
        }

        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "REDIRECT_UPDATED", "REDIRECT", entity.getId(), before, snapshot(entity)));
        webRevalidationService.revalidateRedirects();

        return redirectMapper.toResponse(entity);
    }

    @Transactional
    public void deleteRedirect(UUID id, UUID adminId) {
        RedirectEntity entity = redirectRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Redirect not found."));
        String before = snapshot(entity);
        redirectRepo.delete(entity);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "REDIRECT_DELETED", "REDIRECT", entity.getId(), before, null));
        webRevalidationService.revalidateRedirects();
    }

    private String normalizeSourcePattern(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            throw ValidationException.fromField("sourcePattern", "REQUIRED", "Source pattern is required.");
        }
        if (trimmed.startsWith("//")
                || trimmed.contains("?")
                || trimmed.contains("#")
                || trimmed.matches("(?i)^[a-z][a-z0-9+.-]*:.*")) {
            throw ValidationException.fromField(
                    "sourcePattern",
                    "INVALID_SOURCE",
                    "Source must be an internal path without a domain, query, or fragment.");
        }
        String withLeadingSlash = trimmed.startsWith("/") ? trimmed : "/" + trimmed;
        try {
            URI uri = URI.create(withLeadingSlash);
            if (uri.isAbsolute() || uri.getRawAuthority() != null
                    || uri.getRawQuery() != null || uri.getRawFragment() != null
                    || uri.getRawPath() == null || uri.getRawPath().isBlank()) {
                throw new IllegalArgumentException("Not an exact internal path");
            }
            return canonicalizePath(uri.getRawPath());
        } catch (IllegalArgumentException e) {
            throw ValidationException.fromField(
                    "sourcePattern",
                    "INVALID_SOURCE",
                    "Source must be a valid internal path, for example '/old-page'.");
        }
    }

    private String normalizeRequiredUrl(String value, String field) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            throw ValidationException.fromField(field, "REQUIRED", "Target URL is required.");
        }
        if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
            try {
                URI uri = URI.create(trimmed);
                if (uri.isAbsolute() || uri.getRawAuthority() != null
                        || uri.getRawPath() == null || uri.getRawPath().isBlank()) {
                    throw new IllegalArgumentException("Not an internal URL");
                }
                // Preserve the target pathname exactly (including a meaningful trailing slash).
                // Canonicalization belongs only to source uniqueness and loop comparison.
                StringBuilder normalized = new StringBuilder(uri.getRawPath());
                if (uri.getRawQuery() != null) normalized.append('?').append(uri.getRawQuery());
                if (uri.getRawFragment() != null) normalized.append('#').append(uri.getRawFragment());
                return normalized.toString();
            } catch (IllegalArgumentException e) {
                throw ValidationException.fromField(field, "INVALID_TARGET", "Target URL is not valid.");
            }
        }
        return trimmed;
    }

    private String normalizeNotes(String value) {
        return trimToNull(value);
    }

    private void validateTargetUrl(String targetUrl) {
        if (targetUrl == null || targetUrl.isBlank()) return;

        // Relative internal paths are always allowed
        if (targetUrl.startsWith("/") && !targetUrl.startsWith("//")) return;

        // Protocol-relative URLs (//evil.com) are an open-redirect vector
        if (targetUrl.startsWith("//")) {
            throw ValidationException.fromField("targetUrl", "UNSAFE_TARGET",
                    "Protocol-relative URLs are not allowed as redirect targets. Use a path starting with '/'.");
        }

        URI uri;
        try {
            uri = URI.create(targetUrl);
        } catch (IllegalArgumentException e) {
            throw ValidationException.fromField("targetUrl", "INVALID_TARGET", "Target URL is not valid.");
        }

        String scheme = uri.getScheme();
        if (scheme == null || (!scheme.equalsIgnoreCase("https") && !scheme.equalsIgnoreCase("http"))) {
            throw ValidationException.fromField("targetUrl", "UNSAFE_TARGET",
                    "Target URL protocol is not allowed. Use a relative path starting with '/'.");
        }

        // Allow absolute URLs only when the host matches the configured site base URL
        String targetHost = uri.getHost();
        if (targetHost != null && !targetHost.isBlank()) {
            try {
                URI base = URI.create(siteBaseUrl);
                if (targetHost.equalsIgnoreCase(base.getHost())) return;
            } catch (IllegalArgumentException ignored) {
                // misconfigured siteBaseUrl — fail safe by blocking external
            }
        }

        throw ValidationException.fromField("targetUrl", "EXTERNAL_TARGET",
                "External redirect targets are not allowed. Use a relative path starting with '/'.");
    }

    /**
     * Validates that creating/updating a redirect from {@code sourcePattern} to {@code targetUrl}
     * does not create a redirect loop (direct self-loop or multi-hop A→B→A chains).
     *
     * @param sourcePattern the source path of the redirect being created/updated
     * @param targetUrl     the target URL of the redirect being created/updated
     * @param excludeId     for updates: the ID of the redirect being updated (excluded from chain
     *                      walk so the current rule doesn't falsely detect a loop with itself);
     *                      pass {@code null} for new redirects
     */
    private void validateNoRedirectLoop(String sourcePattern, String targetUrl, UUID excludeId) {
        String normalizedSource = canonicalizePath(sourcePattern);
        String normalizedTarget = redirectLookupPath(targetUrl);

        if (normalizedTarget == null) return;

        // Direct self-loop
        if (normalizedSource.equals(normalizedTarget)) {
            throw ValidationException.fromField(
                    "targetUrl",
                    "SELF_LOOP",
                    "Redirect target must differ from the source pattern."
            );
        }

        // Multi-hop loop detection: walk the chain from normalizedTarget forward.
        // If we ever reach normalizedSource, adding this redirect would create a loop.
        // Stop early if: target is external (no chain to follow), or max depth reached.
        Set<String> visited = new HashSet<>();
        visited.add(normalizedSource);

        String current = normalizedTarget;
        int maxDepth = 20; // guard against pathological data in DB

        while (maxDepth-- > 0) {
            if (visited.contains(current)) {
                throw ValidationException.fromField(
                        "targetUrl",
                        "REDIRECT_LOOP",
                        "Redirect would create a loop: " + sourcePattern + " → … → " + current
                );
            }
            visited.add(current);

            // Look up the next hop in the chain (skip the redirect being updated)
            Optional<RedirectEntity> next = excludeId != null
                    ? redirectRepo.findBySourcePatternAndIdNot(current, excludeId)
                    : redirectRepo.findBySourcePattern(current);

            if (next.isEmpty()) break; // chain ends here — no loop
            current = redirectLookupPath(next.get().getTargetUrl());
            if (current == null) break;
        }
    }

    /**
     * Canonical form of an internal path used for storage, uniqueness, and loop comparison:
     * trim, strip trailing slashes unless the path is exactly "/". Case-sensitive — matches
     * {@code bigbike-web/proxy.ts}'s lookup behavior (never lowercases the incoming pathname)
     * and the case-sensitive DB uniqueness constraint (see DATA_CONTRACT.md "Redirects table").
     */
    private static String canonicalizePath(String path) {
        if (path == null) return "";
        String trimmed = path.trim();
        while (trimmed.length() > 1 && trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    /**
     * Converts a redirect target to the exact pathname the web proxy will look up next.
     * Query/fragment never participate in redirect lookup. Same-site absolute URLs stay in
     * the chain; a genuinely external URL terminates it.
     */
    private String redirectLookupPath(String targetUrl) {
        if (targetUrl == null || targetUrl.isBlank()) return null;
        try {
            URI uri = URI.create(targetUrl.trim());
            if (uri.isAbsolute()) {
                String scheme = uri.getScheme();
                String baseHost = URI.create(siteBaseUrl).getHost();
                if (scheme == null
                        || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))
                        || uri.getHost() == null
                        || baseHost == null
                        || !uri.getHost().equalsIgnoreCase(baseHost)) {
                    return null;
                }
            } else if (uri.getRawAuthority() != null) {
                return null;
            }
            String path = uri.getRawPath();
            return canonicalizePath(path == null || path.isBlank() ? "/" : path);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private void rejectLegacyStatusConfiguration(Integer statusCode, String redirectType) {
        if (statusCode == null && (redirectType == null || redirectType.isBlank())) return;
        throw ValidationException.fromField(
                statusCode != null ? "statusCode" : "redirectType",
                "UNSUPPORTED",
                "Managed redirects always use HTTP 301; statusCode and redirectType are not configurable.");
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
        return toJson(Map.of(
                "id", entity.getId() == null ? "" : entity.getId().toString(),
                "sourcePattern", nvl(entity.getSourcePattern()),
                "targetUrl", nvl(entity.getTargetUrl()),
                "enabled", entity.isEnabled(),
                "hitCount", entity.getHitCount(),
                "legacyId", entity.getLegacyId() == null ? "" : entity.getLegacyId(),
                "notes", nvl(entity.getNotes())));
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Failed to serialize redirect audit JSON: {}", e.getMessage());
            return "{}";
        }
    }

    private static String nvl(String value) {
        return value != null ? value : "";
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
