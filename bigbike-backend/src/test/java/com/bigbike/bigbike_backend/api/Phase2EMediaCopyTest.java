package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.migration.wordpress.media.MediaChecksumService;
import com.bigbike.bigbike_backend.migration.wordpress.media.MediaCopyOptions;
import com.bigbike.bigbike_backend.migration.wordpress.media.MediaCopyReport;
import com.bigbike.bigbike_backend.migration.wordpress.media.MediaCopyService;
import com.bigbike.bigbike_backend.migration.wordpress.media.MediaPathResolver;
import com.bigbike.bigbike_backend.migration.wordpress.media.MediaStoragePort;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

/**
 * Phase 2E — Media Copy &amp; Sync Strategy unit tests.
 *
 * Pure unit tests: no Spring context, no MinIO server, no database.
 * MediaStoragePort and MediaJpaRepository are mocked.
 * Real files are written to a JUnit TempDir for I/O path tests.
 */
class Phase2EMediaCopyTest {

    @TempDir
    Path tempDir;

    MediaJpaRepository mediaRepo;
    MediaPathResolver pathResolver;
    MediaChecksumService checksumService;
    MediaUrlProperties mediaUrlProperties;
    MediaCopyService copyService;
    MediaStoragePort storage;

    private static final String BUCKET = "bigbike-media";
    private static final String ENDPOINT = "http://localhost:9000";

    @BeforeEach
    void setUp() throws Exception {
        mediaRepo = mock(MediaJpaRepository.class);
        pathResolver = new MediaPathResolver();
        checksumService = new MediaChecksumService();
        mediaUrlProperties = new MediaUrlProperties();
        mediaUrlProperties.setPublicBaseUrl("http://localhost:9000/bigbike-media");
        copyService = new MediaCopyService(mediaRepo, pathResolver, checksumService, mediaUrlProperties);
        storage = mock(MediaStoragePort.class);
        doNothing().when(storage).ensureBucket(anyString());
    }

    // -------------------------------------------------------------------------
    // dryRun_reportsCorrectCounts
    // -------------------------------------------------------------------------

    @Test
    void dryRun_reportsCorrectCounts() throws Exception {
        List<MediaEntity> entities = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            Path file = tempDir.resolve("img" + i + ".jpg");
            Files.writeString(file, "content-" + i);
            entities.add(entity(100L + i, "img" + i + ".jpg"));
        }
        when(mediaRepo.findByStorageProvider("LEGACY_WP")).thenReturn(entities);

        MediaCopyOptions opts = new MediaCopyOptions(tempDir, "", BUCKET, 0, true);
        MediaCopyReport report = copyService.run(opts, null);

