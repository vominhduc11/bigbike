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
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.media.CompressionProfile;
import com.bigbike.bigbike_backend.service.media.ImageCompressionService;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaFolderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaSpecifications;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaTagJdbc;
import com.bigbike.bigbike_backend.service.common.PageResult;
import static com.bigbike.bigbike_backend.service.admin.MediaServiceHelpers.buildSort;
import static com.bigbike.bigbike_backend.service.admin.MediaServiceHelpers.nvl;
import static com.bigbike.bigbike_backend.service.admin.MediaServiceHelpers.sameMimeGroup;
import static com.bigbike.bigbike_backend.service.admin.MediaServiceHelpers.sanitizeFilename;
import static com.bigbike.bigbike_backend.service.admin.MediaServiceHelpers.startsWith;
import tools.jackson.databind.ObjectMapper;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminMediaService {

    private static final Tika TIKA = new Tika();
    private static final int TIKA_HEADER_BYTES = 8192;

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final Set<String> ALLOWED_STATUSES = Set.of("ACTIVE", "INACTIVE", "DELETED");
    // Audio removed (owner decision 2026-07-15, AUD-074): Media Library accepts images
    // (+ SVG) and mp4 video only. The admin never uploaded audio and the storefront has
    // no audio surface. Legacy audio objects already in MinIO are left untouched.
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
            "video/mp4");
    private static final String SVG_MIME = "image/svg+xml";
    private static final Set<String> RASTER_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif");
    private static final long MAX_UPLOAD_BYTES = 200L * 1024 * 1024; // 200 MB
    private static final String MINIO_PROVIDER = "MINIO";
    static final String MEDIA_PATH_PREFIX = "/media/";
    // Stored original is capped at 2000px wide (owner-approved, MEDIA_RULE_006) — variants
    // (thumb/medium/large, max 1600px) are always smaller anyway, so this only shrinks what
    // gets served when someone requests the full-size original directly.
    private static final CompressionProfile ADMIN_ORIGINAL_PROFILE =
            new CompressionProfile(2000, 2000, 0.85f, false);

    private final MediaJpaRepository mediaRepo;
    private final MediaFolderJpaRepository mediaFolderRepo;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;
    private final MinioClient minioClient;
    private final MinioProperties minioProperties;
    private final ObjectMapper objectMapper;
    private final MediaReferenceService mediaReferenceService;
    private final MediaTagJdbc tagRepo;
    private final ImageVariantService imageVariantService;
    private final ImageCompressionService imageCompressionService;

    // ── Upload ────────────────────────────────────────────────────────────────

    @Transactional
    public AdminMediaDetailResponse uploadMedia(
            MultipartFile file, String altText, UUID folderId, boolean clearFolder, UUID adminId) {
        validateMimeContent(file);
        if (folderId != null) requireMediaFolder(folderId);
        // Đích upload rõ ràng khi admin đang đứng trong 1 thư mục cụ thể HOẶC đang xem
        // "Chưa phân loại" (clearFolder) — chỉ "Tất cả" (cả hai đều rỗng) là không có đích.
        boolean hasExplicitDestination = clearFolder || folderId != null;

        String mimeType = file.getContentType() != null
                ? file.getContentType().toLowerCase(Locale.ROOT) : "";
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw ValidationException.fromField("file", "FILE_TOO_LARGE",
                    "File exceeds 200 MB limit.");
        }

        // Read bytes once — reused for: MinIO upload, dimension extraction, variant generation
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read upload bytes: " + e.getMessage(), e);
        }
        // SVG: strip scripts/handlers/external refs before storing (also validates it IS an SVG).
        if (SVG_MIME.equals(mimeType)) {
            bytes = SvgSanitizer.sanitize(bytes);
        }

        // Extract raster dimensions for metadata before writing to MinIO. The library upload has
        // no shared minimum pixel floor; position-specific ratio checks happen when a media item
        // is assigned to a field in the admin UI.
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
                log.warn("Could not extract image dimensions for {}: {}", file.getOriginalFilename(), e.getMessage());
            }
        }

        // Downscale the stored original (MEDIA_RULE_006) without upscaling. width/height are
        // re-measured below from what's actually written to MinIO, not from the uploaded bytes.
        if (mimeType.startsWith("image/")) {
            bytes = imageCompressionService.compress(bytes, mimeType, ADMIN_ORIGINAL_PROFILE);
            if (RASTER_IMAGE_TYPES.contains(mimeType)) {
                try {
                    BufferedImage compressedImg = ImageIO.read(new java.io.ByteArrayInputStream(bytes));
                    if (compressedImg != null) {
                        width = compressedImg.getWidth();
                        height = compressedImg.getHeight();
                    }
                } catch (IOException e) {
                    log.warn("Could not re-measure compressed image for {}: {}", file.getOriginalFilename(), e.getMessage());
                }
            }
        }

        String contentSha256 = sha256Hex(bytes);
        var duplicate = mediaRepo.findByContentSha256(contentSha256);
        if (duplicate.isPresent()) {
            MediaEntity existing = duplicate.get();
            boolean changed = false;
            if ((existing.getAltText() == null || existing.getAltText().isBlank())
                    && altText != null && !altText.isBlank()) {
                existing.setAltText(altText.strip());
                changed = true;
            }
            if (!"ACTIVE".equals(existing.getStatus())) {
                existing.setStatus("ACTIVE");
                changed = true;
            }
            // Admin uploaded this content while standing in a specific folder (or
            // explicitly in "Chưa phân loại") — honor that placement even though the
            // bytes already exist elsewhere in the library.
            if (hasExplicitDestination && !java.util.Objects.equals(folderId, existing.getFolderId())) {
                existing.setFolderId(folderId);
                changed = true;
            }
            if (changed) {
                existing.setUpdatedAt(Instant.now());
                mediaRepo.save(existing);
            }
            auditLogWriter.save(auditLogFactory.build(
                    "ADMIN", adminId, "MEDIA_DEDUP_REUSED", "MEDIA", existing.getId(), null,
                    toJson(Map.of("contentSha256", contentSha256))));
            return toDetail(existing);
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
        // `bytes` always reflects what was actually written to MinIO — sanitized SVG, compressed
        // raster image, or the untouched original for anything else (e.g. video/mp4).
        media.setFileSize((long) bytes.length);
        media.setContentSha256(contentSha256);
        media.setWidth(width);
        media.setHeight(height);
        media.setAltText(altText != null ? altText.strip() : null);
        media.setTitle(safeFilename);
        media.setSizes(sizesJson);
        media.setStatus("ACTIVE");
        media.setFolderId(folderId);
        media.setCreatedAt(now);
        media.setUpdatedAt(now);
        MediaEntity saved = mediaRepo.save(media);

        auditLogWriter.save(auditLogFactory.build("ADMIN", adminId, "MEDIA_UPLOADED", "MEDIA", saved.getId(), null,
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
                    "File exceeds 200 MB limit.");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read upload bytes: " + e.getMessage(), e);
        }
        // SVG: strip scripts/handlers/external refs before storing (also validates it IS an SVG).
        if (SVG_MIME.equals(newMime)) {
            bytes = SvgSanitizer.sanitize(bytes);
        }

        // Extract raster dimensions for metadata before overwriting storage. Replacement follows
        // the same no-shared-minimum rule as a new library upload.
        Integer width = null, height = null;
        if (RASTER_IMAGE_TYPES.contains(newMime)) {
            try {
                BufferedImage img = ImageIO.read(new java.io.ByteArrayInputStream(bytes));
                if (img != null) { width = img.getWidth(); height = img.getHeight(); }
            } catch (IOException ignored) {}
        }

        // Downscale the stored original (MEDIA_RULE_006) — same reasoning as uploadMedia().
        if (newMime.startsWith("image/")) {
            bytes = imageCompressionService.compress(bytes, newMime, ADMIN_ORIGINAL_PROFILE);
            if (RASTER_IMAGE_TYPES.contains(newMime)) {
                try {
                    BufferedImage compressedImg = ImageIO.read(new java.io.ByteArrayInputStream(bytes));
                    if (compressedImg != null) { width = compressedImg.getWidth(); height = compressedImg.getHeight(); }
                } catch (IOException ignored) {}
            }
        }

        String contentSha256 = sha256Hex(bytes);
        mediaRepo.findByContentSha256(contentSha256)
                .filter(other -> !other.getId().equals(mediaId))
                .ifPresent(other -> {
                    throw new ConflictException(
                            "An identical media object already exists; reuse that media item instead.");
                });

        String before = snapshot(media);
        String objectKey = media.getFilePath();
        String bucket = media.getBucket() != null && !media.getBucket().isBlank()
                ? media.getBucket()
                : minioProperties.getBucket();

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

        // Old variants are stale — remove them, then regenerate
        imageVariantService.deleteVariants(objectKey, bucket);
        Map<String, String> variants = imageVariantService.generateAndUpload(bytes, objectKey, newMime, bucket);

        media.setMimeType(newMime);
        media.setFileSize((long) bytes.length);
        media.setContentSha256(contentSha256);
        // Replacing a raster with SVG/undecodable legacy image must clear stale
        // dimensions instead of reporting the previous file's width/height.
        media.setWidth(width);
        media.setHeight(height);
        media.setSizes(variants.isEmpty() ? null : toJson(variants));
        media.setUpdatedAt(Instant.now());
        mediaRepo.save(media);

        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "MEDIA_FILE_REPLACED", "MEDIA", mediaId, before, snapshot(media)));

        return toDetail(media);
    }

    // ── List ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<MediaReferenceItem> getMediaReferences(UUID mediaId) {
        MediaEntity media = mediaRepo.findById(mediaId)
                .orElseThrow(() -> new NotFoundException("Media not found."));
        return mediaReferenceService.getReferences(media);
    }

    @Transactional(readOnly = true)
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

    @Transactional(readOnly = true)
    public AdminMediaStatsResponse getStats(MediaListQuery query) {
        // Stats are computed against the same filters as listMedia minus usageFilter and
        // pagination — we want totals across all matching items.
        Specification<MediaEntity> spec = buildBaseSpec(query);
        List<MediaEntity> all = mediaRepo.findAll(spec);

        long total = all.size();
        long activeCount = all.stream().filter(m -> "ACTIVE".equalsIgnoreCase(m.getStatus())).count();
        long deletedCount = all.stream().filter(m -> "DELETED".equalsIgnoreCase(m.getStatus())).count();
        long sizeKnownCount = all.stream().filter(m -> m.getFileSize() != null).count();
        long totalSize = all.stream().filter(m -> m.getFileSize() != null).mapToLong(m -> m.getFileSize().longValue()).sum();

        Set<UUID> usedIds = mediaReferenceService.getUsedMediaIds(all);
        long used = all.stream().filter(m -> usedIds.contains(m.getId())).count();
        long unused = total - used;

        Map<String, Long> byMime = new HashMap<>();
        byMime.put("image", all.stream().filter(m -> startsWith(m.getMimeType(), "image/")).count());
        byMime.put("video", all.stream().filter(m -> startsWith(m.getMimeType(), "video/")).count());
        // No "audio" group — audio uploads are rejected (AUD-074). Any legacy audio object
        // in MinIO is left in place but no longer surfaced as a filterable category.

        return new AdminMediaStatsResponse(total, used, unused, activeCount, deletedCount, byMime, totalSize, sizeKnownCount);
    }

    private Specification<MediaEntity> buildBaseSpec(MediaListQuery query) {
        Specification<MediaEntity> spec;
        if (query.status() != null && !query.status().isBlank()) {
            spec = MediaSpecifications.withStatus(query.status());
        } else {
            spec = MediaSpecifications.excludeDeleted();
        }

        if (query.q() != null && !query.q().isBlank()) {
            Specification<MediaEntity> searchSpec = MediaSpecifications.matchesSearch(query.q());
            Set<UUID> tagMatchIds = tagRepo.mediaIdsWithTagContaining(query.q());
            if (!tagMatchIds.isEmpty()) {
                searchSpec = searchSpec.or(MediaSpecifications.idIn(tagMatchIds));
            }
            spec = spec.and(searchSpec);
        }
        if (query.mimeType() != null && !query.mimeType().isBlank()) {
            spec = spec.and(MediaSpecifications.withMimeTypePrefix(query.mimeType()));
        }
        if (query.storageProvider() != null && !query.storageProvider().isBlank()) {
            spec = spec.and(MediaSpecifications.withStorageProvider(query.storageProvider()));
        }

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

    // ── Detail ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
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

        // Folder: clearFolder=true takes precedence over folderId
        if (Boolean.TRUE.equals(req.clearFolder())) {
            media.setFolderId(null);
        } else if (req.folderId() != null) {
            requireMediaFolder(req.folderId());
            media.setFolderId(req.folderId());
        }

        media.setUpdatedAt(Instant.now());
        mediaRepo.save(media);

        if (req.tags() != null) {
            tagRepo.replaceTags(mediaId, req.tags());
        }

        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "MEDIA_UPDATED", "MEDIA", mediaId, before, snapshot(media)));

        return toDetail(media);
    }

    @Transactional
    public int bulkMoveToFolder(List<UUID> mediaIds, UUID folderId, UUID adminId) {
        if (mediaIds == null || mediaIds.isEmpty()) return 0;
        if (folderId != null) requireMediaFolder(folderId);
        int count = 0;
        for (UUID id : mediaIds) {
            MediaEntity m = mediaRepo.findById(id).orElse(null);
            if (m == null) continue;
            String before = snapshot(m);
            m.setFolderId(folderId); // null is allowed → clears folder
            m.setUpdatedAt(Instant.now());
            mediaRepo.save(m);
            auditLogWriter.save(auditLogFactory.build(
                    "ADMIN", adminId, "MEDIA_MOVED_FOLDER", "MEDIA", id, before, snapshot(m)));
            count++;
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

        auditLogWriter.save(auditLogFactory.build("ADMIN", adminId, "MEDIA_DELETED", "MEDIA", mediaId,
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
    @Transactional
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

        if (!"DELETED".equals(media.getStatus())) {
            throw new ConflictException("Only soft-deleted media (status=DELETED) can be permanently deleted.");
        }

        if (mediaReferenceService.hasReferences(media)) {
            throw new ConflictException(
                    "Media is referenced by other content and cannot be permanently deleted.");
        }

        String before = snapshot(media);

        // Storage deletion must succeed before the DB row is removed.
        // If MinIO fails, the exception propagates and the transaction rolls back (no DB delete).
        String bucket = media.getBucket() != null && !media.getBucket().isBlank()
                ? media.getBucket()
                : minioProperties.getBucket();
        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(bucket)
                            .object(media.getFilePath())
                            .build());
        } catch (Exception e) {
            throw new IllegalStateException(
                    "Storage deletion failed; database record retained. Cause: " + e.getMessage(), e);
        }

        // Variants are best-effort — we already committed to deleting the original
        imageVariantService.deleteVariants(media.getFilePath(), bucket);

        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "MEDIA_HARD_DELETED", "MEDIA", mediaId, before, null));
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

        auditLogWriter.save(auditLogFactory.build("ADMIN", adminId, "MEDIA_RESTORED", "MEDIA", mediaId,
                before, toJson(Map.of("status", "ACTIVE"))));

        return toDetail(media);
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private AdminMediaListItemResponse toListItemWithUsageAndTags(MediaEntity m, int usageCount, List<String> tags) {
        return new AdminMediaListItemResponse(
                m.getId(), m.getLegacyId(), m.getFilePath(), m.getPublicUrl(),
                m.getStorageProvider(),
                m.getMimeType(), m.getFileSize(), m.getWidth(), m.getHeight(),
                m.getAltText(), m.getTitle(),
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
                m.getAltText(), m.getTitle(),
                m.getSizes(), m.getStatus(), m.getCreatedAt(), m.getUpdatedAt(),
                refs.size(), refs, m.getFolderId(), tags);
    }

    // ── Audit helpers ─────────────────────────────────────────────────────────

    private String snapshot(MediaEntity m) {
        return toJson(Map.of(
                "altText", nvl(m.getAltText()),
                "title", nvl(m.getTitle()),
                "status", nvl(m.getStatus())));
    }

    private void requireMediaFolder(UUID folderId) {
        if (!mediaFolderRepo.existsById(folderId)) {
            throw new NotFoundException("Media folder not found.");
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Failed to serialize audit JSON: {}", e.getMessage());
            return "{}";
        }
    }

    private String sha256Hex(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

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
        // SVG is XML — Tika magic-byte detection is unreliable for it. Structural validation
        // (must parse to an <svg> root) + sanitization happen in SvgSanitizer before storage.
        if (SVG_MIME.equals(declared)) {
            return;
        }
        String detected = TIKA.detect(Arrays.copyOf(header, read), file.getOriginalFilename());
        if (!ALLOWED_MIME_TYPES.contains(detected)) {
            throw ValidationException.fromField("file", "MIME_MISMATCH",
                    "File content does not match an allowed type (detected: " + detected + ").");
        }
    }
}
