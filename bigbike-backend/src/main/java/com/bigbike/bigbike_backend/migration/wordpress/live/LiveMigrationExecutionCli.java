package com.bigbike.bigbike_backend.migration.wordpress.live;

import io.minio.MinioClient;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.Locale;

/** Standalone, hash-bound production writer. It never starts the Spring application. */
public final class LiveMigrationExecutionCli {

    private LiveMigrationExecutionCli() {}

    public static void main(String[] args) {
        int exitCode = 2;
        try {
            RuntimeOptions runtime = runtimeOptions();
            MinioClient minio = buildMinio();
            Class.forName("org.postgresql.Driver");

            LiveMigrationPreflightReport freshPlan;
            try (Connection read = DriverManager.getConnection(
                    runtime.jdbcUrl(), runtime.dbUser(), runtime.dbPassword())) {
                read.setAutoCommit(false);
                read.setReadOnly(true);
                try (Statement statement = read.createStatement()) {
                    statement.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
                }
                freshPlan = new LiveMigrationPreflightService().run(
                        runtime.preflightOptions(), read, minio);
                read.rollback();
            }

            LiveMigrationExecutionGate.ValidatedPlan validated =
                    new LiveMigrationExecutionGate().validate(runtime.executionOptions(), freshPlan);
            LiveMigrationExecutionReport result;
            try (Connection write = DriverManager.getConnection(
                    runtime.jdbcUrl(), runtime.dbUser(), runtime.dbPassword())) {
                write.setReadOnly(false);
                result = new LiveMigrationExecutor().execute(
                        validated, runtime.preflightOptions(), runtime.executionOptions(), write, minio);
            }

            System.out.println("LIVE_MIGRATION_EXECUTION_COMPLETE");
            System.out.println("runId=" + result.runId());
            System.out.println("snapshotId=" + result.snapshotId());
            System.out.println("resumed=" + result.resumed());
            System.out.println("domains=" + result.domains());
            System.out.println("protectedCounts=" + result.protectedCountsAfter());
            exitCode = 0;
        } catch (Exception e) {
            System.err.println("LIVE_MIGRATION_EXECUTION_BLOCKED");
            System.err.println(safeMessage(e));
        } finally {
            // MinIO's shared HTTP client can retain non-daemon dispatcher threads.
            System.exit(exitCode);
        }
    }

    private static RuntimeOptions runtimeOptions() {
        Path dump = Path.of(required("BIGBIKE_LIVE_MIGRATION_DUMP"));
        Path uploads = Path.of(required("BIGBIKE_LIVE_MIGRATION_UPLOADS"));
        String prefix = required("BIGBIKE_LIVE_MIGRATION_TABLE_PREFIX");
        String snapshotId = required("BIGBIKE_LIVE_MIGRATION_SNAPSHOT_ID");
        Path reportDir = Path.of(value(
                "BIGBIKE_LIVE_MIGRATION_REPORT_DIR", "../bigbike-migration/reports"));
        Path manifest = Path.of(required("BIGBIKE_LIVE_MIGRATION_OFFSITE_BACKUP_MANIFEST"));
        Path ownerOverrides = Path.of(required("BIGBIKE_LIVE_MIGRATION_OWNER_OVERRIDES"));
        Path recoveryStaging = Path.of(required("BIGBIKE_LIVE_MIGRATION_RECOVERY_STAGING"));
        String bucket = required("MINIO_BUCKET");
        LiveMigrationPreflightOptions preflight = new LiveMigrationPreflightOptions(
                dump, uploads, reportDir, prefix, snapshotId,
                boolRequiredTrue("BIGBIKE_LIVE_MIGRATION_FINAL_SNAPSHOT"),
                boolRequiredTrue("BIGBIKE_LIVE_MIGRATION_FREEZE_CONFIRMED"),
                manifest, ownerOverrides, recoveryStaging, bucket, true);
        LiveMigrationExecutionOptions execution = new LiveMigrationExecutionOptions(
                Path.of(required("BIGBIKE_LIVE_MIGRATION_REVIEWED_PLAN")),
                required("BIGBIKE_LIVE_MIGRATION_REVIEWED_PLAN_SHA256"),
                required("BIGBIKE_LIVE_MIGRATION_EXECUTION_CONFIRMATION"),
                integer("BIGBIKE_LIVE_MIGRATION_BATCH_SIZE", 50));
        String jdbcUrl = value("BIGBIKE_DB_URL",
                "jdbc:postgresql://localhost:5432/" + value("POSTGRES_DB", "bigbike"));
        String dbUser = value("BIGBIKE_DB_USERNAME", value("POSTGRES_USER", "bigbike"));
        String dbPassword = System.getenv("BIGBIKE_DB_PASSWORD");
        if (dbPassword == null || dbPassword.isBlank()) dbPassword = required("POSTGRES_PASSWORD");
        else dbPassword = dbPassword.trim();
        return new RuntimeOptions(preflight, execution, jdbcUrl, dbUser, dbPassword);
    }

    private static MinioClient buildMinio() {
        return MinioClient.builder()
                .endpoint(required("MINIO_ENDPOINT"))
                .credentials(required("MINIO_ROOT_USER"), required("MINIO_ROOT_PASSWORD"))
                .build();
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Required environment variable is missing: " + name);
        }
        return value.trim();
    }

    private static String value(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static boolean boolRequiredTrue(String name) {
        String value = required(name).toLowerCase(Locale.ROOT);
        if (!SetBoolean.TRUE_VALUES.contains(value)) {
            throw new IllegalArgumentException(name + " must explicitly equal true");
        }
        return true;
    }

    private static int integer(String name, int fallback) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) return fallback;
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(name + " must be an integer");
        }
    }

    private static String safeMessage(Exception e) {
        String value = e.getMessage();
        if (value == null || value.isBlank()) return e.getClass().getSimpleName();
        return value.length() > 2_000 ? value.substring(0, 2_000) : value;
    }

    private record RuntimeOptions(
            LiveMigrationPreflightOptions preflightOptions,
            LiveMigrationExecutionOptions executionOptions,
            String jdbcUrl,
            String dbUser,
            String dbPassword) {}

    private static final class SetBoolean {
        private static final java.util.Set<String> TRUE_VALUES = java.util.Set.of("true", "1", "yes");
    }
}