        assertThat(report.dryRun()).isTrue();
        assertThat(report.totalFiles()).isEqualTo(5);
        assertThat(report.copied()).isEqualTo(0);
        assertThat(report.skipped()).isEqualTo(0);
        assertThat(report.failed()).isEqualTo(0);
        assertThat(report.missingSource()).isEqualTo(0);
        // storage never touched in dry-run
        verify(storage, never()).ensureBucket(anyString());
        verify(storage, never()).put(anyString(), anyString(), any(), anyLong(), anyString());
    }

    // -------------------------------------------------------------------------
    // copy_skipsExistingFiles
    // -------------------------------------------------------------------------

    @Test
    void copy_skipsExistingFiles() throws Exception {
        Path file = tempDir.resolve("photo.jpg");
        Files.writeString(file, "hello-world");
        String expectedMd5 = checksumService.md5Hex(file);

        MediaEntity entity = entity(201L, "photo.jpg");
        when(mediaRepo.findByStorageProvider("LEGACY_WP")).thenReturn(List.of(entity));
        when(storage.exists(BUCKET, "wp-uploads/photo.jpg")).thenReturn(true);
        when(storage.etag(BUCKET, "wp-uploads/photo.jpg")).thenReturn(Optional.of(expectedMd5));

        MediaCopyOptions opts = new MediaCopyOptions(tempDir, ENDPOINT, BUCKET, 0, false);
        MediaCopyReport report = copyService.run(opts, storage);

        assertThat(report.skipped()).isEqualTo(1);
        assertThat(report.copied()).isEqualTo(0);
        assertThat(report.failed()).isEqualTo(0);
        verify(storage, never()).put(anyString(), anyString(), any(), anyLong(), anyString());
    }

    // -------------------------------------------------------------------------
    // copy_isIdempotent
    // -------------------------------------------------------------------------

    @Test
    void copy_isIdempotent() throws Exception {
        Path file = tempDir.resolve("idempotent.jpg");
        Files.writeString(file, "stable-content");
        String md5 = checksumService.md5Hex(file);

        MediaEntity entity = entity(301L, "idempotent.jpg");
        when(mediaRepo.findByStorageProvider("LEGACY_WP")).thenReturn(List.of(entity));

        // First call: object absent → copy
        // Second call: object present with matching ETag → skip
        when(storage.exists(BUCKET, "wp-uploads/idempotent.jpg"))
                .thenReturn(false)
                .thenReturn(true);
        when(storage.etag(BUCKET, "wp-uploads/idempotent.jpg")).thenReturn(Optional.of(md5));

        MediaCopyOptions opts = new MediaCopyOptions(tempDir, ENDPOINT, BUCKET, 0, false);

        MediaCopyReport run1 = copyService.run(opts, storage);
        assertThat(run1.copied()).isEqualTo(1);
        assertThat(run1.failed()).isEqualTo(0);

        MediaCopyReport run2 = copyService.run(opts, storage);
        assertThat(run2.skipped()).isEqualTo(1);
        assertThat(run2.copied()).isEqualTo(0);

        // put() called exactly once across both runs
        verify(storage, times(1)).put(eq(BUCKET), eq("wp-uploads/idempotent.jpg"),
                any(), anyLong(), anyString());
    }

    // -------------------------------------------------------------------------
    // checksum_verified
    // -------------------------------------------------------------------------

    @Test
    void checksum_verified() throws Exception {
        Path file = tempDir.resolve("verify.jpg");
        Files.writeString(file, "actual-content");

        MediaEntity entity = entity(401L, "verify.jpg");
        when(mediaRepo.findByStorageProvider("LEGACY_WP")).thenReturn(List.of(entity));
        when(storage.exists(BUCKET, "wp-uploads/verify.jpg")).thenReturn(true);
        // ETag does NOT match the real file → checksum mismatch → re-copy
        when(storage.etag(BUCKET, "wp-uploads/verify.jpg"))
                .thenReturn(Optional.of("aabbccddeeff00112233445566778899"));

        MediaCopyOptions opts = new MediaCopyOptions(tempDir, ENDPOINT, BUCKET, 0, false);
        MediaCopyReport report = copyService.run(opts, storage);

        assertThat(report.checksumMismatch()).isEqualTo(1);
        assertThat(report.copied()).isEqualTo(1);
        assertThat(report.skipped()).isEqualTo(0);
        verify(storage, times(1)).put(eq(BUCKET), eq("wp-uploads/verify.jpg"),
                any(), anyLong(), anyString());
    }

    // -------------------------------------------------------------------------
    // missingFiles_logged_not_failed
    // -------------------------------------------------------------------------

    @Test
    void missingFiles_logged_not_failed() throws Exception {
        // File path references a file that does NOT exist in tempDir
        MediaEntity entity = entity(501L, "2024/05/missing.jpg");
        when(mediaRepo.findByStorageProvider("LEGACY_WP")).thenReturn(List.of(entity));

        MediaCopyOptions opts = new MediaCopyOptions(tempDir, ENDPOINT, BUCKET, 0, false);
        MediaCopyReport report = copyService.run(opts, storage);

        assertThat(report.missingSource()).isEqualTo(1);
        assertThat(report.failed()).isEqualTo(0);
        assertThat(report.errors()).isEmpty();
        assertThat(report.missingPaths()).containsExactly("2024/05/missing.jpg");
        // File is missing → no copy attempted
        verify(storage, never()).put(anyString(), anyString(), any(), anyLong(), anyString());
    }

    // -------------------------------------------------------------------------
    // largeFile_streaming_no_memory_bloat
    // -------------------------------------------------------------------------

    @Test
    void largeFile_streaming_no_memory_bloat() throws Exception {
        Path file = tempDir.resolve("large.bin");
        byte[] chunk = new byte[1024 * 1024]; // 1 MB
        Arrays.fill(chunk, (byte) 0xAB);
        try (OutputStream out = Files.newOutputStream(file)) {
            for (int i = 0; i < 20; i++) out.write(chunk); // 20 MB
        }

        MediaEntity entity = entity(601L, "large.bin");
        when(mediaRepo.findByStorageProvider("LEGACY_WP")).thenReturn(List.of(entity));
        when(storage.exists(anyString(), anyString())).thenReturn(false);

        ArgumentCaptor<InputStream> streamCaptor = ArgumentCaptor.forClass(InputStream.class);

        MediaCopyOptions opts = new MediaCopyOptions(tempDir, ENDPOINT, BUCKET, 0, false);
        MediaCopyReport report = copyService.run(opts, storage);

        assertThat(report.copied()).isEqualTo(1);
        assertThat(report.failed()).isEqualTo(0);

        verify(storage).put(anyString(), anyString(), streamCaptor.capture(), anyLong(), anyString());
        // Stream must be a file-backed stream, never a byte-array in memory
        assertThat(streamCaptor.getValue()).isNotInstanceOf(ByteArrayInputStream.class);
    }

    // -------------------------------------------------------------------------
    // path_resolver_matches_metadata
    // -------------------------------------------------------------------------

    @Test
    void path_resolver_matches_metadata() {
        MediaPathResolver resolver = new MediaPathResolver();

        // Flat path
        assertThat(resolver.storageKey("image.jpg"))
                .isEqualTo("wp-uploads/image.jpg");

        // Dated WP path
        assertThat(resolver.storageKey("2024/05/photo.jpg"))
                .isEqualTo("wp-uploads/2024/05/photo.jpg");

        // Leading slash is stripped
        assertThat(resolver.storageKey("/2023/12/file.png"))
                .isEqualTo("wp-uploads/2023/12/file.png");

        // Windows-style separators normalised to forward slash
        assertThat(resolver.storageKey("2024\\05\\win.jpg"))
                .isEqualTo("wp-uploads/2024/05/win.jpg");

        // sourceFile resolves against uploads directory
        Path uploadsDir = Path.of("/var/www/html/wp-content/uploads");
        Path source = resolver.sourceFile(uploadsDir, "2024/05/photo.jpg");
        assertThat(source.toString()).contains("2024");
        assertThat(source.getFileName().toString()).isEqualTo("photo.jpg");

        // Public URL assembled correctly
        String url = resolver.publicUrl("http://localhost:9000", "bigbike-media",
                "wp-uploads/2024/05/photo.jpg");
        assertThat(url).isEqualTo(
                "http://localhost:9000/bigbike-media/wp-uploads/2024/05/photo.jpg");

        // Trailing slash on endpoint is trimmed
        String url2 = resolver.publicUrl("http://localhost:9000/", "bigbike-media",
                "wp-uploads/img.jpg");
        assertThat(url2).isEqualTo("http://localhost:9000/bigbike-media/wp-uploads/img.jpg");
    }

    // -------------------------------------------------------------------------
    // checksum_service_streaming
    // -------------------------------------------------------------------------

    @Test
    void checksum_service_streaming() throws IOException {
        Path file = tempDir.resolve("checksum-test.bin");
        Files.writeString(file, "deterministic-content");

        MediaChecksumService svc = new MediaChecksumService();

        String md5a = svc.md5Hex(file);
        String md5b = svc.md5Hex(file);
        assertThat(md5a).isEqualTo(md5b);
        assertThat(md5a).hasSize(32).matches("[0-9a-f]+");

        String sha256 = svc.sha256Hex(file);
        assertThat(sha256).hasSize(64).matches("[0-9a-f]+");

        // Different content → different hash
        Path file2 = tempDir.resolve("checksum-test2.bin");
        Files.writeString(file2, "different-content");
        assertThat(svc.md5Hex(file2)).isNotEqualTo(md5a);
    }

    // -------------------------------------------------------------------------
    // multipart_etag_sizeMatch_skips / sizeMismatch_recopies
    // -------------------------------------------------------------------------

    @Test
    void multipartEtag_sizeMatch_skips() throws Exception {
        Path file = tempDir.resolve("multipart.bin");
        Files.writeString(file, "multipart-content");
        long fileSize = Files.size(file);

        MediaEntity entity = entity(701L, "multipart.bin");
        when(mediaRepo.findByStorageProvider("LEGACY_WP")).thenReturn(List.of(entity));
        when(storage.exists(BUCKET, "wp-uploads/multipart.bin")).thenReturn(true);
        when(storage.etag(BUCKET, "wp-uploads/multipart.bin"))
                .thenReturn(Optional.of("abc123-3"));
        when(storage.objectSize(BUCKET, "wp-uploads/multipart.bin"))
                .thenReturn(Optional.of(fileSize));

        MediaCopyOptions opts = new MediaCopyOptions(tempDir, ENDPOINT, BUCKET, 0, false);
        MediaCopyReport report = copyService.run(opts, storage);

        assertThat(report.skipped()).isEqualTo(1);
        assertThat(report.checksumMismatch()).isEqualTo(0);
        assertThat(report.copied()).isEqualTo(0);
        verify(storage, never()).put(anyString(), anyString(), any(), anyLong(), anyString());
    }

    @Test
    void multipartEtag_sizeMismatch_recopies() throws Exception {
        Path file = tempDir.resolve("multipart-bad.bin");
        Files.writeString(file, "multipart-content");
        long fileSize = Files.size(file);

        MediaEntity entity = entity(801L, "multipart-bad.bin");
        when(mediaRepo.findByStorageProvider("LEGACY_WP")).thenReturn(List.of(entity));
        when(storage.exists(BUCKET, "wp-uploads/multipart-bad.bin")).thenReturn(true);
        when(storage.etag(BUCKET, "wp-uploads/multipart-bad.bin"))
                .thenReturn(Optional.of("abc123-3"));
        when(storage.objectSize(BUCKET, "wp-uploads/multipart-bad.bin"))
                .thenReturn(Optional.of(fileSize - 1));

        MediaCopyOptions opts = new MediaCopyOptions(tempDir, ENDPOINT, BUCKET, 0, false);
        MediaCopyReport report = copyService.run(opts, storage);

        assertThat(report.checksumMismatch()).isEqualTo(1);
        assertThat(report.copied()).isEqualTo(1);
        assertThat(report.skipped()).isEqualTo(0);
        verify(storage, times(1)).put(eq(BUCKET), eq("wp-uploads/multipart-bad.bin"),
                any(), anyLong(), anyString());
    }

    // -------------------------------------------------------------------------
    // helpers
    // -------------------------------------------------------------------------

    private MediaEntity entity(long legacyId, String filePath) {
        MediaEntity e = new MediaEntity();
        e.setLegacyId(legacyId);
        e.setFilePath(filePath);
        e.setMimeType("image/jpeg");
        e.setStorageProvider("LEGACY_WP");
        e.setStatus("ACTIVE");
        e.setCreatedAt(Instant.now());
        e.setUpdatedAt(Instant.now());
        return e;
    }
}
