package com.bigbike.bigbike_backend.migration.wordpress.media;

import java.nio.file.Path;

public record MediaCopyOptions(
        Path uploadsDir,
        String endpoint,
        String bucket,
        int maxRetries,
        boolean dryRun
) {}
