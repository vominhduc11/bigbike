package com.bigbike.bigbike_backend.migration.wordpress.live;

import io.minio.MinioClient;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.Locale;

/** Standalone CLI so preflight cannot trigger Flyway, Hibernate, initializers, or application runners. */
public final class LiveMigrationPreflightCli {

    private LiveMigrationPreflightCli() {}

    public static void main(String[] args) throws Exception {
        String dump = required("BIGBIKE_LIVE_MIGRATION_DUMP");
        String uploads = required("BIGBIKE_LIVE_MIGRATION_UPLOADS");
        String prefix = required("BIGBIKE_LIVE_MIGRATION_TABLE_PREFIX");
        String snapshotId = required("BIGBIKE_LIVE_MIGRATION_SNAPSHOT_ID");
        String reportDir = value("BIGBIKE_LIVE_MIGRATION_REPORT_DIR", "../bigbike-migration/reports");
        String jdbcUrl = value("BIGBIKE_DB_URL",
                "jdbc:postgresql://localhost:5432/" + value("POSTGRES_DB", "bigbike"));
        String dbUser = value("BIGBIKE_DB_USERNAME", value("POSTGRES_USER", "bigbike"));
        String dbPassword = System.getenv("BIGBIKE_DB_PASSWORD");
        if (blank(dbPassword)) dbPassword = required("POSTGRES_PASSWORD");
        boolean finalSnapshot = bool("BIGBIKE_LIVE_MIGRATION_FINAL_SNAPSHOT", false);
        boolean freezeConfirmed = bool("BIGBIKE_LIVE_MIGRATION_FREEZE_CONFIRMED", false);
        boolean hashTargetMedia = bool("BIGBIKE_LIVE_MIGRATION_HASH_TARGET_MEDIA", true);
        String backupManifest = System.getenv("BIGBIKE_LIVE_MIGRATION_OFFSITE_BACKUP_MANIFEST");
        String ownerOverrides = required("BIGBIKE_LIVE_MIGRATION_OWNER_OVERRIDES");
        String recoveryStaging = required("BIGBIKE_LIVE_MIGRATION_RECOVERY_STAGING");
        String minioBucket = value("MINIO_BUCKET", "bigbike-media");

        LiveMigrationPreflightOptions options = new LiveMigrationPreflightOptions(
                Path.of(dump), Path.of(uploads), Path.of(reportDir), prefix, snapshotId,
                finalSnapshot, freezeConfirmed,
                backupManifest == null || backupManifest.isBlank() ? null : Path.of(backupManifest),
                Path.of(ownerOverrides), Path.of(recoveryStaging),
                minioBucket, hashTargetMedia);

        MinioClient minio = buildMinio(hashTargetMedia);
        Class.forName("org.postgresql.Driver");
        try (Connection connection = DriverManager.getConnection(jdbcUrl, dbUser, dbPassword.trim())) {
            connection.setAutoCommit(false);
            connection.setReadOnly(true);
            try (Statement statement = connection.createStatement()) {
                statement.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
            }
            LiveMigrationPreflightReport report =
                    new LiveMigrationPreflightService().run(options, connection, minio);
            connection.rollback();

            LiveMigrationReportWriter.Paths paths =
                    new LiveMigrationReportWriter().write(report, options.reportDirectory());
            System.out.println("LIVE_MIGRATION_PREFLIGHT_COMPLETE");
            System.out.println("json=" + paths.json());
            System.out.println("markdown=" + paths.markdown());
            System.out.println("inferenceJson=" + paths.inferenceJson());
            System.out.println("inferenceMarkdown=" + paths.inferenceMarkdown());
            System.out.println("jsonSha256=" + paths.jsonSha256());
            System.out.println("inferenceJsonSha256=" + paths.inferenceJsonSha256());
            System.out.println("planDigestSha256=" + paths.planDigestSha256());
            System.out.println("products=" + report.productActions());
            System.out.println("variants=" + report.variantActions());
            System.out.println("articles=" + report.articleActions());
            System.out.println("media=" + report.mediaSummary());
            System.out.println("redirects=" + report.redirectSummary());
            System.out.println("blockers=" + report.blockers());
        }
        // MinIO's shared HTTP client keeps non-daemon dispatcher threads alive briefly.
        // This is a standalone CLI, so exit explicitly after every resource is closed.
        System.exit(0);
    }

    private static MinioClient buildMinio(boolean enabled) {
        if (!enabled) return null;
        String endpoint = System.getenv("MINIO_ENDPOINT");
        String accessKey = System.getenv("MINIO_ROOT_USER");
        String secretKey = System.getenv("MINIO_ROOT_PASSWORD");
        if (blank(endpoint) || blank(accessKey) || blank(secretKey)) return null;
        return MinioClient.builder().endpoint(endpoint).credentials(accessKey, secretKey).build();
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (blank(value)) throw new IllegalArgumentException("Required environment variable is missing: " + name);
        return value.trim();
    }

    private static String value(String name, String fallback) {
        String value = System.getenv(name);
        return blank(value) ? fallback : value.trim();
    }

    private static boolean bool(String name, boolean fallback) {
        String value = System.getenv(name);
        if (blank(value)) return fallback;
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "1", "true", "yes" -> true;
            case "0", "false", "no" -> false;
            default -> throw new IllegalArgumentException("Invalid boolean environment variable: " + name);
        };
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
