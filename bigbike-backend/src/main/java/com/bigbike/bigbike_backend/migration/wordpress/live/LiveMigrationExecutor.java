package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationExecutionReport.DomainCounts;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Action;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.ArticlePlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.MediaPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.ProductPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.ProductVideoPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.RedirectPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.TargetContentRewritePlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.TargetMediaChecksumPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.VariantPlan;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressArticleMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressMediaMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressProductMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressVariationMapper;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpAttachmentMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.parser.PhpSerializeParser;
import com.bigbike.bigbike_backend.migration.wordpress.parser.WordPressSqlDumpRowReader;
import com.bigbike.bigbike_backend.migration.wordpress.media.MediaChecksumService;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.errors.ErrorResponseException;
import java.io.BufferedInputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import tools.jackson.databind.ObjectMapper;

/**
 * Atomic production writer. This class is reachable only after
 * {@link LiveMigrationExecutionGate}; every update is a fill-blank predicate.
 * Domain checkpoints are committed together with the data only after post-write validation.
 */
final class LiveMigrationExecutor {

    private static final long ADVISORY_LOCK_KEY = 0x42494742494B454CL; // "BIGBIKEL"
    private static final DomainCounts ZERO = new DomainCounts(0, 0, 0, 0);

    private final ObjectMapper json = new ObjectMapper();
    private final MediaChecksumService checksumService = new MediaChecksumService();
    private final WordPressProductMapper productMapper = new WordPressProductMapper();
    private final WordPressVariationMapper variationMapper = new WordPressVariationMapper();
    private final WordPressArticleMapper articleMapper = new WordPressArticleMapper();
    private final WordPressMediaMapper mediaMapper = new WordPressMediaMapper(new PhpSerializeParser());

    LiveMigrationExecutionReport execute(
            LiveMigrationExecutionGate.ValidatedPlan validated,
            LiveMigrationPreflightOptions sourceOptions,
            LiveMigrationExecutionOptions executionOptions,
            Connection connection,
            MinioClient minioClient) throws Exception {
        if (minioClient == null) throw new IllegalStateException("MinIO client is required for execution");
        if (connection.isReadOnly()) throw new IllegalStateException("Execution connection is read-only");

        var plan = validated.report();
        Instant startedAt = Instant.now();
        UUID runId = deterministicRunId(plan.metadata().snapshotId(), plan.metadata().sourceDumpSha256());
        verifySourceDump(sourceOptions.dumpPath(), plan.metadata().sourceDumpSha256(),
                plan.metadata().sourceDumpBytes());
        var source = new LiveWordPressSnapshotReader(new WordPressSqlDumpRowReader())
                .read(sourceOptions.dumpPath(), sourceOptions.tablePrefix());
        verifySourceDump(sourceOptions.dumpPath(), plan.metadata().sourceDumpSha256(),
                plan.metadata().sourceDumpBytes());
        // Same dead-image set the preflight used, taken from the reviewed plan so the written
        // prose matches what was approved.
        LiveMigrationContentRewriter rewriter = new LiveMigrationContentRewriter(
                plan.redirects(),
                plan.ownerDecisions().unavailableMediaFallbacks().stream()
                        .filter(fallback -> fallback.entityType().startsWith("SOURCE_"))
                        .map(LiveMigrationPreflightReport.UnavailableMediaFallbackPlan::relativePath)
                        .collect(java.util.stream.Collectors.toUnmodifiableSet()));

        connection.setAutoCommit(false);
        connection.setTransactionIsolation(Connection.TRANSACTION_SERIALIZABLE);
        acquireLock(connection);
        boolean resumed = false;
        Map<String, DomainCounts> domains = new LinkedHashMap<>();
        try {
            RunState state = ensureRun(
                    connection, runId, plan, validated.reviewedPlanSha256(),
                    validated.planDigestSha256());
            resumed = state.existed();

            MediaBindings media = buildMediaBindings(
                    connection, plan.media(), source, sourceOptions.uploadsPath(),
                    sourceOptions.targetMinioBucket());
            domains.put("TARGET_MEDIA_CHECKSUMS", executeBatches(
                    connection, runId, "TARGET_MEDIA_CHECKSUMS",
                    actionableTargetChecksums(plan.targetMediaChecksums()),
                    executionOptions.batchSize(), checksum -> writeTargetMediaChecksum(
                            connection, minioClient, checksum)));
            domains.put("MEDIA", executeBatches(
                    connection, runId, "MEDIA", orderedMediaPlans(plan.media()),
                    executionOptions.batchSize(), mediaPlan -> writeMedia(
                            connection, minioClient, media.byPlanKey().get(mediaPlanKey(mediaPlan)), mediaPlan)));
            domains.put("PRODUCTS", executeBatches(
                    connection, runId, "PRODUCTS", actionable(plan.products()),
                    executionOptions.batchSize(), product -> writeProduct(
                            connection, source, product, media, rewriter)));
            domains.put("VARIANTS", executeBatches(
                    connection, runId, "VARIANTS", actionableVariants(plan.variants()),
                    executionOptions.batchSize(), variant -> writeVariant(
                            connection, source, variant, media)));
            domains.put("ARTICLES", executeBatches(
                    connection, runId, "ARTICLES", actionableArticles(plan.articles()),
                    executionOptions.batchSize(), article -> writeArticle(
                            connection, source, article, media, rewriter)));
            domains.put("TARGET_CONTENT_REWRITES", executeBatches(
                    connection, runId, "TARGET_CONTENT_REWRITES",
                    actionableTargetContentRewrites(plan.targetContentRewrites()),
                    executionOptions.batchSize(), rewrite -> writeTargetContentRewrite(
                            connection, rewrite, media, rewriter, plan.ownerDecisions())));
            domains.put("REDIRECTS", executeBatches(
                    connection, runId, "REDIRECTS", actionableRedirects(plan.redirects()),
                    executionOptions.batchSize(), redirect -> writeRedirect(connection, redirect)));

            Map<String, Long> protectedAfter = readProtectedCounts(connection);
            validatePostWrite(connection, plan, media, minioClient, protectedAfter);
            markCompleted(connection, runId);
            connection.commit();
            return new LiveMigrationExecutionReport(
                    runId.toString(), plan.metadata().snapshotId(), startedAt, Instant.now(), resumed,
                    Map.copyOf(domains), plan.targetCounts().protectedDomains(), protectedAfter);
        } catch (Exception e) {
            safeRollback(connection);
            markFailed(
                    connection, runId, plan, validated.reviewedPlanSha256(),
                    validated.planDigestSha256(), safeMessage(e));
            throw e;
        } finally {
            releaseLock(connection);
        }
    }

