package com.bigbike.bigbike_backend.migration.wordpress.redirect;

import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionOptions;
import com.bigbike.bigbike_backend.migration.wordpress.importer.MigrationExecutionReport;
import com.bigbike.bigbike_backend.migration.wordpress.importer.RedirectImporter;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressRedirectMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressRedirectMapper.MappedRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpRedirectRow;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * RankMath redirect import pipeline.
 *
 * Maps kd_rank_math_redirections rows → MappedRedirects → DB.
 * Filters out:
 *   - rows with blank source or target
 *   - self-loop redirects (source == target)
 *
 * Delegates the actual persistence to RedirectImporter (upsert by sourcePattern).
 */
@Component
public class RankMathRedirectImporter {

    private static final Logger log = LoggerFactory.getLogger(RankMathRedirectImporter.class);

    private final WordPressRedirectMapper mapper;
    private final RedirectImporter importer;

    public RankMathRedirectImporter(WordPressRedirectMapper mapper, RedirectImporter importer) {
        this.mapper = mapper;
        this.importer = importer;
    }

    public record ImportResult(
            int selfLoopSkipped,
            int blankSkipped,
            MigrationExecutionReport.DomainResult domainResult) {

        public int imported() {
            return domainResult.inserted() + domainResult.updated();
        }
    }

    /**
     * Import all RankMath redirect rows.
     * Returns counts of what was imported, skipped, and why.
     */
    public ImportResult importAll(List<WpRedirectRow> rows, MigrationExecutionOptions opts) {
        List<MappedRedirect> valid = new ArrayList<>();
        int selfLoops = 0;
        int blank = 0;

        for (WpRedirectRow row : rows) {
            MappedRedirect mr = mapper.map(row);
            String src = mr.sourcePattern();
            String tgt = mr.targetPattern();
            if (src == null || src.isBlank() || tgt == null || tgt.isBlank()) {
                blank++;
                continue;
            }
            if (src.equals(tgt)) {
                selfLoops++;
                log.debug("RankMath self-loop skipped: id={} src={}", row.id(), src);
                continue;
            }
            valid.add(mr);
        }

        MigrationExecutionReport.DomainResult result = importer.importBatch(valid, opts);
        log.info("RankMathRedirectImporter: total={} blank={} selfLoops={} imported={}",
                rows.size(), blank, selfLoops, result.inserted() + result.updated());
        return new ImportResult(selfLoops, blank, result);
    }
}
