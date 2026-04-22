package com.bigbike.bigbike_backend.api.internal;

import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import java.util.Optional;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lean lookup endpoint consumed by the bigbike-web proxy / Redis cache layer.
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
}
