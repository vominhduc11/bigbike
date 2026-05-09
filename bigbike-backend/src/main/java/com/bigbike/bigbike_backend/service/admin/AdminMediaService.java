package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaStatsResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.MediaListQuery;
import com.bigbike.bigbike_backend.api.admin.dto.media.MediaReferenceItem;
import com.bigbike.bigbike_backend.api.admin.dto.media.UpdateMediaRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaSpecifications;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaTagJdbc;
import com.bigbike.bigbike_backend.service.common.PageResult;
import tools.jackson.databind.ObjectMapper;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.apache.tika.Tika;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AdminMediaService {

    private static final Logger log = LoggerFactory.getLogger(AdminMediaService.class);
    private static final Tika TIKA = new Tika();
    private static final int TIKA_HEADER_BYTES = 8192;

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final Set<String> ALLOWED_STATUSES = Set.of("ACTIVE", "INACTIVE", "DELETED");
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif",
            "video/mp4",
            "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "audio/aac");
    private static final Set<String> RASTER_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif");
    private static final long MAX_UPLOAD_BYTES = 50L * 1024 * 1024; // 50 MB
    private static final String MINIO_PROVIDER = "MINIO";
    static final String MEDIA_PATH_PREFIX = "/media/";

    private final MediaJpaRepository mediaRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final MinioClient minioClient;
    private final MinioProperties minioProperties;
    private final ObjectMapper objectMapper;
    private final MediaReferenceService mediaReferenceService;
    private final MediaTagJdbc tagRepo;
    private final ImageVariantService imageVariantService;

    public AdminMediaService(
            MediaJpaRepository mediaRepo,
            AuditLogJpaRepository auditLogRepo,
            MinioClient minioClient,
            MinioProperties minioProperties,
            ObjectMapper objectMapper,
            MediaReferenceService mediaReferenceService,
            MediaTagJdbc tagRepo,
            ImageVariantService imageVariantService
    ) {
        this.mediaRepo = mediaRepo;
        this.auditLogRepo = auditLogRepo;
        this.minioClient = minioClient;
        this.minioProperties = minioProperties;
        this.objectMapper = objectMapper;
        this.mediaReferenceService = mediaReferenceService;
        this.tagRepo = tagRepo;
        this.imageVariantService = imageVariantService;
    }

    // ── Upload ────────────────────────────────────────────────────────────────

    @Transactional
    public AdminMediaDetailResponse uploadMedia(MultipartFile file, String altText, UUID adminId) {
        validateMimeContent(file);

        String mimeType = file.getContentType() != null
                ? file.getContentType().toLowerCase(Locale.ROOT) : "";
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw ValidationException.fromField("file", "FILE_TOO_LARGE",
                    "File exceeds 50 MB limit.");
        }

        // Read bytes once — reused for: MinIO upload, dimension extraction, variant generation
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read upload bytes: " + e.getMessage(), e);
        }

        String safeFilename = sanitizeFilename(file.getOriginalFilename());
        String objectKey = "uploads/" + UUID.randomUUID() + "/" + safeFilename;
        String bucket = minioProperties.getBucket();

        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .stream(new java.io.ByteArrayInputStream(bytes), bytes.length, -1)
                            .contentType(mimeType)
                            .build());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to upload file to storage: " + e.getMessage(), e);
        }

        // Relative public URL — clients rewrite via /media/* proxy
        String publicUrl = MEDIA_PATH_PREFIX + objectKey;

        // Extract image dimensions for raster types
        Integer width = null;
        Integer height = null;
        if (RASTER_IMAGE_TYPES.contains(mimeType)) {
            try {
                BufferedImage img = ImageIO.read(new java.io.ByteArrayInputStream(bytes));
                if (img != null) {
                    width = img.getWidth();
                    height = img.getHeight();
                }
            } catch (IOException e) {
                log.warn("Could not extract image dimensions for {}: {}", safeFilename, e.getMessage());
            }
        }

        // Generate responsive variants (thumb/medium/large) and store paths in `sizes` JSON
        Map<String, String> variants = imageVariantService.generateAndUpload(bytes, objectKey, mimeType);
        String sizesJson = variants.isEmpty() ? null : toJson(variants);

        Instant now = Instant.now();
        MediaEntity media = new MediaEntity();
        media.setFilePath(objectKey);
        media.setPublicUrl(publicUrl);
        media.setStorageProvider(MINIO_PROVIDER);
        media.setBucket(bucket);
        media.setMimeType(mimeType);
        media.setFileSize(file.getSize());
        media.setWidth(width);
        media.setHeight(height);
        media.setAltText(altText != null ? altText.strip() : null);
        media.setTitle(safeFilename);
        media.setSizes(sizesJson);
        media.setStatus("ACTIVE");
        media.setCreatedAt(now);
        media.setUpdatedAt(now);
        MediaEntity saved = mediaRepo.save(media);

        auditLogRepo.save(buildAudit(adminId, "MEDIA_UPLOADED", saved.getId(), null,
                toJson(Map.of("filePath", objectKey, "mimeType", mimeType,
                        "variants", variants.keySet()))));

        return toDetail(saved);
    }

    /**
     * Replace the underlying file of an existing media record while keeping the
     * URL and DB id stable. Re-extracts dimensions and re-generates variants.
     *
     * <p>Used to update an image without breaking links anywhere it's referenced.
     */
    @Transactional
    public AdminMediaDetailResponse replaceFile(UUID mediaId, MultipartFile file, UUID adminId) {
        validateMimeContent(file);
        MediaEntity media = mediaRepo.findById(mediaId)
                .orElseThrow(() -> new NotFoundException("Media not found."));

        String newMime = file.getContentType() != null
                ? file.getContentType().toLowerCase(Locale.ROOT) : "";
        // Replacing across mime families breaks too many assumptions (image → audio, etc.)
        if (media.getMimeType() != null && !sameMimeGroup(media.getMimeType(), newMime)) {
            throw ValidationException.fromField("file", "MIME_GROUP_MISMATCH",
                    "Replacement must be the same media type (image/video/audio).");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw ValidationException.fromField("file", "FILE_TOO_LARGE",
                    "File exceeds 50 MB limit.");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read upload bytes: " + e.getMessage(), e);
        }

        String before = snapshot(media);
        String objectKey = media.getFilePath();
        String bucket = media.getBucket() != null ? media.getBucket() : minioProperties.getBucket();

        // Overwrite original at the same key — URL stays valid for everyone referencing it
        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .stream(new java.io.ByteArrayInputStream(bytes), bytes.length, -1)
                            .contentType(newMime)
                            .build());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to overwrite file in storage: " + e.getMessage(), e);
        }

        // Re-extract dimensions for raster types
        Integer width = null, height = null;
        if (RASTER_IMAGE_TYPES.contains(newMime)) {
            try {
                BufferedImage img = ImageIO.read(new java.io.ByteArrayInputStream(bytes));
                if (img != null) { width = img.getWidth(); height = img.getHeight(); }
            } catch (IOException ignored) {}
        }

        // Old variants are stale — remove them, then regenerate
        imageVariantService.deleteVariants(objectKey);
        Map<String, String> variants = imageVariantService.generateAndUpload(bytes, objectKey, newMime);

        media.setMimeType(newMime);
        media.setFileSize(file.getSize());
        if (width != null) media.setWidth(width);
        if (height != null) media.setHeight(height);
        media.setSizes(variants.isEmpty() ? null : toJson(variants));
        media.setUpdatedAt(Instant.now());
        mediaRepo.save(media);

        auditLogRepo.save(buildAudit(adminId, "MEDIA_FILE_REPLACED", mediaId, before, snapshot(media)));

        return toDetail(media);
    }

    private static boolean sameMimeGroup(String a, String b) {
        if (a == null || b == null) return false;
        int slashA = a.indexOf('/'), slashB = b.indexOf('/');
        if (slashA < 0 || slashB < 0) return a.equalsIgnoreCase(b);
        return a.substring(0, slashA).equalsIgnoreCase(b.substring(0, slashB));
    }

    // ── List ──────────────────────────────────────────────────────────────────

    public List<MediaReferenceItem> getMediaReferences(UUID mediaId) {
        MediaEntity media = mediaRepo.findById(mediaId)
                .orElseThrow(() -> new NotFoundException("Media not found."));
        return mediaReferenceService.getReferences(media);
    }

    public PageResult<AdminMediaListItemResponse> listMedia(MediaListQuery query) {
        int normalizedPage = Math.max(1, query.page());
        int normalizedSize = (query.size() <= 0) ? DEFAULT_SIZE : Math.min(query.size(), MAX_SIZE);

        Specification<MediaEntity> spec = buildBaseSpec(query);
        Sort sort = buildSort(query.sort(), query.dir());

        String normalizedUsage = (query.usageFilter() == null) ? "ALL"
                : query.usageFilter().toUpperCase(Locale.ROOT);
        boolean filterByUsage = "USED".equals(normalizedUsage) || "UNUSED".equals(normalizedUsage);
        boolean sortByUsage = "usageCount".equalsIgnoreCase(query.sort());

        if (filterByUsage || sortByUsage) {
            // usageCount is computed from cross-table reference checks — it cannot be
            // expressed as a JPA Specification or used as a Sort key. Load all candidates,
            // compute usage in one batch, then filter / sort / paginate in memory so total
            // counts and page boundaries stay correct.
            List<MediaEntity> all = mediaRepo.findAll(spec, sort);
            Set<UUID> usedIds = mediaReferenceService.getUsedMediaIds(all);

            List<MediaEntity> filtered = all;
            if (filterByUsage) {
                boolean wantUsed = "USED".equals(normalizedUsage);
                filtered = all.stream()
                        .filter(m -> usedIds.contains(m.getId()) == wantUsed)
                        .toList();
            }

            // Batch-compute usage counts for sorting and DTO mapping in one pass
            java.util.Map<UUID, Integer> usageMap = mediaReferenceService.getUsageCounts(filtered);

            if (sortByUsage) {
                boolean asc = "asc".equalsIgnoreCase(query.dir());
                filtered = filtered.stream()
                        .sorted((a, b) -> asc
                                ? Integer.compare(usageMap.getOrDefault(a.getId(), 0), usageMap.getOrDefault(b.getId(), 0))
                                : Integer.compare(usageMap.getOrDefault(b.getId(), 0), usageMap.getOrDefault(a.getId(), 0)))
                        .toList();
            }

            long totalElements = filtered.size();
            int totalPages = Math.max(1, (int) Math.ceil((double) totalElements / normalizedSize));
            int from = Math.min((normalizedPage - 1) * normalizedSize, filtered.size());
            int to = Math.min(from + normalizedSize, filtered.size());
            List<MediaEntity> pageSlice = filtered.subList(from, to);
            Map<UUID, List<String>> tagsByMedia = tagRepo.tagsForMany(
                    pageSlice.stream().map(MediaEntity::getId).toList());
            List<AdminMediaListItemResponse> items = pageSlice.stream()
                    .map(m -> toListItemWithUsageAndTags(m,
                            usageMap.getOrDefault(m.getId(), 0),
                            tagsByMedia.getOrDefault(m.getId(), List.of())))
                    .toList();

            return new PageResult<>(items, normalizedPage, normalizedSize, totalElements, totalPages);
        }

        PageRequest pageRequest = PageRequest.of(normalizedPage - 1, normalizedSize, sort);
        Page<MediaEntity> dbPage = mediaRepo.findAll(spec, pageRequest);

        // Batch-fetch usage counts (1 reference scan) and tags (1 join query)
        // for all items on this page — avoids N+1 (was: 13×N queries for refs + N for tags).
        List<MediaEntity> pageItems = dbPage.getContent();
        Map<UUID, Integer> usageCounts = mediaReferenceService.getUsageCounts(pageItems);
        Map<UUID, List<String>> tagsByMedia = tagRepo.tagsForMany(
                pageItems.stream().map(MediaEntity::getId).toList());

        List<AdminMediaListItemResponse> items = pageItems.stream()
                .map(m -> toListItemWithUsageAndTags(m,
                        usageCounts.getOrDefault(m.getId(), 0),
                        tagsByMedia.getOrDefault(m.getId(), List.of())))
                .toList();

        return new PageResult<>(
                items,
                normalizedPage,
                normalizedSize,
                dbPage.getTotalElements(),
                dbPage.getTotalPages() == 0 ? 1 : dbPage.getTotalPages());
    }

    public AdminMediaStatsResponse getStats(MediaListQuery query) {
        // Stats are computed against the same filters as listMedia minus usageFilter and
        // pagination — we want totals across all matching items.
        Specification<MediaEntity> spec = buildBaseSpec(query);
        List<MediaEntity> all = mediaRepo.findAll(spec);

        long total = all.size();
        long activeCount = all.stream().filter(m -> "ACTIVE".equalsIgnoreCase(m.getStatus())).count();
        long deletedCount = all.stream().filter(m -> "DELETED".equalsIgnoreCase(m.getStatus())).count();
        long totalSize = all.stream().mapToLong(m -> m.getFileSize() == null ? 0L : m.getFileSize()).sum();

        Set<UUID> usedIds = mediaReferenceService.getUsedMediaIds(all);
        long used = all.stream().filter(m -> usedIds.contains(m.getId())).count();
        long unused = total - used;

        Map<String, Long> byMime = new HashMap<>();
        byMime.put("image", all.stream().filter(m -> startsWith(m.getMimeType(), "image/")).count());
        byMime.put("video", all.stream().filter(m -> startsWith(m.getMimeType(), "video/")).count());
        byMime.put("audio", all.stream().filter(m -> startsWith(m.getMimeType(), "audio/")).count());

        return new AdminMediaStatsResponse(total, used, unused, activeCount, deletedCount, byMime, totalSize);
    }

    private static boolean startsWith(String s, String prefix) {
        return s != null && s.toLowerCase(Locale.ROOT).startsWith(prefix);
    }

    private Specification<MediaEntity> buildBaseSpec(MediaListQuery query) {
        Specification<MediaEntity> spec;
        if (query.status() != null && !query.status().isBlank()) {
            spec = MediaSpecifications.withStatus(query.status());
        } else {
            spec = MediaSpecifications.excludeDeleted();
        }

        if (query.q() != null && !query.q().isBlank()) {
            spec = spec.and(MediaSpecifications.matchesSearch(query.q()));
        }
        if (query.mimeType() != null && !query.mimeType().isBlank()) {
            spec = spec.and(MediaSpecifications.withMimeTypePrefix(query.mimeType()));
        }
        // Default to MINIO so editors don't see legacy WordPress metadata that has no
        // public URL. The param is still honored when explicitly passed for migration debugging.
        String effectiveProvider = (query.storageProvider() != null && !query.storageProvider().isBlank())
                ? query.storageProvider() : "MINIO";
        spec = spec.and(MediaSpecifications.withStorageProvider(effectiveProvider));

        if (query.uploadedFrom() != null) {
            spec = spec.and(MediaSpecifications.uploadedAfter(query.uploadedFrom()));
        }
        if (query.uploadedTo() != null) {
            spec = spec.and(MediaSpecifications.uploadedBefore(query.uploadedTo()));
        }
        if (query.minSize() != null && query.minSize() > 0) {
            spec = spec.and(MediaSpecifications.fileSizeAtLeast(query.minSize()));
        }
        if (query.maxSize() != null && query.maxSize() > 0) {
            spec = spec.and(MediaSpecifications.fileSizeAtMost(query.maxSize()));
        }
        if (query.minWidth() != null && query.minWidth() > 0) {
            spec = spec.and(MediaSpecifications.widthAtLeast(query.minWidth()));
        }
        if (query.minHeight() != null && query.minHeight() > 0) {
            spec = spec.and(MediaSpecifications.heightAtLeast(query.minHeight()));
        }
        if (query.folderFilter() != null && !query.folderFilter().isBlank()) {
            String f = query.folderFilter();
            if ("NONE".equalsIgnoreCase(f)) {
                spec = spec.and(MediaSpecifications.noFolder());
            } else {
                try {
                    spec = spec.and(MediaSpecifications.inFolder(UUID.fromString(f)));
                } catch (IllegalArgumentException ignored) { /* invalid UUID → no filter */ }
            }
        }
        if (query.tag() != null && !query.tag().isBlank()) {
            // tag matching uses a join table; restrict media IDs up front
            Set<UUID> mediaIds = tagRepo.mediaIdsWithTag(query.tag());
            spec = spec.and(MediaSpecifications.idIn(mediaIds));
        }
        return spec;
    }

    private static final Set<String> ALLOWED_SORT_KEYS = Set.of("createdAt", "fileSize", "title", "usageCount");

    private static Sort buildSort(String sortKey, String dir) {
        String key = (sortKey != null && ALLOWED_SORT_KEYS.contains(sortKey)) ? sortKey : "createdAt";
        // usageCount is computed in memory; fallback to createdAt for the DB-level sort
        if ("usageCount".equals(key)) key = "createdAt";
        Sort.Direction direction = "asc".equalsIgnoreCase(dir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        return Sort.by(direction, key);
    }

    // ── Detail ────────────────────────────────────────────────────────────────

    public AdminMediaDetailResponse getMediaDetail(UUID mediaId) {
        MediaEntity media = mediaRepo.findById(mediaId)
                .orElseThrow(() -> new NotFoundException("Media not found."));
        return toDetail(media);
    }

    // ── Update metadata ───────────────────────────────────────────────────────

    @Transactional
    public AdminMediaDetailResponse updateMedia(UUID mediaId, UUID adminId, UpdateMediaRequest req) {
        MediaEntity media = mediaRepo.findById(mediaId)
                .orElseThrow(() -> new NotFoundException("Media not found."));

        // Snapshot BEFORE any mutation
        String before = snapshot(media);

        if (req.status() != null) {
            String newStatus = req.status().toUpperCase(Locale.ROOT);
            if (!ALLOWED_STATUSES.contains(newStatus)) {
                throw ValidationException.fromField("status", "INVALID",
                        "Unknown media status: " + newStatus);
            }
            media.setStatus(newStatus);
        }
        if (req.altText() != null) media.setAltText(req.altText());
        if (req.title() != null) media.setTitle(req.title());
        if (req.caption() != null) media.setCaption(req.caption());

        // Folder: clearFolder=true takes precedence over folderId
        if (Boolean.TRUE.equals(req.clearFolder())) {
            media.setFolderId(null);
        } else if (req.folderId() != null) {
            media.setFolderId(req.folderId());
        }

        media.setUpdatedAt(Instant.now());
        mediaRepo.save(media);

        if (req.tags() != null) {
            tagRepo.replaceTags(mediaId, req.tags());
        }

        auditLogRepo.save(buildAudit(adminId, "MEDIA_UPDATED", mediaId, before, snapshot(media)));

        return toDetail(media);
    }

    @Transactional
    public int bulkMoveToFolder(List<UUID> mediaIds, UUID folderId, UUID adminId) {
        if (mediaIds == null || mediaIds.isEmpty()) return 0;
        int count = 0;
        for (UUID id : mediaIds) {
            try {
                MediaEntity m = mediaRepo.findById(id).orElse(null);
                if (m == null) continue;
                String before = snapshot(m);
                m.setFolderId(folderId); // null is allowed → clears folder
                m.setUpdatedAt(Instant.now());
                mediaRepo.save(m);
                auditLogRepo.save(buildAudit(adminId, "MEDIA_MOVED_FOLDER", id, before, snapshot(m)));
                count++;
            } catch (Exception ignored) { /* skip failures */ }
        }
        return count;
    }

    // ── Soft delete ───────────────────────────────────────────────────────────

    @Transactional
    public void deleteMedia(UUID mediaId, UUID adminId) {
        MediaEntity media = mediaRepo.findById(mediaId)
                .orElseThrow(() -> new NotFoundException("Media not found."));

        String before = snapshot(media);
        media.setStatus("DELETED");
        media.setUpdatedAt(Instant.now());
        mediaRepo.save(media);

        auditLogRepo.save(buildAudit(adminId, "MEDIA_DELETED", mediaId,
                before, toJson(Map.of("status", "DELETED"))));
    }

    @Transactional
    public int bulkSoftDelete(List<UUID> mediaIds, UUID adminId) {
        if (mediaIds == null || mediaIds.isEmpty()) return 0;
        int count = 0;
        for (UUID id : mediaIds) {
            try {
                deleteMedia(id, adminId);
                count++;
            } catch (NotFoundException ignored) {
                // skip missing ones — caller asked for best-effort
            }
        }
        return count;
    }

    @Transactional
    public int bulkRestore(List<UUID> mediaIds, UUID adminId) {
        if (mediaIds == null || mediaIds.isEmpty()) return 0;
        int count = 0;
        for (UUID id : mediaIds) {
            try {
                restoreMedia(id, adminId);
                count++;
            } catch (NotFoundException ignored) {
                // skip
            }
        }
        return count;
    }

    /**
     * Best-effort bulk hard delete — skips items that don't exist or have references.
     * Returns a summary of what happened so the UI can surface partial successes.
     */
    public BulkHardDeleteResult bulkHardDelete(List<UUID> mediaIds, UUID adminId) {
        if (mediaIds == null || mediaIds.isEmpty()) return new BulkHardDeleteResult(0, 0, 0);
        int deleted = 0, missing = 0, blocked = 0;
        for (UUID id : mediaIds) {
            try {
                hardDeleteMedia(id, adminId);
                deleted++;
            } catch (NotFoundException ignored) {
                missing++;
            } catch (ConflictException ignored) {
                blocked++;
            }
        }
        return new BulkHardDeleteResult(deleted, missing, blocked);
    }

    public record BulkHardDeleteResult(int deleted, int missing, int blocked) {}

    // ── Hard delete (permanent) ───────────────────────────────────────────────

    @Transactional
    public void hardDeleteMedia(UUID mediaId, UUID adminId) {
        MediaEntity media = mediaRepo.findById(mediaId)
                .orElseThrow(() -> new NotFoundException("Media not found."));

        if (mediaReferenceService.hasReferences(media)) {
            throw new ConflictException(
                    "Media is referenced by other content and cannot be permanently deleted.");
        }

        String before = snapshot(media);

        // Storage deletion must succeed before the DB row is removed.
        // If MinIO fails, the exception propagates and the transaction rolls back (no DB delete).
        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(minioProperties.getBucket())
                            .object(media.getFilePath())
                            .build());
        } catch (Exception e) {
            throw new IllegalStateException(
                    "Storage deletion failed; database record retained. Cause: " + e.getMessage(), e);
        }

        // Variants are best-effort — we already committed to deleting the original
        imageVariantService.deleteVariants(media.getFilePath());

        auditLogRepo.save(buildAudit(adminId, "MEDIA_HARD_DELETED", mediaId, before, null));
        mediaRepo.delete(media);
    }

    // ── Restore ───────────────────────────────────────────────────────────────

    @Transactional
    public AdminMediaDetailResponse restoreMedia(UUID mediaId, UUID adminId) {
        MediaEntity media = mediaRepo.findById(mediaId)
                .orElseThrow(() -> new NotFoundException("Media not found."));

        String before = snapshot(media);
        media.setStatus("ACTIVE");
        media.setUpdatedAt(Instant.now());
        mediaRepo.save(media);

        auditLogRepo.save(buildAudit(adminId, "MEDIA_RESTORED", mediaId,
                before, toJson(Map.of("status", "ACTIVE"))));

        return toDetail(media);
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    /**
     * Per-item DTO mapper. Falls back to single-row queries when called outside
     * a batch context (e.g. detail endpoint). Use {@link #toListItemWithUsageAndTags}
     * inside {@link #listMedia} to avoid N+1.
     */
    private AdminMediaListItemResponse toListItem(MediaEntity m) {
        int usageCount = mediaReferenceService.getReferences(m).size();
        List<String> tags = tagRepo.tagsFor(m.getId());
        return toListItemWithUsageAndTags(m, usageCount, tags);
    }

    /** @deprecated use {@link #toListItemWithUsageAndTags} for batch contexts */
    @Deprecated
    private AdminMediaListItemResponse toListItemWithUsage(MediaEntity m, int usageCount) {
        return toListItemWithUsageAndTags(m, usageCount, tagRepo.tagsFor(m.getId()));
    }

    private AdminMediaListItemResponse toListItemWithUsageAndTags(MediaEntity m, int usageCount, List<String> tags) {
        return new AdminMediaListItemResponse(
                m.getId(), m.getLegacyId(), m.getFilePath(), m.getPublicUrl(),
                m.getStorageProvider(),
                m.getMimeType(), m.getFileSize(), m.getWidth(), m.getHeight(),
                m.getAltText(), m.getTitle(), m.getCaption(),
                m.getStatus(), m.getCreatedAt(), m.getUpdatedAt(),
                usageCount, m.getFolderId(), tags);
    }

    private AdminMediaDetailResponse toDetail(MediaEntity m) {
        var refs = mediaReferenceService.getReferences(m);
        List<String> tags = tagRepo.tagsFor(m.getId());
        return new AdminMediaDetailResponse(
                m.getId(), m.getLegacyId(), m.getFilePath(), m.getPublicUrl(),
                m.getStorageProvider(),
                m.getMimeType(), m.getFileSize(), m.getWidth(), m.getHeight(),
                m.getAltText(), m.getTitle(), m.getCaption(),
                m.getSizes(), m.getStatus(), m.getCreatedAt(), m.getUpdatedAt(),
                refs.size(), refs, m.getFolderId(), tags);
    }

    // ── Audit helpers ─────────────────────────────────────────────────────────

    private AuditLogEntity buildAudit(UUID adminId, String action, UUID resourceId,
            String before, String after) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(adminId);
        log.setAction(action);
        log.setResourceType("MEDIA");
        log.setResourceId(resourceId);
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setCreatedAt(Instant.now());
        return log;
    }

    private String snapshot(MediaEntity m) {
        return toJson(Map.of(
                "altText", nvl(m.getAltText()),
                "title", nvl(m.getTitle()),
                "caption", nvl(m.getCaption()),
                "status", nvl(m.getStatus())));
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Failed to serialize audit JSON: {}", e.getMessage());
            return "{}";
        }
    }

    private static String nvl(String s) { return s != null ? s : ""; }

    // ── File helpers ──────────────────────────────────────────────────────────

    /**
     * Validates the declared Content-Type and detects the actual MIME type from the first
     * 8 KB of file content using Apache Tika magic-byte detection.
     * Rejects empty files, unsupported declared types, and content that doesn't match
     * any allowed MIME — preventing MIME spoofing attacks (P0-2).
     */
    private void validateMimeContent(MultipartFile file) {
        if (file.isEmpty() || file.getSize() == 0) {
            throw ValidationException.fromField("file", "EMPTY_FILE", "File must not be empty.");
        }
        String declared = file.getContentType() != null
                ? file.getContentType().toLowerCase(Locale.ROOT) : "";
        if (!ALLOWED_MIME_TYPES.contains(declared)) {
            throw ValidationException.fromField("file", "INVALID_MIME",
                    "Unsupported file type: " + declared);
        }
        byte[] header = new byte[TIKA_HEADER_BYTES];
        int read;
        try (InputStream is = file.getInputStream()) {
            read = is.read(header, 0, header.length);
        } catch (IOException e) {
            throw new IllegalStateException("Could not read file for MIME validation.", e);
        }
        if (read <= 0) {
            throw ValidationException.fromField("file", "EMPTY_FILE", "File must not be empty.");
        }
        String detected = TIKA.detect(Arrays.copyOf(header, read), file.getOriginalFilename());
        if (!ALLOWED_MIME_TYPES.contains(detected)) {
            throw ValidationException.fromField("file", "MIME_MISMATCH",
                    "File content does not match an allowed type (detected: " + detected + ").");
        }
    }

    private static String sanitizeFilename(String original) {
        if (original == null || original.isBlank()) return "upload";
        // Keep extension intact, sanitize the rest
        String name = original.replaceAll("[^a-zA-Z0-9._-]", "_").toLowerCase(Locale.ROOT);
        return name.length() > 200 ? name.substring(0, 200) : name;
    }
}
