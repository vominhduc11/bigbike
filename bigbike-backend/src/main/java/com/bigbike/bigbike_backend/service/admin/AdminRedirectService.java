package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.redirect.AdminRedirectResponse;
import com.bigbike.bigbike_backend.api.admin.dto.redirect.CreateRedirectRequest;
import com.bigbike.bigbike_backend.api.admin.dto.redirect.UpdateRedirectRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.mapper.RedirectMapper;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectSpecification;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.UnaryOperator;
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
    /** Guard against pathological chains in the table — also the loop-detection depth. */
    private static final int MAX_CHAIN_DEPTH = 20;

    private final RedirectJpaRepository redirectRepo;
    private final ProductJpaRepository productRepo;
    private final CategoryJpaRepository categoryRepo;
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
                dbPage.getContent().stream()
                        .map(redirectMapper::toResponse)
                        .toList(),
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
        rejectRedirectType(request.redirectType());
        int statusCode = normalizeStatusCode(request.statusCode());
        String sourcePattern = normalizeSourcePattern(request.sourcePattern());
        String targetUrl = normalizeRequiredUrl(request.targetUrl(), "targetUrl");
        validateTargetUrl(targetUrl);
        if (statusCode == 301) {
            validateCatalogTarget(sourcePattern, targetUrl);
            validateNoRedirectLoop(sourcePattern, targetUrl, null);
            targetUrl = resolveTargetForSave(targetUrl, null);
        }
        ensureUniqueSourcePattern(sourcePattern, null);

        boolean enabled = request.enabled() == null || request.enabled();

        Instant now = Instant.now();
        RedirectEntity entity = new RedirectEntity();
        entity.setSourcePattern(sourcePattern);
        entity.setTargetUrl(targetUrl);
        entity.setStatusCode(statusCode);
        entity.setEnabled(enabled);
        entity.setHitCount(0);
        entity.setLastHitAt(null);
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
        rejectRedirectType(request.redirectType());
        RedirectEntity entity = redirectRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Redirect not found."));
        String before = snapshot(entity);
        int nextStatusCode = request.statusCode() == null
                ? entity.getStatusCode()
                : normalizeStatusCode(request.statusCode());

        String nextSourcePattern = entity.getSourcePattern();
        if (request.sourcePattern() != null) {
            nextSourcePattern = normalizeSourcePattern(request.sourcePattern());
        }
        String nextTargetUrl = entity.getTargetUrl();
        if (request.targetUrl() != null) {
            nextTargetUrl = normalizeRequiredUrl(request.targetUrl(), "targetUrl");
            validateTargetUrl(nextTargetUrl);
        }
        // Always re-validated on the effective pair — even a source-only edit could newly
        // collide with the (unchanged) target. Collapsing to a final destination, below, only
        // runs when targetUrl is actually part of this request — see resolveTargetForSave.
        if (nextStatusCode == 301) {
            validateCatalogTarget(nextSourcePattern, nextTargetUrl);
            validateNoRedirectLoop(nextSourcePattern, nextTargetUrl, id);
        }
        if (request.targetUrl() != null && nextStatusCode == 301) {
            nextTargetUrl = resolveTargetForSave(nextTargetUrl, id);
        }
        ensureUniqueSourcePattern(nextSourcePattern, id);

        if (request.sourcePattern() != null) {
            entity.setSourcePattern(nextSourcePattern);
        }
        if (request.targetUrl() != null) {
            entity.setTargetUrl(nextTargetUrl);
        }
        if (request.statusCode() != null) {
            entity.setStatusCode(nextStatusCode);
        }
        if (request.enabled() != null) {
            entity.setEnabled(request.enabled());
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
     * REDIRECT_RULE_011: catalogue-looking destinations must still point to a
     * real public page when an admin creates or enables a 301. This guard is
     * deliberately not based on stock availability: an out-of-stock product
     * remains a valid product page. Legacy rows are repaired by migration, but
     * the rule also protects future admin writes.
     */
    private void validateCatalogTarget(String sourcePattern, String targetUrl) {
        String path = redirectLookupPath(targetUrl);
        if (path == null) return;

        String routePath = stripLocalePrefix(path);
        if (isLegacyProductSource(sourcePattern) && isListOrCategoryPath(routePath)) {
            throw ValidationException.fromField(
                    "targetUrl",
                    "INVALID_LEGACY_PRODUCT_TARGET",
                    "A legacy product URL must point to a product page, a reviewed history page, or a terminal 410.");
        }

        if (routePath.startsWith("/product/")) {
            String slug = singleRouteSegment(routePath, "/product/");
            Optional<ProductEntity> product = slug == null
                    ? Optional.empty()
                    : productRepo.findBySlug(slug).or(() -> productRepo.findBySlugEn(slug));
            if (product.isEmpty()
                    || product.get().getPublishStatus() != PublishStatus.PUBLISHED
                    || product.get().isDiscontinued()) {
                throw ValidationException.fromField(
                        "targetUrl",
                        "INVALID_PRODUCT_TARGET",
                        "A product redirect target must resolve to a published, non-discontinued product.");
            }
            return;
        }

        if (routePath.startsWith("/danh-muc/") || routePath.startsWith("/categories/")) {
            String prefix = routePath.startsWith("/danh-muc/") ? "/danh-muc/" : "/categories/";
            String slug = singleRouteSegment(routePath, prefix);
            Optional<CategoryEntity> category = slug == null
                    ? Optional.empty()
                    : (prefix.equals("/danh-muc/")
                            ? categoryRepo.findBySlug(slug).or(() -> categoryRepo.findBySlugEn(slug))
                            : categoryRepo.findBySlugEn(slug).or(() -> categoryRepo.findBySlug(slug)));
            if (category.isEmpty() || !category.get().isVisible() || category.get().isDeleted()) {
                throw ValidationException.fromField(
                        "targetUrl",
                        "INVALID_CATEGORY_TARGET",
                        "A category redirect target must resolve to a visible, non-deleted category.");
            }
        }
    }

    private static String stripLocalePrefix(String path) {
        if (path.startsWith("/en/") || path.startsWith("/vi/")) return path.substring(3);
        return path;
    }

    private static boolean isLegacyProductSource(String sourcePattern) {
        String normalized = canonicalizePath(sourcePattern);
        return normalized.startsWith("/sp/")
                || normalized.startsWith("/en/sp/")
                || normalized.startsWith("/vi/sp/");
    }

    private static boolean isListOrCategoryPath(String path) {
        return path.equals("/")
                || path.equals("/sp")
                || path.equals("/sp/")
                || path.equals("/products")
                || path.startsWith("/products/")
                || path.equals("/danh-muc")
                || path.startsWith("/danh-muc/")
                || path.equals("/categories")
                || path.startsWith("/categories/");
    }

    private static String singleRouteSegment(String path, String prefix) {
        if (!path.startsWith(prefix)) return null;
        String slug = path.substring(prefix.length());
        return slug.isBlank() || slug.contains("/") ? null : slug;
    }

    /**
     * Validates that creating/updating a redirect from {@code sourcePattern} to {@code targetUrl}
     * does not create a redirect loop: neither a direct self-loop nor a multi-hop A→B→A chain.
     * The chain walk here is deliberately unfiltered by {@code enabled} — a loop through a
     * currently-disabled rule would still be live the moment someone re-enables it, so it must be
     * rejected now, not silently allowed back in later.
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
        // If it ever reaches normalizedSource, adding this redirect would close a loop.
        List<String> path = walkChain(normalizedTarget, repositoryNextHop(excludeId), MAX_CHAIN_DEPTH);
        if (path.contains(normalizedSource)) {
            throw ValidationException.fromField(
                    "targetUrl",
                    "REDIRECT_LOOP",
                    "Redirect would create a loop: " + sourcePattern + " → … → " + normalizedSource
            );
        }
    }

    /**
     * REDIRECT_RULE_010: if {@code targetUrl} is itself the {@code sourcePattern} of another
     * currently-ENABLED rule, returns the fully-resolved final destination after following that
     * chain, instead of the intermediate value — so the row being saved always represents exactly
     * one hop and there is nothing left to track/display as a "chain length". A disabled rule
     * does not redirect anyone in production, so it is deliberately excluded from this walk (only
     * {@code enabledRepositoryNextHop} is used here, never the unfiltered resolver).
     *
     * <p>Must be called only after {@link #validateNoRedirectLoop} already passed for the same
     * {@code (sourcePattern, targetUrl)} pair — no loop check is repeated here. That is safe
     * because the enabled-only walk below can only ever stop earlier than (or at the same point
     * as) the unfiltered walk {@code validateNoRedirectLoop} already completed: both follow
     * identical steps until the first disabled rule, where the enabled-only walk stops instead of
     * continuing. So its path is always a prefix of the already-validated unfiltered path, and
     * therefore can't contain the source path either.
     *
     * @param targetUrl the already loop-validated target URL of the redirect being created/updated
     * @param excludeId for updates: the ID of the redirect being updated; {@code null} for new ones
     */
    private String resolveTargetForSave(String targetUrl, UUID excludeId) {
        String normalizedTarget = redirectLookupPath(targetUrl);
        if (normalizedTarget == null) return targetUrl;

        List<String> path = walkChain(normalizedTarget, enabledRepositoryNextHop(excludeId), MAX_CHAIN_DEPTH);
        // path.size() >= 2 means targetUrl is itself another enabled rule's source — collapse to
        // where that chain actually ends. size() <= 1 means nothing redirects onward from
        // targetUrl, so keep it exactly as given (preserves the caller's trailing-slash choice).
        return path.size() >= 2 ? path.get(path.size() - 1) : targetUrl;
    }

    /**
     * Walks the redirect chain forward from {@code target} and returns the ordered lookup paths a
     * visitor actually travels, the first element being {@code target}'s own lookup path.
     *
     * <p>Stops at a target that leaves this site (no internal chain left to follow), a path no rule
     * matches, a path already visited (pre-existing cyclic data in the table must not hang the
     * walk), or {@code maxDepth}. Backs both loop validation and the save-time auto-collapse.
     *
     * @param nextHop resolves a lookup path to the raw target of the rule that matches it, or
     *                {@code null} when no rule matches — lets callers back this with either the
     *                unfiltered or enabled-only resolver below
     */
    private List<String> walkChain(String target, UnaryOperator<String> nextHop, int maxDepth) {
        List<String> path = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        String current = redirectLookupPath(target);

        while (current != null && path.size() < maxDepth) {
            if (!seen.add(current)) break;
            path.add(current);
            String next = nextHop.apply(current);
            if (next == null) break;
            current = redirectLookupPath(next);
        }
        return path;
    }

    /** Chain lookup backed by the repository, skipping the rule being updated (if any) so it is
     * not treated as part of its own chain. Pass {@code null} for a brand-new redirect. Used only
     * for loop detection, which must catch a loop through a disabled rule too. */
    private UnaryOperator<String> repositoryNextHop(UUID excludeId) {
        return path -> {
            Optional<RedirectEntity> next = excludeId != null
                    ? redirectRepo.findBySourcePatternAndIdNot(path, excludeId)
                    : redirectRepo.findBySourcePattern(path);
            return next.filter(r -> r.getStatusCode() == 301)
                    .map(RedirectEntity::getTargetUrl)
                    .orElse(null);
        };
    }

    /** As {@link #repositoryNextHop}, but matching only ENABLED rules — used exclusively by
     * {@link #resolveTargetForSave}, since a disabled rule redirects nobody in production and
     * must not be treated as a real chain link when deciding what to collapse a saved target
     * down to. */
    private UnaryOperator<String> enabledRepositoryNextHop(UUID excludeId) {
        return path -> {
            Optional<RedirectEntity> next = excludeId != null
                    ? redirectRepo.findBySourcePatternAndIdNot(path, excludeId)
                    : redirectRepo.findBySourcePattern(path);
            return next.filter(RedirectEntity::isEnabled)
                    .filter(r -> r.getStatusCode() == 301)
                    .map(RedirectEntity::getTargetUrl)
                    .orElse(null);
        };
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

    private int normalizeStatusCode(Integer statusCode) {
        if (statusCode != null && statusCode != 301 && statusCode != 410) {
            throw ValidationException.fromField(
                    "statusCode",
                    "INVALID_STATUS_CODE",
                    "Redirect status code must be 301 or 410.");
        }
        return statusCode == null ? 301 : statusCode;
    }

    private void rejectRedirectType(String redirectType) {
        if (redirectType == null || redirectType.isBlank()) return;
        throw ValidationException.fromField(
                "redirectType",
                "UNSUPPORTED",
                "redirectType is not configurable; use statusCode 301 or 410.");
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
                "statusCode", entity.getStatusCode(),
                "enabled", entity.isEnabled(),
                "hitCount", entity.getHitCount()));
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
