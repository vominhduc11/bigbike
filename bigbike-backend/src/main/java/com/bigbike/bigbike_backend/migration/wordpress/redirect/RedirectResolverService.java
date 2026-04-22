package com.bigbike.bigbike_backend.migration.wordpress.redirect;

import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionOptions;
import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionReport;
import com.bigbike.bigbike_backend.migration.wordpress.importer.RedirectImporter;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressRedirectMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressRedirectMapper.MappedRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpFgRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpRedirectRow;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Orchestrates the complete Phase 2D.4 redirect completion strategy.
 *
 * Source priority (first source claiming a sourcePattern wins):
 *   1. RankMath — explicit, manually curated redirects (highest priority)
 *   2. FG Redirect — resolved from product post IDs
 *   3. Legacy URL fallback — generated from product/brand/category slugs in DB
 *
 * Safety invariants:
 *   - No self-loops (source == target) are ever imported.
 *   - No duplicate sourcePatterns — first source to claim a pattern wins.
 *   - No existing redirects are overwritten by a lower-priority source.
 *   - 301 is enforced as default when redirectCode is 0 or invalid.
 *   - Deferred FG rows are never imported.
 */
@Service
public class RedirectResolverService {

    private static final Logger log = LoggerFactory.getLogger(RedirectResolverService.class);

    private final WordPressRedirectMapper rankMathMapper;
    private final FgRedirectAnalyzer fgAnalyzer;
    private final LegacyUrlMapper legacyMapper;
    private final RedirectImporter redirectImporter;

    public RedirectResolverService(
            WordPressRedirectMapper rankMathMapper,
            FgRedirectAnalyzer fgAnalyzer,
            LegacyUrlMapper legacyMapper,
            RedirectImporter redirectImporter) {
        this.rankMathMapper = rankMathMapper;
        this.fgAnalyzer = fgAnalyzer;
        this.legacyMapper = legacyMapper;
        this.redirectImporter = redirectImporter;
    }

    public record ResolutionSummary(
            int rankMathProcessed,
            int rankMathSelfLoopSkipped,
            int rankMathBlankSkipped,
            int fgTotal,
            int fgResolved,
            int fgDeferred,
            int fgSelfLoops,
            int fallbackGenerated,
            int fallbackConflictSkipped,
            int crossSourceDuplicateSkipped,
            MigrationExecutionReport.DomainResult importResult) {}

    /**
     * Run the full redirect resolution and import strategy.
     *
     * @param rankMathRows rows from kd_rank_math_redirections
     * @param fgRows       rows from kd_fg_redirect
     * @param opts         import options (dryRun, failFast, etc.)
     */
    public ResolutionSummary resolve(
            List<WpRedirectRow> rankMathRows,
            List<WpFgRedirect> fgRows,
            MigrationExecutionOptions opts) {

        // Deduplicated map: sourcePattern → MappedRedirect (first claim wins)
        Map<String, MappedRedirect> deduped = new LinkedHashMap<>();
        int rankMathSelfLoops = 0, rankMathBlanks = 0;

        // ── 1. RankMath (highest priority) ───────────────────────────────────
        for (WpRedirectRow row : rankMathRows) {
            MappedRedirect mr = rankMathMapper.map(row);
            String src = mr.sourcePattern();
            String tgt = mr.targetPattern();
            if (src == null || src.isBlank() || tgt == null || tgt.isBlank()) {
                rankMathBlanks++;
                continue;
            }
            if (src.equals(tgt)) {
                rankMathSelfLoops++;
                continue;
            }
            deduped.putIfAbsent(src, mr);
        }
        int rankMathClaimed = deduped.size();

        // ── 2. FG Redirect (medium priority) ─────────────────────────────────
        FgRedirectAnalyzer.AnalysisResult fgResult = fgAnalyzer.analyze(fgRows);
        int fgCrossSourceDup = 0;
        for (MappedRedirect mr : fgResult.resolvedRedirects()) {
            if (deduped.putIfAbsent(mr.sourcePattern(), mr) != null) {
                fgCrossSourceDup++;
            }
        }

        // ── 3. Fallback legacy mapping (lowest priority) ──────────────────────
        LegacyUrlMapper.MappingResult fallback = legacyMapper.generateFallbacks();
        int fallbackCrossSourceDup = 0;
        for (MappedRedirect mr : fallback.redirects()) {
            if (deduped.putIfAbsent(mr.sourcePattern(), mr) != null) {
                fallbackCrossSourceDup++;
            }
        }
        int crossSourceDup = fgCrossSourceDup + fallbackCrossSourceDup;

        // ── 4. Import merged list ─────────────────────────────────────────────
        List<MappedRedirect> toImport = new ArrayList<>(deduped.values());
        MigrationExecutionReport.DomainResult importResult = redirectImporter.importBatch(toImport, opts);

        log.info("RedirectResolverService: rankMath={} fg={} fallback={} crossDup={} total={}",
                rankMathClaimed,
                fgResult.resolved(),
                fallback.productCount() + fallback.brandCount() + fallback.categoryCount(),
                crossSourceDup,
                toImport.size());

        return new ResolutionSummary(
                rankMathRows.size(),
                rankMathSelfLoops,
                rankMathBlanks,
                fgResult.total(),
                fgResult.resolved(),
                fgResult.deferred(),
                fgResult.selfLoops(),
                fallback.productCount() + fallback.brandCount() + fallback.categoryCount(),
                fallback.conflictSkipped() + fallback.selfLoopSkipped(),
                crossSourceDup,
                importResult);
    }
}
