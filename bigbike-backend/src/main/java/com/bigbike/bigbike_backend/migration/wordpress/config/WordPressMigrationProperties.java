package com.bigbike.bigbike_backend.migration.wordpress.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration for the WordPress migration tooling.
 * Disabled by default — must be explicitly enabled for migration runs.
 * Never auto-triggers import on application startup.
 */
@Component
@ConfigurationProperties(prefix = "bigbike.migration.wordpress")
public class WordPressMigrationProperties {

    /** Master switch. Must be true to enable any migration operation. Default: false. */
    private boolean enabled = false;

    /** Path to the WordPress SQL dump file. */
    private String sqlDumpPath = "";

    /** Path to the wp-content/uploads directory. */
    private String uploadsPath = "";

    /** WordPress table prefix. bigbike.vn dump uses kd_ (not the default wp_). */
    private String tablePrefix = "kd_";

    /**
     * Dry-run mode: parse and map but do NOT write to the database.
     * Default: true. Set to false only for real import runs.
     */
    private boolean dryRun = true;

    /**
     * Operation mode for explicit runner activation.
     * Set to "catalog-dry-run" to trigger Phase 2B.1 dry-run via the runner.
     * Default: "" (no runner activated).
     */
    private String mode = "";

    /**
     * Path to the WordPress SQL dump file (alias for sqlDumpPath).
     * Bound from --bigbike.migration.wordpress.dump-path.
     */
    private String dumpPath = "";

    /** Number of rows to process per batch during import. Default: 500. */
    private int batchSize = 500;

    /**
     * Explicit confirmation required for real import execute mode.
     * Must be true for mode=import with dry-run=false to proceed.
     * Default: false.
     */
    private boolean confirmExecute = false;

    /**
     * Comma-separated list of domains to import. Empty = all domains.
     * Example: categories,brands,media,products
     */
    private String domains = "";

    /**
     * Deployment environment. Must be "local" or "staging" to allow real import.
     * Any other value (including blank) blocks real import execution.
     * Default: "" (blocked).
     */
    private String environment = "";

    /**
     * Base URL for legacy WordPress uploads served via CDN/proxy.
     * Used to construct image_url for products and articles during Phase 2D.
     * Example: https://cdn.bigbike.vn/uploads
     */
    private String legacyUploadsBaseUrl = "https://cdn.bigbike.vn/uploads";

    // ---- Phase 2E: media copy to MinIO ----

    /** MinIO API endpoint. Example: http://localhost:9000 */
    private String minioEndpoint = "";

    /** MinIO access key (MINIO_ROOT_USER). */
    private String minioAccessKey = "";

    /** MinIO secret key (MINIO_ROOT_PASSWORD). */
    private String minioSecretKey = "";

    /** MinIO bucket for uploaded media. Example: bigbike-media */
    private String minioBucket = "";

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getSqlDumpPath() { return sqlDumpPath; }
    public void setSqlDumpPath(String sqlDumpPath) { this.sqlDumpPath = sqlDumpPath; }

    public String getUploadsPath() { return uploadsPath; }
    public void setUploadsPath(String uploadsPath) { this.uploadsPath = uploadsPath; }

    public String getTablePrefix() { return tablePrefix; }
    public void setTablePrefix(String tablePrefix) { this.tablePrefix = tablePrefix; }

    public boolean isDryRun() { return dryRun; }
    public void setDryRun(boolean dryRun) { this.dryRun = dryRun; }

    public int getBatchSize() { return batchSize; }
    public void setBatchSize(int batchSize) { this.batchSize = batchSize; }

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }

    public String getDumpPath() { return dumpPath; }
    public void setDumpPath(String dumpPath) { this.dumpPath = dumpPath; }

    public boolean isConfirmExecute() { return confirmExecute; }
    public void setConfirmExecute(boolean confirmExecute) { this.confirmExecute = confirmExecute; }

    public String getDomains() { return domains; }
    public void setDomains(String domains) { this.domains = domains; }

    public String getEnvironment() { return environment; }
    public void setEnvironment(String environment) { this.environment = environment; }

    public String getLegacyUploadsBaseUrl() { return legacyUploadsBaseUrl; }
    public void setLegacyUploadsBaseUrl(String legacyUploadsBaseUrl) { this.legacyUploadsBaseUrl = legacyUploadsBaseUrl; }

    public String getMinioEndpoint() { return minioEndpoint; }
    public void setMinioEndpoint(String minioEndpoint) { this.minioEndpoint = minioEndpoint; }

    public String getMinioAccessKey() { return minioAccessKey; }
    public void setMinioAccessKey(String minioAccessKey) { this.minioAccessKey = minioAccessKey; }

    public String getMinioSecretKey() { return minioSecretKey; }
    public void setMinioSecretKey(String minioSecretKey) { this.minioSecretKey = minioSecretKey; }

    public String getMinioBucket() { return minioBucket; }
    public void setMinioBucket(String minioBucket) { this.minioBucket = minioBucket; }

    /** Returns the resolved dump file path: dumpPath takes precedence over sqlDumpPath. */
    public String resolvedDumpPath() {
        if (dumpPath != null && !dumpPath.isBlank()) return dumpPath;
        return sqlDumpPath;
    }
}
