package com.bigbike.bigbike_backend.migration.wordpress.live;

import java.nio.file.Path;
import java.util.Objects;
import java.util.regex.Pattern;

/** Inputs for the read-only live migration planner. Secrets are deliberately excluded. */
public record LiveMigrationPreflightOptions(
        Path dumpPath,
        Path uploadsPath,
        Path reportDirectory,
        String tablePrefix,
        String snapshotId,
        boolean finalSnapshot,
        boolean freezeConfirmed,
        Path offsiteBackupManifest,
        Path ownerOverridesPath,
        Path recoveryStagingPath,
        String targetMinioBucket,
        boolean hashTargetMedia) {

    private static final Pattern SAFE_PREFIX = Pattern.compile("[A-Za-z0-9_]+");

    public LiveMigrationPreflightOptions {
        Objects.requireNonNull(dumpPath, "dumpPath");
        Objects.requireNonNull(uploadsPath, "uploadsPath");
        Objects.requireNonNull(reportDirectory, "reportDirectory");
        Objects.requireNonNull(ownerOverridesPath, "ownerOverridesPath");
        Objects.requireNonNull(recoveryStagingPath, "recoveryStagingPath");
        tablePrefix = tablePrefix == null ? "" : tablePrefix.trim();
        snapshotId = snapshotId == null ? "" : snapshotId.trim();
        targetMinioBucket = targetMinioBucket == null ? "" : targetMinioBucket.trim();
        if (!SAFE_PREFIX.matcher(tablePrefix).matches()) {
            throw new IllegalArgumentException("WordPress table prefix contains unsafe characters");
        }
        if (snapshotId.isBlank()) {
            throw new IllegalArgumentException("snapshotId is required");
        }
    }
}
