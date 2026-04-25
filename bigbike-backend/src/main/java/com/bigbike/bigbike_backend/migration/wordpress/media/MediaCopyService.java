package com.bigbike.bigbike_backend.migration.wordpress.media;

import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Phase 2E — streams WordPress media files from the uploads directory into MinIO.
 *
 * Guarantees:
 *  - No file is ever loaded fully into memory (streaming 64 KB chunks).
 *  - Already-copied files are skipped (ETag == MD5 comparison for single-part objects).
 *  - Missing source files are logged and counted but do NOT fail the run.
 *  - Copy is idempotent: repeated runs produce the same result.
 *  - Checksum mismatches (corrupt prior upload) trigger a re-copy.
 *
 * Pass {@code null} for {@code storage} in dry-run mode; no MinIO connection is made.
 */
@Component
public class MediaCopyService {

    private static final Logger log = LoggerFactory.getLogger(MediaCopyService.class);
    private static final int STREAM_BUFFER = 64 * 1024;
    private static final String LEGACY_PROVIDER = "LEGACY_WP";
    private static final String MINIO_PROVIDER = "MINIO";

    private final MediaJpaRepository mediaRepo;
    private final MediaPathResolver pathResolver;
    private final MediaChecksumService checksumService;
    private final MediaUrlProperties mediaUrlProperties;

    public MediaCopyService(
            MediaJpaRepository mediaRepo,
            MediaPathResolver pathResolver,
            MediaChecksumService checksumService,
            MediaUrlProperties mediaUrlProperties) {
        this.mediaRepo = mediaRepo;
        this.pathResolver = pathResolver;
        this.checksumService = checksumService;
        this.mediaUrlProperties = mediaUrlProperties;
    }

    public MediaCopyReport run(MediaCopyOptions options, MediaStoragePort storage) {
        Instant start = Instant.now();

        List<MediaEntity> entities = mediaRepo.findByStorageProvider(LEGACY_PROVIDER);
        log.info("Phase 2E: {} LEGACY_WP media records (dryRun={})", entities.size(), options.dryRun());

        long totalFiles = 0, totalSizeBytes = 0;
        long copied = 0, skipped = 0, missingSource = 0, checksumMismatch = 0, failed = 0;
        List<String> missingPaths = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        if (!options.dryRun()) {
            try {
                storage.ensureBucket(options.bucket());
            } catch (Exception e) {
                errors.add("Cannot ensure bucket '" + options.bucket() + "': " + e.getMessage());
                return new MediaCopyReport(false, 0, 0, 0, 0, 0, 0, 1,
                        List.of(), List.copyOf(errors), Duration.between(start, Instant.now()));
            }
        }

        for (MediaEntity entity : entities) {
            String filePath = entity.getFilePath();
            if (filePath == null || filePath.isBlank()) {
                skipped++;
                continue;
            }

            Path source = pathResolver.sourceFile(options.uploadsDir(), filePath);
            if (!Files.exists(source)) {
                missingSource++;
                missingPaths.add(filePath);
                log.warn("Missing source: {}", source);
                continue;
            }

            long fileSize;
            try {
                fileSize = Files.size(source);
            } catch (IOException e) {
                failed++;
                errors.add(filePath + ": cannot stat: " + e.getMessage());
                continue;
            }

            totalFiles++;
            totalSizeBytes += fileSize;

            if (options.dryRun()) {
                continue;
            }

            String key = pathResolver.storageKey(filePath);
            boolean needsCopy = true;

            try {
                if (storage.exists(options.bucket(), key)) {
                    Optional<String> remoteEtag = storage.etag(options.bucket(), key);
                    if (remoteEtag.isPresent()) {
                        String etagClean = remoteEtag.get().replace("\"", "");
                        if (etagClean.contains("-")) {
                            Optional<Long> remoteSize = storage.objectSize(options.bucket(), key);
                            if (remoteSize.isPresent() && remoteSize.get().equals(fileSize)) {
                                needsCopy = false;
                                skipped++;
                                log.debug("Multipart ETag, size match ({} bytes) — skip {}", fileSize, key);
                            } else {
                                checksumMismatch++;
                                log.warn("Multipart ETag, size MISMATCH (local={} remote={}) — re-copying {}",
                                        fileSize, remoteSize.orElse(-1L), key);
                            }
                        } else {
                            String sourceMd5 = checksumService.md5Hex(source);
                            if (etagClean.equalsIgnoreCase(sourceMd5)) {
                                needsCopy = false;
                                skipped++;
                            } else {
                                checksumMismatch++;
                                log.warn("Checksum mismatch for {} — re-copying", key);
                            }
                        }
                    } else {
                        // ETag unavailable — object exists, trust it
                        needsCopy = false;
                        skipped++;
                    }
                }
            } catch (Exception e) {
                log.warn("Cannot check existence of {} — will copy: {}", key, e.getMessage());
            }

            if (!needsCopy) {
                ensureEntitySynced(entity, options, key, fileSize);
                continue;
            }

            boolean success = copyWithRetry(storage, source, options.bucket(), key,
                    fileSize, entity.getMimeType(), options.maxRetries(), errors, filePath);
            if (success) {
                copied++;
                updateEntity(entity, options, key, fileSize);
            } else {
                failed++;
            }
        }

        Duration duration = Duration.between(start, Instant.now());
        log.info("Phase 2E done: total={} copied={} skipped={} missing={} mismatch={} failed={} {}ms",
                totalFiles, copied, skipped, missingSource, checksumMismatch, failed, duration.toMillis());

        return new MediaCopyReport(
                options.dryRun(), totalFiles, totalSizeBytes,
                copied, skipped, missingSource, checksumMismatch, failed,
                List.copyOf(missingPaths), List.copyOf(errors), duration);
    }

