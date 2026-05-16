package com.bigbike.bigbike_backend.migration.wordpress.redirect;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressRedirectMapper.MappedRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpFgRedirect;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Resolves FG Redirect rows into MappedRedirects.
 *
 * kd_fg_redirect schema has no stored target URL.
 * Target is derived by looking up the product with legacyId=targetPostId:
 *   target = "/product/{slug}"
 *
 * Rows where the product is not found in the DB are marked DEFERRED and excluded
 * from the importable list. Importing against a missing product would create a
 * dead-end redirect.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class FgRedirectResolver {

    static final String PRODUCT_URL_PREFIX = "/product/";

    private final ProductJpaRepository productRepo;

    public record ResolutionResult(
            List<MappedRedirect> resolved,
            int deferredCount,
            int selfLoopCount) {}

    /**
     * Resolve a list of FG redirect rows.
     * Idempotent — result depends only on current DB state and input rows.
     */
    public ResolutionResult resolve(List<WpFgRedirect> rows) {
        List<MappedRedirect> resolved = new ArrayList<>();
        int deferred = 0;
        int selfLoops = 0;

        for (WpFgRedirect row : rows) {
            if (!row.activated()) {
                deferred++;
                continue;
            }
            String sourcePattern = toSourcePattern(row.oldUrl());
            if (sourcePattern == null || sourcePattern.isBlank()) {
                deferred++;
                continue;
            }

            String productId = "wp-prod-" + row.targetPostId();
            var productOpt = productRepo.findById(productId);
            if (productOpt.isEmpty()) {
                deferred++;
                log.debug("FgRedirect DEFERRED: oldUrl={} targetPostId={} — product not in DB",
                        row.oldUrl(), row.targetPostId());
                continue;
            }

            ProductEntity product = productOpt.get();
            String targetUrl = PRODUCT_URL_PREFIX + product.getSlug();

            if (sourcePattern.equals(targetUrl)) {
                selfLoops++;
                continue;
            }

            List<String> warnings = new ArrayList<>();
            resolved.add(new MappedRedirect(
                    row.targetPostId(),
                    sourcePattern,
                    targetUrl,
                    301,
                    true,
                    warnings));
        }

        if (deferred > 0) {
            log.info("FgRedirectResolver: resolved={} deferred={} selfLoops={}",
                    resolved.size(), deferred, selfLoops);
        }
        return new ResolutionResult(resolved, deferred, selfLoops);
    }

    /**
     * Convert raw old_url from dump to source pattern.
     * old_url is stored without leading slash (e.g. "some-product.html").
     * Source pattern becomes "/some-product.html".
     */
    public static String toSourcePattern(String oldUrl) {
        if (oldUrl == null || oldUrl.isBlank()) return null;
        String trimmed = oldUrl.trim();
        return trimmed.startsWith("/") ? trimmed : "/" + trimmed;
    }
}
