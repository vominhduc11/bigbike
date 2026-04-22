package com.bigbike.bigbike_backend.migration.wordpress.redirect;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressRedirectMapper.MappedRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpFgRedirect;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Analyzes kd_fg_redirect rows and reports resolution statistics.
 *
 * Wraps FgRedirectResolver with an additional reporting layer.
 * Deferred rows are never imported — they require manual investigation.
 *
 * Deferred reason categories:
 *   - deactivated   : row.activated() == false
 *   - missingProduct: product with legacyId=targetPostId not found in DB
 *   - blankSource   : old_url is null or blank
 *   - selfLoop      : resolved source pattern == /product/{slug}
 */
@Component
public class FgRedirectAnalyzer {

    private static final Logger log = LoggerFactory.getLogger(FgRedirectAnalyzer.class);

    private final FgRedirectResolver resolver;

    public FgRedirectAnalyzer(FgRedirectResolver resolver) {
        this.resolver = resolver;
    }

    public record AnalysisResult(
            int total,
            int resolved,
            int deferred,
            int selfLoops,
            List<MappedRedirect> resolvedRedirects) {}

    /**
     * Analyze FG redirect rows.
     * Returns resolved list + statistics. Never imports — caller decides what to do.
     */
    public AnalysisResult analyze(List<WpFgRedirect> rows) {
        FgRedirectResolver.ResolutionResult result = resolver.resolve(rows);

        log.info("FgRedirectAnalyzer: total={} resolved={} deferred={} selfLoops={}",
                rows.size(), result.resolved().size(), result.deferredCount(), result.selfLoopCount());

        return new AnalysisResult(
                rows.size(),
                result.resolved().size(),
                result.deferredCount(),
                result.selfLoopCount(),
                result.resolved());
    }
}
