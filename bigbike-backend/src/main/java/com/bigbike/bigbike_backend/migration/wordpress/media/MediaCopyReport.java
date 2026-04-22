package com.bigbike.bigbike_backend.migration.wordpress.media;

import java.time.Duration;
import java.util.List;

public record MediaCopyReport(
        boolean dryRun,
        long totalFiles,
        long totalSizeBytes,
        long copied,
        long skipped,
        long missingSource,
        long checksumMismatch,
        long failed,
        List<String> missingPaths,
        List<String> errors,
        Duration duration
) {
    public double throughputMbps() {
        long ms = duration.toMillis();
        if (ms == 0 || totalSizeBytes == 0) return 0.0;
        return (totalSizeBytes / (1024.0 * 1024.0)) / (ms / 1000.0);
    }
}
