package com.bigbike.bigbike_backend.api.internal;

import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lean lookup endpoint consumed by the bigbike-web proxy.
 * Returns a single redirect rule for a given source path, or 404 when none matches.
 * Intentionally bypasses the standard ApiDataResponse envelope: the proxy is on the
 * hot request path and benefits from the smallest possible JSON shape.
 *
 * Security policy (deny-by-default):
 * - When {@code bigbike.internal.token} is set: all three endpoints require the matching
 *   value in the {@code X-Internal-Token} request header (returns 401 otherwise).
 * - When token is blank AND {@code bigbike.internal.allow-open=true}: endpoints are open.
 *   Use only in local dev or test environments; never set in staging/production.
 * - When token is blank AND {@code bigbike.internal.allow-open=false} (default): endpoints
 *   return 401. This is the safe default — set a token in staging/prod via
 *   {@code BIGBIKE_INTERNAL_TOKEN}, or enable allow-open=true only in dev.
 */
@RestController
@RequestMapping("/api/internal")
@RequiredArgsConstructor
public class InternalRedirectController {

    private static final String TOKEN_HEADER = "X-Internal-Token";

    private final RedirectJpaRepository redirectRepo;

    @Value("${bigbike.internal.token:}")
    private String internalToken;

    /**
     * When true and internalToken is blank, endpoints are open without a token check.
     * Set to true only in local dev (application-dev.properties) or test environments.
     * Defaults to false (deny) so production without a token configured is safe.
     */
    @Value("${bigbike.internal.allow-open:false}")
    private boolean allowOpen;

    /** redirectId lets the caller fire the hit-counter without a second lookup. */
    public record RedirectLookupResponse(String redirectId, String target, int statusCode) {}

    public record ActiveRedirectItem(
            String id,
            String sourcePattern,
            String redirectType,
            String targetUrl,
            int statusCode
    ) {}

    /** Single exact-match lookup — used by per-request fallback. */
    @GetMapping("/redirect")
    public ResponseEntity<RedirectLookupResponse> lookup(
            @RequestParam("path") String path,
            HttpServletRequest request
    ) {
        if (!isAuthorized(request)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (path == null || path.isBlank()) return ResponseEntity.badRequest().build();

        Optional<RedirectEntity> match = redirectRepo.findBySourcePattern(path)
                .filter(RedirectEntity::isEnabled);
        return match
                .map(r -> ResponseEntity.ok(
                        new RedirectLookupResponse(r.getId().toString(), r.getTargetUrl(), r.getStatusCode())))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** Bulk list of all active redirects — consumed by Next.js proxy on cold start. */
    @GetMapping("/redirects/active")
    public ResponseEntity<List<ActiveRedirectItem>> listActive(HttpServletRequest request) {
        if (!isAuthorized(request)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        List<ActiveRedirectItem> items = redirectRepo.findByEnabled(true).stream()
                .map(r -> new ActiveRedirectItem(
                        r.getId().toString(),
                        r.getSourcePattern(),
                        r.getRedirectType(),
                        r.getTargetUrl(),
                        r.getStatusCode()))
                .toList();
        return ResponseEntity.ok(items);
    }

    /** Fire-and-forget hit counter increment — called by Next.js proxy after redirect. */
    @PostMapping("/redirects/hit/{redirectId}")
    @Transactional
    public ResponseEntity<Void> recordHit(
            @PathVariable UUID redirectId,
            HttpServletRequest request
    ) {
        if (!isAuthorized(request)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        redirectRepo.incrementHitCount(redirectId, Instant.now());
        return ResponseEntity.noContent().build();
    }

    private boolean isAuthorized(HttpServletRequest request) {
        if (internalToken == null || internalToken.isBlank()) {
            // No token configured: allow only when explicitly opted in (e.g. local dev)
            return allowOpen;
        }
        // Token configured: require matching header value. Constant-time compare
        // avoids leaking the token byte-by-byte through response timing.
        String provided = request.getHeader(TOKEN_HEADER);
        if (provided == null) {
            return false;
        }
        return MessageDigest.isEqual(
                internalToken.getBytes(StandardCharsets.UTF_8),
                provided.getBytes(StandardCharsets.UTF_8));
    }
}
