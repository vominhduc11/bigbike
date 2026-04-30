package com.bigbike.bigbike_backend.api.internal;

import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
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
 */
@RestController
@RequestMapping("/api/internal")
public class InternalRedirectController {

    private final RedirectJpaRepository redirectRepo;

    public InternalRedirectController(RedirectJpaRepository redirectRepo) {
        this.redirectRepo = redirectRepo;
    }

    public record RedirectLookupResponse(String target, int statusCode) {}

    public record ActiveRedirectItem(
            String id,
            String sourcePattern,
            String redirectType,
            String targetUrl,
            int statusCode
    ) {}

    /** Single exact-match lookup — used by per-request fallback. */
    @GetMapping("/redirect")
    public ResponseEntity<RedirectLookupResponse> lookup(@RequestParam("path") String path) {
        if (path == null || path.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        Optional<RedirectEntity> match = redirectRepo.findBySourcePattern(path)
                .filter(RedirectEntity::isEnabled);
        return match
                .map(r -> ResponseEntity.ok(new RedirectLookupResponse(r.getTargetUrl(), r.getStatusCode())))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** Bulk list of all active redirects — consumed by Next.js middleware cache. */
    @GetMapping("/redirects/active")
    public List<ActiveRedirectItem> listActive() {
        return redirectRepo.findByEnabled(true).stream()
                .map(r -> new ActiveRedirectItem(
                        r.getId().toString(),
                        r.getSourcePattern(),
                        r.getRedirectType(),
                        r.getTargetUrl(),
                        r.getStatusCode()))
                .toList();
    }

    /** Fire-and-forget hit counter increment — called by Next.js middleware. */
    @PostMapping("/redirects/hit/{redirectId}")
    @Transactional
    public ResponseEntity<Void> recordHit(@PathVariable UUID redirectId) {
        redirectRepo.incrementHitCount(redirectId, Instant.now());
        return ResponseEntity.noContent().build();
    }
}
