package com.bigbike.bigbike_backend.migration.wordpress.media;

import com.bigbike.bigbike_backend.migration.wordpress.config.WordPressMigrationProperties;
import com.bigbike.bigbike_backend.migration.wordpress.runner.WordPressMigrationImportRunner;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Phase 2E — Media Copy runner.
 *
 * Activated only when ALL of these are satisfied:
 *
 *   1. bigbike.migration.wordpress.enabled=true
 *   2. bigbike.migration.wordpress.mode=media-copy
 *   3. bigbike.migration.wordpress.uploads-path=&lt;path to wp-content/uploads&gt;
 *
 * For real copy (dry-run=false), additional guards are required:
 *
 *   4. bigbike.migration.wordpress.confirm-execute=true
 *   5. bigbike.migration.wordpress.environment=local OR staging
 *   6. Active Spring profile must NOT be "test"
 *   7. DB URL must NOT match production-like patterns
 *   8. uploads-path must be an existing directory
 *   9. minio-endpoint, minio-access-key, minio-secret-key, minio-bucket must be set
 *
 * Dry-run (dry-run=true, default):
 *   Scans the uploads directory against media DB records and reports counts/sizes.
 *   No MinIO connection is made. No files are copied.
 *
 * Example activation (dry-run):
 *   --bigbike.migration.wordpress.enabled=true
 *   --bigbike.migration.wordpress.mode=media-copy
 *   --bigbike.migration.wordpress.uploads-path=/data/wp-content/uploads
 *
 * Example activation (real copy):
 *   --bigbike.migration.wordpress.enabled=true
 *   --bigbike.migration.wordpress.mode=media-copy
 *   --bigbike.migration.wordpress.dry-run=false
 *   --bigbike.migration.wordpress.confirm-execute=true
 *   --bigbike.migration.wordpress.environment=local
 *   --bigbike.migration.wordpress.uploads-path=/data/wp-content/uploads
 */
@Component
@Slf4j
public class MediaCopyRunner implements ApplicationRunner {

    private static final int DEFAULT_MAX_RETRIES = 3;

    private final WordPressMigrationProperties props;
    private final MediaCopyService copyService;
    private final Environment environment;
    private final String datasourceUrl;

