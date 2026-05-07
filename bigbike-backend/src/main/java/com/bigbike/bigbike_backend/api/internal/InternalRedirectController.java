package com.bigbike.bigbike_backend.api.internal;

import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
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
 * Security: when BIGBIKE_INTERNAL_TOKEN is set, all three endpoints require the
 * matching value in the X-Internal-Token request header (returns 401 otherwise).
 * When the property is empty (default), the endpoints are open — lock down at the
 * network layer (private VPC / nginx ACL) for production.
 */
@RestController
@RequestMapping("/api/internal")
public class InternalRedirectController {

    private static final String TOKEN_HEADER = "X-Internal-Token";

    private final RedirectJpaRepository redirectRepo;

    @Value("${bigbike.internal.token:}")
    private String internalToken;

    public InternalRedirectController(RedirectJpaRepository redirectRepo) {
        this.redirectRepo = redirectRepo;
    }

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
        if (internalToken == null || internalToken.isBlank()) return true;
        return internalToken.equals(request.getHeader(TOKEN_HEADER));
    }
}