    private boolean copyWithRetry(
            MediaStoragePort storage, Path source, String bucket, String key,
            long size, String mimeType, int maxRetries, List<String> errors, String filePath) {
        String contentType = (mimeType != null && !mimeType.isBlank())
                ? mimeType : "application/octet-stream";

        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            try (InputStream in = new BufferedInputStream(Files.newInputStream(source), STREAM_BUFFER)) {
                storage.put(bucket, key, in, size, contentType);
                return true;
            } catch (Exception e) {
                if (attempt == maxRetries) {
                    String msg = filePath + ": upload failed after " + (maxRetries + 1)
                            + " attempt(s): " + e.getMessage();
                    errors.add(msg);
                    log.error("Upload failed for {}: {}", filePath, e.getMessage());
                    return false;
                }
                log.warn("Upload attempt {}/{} failed for {}: {}",
                        attempt + 1, maxRetries + 1, filePath, e.getMessage());
                try {
                    Thread.sleep(500L * (attempt + 1));
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    errors.add(filePath + ": interrupted during retry");
                    return false;
                }
            }
        }
        return false;
    }

    private void updateEntity(MediaEntity entity, MediaCopyOptions options, String key, long fileSize) {
        entity.setStorageProvider(MINIO_PROVIDER);
        entity.setBucket(options.bucket());
        entity.setFileSize(fileSize);
        entity.setPublicUrl(publicUrlFor(key));
        entity.setUpdatedAt(Instant.now());
        mediaRepo.save(entity);
    }

    private void ensureEntitySynced(MediaEntity entity, MediaCopyOptions options, String key, long fileSize) {
        if (entity.getPublicUrl() == null || entity.getPublicUrl().isBlank()
                || !MINIO_PROVIDER.equals(entity.getStorageProvider())) {
            entity.setStorageProvider(MINIO_PROVIDER);
            entity.setBucket(options.bucket());
            entity.setFileSize(fileSize);
            entity.setPublicUrl(publicUrlFor(key));
            entity.setUpdatedAt(Instant.now());
            mediaRepo.save(entity);
        }
    }

    private String publicUrlFor(String key) {
        String base = mediaUrlProperties.getPublicBaseUrl();
        return base.endsWith("/") ? base + key : base + "/" + key;
    }
}
