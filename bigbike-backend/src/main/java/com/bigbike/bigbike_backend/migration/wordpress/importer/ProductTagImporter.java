package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class ProductTagImporter implements DomainImporter {

    private static final Logger log = LoggerFactory.getLogger(ProductTagImporter.class);

    /**
     * productId is the resolved DB id (e.g. "wp-prod-479").
     * Resolved in the service before calling importBatch.
     */
    public record MappedProductTag(String productId, String tag) {}

    private static final String UPSERT_SQL =
            "INSERT INTO product_tags (product_id, tag) VALUES (?, ?) " +
            "ON CONFLICT (product_id, tag) DO NOTHING";

    private final JdbcTemplate jdbc;

    public ProductTagImporter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.PRODUCT_TAGS;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedProductTag> items, MigrationExecutionOptions options) {

        int inserted = 0, skipped = 0, failed = 0;
        List<String> errors = new ArrayList<>();

        for (MappedProductTag item : items) {
            if (item.tag() == null || item.tag().isBlank()) { skipped++; continue; }
            if (item.tag().length() > 120) {
                log.warn("Skipping over-length tag ({}chars) productId={}: {}",
                        item.tag().length(), item.productId(), item.tag().substring(0, 50) + "...");
                skipped++;
                continue;
            }

            try {
                if (options.dryRun()) { inserted++; continue; }

                int rows = jdbc.update(UPSERT_SQL, item.productId(), item.tag());
                if (rows > 0) inserted++; else skipped++;

            } catch (DataIntegrityViolationException e) {
                // FK violation — product was not imported (draft/trash)
                skipped++;
            } catch (Exception e) {
                failed++;
                String msg = "ProductTag " + item.productId() + "/" + item.tag() + ": " + e.getMessage();
                errors.add(msg);
                if (options.failFast()) throw new RuntimeException(msg, e);
            }
        }

        log.info("ProductTagImporter: inserted={} skipped={} failed={}", inserted, skipped, failed);
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.PRODUCT_TAGS, inserted, 0, skipped, failed,
                List.of(), errors);
    }
}