    public MediaCopyRunner(
            WordPressMigrationProperties props,
            MediaCopyService copyService,
            Environment environment,
            @Value("${spring.datasource.url:}") String datasourceUrl) {
        this.props = props;
        this.copyService = copyService;
        this.environment = environment;
        this.datasourceUrl = datasourceUrl;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        // Guard 1: master switch
        if (!props.isEnabled()) return;

        // Guard 2: mode must be "media-copy"
        if (!"media-copy".equals(props.getMode())) return;

        // Guard 3: uploads-path must be configured
        String uploadsPathStr = props.getUploadsPath();
        if (uploadsPathStr == null || uploadsPathStr.isBlank()) {
            log.error("MEDIA COPY ABORTED: uploads-path is not configured.");
            log.error("Set: --bigbike.migration.wordpress.uploads-path=/path/to/wp-content/uploads");
            return;
        }

        Path uploadsDir = Path.of(uploadsPathStr);
        boolean dryRun = props.isDryRun();

        if (!dryRun) {
            // Guard 4: explicit confirmation
            if (!props.isConfirmExecute()) {
                log.error("=================================================");
                log.error("MEDIA COPY ABORTED: confirm-execute flag is NOT set.");
                log.error("Add: --bigbike.migration.wordpress.confirm-execute=true");
                log.error("NEVER run on production without a verified backup.");
                log.error("=================================================");
                return;
            }

            // Guard 5: environment
            String env = props.getEnvironment() == null ? "" : props.getEnvironment().trim().toLowerCase();
            if (!env.equals("local") && !env.equals("staging")) {
                log.error("=================================================");
                log.error("MEDIA COPY ABORTED: environment guard not satisfied.");
                log.error("Set: --bigbike.migration.wordpress.environment=local OR staging");
                log.error("Current value: '{}'", props.getEnvironment());
                log.error("=================================================");
                return;
            }

            // Guard 6: not in test Spring profile
            if (Arrays.asList(environment.getActiveProfiles()).contains("test")) {
                log.error("MEDIA COPY ABORTED: active Spring profile is 'test'. Real copy must not run in test.");
                return;
            }

            // Guard 7: no production DB URL
            if (datasourceUrl != null && !datasourceUrl.isBlank()) {
                String urlLower = datasourceUrl.toLowerCase();
                for (String pattern : WordPressMigrationImportRunner.PRODUCTION_URL_PATTERNS) {
                    if (urlLower.contains(pattern)) {
                        log.error("=================================================");
                        log.error("MEDIA COPY ABORTED: DB URL matches production pattern '{}'.", pattern);
                        log.error("DB URL: {}", datasourceUrl);
                        log.error("=================================================");
                        return;
                    }
                }
            }

            // Guard 8: uploads directory must exist on disk
            if (!Files.isDirectory(uploadsDir)) {
                log.error("MEDIA COPY ABORTED: uploads directory not found: {}", uploadsDir);
                return;
            }

            // Guard 9: MinIO configuration must be complete
            if (props.getMinioEndpoint().isBlank() || props.getMinioAccessKey().isBlank()
                    || props.getMinioSecretKey().isBlank() || props.getMinioBucket().isBlank()) {
                log.error("MEDIA COPY ABORTED: MinIO configuration is incomplete.");
                log.error("Required properties: minio-endpoint, minio-access-key, minio-secret-key, minio-bucket");
                return;
            }
        }

        log.warn("=================================================");
        log.warn("PHASE 2E MEDIA COPY — dryRun={}", dryRun);
        log.warn("uploads-path: {}", uploadsDir);
        if (!dryRun) {
            log.warn("MinIO target: {}/{}", props.getMinioEndpoint(), props.getMinioBucket());
        }
        log.warn("=================================================");

        MediaCopyOptions options = new MediaCopyOptions(
                uploadsDir,
                dryRun ? "" : props.getMinioEndpoint(),
                dryRun ? "" : props.getMinioBucket(),
                DEFAULT_MAX_RETRIES,
                dryRun);

        MediaStoragePort storage = null;
        if (!dryRun) {
            storage = new MinioMediaStorageAdapter(
                    props.getMinioEndpoint(),
                    props.getMinioAccessKey(),
                    props.getMinioSecretKey());
        }

        MediaCopyReport report = copyService.run(options, storage);

        log.info("=== PHASE2E_MEDIA_COPY_REPORT_BEGIN ===");
        log.info("DryRun:           {}", report.dryRun());
        log.info("TotalFiles:       {}", report.totalFiles());
        log.info("TotalSizeBytes:   {}", report.totalSizeBytes());
        log.info("TotalSizeMB:      {}", String.format("%.2f", report.totalSizeBytes() / (1024.0 * 1024.0)));
        log.info("Copied:           {}", report.copied());
        log.info("Skipped:          {}", report.skipped());
        log.info("MissingSource:    {}", report.missingSource());
        log.info("ChecksumMismatch: {}", report.checksumMismatch());
        log.info("Failed:           {}", report.failed());
        log.info("DurationMs:       {}", report.duration().toMillis());
        log.info("ThroughputMBps:   {}", String.format("%.2f", report.throughputMbps()));

        if (!report.missingPaths().isEmpty()) {
            log.warn("--- Missing source files ({}) ---", report.missingPaths().size());
            report.missingPaths().forEach(p -> log.warn("  MISSING: {}", p));
        }
        if (!report.errors().isEmpty()) {
            log.error("--- Errors ({}) ---", report.errors().size());
            report.errors().forEach(e -> log.error("  ERROR: {}", e));
        }
        log.info("=== PHASE2E_MEDIA_COPY_REPORT_END ===");

        if (report.failed() > 0) {
            log.error("Media copy completed WITH {} failure(s). Review errors above.", report.failed());
        } else if (dryRun) {
            log.info("Dry-run complete. Re-run with dry-run=false and confirm-execute=true to perform the actual copy.");
        } else {
            log.info("Media copy completed successfully.");
        }
    }
}