    private RunState ensureRun(
            Connection connection,
            UUID runId,
            LiveMigrationPreflightReport plan,
            String reviewedPlanSha,
            String planDigest) throws Exception {
        String select = "select run_id::text, source_dump_sha256, reviewed_plan_sha256, "
                + "plan_digest_sha256, status from live_migration_runs where snapshot_id=? for update";
        try (PreparedStatement statement = connection.prepareStatement(select)) {
            statement.setString(1, plan.metadata().snapshotId());
            try (ResultSet rs = statement.executeQuery()) {
                if (rs.next()) {
                    if (!runId.toString().equals(rs.getString(1))
                            || !plan.metadata().sourceDumpSha256().equals(rs.getString(2))
                            || !reviewedPlanSha.equals(rs.getString(3))
                            || !planDigest.equals(rs.getString(4))) {
                        throw new IllegalStateException("Existing migration run is bound to different hashes");
                    }
                    try (PreparedStatement update = connection.prepareStatement(
                            "update live_migration_runs set status='RUNNING', updated_at=now(), last_error=null "
                                    + "where run_id=?")) {
                        if ("COMPLETED".equals(rs.getString(5))) {
                            throw new IllegalStateException("Migration run is already completed");
                        }
                        if (checkpointCount(connection, runId) > 0) {
                            throw new IllegalStateException(
                                    "Migration run has legacy committed checkpoints; manual reconciliation is required");
                        }
                        update.setObject(1, runId);
                        update.executeUpdate();
                    }
                    return new RunState(true, rs.getString(5));
                }
            }
        }

        String sql = "insert into live_migration_runs "
                + "(run_id,snapshot_id,source_dump_sha256,reviewed_plan_sha256,plan_digest_sha256,"
                + "status,protected_counts,started_at,updated_at) "
                + "values (?,?,?,?,?,'RUNNING',cast(? as jsonb),now(),now())";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, runId);
            statement.setString(2, plan.metadata().snapshotId());
            statement.setString(3, plan.metadata().sourceDumpSha256());
            statement.setString(4, reviewedPlanSha);
            statement.setString(5, planDigest);
            statement.setString(6, json.writeValueAsString(plan.targetCounts().protectedDomains()));
            statement.executeUpdate();
        }
        return new RunState(false, "RUNNING");
    }

    private int checkpointCount(Connection connection, UUID runId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "select count(*) from live_migration_checkpoints where run_id=?")) {
            statement.setObject(1, runId);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) throw new SQLException("Could not count migration checkpoints");
                return rs.getInt(1);
            }
        }
    }

    private <T> DomainCounts executeBatches(
            Connection connection,
            UUID runId,
            String domain,
            List<T> rows,
            int batchSize,
            RowWriter<T> writer) throws Exception {
        DomainCounts total = ZERO;
        int batchNumber = 0;
        for (int start = 0; start < rows.size(); start += batchSize, batchNumber++) {
            List<T> batch = rows.subList(start, Math.min(rows.size(), start + batchSize));
            Savepoint savepoint = connection.setSavepoint("live_migration_" + domain + "_" + batchNumber);
            try {
                DomainCounts batchCounts = ZERO;
                for (T row : batch) batchCounts = batchCounts.add(writer.write(row));
                insertCheckpoint(connection, runId, domain, batchNumber, batch.size(), batchCounts);
                connection.releaseSavepoint(savepoint);
                total = total.add(batchCounts);
            } catch (Exception e) {
                connection.rollback(savepoint);
                throw e;
            }
        }
        return total;
    }

    private void insertCheckpoint(
            Connection connection,
            UUID runId,
            String domain,
            int batchNumber,
            int rowCount,
            DomainCounts counts) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "insert into live_migration_checkpoints "
                        + "(run_id,domain,batch_number,row_count,result,committed_at) "
                        + "values (?,?,?,?,cast(? as jsonb),now())")) {
            statement.setObject(1, runId);
            statement.setString(2, domain);
            statement.setInt(3, batchNumber);
            statement.setInt(4, rowCount);
            statement.setString(5, json.writeValueAsString(counts));
            statement.executeUpdate();
        }
    }

    private void acquireLock(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("select pg_try_advisory_lock(?)")) {
            statement.setLong(1, ADVISORY_LOCK_KEY);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next() || !rs.getBoolean(1)) {
                    throw new IllegalStateException("Another BigBike live migration session holds the lock");
                }
            }
        }
    }

    private void releaseLock(Connection connection) {
        try (PreparedStatement statement = connection.prepareStatement("select pg_advisory_unlock(?)")) {
            statement.setLong(1, ADVISORY_LOCK_KEY);
            statement.execute();
        } catch (Exception ignored) {
            // Connection close also releases the session-scoped lock.
        }
    }

    private void markCompleted(Connection connection, UUID runId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "update live_migration_runs set status='COMPLETED',completed_at=now(),updated_at=now(),"
                        + "last_error=null where run_id=?")) {
            statement.setObject(1, runId);
            statement.executeUpdate();
        }
    }

    private void markFailed(
            Connection connection,
            UUID runId,
            LiveMigrationPreflightReport plan,
            String reviewedPlanSha,
            String planDigest,
            String error) {
        try {
            connection.setAutoCommit(false);
            try (PreparedStatement insert = connection.prepareStatement(
                    "insert into live_migration_runs "
                            + "(run_id,snapshot_id,source_dump_sha256,reviewed_plan_sha256,plan_digest_sha256,"
                            + "status,protected_counts,started_at,updated_at,last_error) "
                            + "values (?,?,?,?,?,'FAILED',cast(? as jsonb),now(),now(),?) "
                            + "on conflict do nothing")) {
                insert.setObject(1, runId);
                insert.setString(2, plan.metadata().snapshotId());
                insert.setString(3, plan.metadata().sourceDumpSha256());
                insert.setString(4, reviewedPlanSha);
                insert.setString(5, planDigest);
                insert.setString(6, json.writeValueAsString(plan.targetCounts().protectedDomains()));
                insert.setString(7, error);
                insert.executeUpdate();
            }
            try (PreparedStatement statement = connection.prepareStatement(
                    "update live_migration_runs set status='FAILED',updated_at=now(),last_error=? "
                            + "where run_id=? and source_dump_sha256=? and reviewed_plan_sha256=? "
                            + "and plan_digest_sha256=? and status<>'COMPLETED'")) {
                statement.setString(1, error);
                statement.setObject(2, runId);
                statement.setString(3, plan.metadata().sourceDumpSha256());
                statement.setString(4, reviewedPlanSha);
                statement.setString(5, planDigest);
                statement.executeUpdate();
            }
            connection.commit();
        } catch (Exception ignored) {
            safeRollback(connection);
        }
    }

    private MediaBindings buildMediaBindings(
            Connection connection,
            List<MediaPlan> plans,
            LiveWordPressSnapshotReader.Snapshot source,
            Path uploadsRoot,
            String defaultBucket) throws Exception {
        Map<String, MediaBinding> newByTargetId = new HashMap<>();
        Map<String, MediaBinding> byPlanKey = new LinkedHashMap<>();
        Map<Long, MediaBinding> byAttachment = new HashMap<>();
        Map<String, MediaBinding> byRelative = new HashMap<>();

        for (MediaPlan plan : plans) {
            if (plan.action() == Action.SKIP || plan.action() == Action.CONFLICT) continue;
            Path sourcePath = resolveSourcePath(uploadsRoot, requiredRelative(plan.sourceRelativePath()));
            if (plan.fileSize() == null || Files.size(sourcePath) != plan.fileSize()
                    || !required(plan.sha256(), "planned media SHA-256")
                            .equals(checksumService.sha256Hex(sourcePath))) {
                throw new IllegalStateException(
                        "Source media changed after review: " + plan.sourceRelativePath());
            }
        }

        for (MediaPlan plan : plans) {
            if (plan.action() != Action.INSERT) continue;
            MediaBinding binding = newMediaBinding(plan, source, uploadsRoot, defaultBucket);
            newByTargetId.put(plan.targetMediaId(), binding);
        }
        for (MediaPlan plan : plans) {
            if (plan.action() == Action.SKIP || plan.action() == Action.CONFLICT) continue;
            MediaBinding binding;
            if (plan.action() == Action.INSERT) {
                binding = newByTargetId.get(plan.targetMediaId());
            } else {
                MediaBinding planned = newByTargetId.get(plan.targetMediaId());
                binding = planned == null
                        ? existingMediaBinding(connection, plan, source, uploadsRoot, defaultBucket)
                        : mergeSourceMetadata(planned, plan, source, uploadsRoot);
            }
            if (binding == null) throw new IllegalStateException("No media binding for " + plan.sourceRelativePath());
            byPlanKey.put(mediaPlanKey(plan), binding);
            if (plan.sourceAttachmentId() != null) byAttachment.put(plan.sourceAttachmentId(), binding);
            String relative = LiveMediaPlanner.normalizeRelativePath(plan.sourceRelativePath());
            if (relative != null) byRelative.put(relative, binding);
        }
        Map<String, String> publicUrls = byRelative.entrySet().stream().collect(Collectors.toMap(
                Map.Entry::getKey, entry -> entry.getValue().publicUrl(), (a, b) -> a));
        // byAttachment is looked up with attachment ids that are legitimately absent — a product
        // or article with no thumbnail/OG image yields a null id, and setAsset() already writes
        // NULL columns for a null binding. Map.copyOf would throw on get(null), so keep a
        // null-key-tolerant unmodifiable view instead.
        return new MediaBindings(
                Map.copyOf(byPlanKey), java.util.Collections.unmodifiableMap(byAttachment),
                Map.copyOf(byRelative), Map.copyOf(publicUrls));
    }

    private DomainCounts writeTargetMediaChecksum(
            Connection connection,
            MinioClient minio,
            TargetMediaChecksumPlan plan) throws Exception {
        String bucket = required(plan.bucket(), "target media bucket");
        String objectKey = required(plan.objectKey(), "target media object key");
        String expectedSha = required(plan.sha256(), "target media SHA-256");
        if (!expectedSha.matches("[0-9a-f]{64}")) {
            throw new IllegalStateException("Reviewed target media SHA-256 is malformed");
        }
        var stat = minio.statObject(
                StatObjectArgs.builder().bucket(bucket).object(objectKey).build());
        if (plan.objectBytes() == null || stat.size() != plan.objectBytes()) {
            throw new IllegalStateException(
                    "Target media object size changed after review: " + plan.targetMediaId());
        }
        String actualSha = hashObject(minio, bucket, objectKey);
        if (!expectedSha.equals(actualSha)) {
            throw new IllegalStateException(
                    "Target media object checksum changed after review: " + plan.targetMediaId());
        }
        if (plan.action() == Action.PRESERVE) {
            return new DomainCounts(0, 0, 1, 0);
        }
        if (plan.action() != Action.UPDATE_FILL_BLANKS) {
            throw new IllegalStateException(
                    "Unapproved target media checksum action: " + plan.action());
        }
        String sql = "update media set content_sha256=coalesce(content_sha256,?),"
                + "file_size=coalesce(file_size,?),updated_at=now() "
                + "where id::text=? and (content_sha256 is null or content_sha256=?) "
                + "and (file_size is null or file_size=?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, expectedSha);
            statement.setLong(2, plan.objectBytes());
            statement.setString(3, plan.targetMediaId());
            statement.setString(4, expectedSha);
            statement.setLong(5, plan.objectBytes());
            assertOne(statement.executeUpdate(), "target media checksum fill", plan.targetMediaId());
        }
        return new DomainCounts(0, 1, 0, 0);
    }

    private MediaBinding newMediaBinding(
            MediaPlan plan,
            LiveWordPressSnapshotReader.Snapshot source,
            Path uploadsRoot,
            String bucket) throws Exception {
        SourceMediaMetadata metadata = sourceMediaMetadata(plan, source);
        String relative = requiredRelative(plan.sourceRelativePath());
        Path sourcePath = resolveSourcePath(uploadsRoot, relative);
        String objectKey = LiveMediaPlanner.migrationObjectKey(plan.sha256(), relative);
        return new MediaBinding(
                plan.targetMediaId(), plan.sourceAttachmentId(), relative, plan.sha256(),
                plan.fileSize(), sourcePath, objectKey, "/media/" + objectKey, bucket,
                metadata.mimeType(), metadata.altText(), metadata.title(),
                metadata.width(), metadata.height(), true);
    }

    private MediaBinding existingMediaBinding(
            Connection connection,
            MediaPlan plan,
            LiveWordPressSnapshotReader.Snapshot source,
            Path uploadsRoot,
            String defaultBucket) throws Exception {
        String sql = "select id::text,legacy_id,file_path,public_url,storage_provider,bucket,mime_type,file_size,"
                + "width,height,alt_text,title from media where id::text=?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, plan.targetMediaId());
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    throw new IllegalStateException("Reviewed target media row disappeared: " + plan.targetMediaId());
                }
                SourceMediaMetadata metadata = sourceMediaMetadata(plan, source);
                String relative = requiredRelative(plan.sourceRelativePath());
                Path sourcePath = resolveSourcePath(uploadsRoot, relative);
                String objectKey = objectKey(
                        rs.getString("storage_provider"), rs.getString("file_path"), rs.getString("public_url"));
                if (objectKey == null) {
                    throw new IllegalStateException("Target media has no usable object key: " + plan.targetMediaId());
                }
                String publicUrl = trimToNull(rs.getString("public_url"));
                if (publicUrl == null && objectKey != null) publicUrl = "/media/" + objectKey;
                if (publicUrl == null) {
                    throw new IllegalStateException("Target media has no usable public URL: " + plan.targetMediaId());
                }
                return new MediaBinding(
                        plan.targetMediaId(), plan.sourceAttachmentId(), relative, plan.sha256(),
                        plan.fileSize(), sourcePath, objectKey, publicUrl,
                        firstNonBlank(rs.getString("bucket"), defaultBucket),
                        firstNonBlank(rs.getString("mime_type"), metadata.mimeType()),
                        firstNonBlank(rs.getString("alt_text"), metadata.altText()),
                        firstNonBlank(rs.getString("title"), metadata.title()),
                        nullableInt(rs, "width", metadata.width()),
                        nullableInt(rs, "height", metadata.height()), false);
            }
        }
    }

    private MediaBinding mergeSourceMetadata(
            MediaBinding planned,
            MediaPlan plan,
            LiveWordPressSnapshotReader.Snapshot source,
            Path uploadsRoot) throws Exception {
        SourceMediaMetadata metadata = sourceMediaMetadata(plan, source);
        String relative = requiredRelative(plan.sourceRelativePath());
        return new MediaBinding(
                planned.targetId(), plan.sourceAttachmentId(), relative, planned.sha256(),
                planned.fileSize(), resolveSourcePath(uploadsRoot, relative), planned.objectKey(),
                planned.publicUrl(), planned.bucket(),
                firstNonBlank(planned.mimeType(), metadata.mimeType()),
                firstNonBlank(planned.altText(), metadata.altText()),
                firstNonBlank(planned.title(), metadata.title()),
                planned.width() == null ? metadata.width() : planned.width(),
                planned.height() == null ? metadata.height() : planned.height(), true);
    }

    private SourceMediaMetadata sourceMediaMetadata(
            MediaPlan plan, LiveWordPressSnapshotReader.Snapshot source) throws Exception {
        WpPost attachment = plan.sourceAttachmentId() == null
                ? null : source.postsById().get(plan.sourceAttachmentId());
        if (attachment == null) {
            String name = Path.of(requiredRelative(plan.sourceRelativePath())).getFileName().toString();
            String mime = Files.probeContentType(Path.of(requiredRelative(plan.sourceRelativePath())));
            return new SourceMediaMetadata(
                    firstNonBlank(mime, "application/octet-stream"), null, name, null, null);
        }
        Map<String, String> meta = source.meta(attachment.id());
        var mapped = mediaMapper.map(new WpAttachmentMeta(
                attachment.id(), meta.get("_wp_attached_file"), attachment.postMimeType(),
                meta.get("_wp_attachment_image_alt"), attachment.postTitle(),
                meta.get("_wp_attachment_metadata")));
        return new SourceMediaMetadata(
                mapped.mimeType(), trimToNull(mapped.altText()), trimToNull(mapped.title()),
                mapped.width(), mapped.height());
    }

    private DomainCounts writeMedia(
            Connection connection,
            MinioClient minio,
            MediaBinding binding,
            MediaPlan plan) throws Exception {
        if (binding == null) throw new IllegalStateException("Missing media binding");
        if (plan.action() == Action.INSERT) {
            ensureObject(minio, binding);
            String sql = "insert into media "
                    + "(id,legacy_id,file_path,public_url,storage_provider,bucket,mime_type,file_size,"
                    + "content_sha256,width,height,alt_text,title,status,created_at,updated_at) "
                    + "values (?::uuid,?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',now(),now())";
            try (PreparedStatement statement = connection.prepareStatement(sql)) {
                int i = 1;
                statement.setString(i++, binding.targetId());
                setNullableLong(statement, i++, binding.legacyId());
                statement.setString(i++, binding.objectKey());
                statement.setString(i++, binding.publicUrl());
                statement.setString(i++, "MINIO");
                statement.setString(i++, binding.bucket());
                statement.setString(i++, binding.mimeType());
                setNullableLong(statement, i++, binding.fileSize());
                statement.setString(i++, binding.sha256());
                setNullableInt(statement, i++, binding.width());
                setNullableInt(statement, i++, binding.height());
                statement.setString(i++, binding.altText());
                statement.setString(i, binding.title());
                assertOne(statement.executeUpdate(), "media insert", binding.targetId());
            }
            return new DomainCounts(1, 0, 0, 0);
        }

        String sql = "update media set "
                + "content_sha256=coalesce(content_sha256,?),"
                + "public_url=coalesce(nullif(btrim(public_url),''),?),"
                + "bucket=coalesce(nullif(btrim(bucket),''),?),"
                + "mime_type=coalesce(nullif(btrim(mime_type),''),?),"
                + "file_size=coalesce(file_size,?),width=coalesce(width,?),height=coalesce(height,?),"
                + "alt_text=coalesce(nullif(btrim(alt_text),''),?),"
                + "title=coalesce(nullif(btrim(title),''),?),updated_at=now() "
                + "where id::text=? and (content_sha256 is null or content_sha256=?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int i = 1;
            statement.setString(i++, binding.sha256());
            statement.setString(i++, binding.publicUrl());
            statement.setString(i++, binding.bucket());
            statement.setString(i++, binding.mimeType());
            setNullableLong(statement, i++, binding.fileSize());
            setNullableInt(statement, i++, binding.width());
            setNullableInt(statement, i++, binding.height());
            statement.setString(i++, binding.altText());
            statement.setString(i++, binding.title());
            statement.setString(i++, binding.targetId());
            statement.setString(i, binding.sha256());
            assertOne(statement.executeUpdate(), "media checksum fill", binding.targetId());
        }
        return new DomainCounts(0, 0, 1, 0);
    }

    private void ensureObject(MinioClient minio, MediaBinding binding) throws Exception {
        boolean exists = true;
        try {
            minio.statObject(StatObjectArgs.builder()
                    .bucket(binding.bucket()).object(binding.objectKey()).build());
        } catch (ErrorResponseException e) {
            String code = e.errorResponse() == null ? "" : e.errorResponse().code();
            if (Set.of("NoSuchKey", "NoSuchObject", "NoSuchFile").contains(code)) exists = false;
            else throw e;
        }
        if (exists) {
            String actual = hashObject(minio, binding.bucket(), binding.objectKey());
            if (!binding.sha256().equals(actual)) {
                throw new IllegalStateException("Content-addressed MinIO key exists with different bytes");
            }
            return;
        }
        try (InputStream in = new BufferedInputStream(Files.newInputStream(binding.sourcePath()), 64 * 1024)) {
            minio.putObject(PutObjectArgs.builder()
                    .bucket(binding.bucket()).object(binding.objectKey())
                    .stream(in, binding.fileSize(), -1).contentType(binding.mimeType()).build());
        }
        String actual = hashObject(minio, binding.bucket(), binding.objectKey());
        if (!binding.sha256().equals(actual)) {
            throw new IllegalStateException("Uploaded MinIO object checksum mismatch");
        }
    }

    private String hashObject(MinioClient minio, String bucket, String objectKey) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream raw = minio.getObject(
                     GetObjectArgs.builder().bucket(bucket).object(objectKey).build());
             InputStream in = new BufferedInputStream(raw, 64 * 1024)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) >= 0) if (read > 0) digest.update(buffer, 0, read);
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private String hashText(String value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
    }

    private DomainCounts writeProduct(
            Connection connection,
            LiveWordPressSnapshotReader.Snapshot source,
            ProductPlan plan,
            MediaBindings media,
            LiveMigrationContentRewriter rewriter) throws Exception {
        WpPost post = requiredPost(source, plan.sourceId(), "product");
        Map<String, String> meta = source.meta(plan.sourceId());
        var mapped = productMapper.map(
                post, source.metaByPost().getOrDefault(plan.sourceId(), List.of()));
        if (plan.action() == Action.INSERT) {
            insertProduct(connection, plan, post, meta, mapped, media, rewriter);
            return new DomainCounts(1, 0, 0, 0);
        }
        if ("DOWNGRADE_CONFIRMED_LEGACY_TO_DRAFT".equals(plan.statusDecision())) {
            downgradeConfirmedLegacyProduct(connection, plan);
        } else if ("OWNER_OVERRIDE_FORCE_DRAFT_SCS_S10X".equals(plan.statusDecision())) {
            forceOwnerSelectedProductDraft(connection, plan);
        }
        for (String field : plan.fieldsToFill()) {
            fillProductField(connection, plan, post, meta, mapped, media, rewriter, field);
        }
        return new DomainCounts(0, 1, 0, 0);
    }

    private void downgradeConfirmedLegacyProduct(Connection connection, ProductPlan plan) throws Exception {
        if (plan.targetCreatedAt() == null || plan.targetUpdatedAt() == null
                || !"EXACT_LEGACY_ID_AND_DETERMINISTIC_ID".equals(plan.targetProvenance())
                || plan.targetAdminAuditCount() != 0) {
            throw new IllegalStateException(
                    "Reviewed legacy status downgrade lacks exact provenance: " + plan.targetId());
        }
        String auditNeedle = "%" + plan.targetId() + "%";
        String sql = "update products set publish_status='DRAFT',updated_at=now() "
                + "where id=? and legacy_id=? and publish_status='PUBLISHED' "
                + "and created_at=? and updated_at=? and not exists ("
                + "select 1 from audit_logs where upper(resource_type)='PRODUCT' and ("
                + "coalesce(before_data,'') like ? or coalesce(after_data,'') like ?))";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, plan.targetId());
            statement.setString(2, Long.toString(plan.sourceId()));
            statement.setTimestamp(3, Timestamp.from(plan.targetCreatedAt()));
            statement.setTimestamp(4, Timestamp.from(plan.targetUpdatedAt()));
            statement.setString(5, auditNeedle);
            statement.setString(6, auditNeedle);
            assertOne(statement.executeUpdate(), "confirmed legacy product status downgrade", plan.targetId());
        }

        UUID auditId = UUID.nameUUIDFromBytes(
                ("bigbike-live-migration:legacy-status:" + plan.targetId())
                        .getBytes(StandardCharsets.UTF_8));
        Map<String, String> before = Map.of(
                "id", plan.targetId(), "publishStatus", "PUBLISHED");
        Map<String, String> after = Map.of(
                "id", plan.targetId(), "publishStatus", "DRAFT");
        try (PreparedStatement statement = connection.prepareStatement(
                "insert into audit_logs "
                        + "(id,actor_type,action,resource_type,resource_id,before_data,after_data,created_at) "
                        + "values (?,'SYSTEM','LIVE_MIGRATION_LEGACY_STATUS_DOWNGRADED',"
                        + "'PRODUCT',null,?,?,now())")) {
            statement.setObject(1, auditId);
            statement.setString(2, json.writeValueAsString(before));
            statement.setString(3, json.writeValueAsString(after));
            assertOne(statement.executeUpdate(), "legacy product status audit", plan.targetId());
        }
    }

    private void forceOwnerSelectedProductDraft(
            Connection connection, ProductPlan plan) throws Exception {
        if (plan.sourceId() != 41038L
                || !"SCS-S10X".equals(LiveMigrationPreflightService.normalizeSku(plan.sourceSku()))
                || plan.targetCreatedAt() == null || plan.targetUpdatedAt() == null) {
            throw new IllegalStateException(
                    "Owner SCS-S10X status override lacks exact reviewed evidence: " + plan.targetId());
        }
        String currentStatus = scalarString(
                connection, "select publish_status from products where id=?", plan.targetId());
        if ("DRAFT".equals(currentStatus)) {
            throw new IllegalStateException("Owner SCS-S10X target status drifted to DRAFT after review");
        }
        String sql = "update products set publish_status='DRAFT',updated_at=now() "
                + "where id=? and lower(btrim(sku))=lower(?) and publish_status=? "
                + "and created_at=? and updated_at=?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, plan.targetId());
            statement.setString(2, plan.sourceSku());
            statement.setString(3, currentStatus);
            statement.setTimestamp(4, Timestamp.from(plan.targetCreatedAt()));
            statement.setTimestamp(5, Timestamp.from(plan.targetUpdatedAt()));
            assertOne(statement.executeUpdate(), "owner SCS-S10X status override", plan.targetId());
        }
        UUID auditId = UUID.nameUUIDFromBytes(
                ("bigbike-live-migration:owner-scs-s10x-status:" + plan.targetId())
                        .getBytes(StandardCharsets.UTF_8));
        Map<String, String> before = Map.of(
                "id", plan.targetId(), "publishStatus", currentStatus,
                "sourceId", Long.toString(plan.sourceId()));
        Map<String, String> after = Map.of(
                "id", plan.targetId(), "publishStatus", "DRAFT",
                "sourceId", Long.toString(plan.sourceId()));
        try (PreparedStatement statement = connection.prepareStatement(
                "insert into audit_logs "
                        + "(id,actor_type,action,resource_type,resource_id,before_data,after_data,created_at) "
                        + "values (?,'SYSTEM','LIVE_MIGRATION_OWNER_SCS_S10X_FORCED_DRAFT',"
                        + "'PRODUCT',null,?,?,now())")) {
            statement.setObject(1, auditId);
            statement.setString(2, json.writeValueAsString(before));
            statement.setString(3, json.writeValueAsString(after));
            assertOne(statement.executeUpdate(), "owner SCS-S10X status audit", plan.targetId());
        }
    }

    private void insertProduct(
            Connection connection,
            ProductPlan plan,
            WpPost post,
            Map<String, String> meta,
            WordPressProductMapper.MappedProduct mapped,
            MediaBindings media,
            LiveMigrationContentRewriter rewriter) throws Exception {
        MediaBinding image = media.byAttachment().get(mapped.thumbnailId());
        MediaBinding og = media.byAttachment().get(firstOgAttachmentId(meta));
        BigDecimal retail = LiveMigrationPreflightService.sourceRetailPrice(
                mapped.regularPrice(), mapped.price());
        BigDecimal sale = LiveMigrationPreflightService.sourceSalePrice(
                mapped.regularPrice(), mapped.price(), mapped.salePrice());
        String brandId = requiredBrandId(connection, plan.targetBrandSlug());
        var translation = plan.translation();
        // The owner supplies Vietnamese wording only for published English-only products; for a
        // Polylang pair the Vietnamese source row is already the primary one.
        String description = rewriter.rewriteHtml(
                translation != null && hasText(translation.descriptionVi())
                        ? translation.descriptionVi() : mapped.description(),
                media.publicUrlsByRelative());
        String shortDescription = rewriter.rewriteHtml(
                translation != null && hasText(translation.shortDescriptionVi())
                        ? translation.shortDescriptionVi() : post.postExcerpt(),
                media.publicUrlsByRelative());
        String name = translation != null && hasText(translation.nameVi())
                ? translation.nameVi() : mapped.name();
        String seoTitle = translation != null && hasText(translation.seoTitleVi())
                ? translation.seoTitleVi() : mapped.seoTitle();
        String seoDescription = translation != null && hasText(translation.seoDescriptionVi())
                ? translation.seoDescriptionVi() : mapped.seoDescription();
        // English wording goes through the very same rewrite as the primary text, otherwise a
        // legacy WordPress link would survive in the *_en columns and fail the post-write scan.
        String descriptionEn = translation == null ? null
                : rewriter.rewriteHtml(translation.descriptionEn(), media.publicUrlsByRelative());
        String shortDescriptionEn = translation == null ? null
                : rewriter.rewriteHtml(translation.shortDescriptionEn(), media.publicUrlsByRelative());
        String canonical = rewriter.rewriteCanonical(sourceCanonical(meta),
                "/product/" + plan.targetSlug() + "/");
        Instant createdAt = sourceInstant(post);
        String gallery = productGalleryJson(mapped.galleryIds(), media);
        String videos = productVideosJson(plan.videos(), media);
        boolean available = sourceAvailable(mapped.stockStatus());

        String columns = "id,legacy_id,sku,slug,name,short_description,description,brand_id,"
                + "image_id,image_url,image_alt,image_width,image_height,image_mime_type,"
                + "retail_price,sale_price,currency,stock_state,stock_quantity,manage_stock,backorders,"
                + "length_cm,width_cm,height_cm,publish_status,seo_title,seo_description,seo_canonical_url,"
                + "seo_og_image_id,seo_og_image_url,seo_og_image_alt,seo_og_image_width,"
                + "seo_og_image_height,seo_og_image_mime_type,created_at,updated_at,weight_kg,"
                + "homepage_block,gender_male,gender_female,gallery,videos,available,discount_percent_override,"
                + "name_en,slug_en,short_description_en,description_en,"
                + "seo_title_en,seo_description_en";
        String values = String.join(",", java.util.Collections.nCopies(38, "?"))
                + ",?,?"
                + ",cast(? as jsonb),cast(? as jsonb),?,?,?,?,?,?,?,?";
        try (PreparedStatement statement = connection.prepareStatement(
                "insert into products (" + columns + ") values (" + values + ")")) {
            int i = 1;
            statement.setString(i++, plan.targetId());
            statement.setString(i++, Long.toString(plan.sourceId()));
            statement.setString(i++, required(plan.sourceSku(), "product SKU"));
            statement.setString(i++, required(plan.targetSlug(), "product slug"));
            statement.setString(i++, required(name, "product name"));
            statement.setString(i++, trimToNull(shortDescription));
            statement.setString(i++, trimToNull(description));
            statement.setString(i++, brandId);
            i = setAsset(statement, i, image);
            if (retail == null || retail.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalStateException(
                        "Reviewed product has no positive source retail price: " + plan.sourceId());
            }
            statement.setBigDecimal(i++, retail);
            statement.setBigDecimal(i++, sale);
            statement.setString(i++, "VND");
            statement.setString(i++, available ? "IN_STOCK" : "OUT_OF_STOCK");
            setNullableInt(statement, i++, mapped.stockQuantity());
            setNullableBoolean(statement, i++, mapped.manageStock());
            statement.setString(i++, trimToNull(mapped.backorders()));
            statement.setBigDecimal(i++, mapped.lengthCm());
            statement.setBigDecimal(i++, mapped.widthCm());
            statement.setBigDecimal(i++, mapped.heightCm());
            statement.setString(i++, "DRAFT");
            statement.setString(i++, trimToNull(seoTitle));
            statement.setString(i++, trimToNull(seoDescription));
            statement.setString(i++, canonical);
            i = setAsset(statement, i, og);
            statement.setTimestamp(i++, Timestamp.from(createdAt));
            statement.setTimestamp(i++, Timestamp.from(createdAt));
            statement.setBigDecimal(i++, mapped.weightKg());
            statement.setString(i++, "NONE");
            statement.setBoolean(i++, hasGender(plan.targetGender(), "Nam"));
            statement.setBoolean(i++, hasGender(plan.targetGender(), "Nữ"));
            statement.setString(i++, gallery);
            statement.setString(i++, videos);
            statement.setBoolean(i++, available);
            statement.setBigDecimal(i++, mapped.discountPercentOverride());
            statement.setString(i++, translation == null ? null : trimToNull(translation.nameEn()));
            statement.setString(i++, translation == null ? null : trimToNull(translation.slugEn()));
            statement.setString(i++, trimToNull(shortDescriptionEn));
            statement.setString(i++, trimToNull(descriptionEn));
            statement.setString(i++,
                    translation == null ? null : trimToNull(translation.seoTitleEn()));
            statement.setString(i++,
                    translation == null ? null : trimToNull(translation.seoDescriptionEn()));
            if (i != 51) throw new IllegalStateException("Product insert binding count drift");
            assertOne(statement.executeUpdate(), "product insert", plan.targetId());
        }
        insertProductCategories(connection, plan.targetId(), plan.targetCategorySlugs());
    }

    private void fillProductField(
            Connection connection,
            ProductPlan plan,
            WpPost post,
            Map<String, String> meta,
            WordPressProductMapper.MappedProduct mapped,
            MediaBindings media,
            LiveMigrationContentRewriter rewriter,
            String field) throws Exception {
        if (field.startsWith("categoryIds:")) {
            insertProductCategory(connection, plan.targetId(), field.substring("categoryIds:".length()));
            return;
        }
        switch (field) {
            case "legacyId" -> updateBlankString(connection, "products", "legacy_id",
                    Long.toString(plan.sourceId()), plan.targetId());
            case "sku" -> updateBlankString(connection, "products", "sku", plan.sourceSku(), plan.targetId());
            case "name" -> updateBlankString(connection, "products", "name", mapped.name(), plan.targetId());
            case "shortDescription" -> updateBlankString(connection, "products", "short_description",
                    rewriter.rewriteHtml(post.postExcerpt(), media.publicUrlsByRelative()), plan.targetId());
            case "description" -> updateBlankString(connection, "products", "description",
                    rewriter.rewriteHtml(mapped.description(), media.publicUrlsByRelative()), plan.targetId());
            case "retailPrice" -> updateMissingPrice(connection, "products",
                    LiveMigrationPreflightService.sourceRetailPrice(mapped.regularPrice(), mapped.price()),
                    plan.targetId());
            case "salePrice" -> updateNullValue(connection, "products", "sale_price",
                    LiveMigrationPreflightService.sourceSalePrice(
                            mapped.regularPrice(), mapped.price(), mapped.salePrice()), plan.targetId());
            case "stockQuantity" -> updateNullValue(
                    connection, "products", "stock_quantity", mapped.stockQuantity(), plan.targetId());
            case "manageStock" -> updateNullValue(
                    connection, "products", "manage_stock", mapped.manageStock(), plan.targetId());
            case "backorders" -> updateBlankString(
                    connection, "products", "backorders", mapped.backorders(), plan.targetId());
            case "weightKg" -> updateNullValue(
                    connection, "products", "weight_kg", mapped.weightKg(), plan.targetId());
            case "lengthCm" -> updateNullValue(
                    connection, "products", "length_cm", mapped.lengthCm(), plan.targetId());
            case "widthCm" -> updateNullValue(
                    connection, "products", "width_cm", mapped.widthCm(), plan.targetId());
            case "heightCm" -> updateNullValue(
                    connection, "products", "height_cm", mapped.heightCm(), plan.targetId());
            case "seoTitle" -> updateBlankString(
                    connection, "products", "seo_title", mapped.seoTitle(), plan.targetId());
            case "seoDescription" -> updateBlankString(
                    connection, "products", "seo_description", mapped.seoDescription(), plan.targetId());
            case "seoCanonicalUrl" -> updateBlankString(connection, "products", "seo_canonical_url",
                    rewriter.rewriteCanonical(sourceCanonical(meta),
                            "/product/" + plan.targetSlug() + "/"), plan.targetId());
            case "brandId" -> updateNullValue(connection, "products", "brand_id",
                    requiredBrandId(connection, plan.targetBrandSlug()), plan.targetId());
            case "gender" -> updateProductGenderFlags(
                    connection, plan.targetGender(), plan.targetId());
            case "image" -> updateProductAsset(connection, plan.targetId(), "image",
                    requiredMedia(media.byAttachment().get(mapped.thumbnailId()), "product image"));
            case "seoOgImage" -> updateProductAsset(connection, plan.targetId(), "seo_og_image",
                    requiredMedia(media.byAttachment().get(firstOgAttachmentId(meta)), "product OG image"));
            case "gallery" -> updateJsonIfEmpty(connection, "products", "gallery",
                    productGalleryJson(mapped.galleryIds(), media), plan.targetId());
            case "videos" -> updateJsonIfEmpty(connection, "products", "videos",
                    productVideosJson(plan.videos(), media), plan.targetId());
            default -> throw new IllegalStateException("Unapproved product fill field: " + field);
        }
    }

    private void insertProductCategories(
            Connection connection, String productId, List<String> slugs) throws SQLException {
        int order = 0;
        for (String slug : slugs) insertProductCategory(connection, productId, slug, order++);
    }

    private void insertProductCategory(Connection connection, String productId, String slug) throws SQLException {
        int order;
        try (PreparedStatement statement = connection.prepareStatement(
                "select coalesce(max(sort_order),-1)+1 from product_category_map where product_id=?")) {
            statement.setString(1, productId);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) throw new SQLException("Cannot resolve next product category order");
                order = rs.getInt(1);
            }
        }
        insertProductCategory(connection, productId, slug, order);
    }

    private void insertProductCategory(
            Connection connection, String productId, String slug, int sortOrder) throws SQLException {
        String sql = "insert into product_category_map(product_id,category_id,sort_order) "
                + "select ?,id,? from categories where slug=? and not deleted";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, productId);
            statement.setInt(2, sortOrder);
            statement.setString(3, slug);
            assertOne(statement.executeUpdate(), "product category insert", productId + ":" + slug);
        }
    }

    private DomainCounts writeVariant(
            Connection connection,
            LiveWordPressSnapshotReader.Snapshot source,
            VariantPlan plan,
            MediaBindings media) throws Exception {
        WpPost post = requiredPost(source, plan.sourceId(), "product_variation");
        Map<String, String> meta = source.meta(plan.sourceId());
        var mapped = variationMapper.map(
                post, source.metaByPost().getOrDefault(plan.sourceId(), List.of()));
        if (plan.action() == Action.INSERT) {
            insertVariant(connection, plan, post, meta, mapped, media);
            return new DomainCounts(1, 0, 0, 0);
        }
        for (String field : plan.fieldsToFill()) {
            fillVariantField(connection, plan, post, meta, mapped, media, field);
        }
        return new DomainCounts(0, 1, 0, 0);
    }

    private void insertVariant(
            Connection connection,
            VariantPlan plan,
            WpPost post,
            Map<String, String> meta,
            WordPressVariationMapper.MappedVariation mapped,
            MediaBindings media) throws Exception {
        BigDecimal retail = LiveMigrationPreflightService.sourceRetailPrice(
                mapped.regularPrice(), mapped.price());
        BigDecimal sale = LiveMigrationPreflightService.sourceSalePrice(
                mapped.regularPrice(), mapped.price(), mapped.salePrice());
        MediaBinding image = variantCover(plan, meta, mapped, media);
        boolean available = sourceAvailable(mapped.stockStatus());
        String sql = "insert into product_variants "
                + "(id,product_id,sku,name,retail_price,sale_price,currency,stock_state,"
                + "image_id,image_url,image_alt,image_width,image_height,image_mime_type,"
                + "is_available,sort_order,quantity_on_hand) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int i = 1;
            statement.setString(i++, plan.targetId());
            statement.setString(i++, required(plan.targetParentId(), "variant parent"));
            // Reviewed plan wins: a generated SKU is only present when WordPress had none.
            statement.setString(i++, required(
                    hasText(plan.plannedSku()) ? plan.plannedSku() : mapped.sku(), "variant SKU"));
            statement.setString(i++, required(post.postTitle(), "variant name"));
            statement.setBigDecimal(i++, retail);
            statement.setBigDecimal(i++, sale);
            statement.setString(i++, "VND");
            statement.setString(i++, available ? "IN_STOCK" : "OUT_OF_STOCK");
            i = setAsset(statement, i, image);
            statement.setBoolean(i++, available);
            statement.setInt(i++, Math.max(0, post.menuOrder()));
            statement.setInt(i, mapped.stockQuantity() == null ? 0 : Math.max(0, mapped.stockQuantity()));
            assertOne(statement.executeUpdate(), "variant insert", plan.targetId());
        }
        insertVariantOptions(connection, plan.targetId(), mapped.attributes());
        insertVariantGallery(
                connection, plan.targetId(), reviewedVariantGallery(plan, mapped), media);
    }

    private void fillVariantField(
            Connection connection,
            VariantPlan plan,
            WpPost post,
            Map<String, String> meta,
            WordPressVariationMapper.MappedVariation mapped,
            MediaBindings media,
            String field) throws Exception {
        switch (field) {
            case "sku" -> updateBlankString(
                    connection, "product_variants", "sku", mapped.sku(), plan.targetId());
            case "name" -> updateBlankString(
                    connection, "product_variants", "name", post.postTitle(), plan.targetId());
            case "retailPrice" -> updateMissingPrice(connection, "product_variants",
                    LiveMigrationPreflightService.sourceRetailPrice(mapped.regularPrice(), mapped.price()),
                    plan.targetId());
            case "salePrice" -> updateNullValue(connection, "product_variants", "sale_price",
                    LiveMigrationPreflightService.sourceSalePrice(
                            mapped.regularPrice(), mapped.price(), mapped.salePrice()), plan.targetId());
            case "image" -> updateVariantAsset(connection, plan.targetId(),
                    requiredMedia(variantCover(plan, meta, mapped, media), "variant image"));
            case "options" -> insertVariantOptionsIfEmpty(
                    connection, plan.targetId(), mapped.attributes());
            case "gallery" -> insertVariantGalleryIfEmpty(
                    connection, plan.targetId(), reviewedVariantGallery(plan, mapped), media);
            default -> throw new IllegalStateException("Unapproved variant fill field: " + field);
        }
    }

    private void insertVariantOptions(
            Connection connection, String variantId, Map<String, String> attributes) throws SQLException {
        if (attributes == null) return;
        List<Map.Entry<String, String>> values = attributes.entrySet().stream()
                .filter(entry -> hasText(entry.getKey()) && hasText(entry.getValue()))
                .sorted(Map.Entry.comparingByKey()).toList();
        String sql = "insert into product_variant_options "
                + "(variant_id,sort_order,option_name,option_value) values (?,?,?,?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int order = 0;
            for (Map.Entry<String, String> value : values) {
                statement.setString(1, variantId);
                statement.setInt(2, order++);
                statement.setString(3, value.getKey().trim());
                statement.setString(4, value.getValue().trim());
                statement.addBatch();
            }
            if (!values.isEmpty()) statement.executeBatch();
        }
    }

    private void insertVariantOptionsIfEmpty(
            Connection connection, String variantId, Map<String, String> attributes) throws SQLException {
        if (scalarLong(connection,
                "select count(*) from product_variant_options where variant_id=?", variantId) != 0) {
            throw new IllegalStateException("Variant options changed after preflight: " + variantId);
        }
        insertVariantOptions(connection, variantId, attributes);
    }

    private void insertVariantGallery(
            Connection connection,
            String variantId,
            List<Long> attachmentIds,
            MediaBindings media) throws SQLException {
        if (attachmentIds == null) return;
        String sql = "insert into product_variant_gallery_images "
                + "(variant_id,sort_order,image_id,image_url,image_alt,image_width,image_height,"
                + "image_mime_type,media_type) values (?,?,?,?,?,?,?,?, 'image')";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int order = 0;
            for (Long attachmentId : attachmentIds.stream().filter(id -> id != null && id > 0).distinct().toList()) {
                MediaBinding asset = media.byAttachment().get(attachmentId);
                if (asset == null) throw new IllegalStateException("Missing variant gallery media: " + attachmentId);
                statement.setString(1, variantId);
                statement.setInt(2, order++);
                statement.setString(3, asset.targetId());
                statement.setString(4, asset.publicUrl());
                statement.setString(5, asset.altText());
                setNullableInt(statement, 6, asset.width());
                setNullableInt(statement, 7, asset.height());
                statement.setString(8, asset.mimeType());
                statement.addBatch();
            }
            if (order > 0) statement.executeBatch();
        }
    }

    private void insertVariantGalleryIfEmpty(
            Connection connection,
            String variantId,
            List<Long> attachmentIds,
            MediaBindings media) throws SQLException {
        if (scalarLong(connection,
                "select count(*) from product_variant_gallery_images where variant_id=?", variantId) != 0) {
            throw new IllegalStateException("Variant gallery changed after preflight: " + variantId);
        }
        insertVariantGallery(connection, variantId, attachmentIds, media);
    }

    private MediaBinding variantCover(
            VariantPlan plan,
            Map<String, String> meta,
            WordPressVariationMapper.MappedVariation mapped,
            MediaBindings media) {
        Set<Long> reviewedAttachmentIds = new java.util.LinkedHashSet<>(
                plan.attachmentIds() == null ? List.of() : plan.attachmentIds());
        Long thumbnail = parseLong(meta.get("_thumbnail_id"));
        if (thumbnail != null && thumbnail > 0
                && reviewedAttachmentIds.contains(thumbnail)
                && media.byAttachment().containsKey(thumbnail)) {
            return media.byAttachment().get(thumbnail);
        }
        for (Long id : reviewedVariantGallery(plan, mapped)) {
            if (id != null && id > 0 && media.byAttachment().containsKey(id)) {
                return media.byAttachment().get(id);
            }
        }
        return null;
    }

    private List<Long> reviewedVariantGallery(
            VariantPlan plan,
            WordPressVariationMapper.MappedVariation mapped) {
        return LiveVariantAttachmentOverridePlanner.reviewedGalleryForExecution(
                plan.attachmentIds(), mapped.galleryAttachmentIds());
    }

    private DomainCounts writeArticle(
            Connection connection,
            LiveWordPressSnapshotReader.Snapshot source,
            ArticlePlan plan,
            MediaBindings media,
            LiveMigrationContentRewriter rewriter) throws Exception {
        WpPost post = requiredPost(source, plan.sourceId(), "post");
        Map<String, String> meta = source.meta(plan.sourceId());
        var mapped = articleMapper.map(
                post, source.metaByPost().getOrDefault(plan.sourceId(), List.of()));
        if (plan.action() == Action.INSERT) {
            insertArticle(connection, plan, post, meta, mapped, media, rewriter);
            return new DomainCounts(1, 0, 0, 0);
        }
        for (String field : plan.fieldsToFill()) {
            fillArticleField(connection, plan, post, meta, mapped, media, rewriter, field);
        }
        return new DomainCounts(0, 1, 0, 0);
    }

    private void insertArticle(
            Connection connection,
            ArticlePlan plan,
            WpPost post,
            Map<String, String> meta,
            WordPressArticleMapper.MappedArticle mapped,
            MediaBindings media,
            LiveMigrationContentRewriter rewriter) throws Exception {
        MediaBinding cover = media.byAttachment().get(mapped.thumbnailId());
        MediaBinding productImage = media.byAttachment().get(mapped.productImageId());
        MediaBinding og = media.byAttachment().get(firstOgAttachmentId(meta));
        String excerpt = rewriter.rewriteHtml(mapped.excerpt(), media.publicUrlsByRelative());
        String body = rewriter.rewriteHtml(mapped.content(), media.publicUrlsByRelative());
        String canonical = rewriter.rewriteCanonical(sourceCanonical(meta),
                "/tin-tuc/" + plan.targetSlug() + "/");
        Instant createdAt = sourceInstant(post);
        Instant publishedAt = "PUBLISHED".equals(plan.sourceStatus()) ? createdAt : null;
        String columns = "id,slug,title,excerpt,body,cover_image_id,cover_image_url,cover_image_alt,"
                + "cover_image_width,cover_image_height,cover_image_mime_type,product_image_url,"
                + "product_image_alt,publish_status,seo_title,seo_description,seo_canonical_url,"
                + "seo_og_image_id,seo_og_image_url,seo_og_image_alt,seo_og_image_width,"
                + "seo_og_image_height,seo_og_image_mime_type,published_at,created_at,updated_at,"
                + "featured,seo_no_index,home_experience";
        String values = String.join(",", java.util.Collections.nCopies(29, "?"));
        try (PreparedStatement statement = connection.prepareStatement(
                "insert into articles (" + columns + ") values (" + values + ")")) {
            int i = 1;
            statement.setString(i++, plan.targetId());
            statement.setString(i++, required(plan.targetSlug(), "article slug"));
            statement.setString(i++, required(mapped.title(), "article title"));
            statement.setString(i++, trimToNull(excerpt));
            statement.setString(i++, required(body, "article body"));
            i = setAsset(statement, i, cover);
            statement.setString(i++, productImage == null ? null : productImage.publicUrl());
            statement.setString(i++, productImage == null ? null : productImage.altText());
            statement.setString(i++, plan.sourceStatus());
            statement.setString(i++, trimToNull(mapped.seoTitle()));
            statement.setString(i++, trimToNull(mapped.seoDescription()));
            statement.setString(i++, canonical);
            i = setAsset(statement, i, og);
            statement.setTimestamp(i++, publishedAt == null ? null : Timestamp.from(publishedAt));
            statement.setTimestamp(i++, Timestamp.from(createdAt));
            statement.setTimestamp(i++, Timestamp.from(createdAt));
            statement.setBoolean(i++, false);
            statement.setBoolean(i++, sourceNoIndex(meta));
            statement.setBoolean(i++, false);
            if (i != 30) throw new IllegalStateException("Article insert binding count drift");
            assertOne(statement.executeUpdate(), "article insert", plan.targetId());
        }
        insertArticleTags(connection, plan.targetId(), plan.tagsToAdd());
    }

    private void fillArticleField(
            Connection connection,
            ArticlePlan plan,
            WpPost post,
            Map<String, String> meta,
            WordPressArticleMapper.MappedArticle mapped,
            MediaBindings media,
            LiveMigrationContentRewriter rewriter,
            String field) throws Exception {
        switch (field) {
            case "slug" -> updateBlankString(
                    connection, "articles", "slug", mapped.slug(), plan.targetId());
            case "title" -> updateBlankString(
                    connection, "articles", "title", mapped.title(), plan.targetId());
            case "excerpt" -> updateBlankString(connection, "articles", "excerpt",
                    rewriter.rewriteHtml(mapped.excerpt(), media.publicUrlsByRelative()), plan.targetId());
            case "body" -> updateBlankString(connection, "articles", "body",
                    rewriter.rewriteHtml(mapped.content(), media.publicUrlsByRelative()), plan.targetId());
            case "seoTitle" -> updateBlankString(
                    connection, "articles", "seo_title", mapped.seoTitle(), plan.targetId());
            case "seoDescription" -> updateBlankString(
                    connection, "articles", "seo_description", mapped.seoDescription(), plan.targetId());
            case "seoCanonicalUrl" -> updateBlankString(connection, "articles", "seo_canonical_url",
                    rewriter.rewriteCanonical(sourceCanonical(meta),
                            "/tin-tuc/" + plan.targetSlug() + "/"), plan.targetId());
            case "coverImage" -> updateArticleAsset(connection, plan.targetId(), "cover_image",
                    requiredMedia(media.byAttachment().get(mapped.thumbnailId()), "article cover"));
            case "productImage" -> updateArticleProductImage(connection, plan.targetId(),
                    requiredMedia(media.byAttachment().get(mapped.productImageId()), "article product image"));
            case "seoOgImage" -> updateArticleAsset(connection, plan.targetId(), "seo_og_image",
                    requiredMedia(media.byAttachment().get(firstOgAttachmentId(meta)), "article OG image"));
            case "publishedAt" -> updateNullValue(
                    connection, "articles", "published_at", Timestamp.from(sourceInstant(post)), plan.targetId());
            case "tags" -> insertArticleTags(connection, plan.targetId(), plan.tagsToAdd());
            default -> throw new IllegalStateException("Unapproved article fill field: " + field);
        }
    }

    private void insertArticleTags(
            Connection connection, String articleId, List<String> tags) throws SQLException {
        if (tags == null || tags.isEmpty()) return;
        int order;
        try (PreparedStatement statement = connection.prepareStatement(
                "select coalesce(max(sort_order),-1)+1 from article_tags where article_id=?")) {
            statement.setString(1, articleId);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) throw new SQLException("Cannot resolve article tag order");
                order = rs.getInt(1);
            }
        }
        String sql = "insert into article_tags(article_id,sort_order,tag) "
                + "select ?,?,? where not exists "
                + "(select 1 from article_tags where article_id=? and lower(tag)=lower(?))";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (String tag : tags.stream().filter(LiveMigrationExecutor::hasText).distinct().toList()) {
                statement.setString(1, articleId);
                statement.setInt(2, order++);
                statement.setString(3, tag.trim());
                statement.setString(4, articleId);
                statement.setString(5, tag.trim());
                int inserted = statement.executeUpdate();
                if (inserted != 1) {
                    throw new IllegalStateException("Article tag changed after preflight: " + articleId);
                }
            }
        }
    }

    private DomainCounts writeRedirect(Connection connection, RedirectPlan plan) throws Exception {
        if (plan.action() == Action.UPDATE_REDIRECT_TARGET) {
            return updateRedirect(connection, plan);
        }
        if (plan.action() != Action.INSERT) {
            throw new IllegalStateException("Unapproved redirect write action: " + plan.action());
        }
        UUID id = UUID.nameUUIDFromBytes(
                ("bigbike:wordpress-redirect:" + plan.sourcePath()).getBytes(StandardCharsets.UTF_8));
        String sql = "insert into redirects "
                + "(id,source_pattern,target_url,enabled,hit_count,notes,"
                + "legacy_id,created_at,updated_at) values (?,?,?,true,0,?,?,now(),now())";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, id);
            statement.setString(2, required(plan.sourcePath(), "redirect source"));
            statement.setString(3, required(plan.targetPath(), "redirect target"));
            statement.setString(4, trimToNull(plan.reason() + " [" + plan.confidence() + "]"));
            setNullableLong(statement, 5, plan.sourceId());
            assertOne(statement.executeUpdate(), "redirect insert", plan.sourcePath());
        }
        return new DomainCounts(1, 0, 0, 0);
    }

    private DomainCounts updateRedirect(Connection connection, RedirectPlan plan) throws Exception {
        UUID id;
        try {
            id = UUID.fromString(required(plan.existingRedirectId(), "existing redirect id"));
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(
                    "Reviewed existing redirect id is not a UUID: " + plan.existingRedirectId(), e);
        }
        String existingSource = required(
                plan.existingSourcePattern(), "existing redirect source pattern");
        String existingTarget = required(plan.existingTargetUrl(), "existing redirect target URL");
        if (plan.existingEnabled() == null) {
            throw new IllegalStateException(
                    "Reviewed existing redirect metadata is incomplete: " + plan.sourcePath());
        }
        String notes = trimToNull(plan.reason() + " [" + plan.confidence()
                + "; replaced reviewed legacy/missing/non-public target]");
        String sql = "update redirects set target_url=?,"
                + "enabled=true,notes=coalesce(nullif(btrim(notes),''),?),"
                + "legacy_id=coalesce(legacy_id,?),updated_at=now() "
                + "where id=? and source_pattern=? and target_url=? and enabled=?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, required(plan.targetPath(), "redirect target"));
            statement.setString(2, notes);
            setNullableLong(statement, 3, plan.sourceId());
            statement.setObject(4, id);
            statement.setString(5, existingSource);
            statement.setString(6, existingTarget);
            statement.setBoolean(7, plan.existingEnabled());
            assertOne(statement.executeUpdate(), "guarded redirect update", plan.sourcePath());
        }

        Map<String, Object> before = new LinkedHashMap<>();
        before.put("id", id.toString());
        before.put("sourcePattern", existingSource);
        before.put("targetUrl", existingTarget);
        before.put("enabled", plan.existingEnabled());
        Map<String, Object> after = new LinkedHashMap<>();
        after.put("id", id.toString());
        after.put("sourcePattern", existingSource);
        after.put("targetUrl", plan.targetPath());
        after.put("enabled", true);
        UUID auditId = UUID.nameUUIDFromBytes(
                ("bigbike-live-migration:redirect-update:" + id + ":" + existingTarget
                        + ":" + plan.targetPath()).getBytes(StandardCharsets.UTF_8));
        try (PreparedStatement statement = connection.prepareStatement(
                "insert into audit_logs "
                        + "(id,actor_type,action,resource_type,resource_id,before_data,after_data,created_at) "
                        + "values (?,'SYSTEM','LIVE_MIGRATION_REDIRECT_TARGET_UPDATED',"
                        + "'REDIRECT',?,?,?,now())")) {
            statement.setObject(1, auditId);
            statement.setObject(2, id);
            statement.setString(3, json.writeValueAsString(before));
            statement.setString(4, json.writeValueAsString(after));
            assertOne(statement.executeUpdate(), "redirect update audit", plan.sourcePath());
        }
        return new DomainCounts(0, 1, 0, 0);
    }

    private DomainCounts writeTargetContentRewrite(
            Connection connection,
            TargetContentRewritePlan plan,
            MediaBindings media,
            LiveMigrationContentRewriter rewriter,
            LiveMigrationPreflightReport.OwnerDecisionPlans ownerDecisions) throws Exception {
        if (plan.action() != Action.REWRITE_URLS_ONLY) {
            throw new IllegalStateException("Unapproved target content rewrite action: " + plan.action());
        }
        ContentFieldTarget target = contentFieldTarget(plan);
        String current = readTargetContentField(connection, plan, target);
        if (!required(plan.beforeSha256(), "target content before SHA-256").equals(hashText(current))) {
            throw new IllegalStateException(
                    "Target content changed after review: " + plan.entityId() + ":" + plan.field());
        }
        List<LiveMigrationOwnerOverrides.UnavailableFileFallback> unavailableFallbacks =
                ownerDecisions.unavailableMediaFallbacks().stream()
                        .map(fallback -> new LiveMigrationOwnerOverrides.UnavailableFileFallback(
                                fallback.relativePath(), fallback.entityType(), fallback.entityId(),
                                fallback.fields(), fallback.action()))
                        .toList();
        String rewritten = plan.canonicalPath() == null
                ? rewriter.rewriteTargetField(
                        current, media.publicUrlsByRelative(), plan.entityType(), plan.entityId(),
                        plan.field(), isHtmlContentField(plan),
                        // Mirrors the pinned owner policy. A drift would not slip through: the
                        // afterSha256 check below refuses to write anything the reviewed plan
                        // did not produce.
                        new LiveMigrationOwnerOverrides.TargetContentPolicy(
                                true, true, false, false, false, List.of(), true),
                        unavailableFallbacks).value()
                : rewriter.rewriteCanonical(current, plan.canonicalPath());
        if (rewritten == null || rewritten.equals(current)
                || !required(plan.afterSha256(), "target content after SHA-256").equals(hashText(rewritten))) {
            throw new IllegalStateException(
                    "Target content rewrite no longer matches the reviewed result: "
                            + plan.entityId() + ":" + plan.field());
        }
        int remaining = LiveMigrationContentRewriter.wordpressUploadLinkCount(rewritten)
                + LiveMigrationContentRewriter.legacyInternalLinkCount(rewritten);
        if (remaining != 0) {
            throw new IllegalStateException(
                    "Target content rewrite still contains legacy URLs: "
                            + plan.entityId() + ":" + plan.field());
        }

        String assignment = target.json() ? "cast(? as jsonb)" : "?";
        String currentPredicate = target.json() ? target.column() + "::text=?" : target.column() + "=?";
        try (PreparedStatement statement = connection.prepareStatement(
                "update " + target.table() + " set " + target.column() + "=" + assignment
                        + ",updated_at=now() where id=? and " + currentPredicate)) {
            statement.setString(1, rewritten);
            statement.setString(2, plan.entityId());
            statement.setString(3, current);
            assertOne(statement.executeUpdate(), "target URL-only content rewrite",
                    plan.entityId() + ":" + plan.field());
        }
        insertTargetContentRewriteAudit(connection, plan);
        return new DomainCounts(0, 1, 0, 0);
    }

    private String readTargetContentField(
            Connection connection,
            TargetContentRewritePlan plan,
            ContentFieldTarget target) throws SQLException {
        String selectExpression = target.json() ? target.column() + "::text" : target.column();
        try (PreparedStatement statement = connection.prepareStatement(
                "select " + selectExpression + " from " + target.table() + " where id=?")) {
            statement.setString(1, plan.entityId());
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next() || rs.getString(1) == null) {
                    throw new IllegalStateException(
                            "Reviewed target content field disappeared: "
                                    + plan.entityId() + ":" + plan.field());
                }
                return rs.getString(1);
            }
        }
    }

    private ContentFieldTarget contentFieldTarget(TargetContentRewritePlan plan) {
        return switch (plan.entityType()) {
            case "PRODUCT" -> switch (plan.field()) {
                case "short_description", "description", "short_description_en", "description_en",
                        "seo_canonical_url" -> new ContentFieldTarget("products", plan.field(), false);
                case "description_blocks" -> new ContentFieldTarget("products", plan.field(), true);
                default -> throw new IllegalStateException("Unapproved product content field: " + plan.field());
            };
            case "ARTICLE" -> switch (plan.field()) {
                case "excerpt", "body", "excerpt_en", "body_en", "seo_canonical_url" ->
                        new ContentFieldTarget("articles", plan.field(), false);
                case "body_blocks" -> new ContentFieldTarget("articles", plan.field(), true);
                default -> throw new IllegalStateException("Unapproved article content field: " + plan.field());
            };
            case "BRAND" -> switch (plan.field()) {
                case "banner_url" -> new ContentFieldTarget("brands", plan.field(), false);
                default -> throw new IllegalStateException("Unapproved brand content field: " + plan.field());
            };
            default -> throw new IllegalStateException(
                    "Unapproved target content entity: " + plan.entityType());
        };
    }

    private boolean isHtmlContentField(TargetContentRewritePlan plan) {
        return ("PRODUCT".equals(plan.entityType())
                        && Set.of("short_description", "description",
                                "short_description_en", "description_en").contains(plan.field()))
                || ("ARTICLE".equals(plan.entityType())
                        && Set.of("excerpt", "body", "excerpt_en", "body_en")
                                .contains(plan.field()));
    }

    private void insertTargetContentRewriteAudit(
            Connection connection, TargetContentRewritePlan plan) throws Exception {
        UUID auditId = UUID.nameUUIDFromBytes(
                ("bigbike-live-migration:content-rewrite:" + plan.entityType() + ":"
                        + plan.entityId() + ":" + plan.field() + ":" + plan.beforeSha256())
                        .getBytes(StandardCharsets.UTF_8));
        Map<String, Object> before = new LinkedHashMap<>();
        before.put("id", plan.entityId());
        before.put("field", plan.field());
        before.put("sha256", plan.beforeSha256());
        Map<String, Object> after = new LinkedHashMap<>();
        after.put("id", plan.entityId());
        after.put("field", plan.field());
        after.put("sha256", plan.afterSha256());
        after.put("operations", plan.operations());
        try (PreparedStatement statement = connection.prepareStatement(
                "insert into audit_logs "
                        + "(id,actor_type,action,resource_type,resource_id,before_data,after_data,created_at) "
                        + "values (?,'SYSTEM','LIVE_MIGRATION_CONTENT_URLS_REWRITTEN',?,null,?,?,now())")) {
            statement.setObject(1, auditId);
            statement.setString(2, plan.entityType());
            statement.setString(3, json.writeValueAsString(before));
            statement.setString(4, json.writeValueAsString(after));
            assertOne(statement.executeUpdate(), "target content rewrite audit",
                    plan.entityId() + ":" + plan.field());
        }
    }

    private void updateBlankString(
            Connection connection, String table, String column, String value, String id) throws SQLException {
        String safeTable = identifier(table);
        String safeColumn = identifier(column);
        String source = required(value, safeTable + "." + safeColumn);
        String sql = "update " + safeTable + " set " + safeColumn + "=?,updated_at=now() "
                + "where id=? and (" + safeColumn + " is null or btrim(" + safeColumn + ")='')";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, source);
            statement.setString(2, id);
            assertOne(statement.executeUpdate(), safeTable + " blank fill " + safeColumn, id);
        }
    }

    private void updateBlankNullableString(
            Connection connection, String table, String column, String value, String id) throws SQLException {
        String safeTable = identifier(table);
        String safeColumn = identifier(column);
        String sql = "update " + safeTable + " set " + safeColumn + "=?,updated_at=now() "
                + "where id=? and (" + safeColumn + " is null or btrim(" + safeColumn + ")='')";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            String normalized = trimToNull(value);
            if (normalized == null) {
                statement.setNull(1, java.sql.Types.VARCHAR);
            } else {
                statement.setString(1, normalized);
            }
            statement.setString(2, id);
            assertOne(statement.executeUpdate(), safeTable + " nullable blank fill " + safeColumn, id);
        }
    }

    private void updateProductGenderFlags(Connection connection, String value, String id) throws SQLException {
        String sql = "update products set gender_male=?,gender_female=?,updated_at=now() "
                + "where id=? and gender_male=false and gender_female=false";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setBoolean(1, hasGender(value, "Nam"));
            statement.setBoolean(2, hasGender(value, "Nữ"));
            statement.setString(3, id);
            assertOne(statement.executeUpdate(), "products blank fill gender flags", id);
        }
    }

    private void updateNullValue(
            Connection connection, String table, String column, Object value, String id) throws SQLException {
        String safeTable = identifier(table);
        String safeColumn = identifier(column);
        if (value == null) throw new IllegalStateException("Planned source value is null: " + safeColumn);
        String sql = "update " + safeTable + " set " + safeColumn + "=?,updated_at=now() "
                + "where id=? and " + safeColumn + " is null";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, value);
            statement.setString(2, id);
            assertOne(statement.executeUpdate(), safeTable + " null fill " + safeColumn, id);
        }
    }

    private void updateMissingPrice(
            Connection connection, String table, BigDecimal value, String id) throws SQLException {
        if (value == null || value.signum() <= 0) {
            throw new IllegalStateException("Planned retail price is not positive: " + id);
        }
        String safeTable = identifier(table);
        String sql = "update " + safeTable + " set retail_price=?,updated_at=now() "
                + "where id=? and (retail_price is null or retail_price<=0)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setBigDecimal(1, value);
            statement.setString(2, id);
            assertOne(statement.executeUpdate(), safeTable + " retail price fill", id);
        }
    }

    private void updateProductAsset(
            Connection connection, String productId, String prefix, MediaBinding asset) throws SQLException {
        updateAsset(connection, "products", productId, prefix, asset);
    }

    private void updateArticleAsset(
            Connection connection, String articleId, String prefix, MediaBinding asset) throws SQLException {
        updateAsset(connection, "articles", articleId, prefix, asset);
    }

    private void updateAsset(
            Connection connection,
            String table,
            String id,
            String prefix,
            MediaBinding asset) throws SQLException {
        String safeTable = identifier(table);
        String safePrefix = identifier(prefix);
        String sql = "update " + safeTable + " set "
                + safePrefix + "_id=?," + safePrefix + "_url=?," + safePrefix + "_alt=?,"
                + safePrefix + "_width=?," + safePrefix + "_height=?," + safePrefix + "_mime_type=?,"
                + "updated_at=now() where id=? and "
                + "(" + safePrefix + "_id is null or btrim(" + safePrefix + "_id)='') and "
                + "(" + safePrefix + "_url is null or btrim(" + safePrefix + "_url)='')";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int i = setAsset(statement, 1, asset);
            statement.setString(i, id);
            assertOne(statement.executeUpdate(), safeTable + " asset fill " + safePrefix, id);
        }
    }

    private void updateVariantAsset(
            Connection connection, String variantId, MediaBinding asset) throws SQLException {
        String sql = "update product_variants set image_id=?,image_url=?,image_alt=?,image_width=?,"
                + "image_height=?,image_mime_type=? where id=? and "
                + "(image_id is null or btrim(image_id)='') and "
                + "(image_url is null or btrim(image_url)='')";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int i = setAsset(statement, 1, asset);
            statement.setString(i, variantId);
            assertOne(statement.executeUpdate(), "variant asset fill", variantId);
        }
    }

    private void updateArticleProductImage(
            Connection connection, String articleId, MediaBinding asset) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "update articles set product_image_url=?,product_image_alt=?,updated_at=now() "
                        + "where id=? and (product_image_url is null or btrim(product_image_url)='')")) {
            statement.setString(1, asset.publicUrl());
            statement.setString(2, asset.altText());
            statement.setString(3, articleId);
            assertOne(statement.executeUpdate(), "article product image fill", articleId);
        }
    }

    private void updateJsonIfEmpty(
            Connection connection, String table, String column, String value, String id) throws SQLException {
        String safeTable = identifier(table);
        String safeColumn = identifier(column);
        if (!hasText(value) || "[]".equals(value.trim())) {
            throw new IllegalStateException("Planned JSON collection is empty: " + safeColumn);
        }
        String sql = "update " + safeTable + " set " + safeColumn + "=cast(? as jsonb),updated_at=now() "
                + "where id=? and (" + safeColumn + " is null or " + safeColumn + "='[]'::jsonb)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, value);
            statement.setString(2, id);
            assertOne(statement.executeUpdate(), safeTable + " JSON fill " + safeColumn, id);
        }
    }

    private int setAsset(PreparedStatement statement, int index, MediaBinding asset) throws SQLException {
        statement.setString(index++, asset == null ? null : asset.targetId());
        statement.setString(index++, asset == null ? null : asset.publicUrl());
        statement.setString(index++, asset == null ? null : asset.altText());
        setNullableInt(statement, index++, asset == null ? null : asset.width());
        setNullableInt(statement, index++, asset == null ? null : asset.height());
        statement.setString(index++, asset == null ? null : asset.mimeType());
        return index;
    }

    private String productGalleryJson(List<Long> ids, MediaBindings media) throws Exception {
        if (ids == null || ids.isEmpty()) return null;
        List<Map<String, Object>> values = new ArrayList<>();
        for (Long id : ids.stream().filter(value -> value != null && value > 0).distinct().toList()) {
            MediaBinding asset = media.byAttachment().get(id);
            if (asset == null) throw new IllegalStateException("Missing product gallery media: " + id);
            Map<String, Object> image = new LinkedHashMap<>();
            image.put("id", asset.targetId());
            image.put("url", asset.publicUrl());
            image.put("alt", asset.altText());
            image.put("width", asset.width());
            image.put("height", asset.height());
            image.put("mimeType", asset.mimeType());
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("mediaType", "image");
            item.put("image", image);
            item.put("videoUrl", null);
            item.put("videoProvider", null);
            values.add(item);
        }
        return values.isEmpty() ? null : json.writeValueAsString(values);
    }

    private String productVideosJson(List<ProductVideoPlan> plans, MediaBindings media) throws Exception {
        if (plans == null || plans.isEmpty()) return null;
        List<Map<String, Object>> values = new ArrayList<>();
        for (ProductVideoPlan plan : plans) {
            MediaBinding upload = plan.uploadAttachmentId() == null
                    ? null : media.byAttachment().get(plan.uploadAttachmentId());
            MediaBinding thumbnail = plan.thumbnailAttachmentId() == null
                    ? null : media.byAttachment().get(plan.thumbnailAttachmentId());
            String url;
            String id;
            if ("youtube".equals(plan.provider())) {
                url = required(plan.url(), "product YouTube URL");
                id = "wp-video-" + plan.sourceVideoId();
            } else if ("upload".equals(plan.provider())) {
                if (upload == null) {
                    throw new IllegalStateException(
                            "Missing uploaded product video media: " + plan.sourceVideoId());
                }
                url = upload.publicUrl();
                id = upload.targetId();
            } else {
                throw new IllegalStateException(
                        "Unsupported planned product video provider: " + plan.provider());
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", id);
            item.put("url", url);
            item.put("title", plan.title());
            item.put("provider", plan.provider());
            item.put("thumbnail", thumbnail == null ? null : imageAssetJson(thumbnail));
            item.put("description", plan.description());
            values.add(item);
        }
        return values.isEmpty() ? null : json.writeValueAsString(values);
    }

    private Map<String, Object> imageAssetJson(MediaBinding asset) {
        Map<String, Object> image = new LinkedHashMap<>();
        image.put("id", asset.targetId());
        image.put("url", asset.publicUrl());
        image.put("alt", asset.altText());
        image.put("width", asset.width());
        image.put("height", asset.height());
        image.put("mimeType", asset.mimeType());
        return image;
    }

    private void validatePostWrite(
            Connection connection,
            LiveMigrationPreflightReport plan,
            MediaBindings media,
            MinioClient minio,
            Map<String, Long> protectedAfter) throws Exception {
        if (!plan.targetCounts().protectedDomains().equals(protectedAfter)) {
            throw new IllegalStateException("Protected customer/order/admin counts changed during migration");
        }
        for (ProductPlan product : plan.products()) {
            if (product.action() != Action.INSERT
                    && !"DOWNGRADE_CONFIRMED_LEGACY_TO_DRAFT".equals(product.statusDecision())
                    && (product.statusDecision() == null
                        || !product.statusDecision().startsWith("OWNER_OVERRIDE_"))) {
                continue;
            }
            if (product.targetId() == null) continue;
            String status = scalarString(connection,
                    "select publish_status from products where id=?", product.targetId());
            if (!"DRAFT".equals(status)) {
                throw new IllegalStateException("Imported product is not DRAFT: " + product.targetId());
            }
        }
        long duplicateVariantSkus = scalarLong(connection,
                "select count(*) from (select lower(btrim(sku)) from product_variants "
                        + "where sku is not null and btrim(sku)<>'' group by 1 having count(*)>1) d");
        if (duplicateVariantSkus != 0) throw new IllegalStateException("Duplicate variant SKU after migration");
        long duplicateProductSlugs = scalarLong(connection,
                "select count(*) from (select lower(btrim(slug)) from products group by 1 having count(*)>1) d");
        long duplicateArticleSlugs = scalarLong(connection,
                "select count(*) from (select lower(btrim(slug)) from articles group by 1 having count(*)>1) d");
        if (duplicateProductSlugs != 0 || duplicateArticleSlugs != 0) {
            throw new IllegalStateException("Duplicate content slug after migration");
        }
        long oldUploadLinks = scalarLong(connection,
                "select (select count(*) from products where concat_ws(' ',short_description,description,"
                        + "short_description_en,description_en,description_blocks::text) "
                        + "ilike '%wp-content/uploads%') + (select count(*) from articles where "
                        + "concat_ws(' ',excerpt,body,excerpt_en,body_en,body_blocks::text) "
                        + "ilike '%wp-content/uploads%') + (select count(*) from brands where "
                        + "banner_url ilike '%wp-content/uploads%')");
        if (oldUploadLinks != 0) {
            throw new IllegalStateException("Public content still contains wp-content/uploads links");
        }
        for (TargetContentRewritePlan rewrite : plan.targetContentRewrites()) {
            if (rewrite.action() != Action.REWRITE_URLS_ONLY) continue;
            String current = readTargetContentField(connection, rewrite, contentFieldTarget(rewrite));
            if (!required(rewrite.afterSha256(), "target content post-write SHA-256")
                    .equals(hashText(current))) {
                throw new IllegalStateException(
                        "Target content rewrite changed after write: "
                                + rewrite.entityId() + ":" + rewrite.field());
            }
            if (LiveMigrationContentRewriter.wordpressUploadLinkCount(current)
                    + LiveMigrationContentRewriter.legacyInternalLinkCount(current) != 0) {
                throw new IllegalStateException(
                        "Target content still contains a legacy URL: "
                                + rewrite.entityId() + ":" + rewrite.field());
            }
        }
        for (RedirectPlan redirect : plan.redirects()) {
            if (redirect.action() != Action.INSERT
                    && redirect.action() != Action.UPDATE_REDIRECT_TARGET) continue;
            String sourcePattern = redirect.action() == Action.UPDATE_REDIRECT_TARGET
                    ? required(redirect.existingSourcePattern(), "updated redirect source")
                    : redirect.sourcePath();
            try (PreparedStatement statement = connection.prepareStatement(
                    "select count(*) from redirects where source_pattern=? and target_url=? "
                            + "and enabled")) {
                statement.setString(1, sourcePattern);
                statement.setString(2, redirect.targetPath());
                try (ResultSet rs = statement.executeQuery()) {
                    if (!rs.next() || rs.getLong(1) != 1) {
                        throw new IllegalStateException(
                                "Redirect post-write validation failed: " + redirect.sourcePath());
                    }
                }
            }
        }
        Set<String> checkedObjects = new LinkedHashSet<>();
        for (MediaBinding binding : media.byPlanKey().values()) {
            if (binding.objectKey() == null || !checkedObjects.add(binding.bucket() + "/" + binding.objectKey())) {
                continue;
            }
            String actual = hashObject(minio, binding.bucket(), binding.objectKey());
            if (!binding.sha256().equals(actual)) {
                throw new IllegalStateException("Post-write media checksum mismatch: " + binding.targetId());
            }
        }
    }

    private Map<String, Long> readProtectedCounts(Connection connection) throws SQLException {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String table : List.of("customers", "orders", "admin_users")) {
            if (tableExists(connection, table)) counts.put(table, scalarLong(connection, "select count(*) from " + table));
        }
        return Map.copyOf(counts);
    }

    private boolean tableExists(Connection connection, String table) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "select exists(select 1 from information_schema.tables "
                        + "where table_schema=current_schema() and table_name=?)")) {
            statement.setString(1, table);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() && rs.getBoolean(1);
            }
        }
    }

    private long scalarLong(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement(); ResultSet rs = statement.executeQuery(sql)) {
            return rs.next() ? rs.getLong(1) : 0;
        }
    }

    private long scalarLong(Connection connection, String sql, String value) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, value);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? rs.getLong(1) : 0;
            }
        }
    }

    private String scalarString(Connection connection, String sql, String value) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, value);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? rs.getString(1) : null;
            }
        }
    }

    private String requiredBrandId(Connection connection, String slug) throws SQLException {
        String value = scalarString(connection, "select id from brands where slug=?", required(slug, "brand slug"));
        if (value == null) throw new IllegalStateException("Reviewed target brand disappeared: " + slug);
        return value;
    }

    private WpPost requiredPost(
            LiveWordPressSnapshotReader.Snapshot source, long sourceId, String expectedType) {
        WpPost post = source.postsById().get(sourceId);
        if (post == null || !expectedType.equals(post.postType())) {
            throw new IllegalStateException("Source post missing or wrong type: " + sourceId);
        }
        return post;
    }

    private Instant sourceInstant(WpPost post) {
        LocalDateTime value = post.postDateGmt();
        if (value != null) return value.toInstant(ZoneOffset.UTC);
        if (post.postDate() != null) {
            return post.postDate().atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();
        }
        throw new IllegalStateException("Source post has no mappable timestamp: " + post.id());
    }

    private boolean sourceAvailable(String stockStatus) {
        String normalized = trimToNull(stockStatus);
        if (normalized == null) throw new IllegalStateException("Source stock status is missing");
        return !"outofstock".equalsIgnoreCase(normalized);
    }

    private boolean sourceNoIndex(Map<String, String> meta) {
        String yoast = trimToNull(meta.get("_yoast_wpseo_meta-robots-noindex"));
        String rankMath = trimToNull(meta.get("rank_math_robots"));
        return "1".equals(yoast) || "noindex".equalsIgnoreCase(yoast)
                || (rankMath != null && rankMath.toLowerCase(Locale.ROOT).contains("noindex"));
    }

    private String sourceCanonical(Map<String, String> meta) {
        return firstNonBlank(meta.get("rank_math_canonical"), meta.get("_yoast_wpseo_canonical"));
    }

    private Long firstOgAttachmentId(Map<String, String> meta) {
        Long rankMath = parseLong(meta.get("rank_math_facebook_image_id"));
        if (rankMath != null && rankMath > 0) return rankMath;
        Long yoast = parseLong(meta.get("_yoast_wpseo_opengraph-image-id"));
        return yoast != null && yoast > 0 ? yoast : null;
    }

    private Path resolveSourcePath(Path uploadsRoot, String relative) {
        Path root = uploadsRoot.toAbsolutePath().normalize();
        Path resolved = root.resolve(relative).normalize();
        if (!resolved.startsWith(root) || !Files.isRegularFile(resolved) || !Files.isReadable(resolved)) {
            throw new IllegalStateException("Reviewed source media is no longer readable: " + relative);
        }
        return resolved;
    }

    private void verifySourceDump(Path path, String expectedSha256, long expectedBytes) throws Exception {
        if (!Files.isRegularFile(path) || !Files.isReadable(path)
                || Files.size(path) != expectedBytes
                || !required(expectedSha256, "source dump SHA-256")
                        .equals(checksumService.sha256Hex(path))) {
            throw new IllegalStateException("Source dump changed after the reviewed preflight");
        }
    }

    private String requiredRelative(String value) {
        String relative = LiveMediaPlanner.normalizeRelativePath(value);
        if (relative == null) throw new IllegalStateException("Invalid reviewed media path");
        return relative;
    }

    private String objectKey(String provider, String filePath, String publicUrl) {
        if (publicUrl != null && publicUrl.startsWith("/media/")) {
            return stripLeadingSlash(publicUrl.substring("/media/".length()));
        }
        String path = trimToNull(filePath);
        if (path == null) return null;
        path = stripLeadingSlash(path);
        if ("LEGACY_WP".equalsIgnoreCase(provider) && !path.startsWith("wp-uploads/")) {
            path = "wp-uploads/" + path;
        }
        return path;
    }

    private String stripLeadingSlash(String value) {
        String result = value;
        while (result.startsWith("/")) result = result.substring(1);
        return result;
    }

    private int nullableInt(ResultSet rs, String column, Integer fallback) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? fallback : value;
    }

    private void setNullableLong(PreparedStatement statement, int index, Long value) throws SQLException {
        if (value == null) statement.setNull(index, java.sql.Types.BIGINT);
        else statement.setLong(index, value);
    }

    private void setNullableInt(PreparedStatement statement, int index, Integer value) throws SQLException {
        if (value == null) statement.setNull(index, java.sql.Types.INTEGER);
        else statement.setInt(index, value);
    }

    private void setNullableBoolean(PreparedStatement statement, int index, Boolean value) throws SQLException {
        if (value == null) statement.setNull(index, java.sql.Types.BOOLEAN);
        else statement.setBoolean(index, value);
    }

    private void assertOne(int changed, String operation, String id) {
        if (changed != 1) {
            throw new IllegalStateException(operation + " expected exactly one row for " + id
                    + " but changed " + changed);
        }
    }

    private String identifier(String value) {
        if (value == null || !value.matches("[a-z][a-z0-9_]*")) {
            throw new IllegalArgumentException("Unsafe SQL identifier");
        }
        return value;
    }

    private String required(String value, String field) {
        String result = trimToNull(value);
        if (result == null) throw new IllegalStateException("Required mapped value is missing: " + field);
        return result;
    }

    private MediaBinding requiredMedia(MediaBinding value, String field) {
        if (value == null) throw new IllegalStateException("Required mapped media is missing: " + field);
        return value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String trimToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private static boolean hasGender(String value, String expected) {
        if (!hasText(value)) return false;
        for (String token : value.split("\\|")) {
            if (expected.equalsIgnoreCase(token.trim())) return true;
        }
        return false;
    }

    private String firstNonBlank(String first, String second) {
        String value = trimToNull(first);
        return value != null ? value : trimToNull(second);
    }

    private Long parseLong(String value) {
        if (!hasText(value)) return null;
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private UUID deterministicRunId(String snapshotId, String dumpSha) {
        return UUID.nameUUIDFromBytes(
                ("bigbike:live-migration:" + snapshotId + ":" + dumpSha)
                        .getBytes(StandardCharsets.UTF_8));
    }

    private List<MediaPlan> orderedMediaPlans(List<MediaPlan> plans) {
        return plans.stream()
                .filter(plan -> plan.action() == Action.INSERT || plan.action() == Action.PRESERVE)
                .sorted(Comparator.comparingInt((MediaPlan plan) -> plan.action() == Action.INSERT ? 0 : 1)
                        .thenComparing(plan -> plan.sourceRelativePath() == null ? "" : plan.sourceRelativePath()))
                .toList();
    }

    private List<TargetMediaChecksumPlan> actionableTargetChecksums(
            List<TargetMediaChecksumPlan> plans) {
        return plans.stream()
                .filter(plan -> plan.action() == Action.UPDATE_FILL_BLANKS
                        || plan.action() == Action.PRESERVE)
                .sorted(Comparator.comparing(TargetMediaChecksumPlan::targetMediaId))
                .toList();
    }

    private List<ProductPlan> actionable(List<ProductPlan> plans) {
        return plans.stream().filter(plan -> plan.action() == Action.INSERT
                || plan.action() == Action.UPDATE_FILL_BLANKS).toList();
    }

    private List<VariantPlan> actionableVariants(List<VariantPlan> plans) {
        return plans.stream().filter(plan -> plan.action() == Action.INSERT
                || plan.action() == Action.UPDATE_FILL_BLANKS).toList();
    }

    private List<ArticlePlan> actionableArticles(List<ArticlePlan> plans) {
        return plans.stream().filter(plan -> plan.action() == Action.INSERT
                || plan.action() == Action.UPDATE_FILL_BLANKS).toList();
    }

    private List<TargetContentRewritePlan> actionableTargetContentRewrites(
            List<TargetContentRewritePlan> plans) {
        return plans.stream().filter(plan -> plan.action() == Action.REWRITE_URLS_ONLY).toList();
    }

    private List<RedirectPlan> actionableRedirects(List<RedirectPlan> plans) {
        return plans.stream().filter(plan -> plan.action() == Action.INSERT
                || plan.action() == Action.UPDATE_REDIRECT_TARGET).toList();
    }

    private String mediaPlanKey(MediaPlan plan) {
        return String.valueOf(plan.sourceAttachmentId()) + "|" + plan.sourceRelativePath()
                + "|" + plan.sha256();
    }

    private void safeRollback(Connection connection) {
        try {
            connection.rollback();
        } catch (Exception ignored) {
            // Preserve the original failure.
        }
    }

    private String safeMessage(Exception error) {
        String value = error.getMessage();
        if (!hasText(value)) value = error.getClass().getSimpleName();
        return value.length() > 500 ? value.substring(0, 500) : value;
    }

    @FunctionalInterface
    private interface RowWriter<T> {
        DomainCounts write(T row) throws Exception;
    }

    private record RunState(boolean existed, String previousStatus) {}

    private record SourceMediaMetadata(
            String mimeType, String altText, String title, Integer width, Integer height) {}

    private record ContentFieldTarget(String table, String column, boolean json) {}

    private record MediaBinding(
            String targetId,
            Long legacyId,
            String relativePath,
            String sha256,
            Long fileSize,
            Path sourcePath,
            String objectKey,
            String publicUrl,
            String bucket,
            String mimeType,
            String altText,
            String title,
            Integer width,
            Integer height,
            boolean plannedObject) {}

    private record MediaBindings(
            Map<String, MediaBinding> byPlanKey,
            Map<Long, MediaBinding> byAttachment,
            Map<String, MediaBinding> byRelative,
            Map<String, String> publicUrlsByRelative) {}
}
