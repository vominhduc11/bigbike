package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.UpdateMediaRequest;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaSpecifications;
import com.bigbike.bigbike_backend.service.common.PageResult;
import tools.jackson.databind.ObjectMapper;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
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

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final Set<String> ALLOWED_STATUSES = Set.of("ACTIVE", "INACTIVE", "DELETED");
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
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

    public AdminMediaService(
            MediaJpaRepository mediaRepo,
            AuditLogJpaRepository auditLogRepo,
            MinioClient minioClient,
            MinioProperties minioProperties,
            ObjectMapper objectMapper
    ) {
        this.mediaRepo = mediaRepo;
        this.auditLogRepo = auditLogRepo;
        this.minioClient = minioClient;
        this.minioProperties = minioProperties;
        this.objectMapper = objectMapper;
    }

    // ── Upload ────────────────────────────────────────────────────────────────

    @Transactional
    public AdminMediaDetailResponse uploadMedia(MultipartFile file, String altText, UUID adminId) {
        String mimeType = file.getContentType() != null
                ? file.getContentType().toLowerCase(Locale.ROOT) : "";
        if (!ALLOWED_MIME_TYPES.contains(mimeType)) {
            throw ValidationException.fromField("file", "INVALID_MIME",
                    "Unsupported file type: " + mimeType);
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw ValidationException.fromField("file", "FILE_TOO_LARGE",
                    "File exceeds 50 MB limit.");
        }

        String safeFilename = sanitizeFilename(file.getOriginalFilename());
        String objectKey = "uploads/" + UUID.randomUUID() + "/" + safeFilename;
        String bucket = minioProperties.getBucket();

        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .stream(file.getInputStream(), file.getSize(), -1)
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
                BufferedImage img = ImageIO.read(file.getInputStream());
                if (img != null) {
                    width = img.getWidth();
                    height = img.getHeight();
                }
            } catch (IOException e) {
                log.warn("Could not extract image dimensions for {}: {}", safeFilename, e.getMessage());
            }
        }

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
        media.setStatus("ACTIVE");
        media.setCreatedAt(now);
        media.setUpdatedAt(now);
        MediaEntity saved = mediaRepo.save(media);

        auditLogRepo.save(buildAudit(adminId, "MEDIA_UPLOADED", saved.getId(), null,
                toJson(Map.of("filePath", objectKey, "mimeType", mimeType))));

        return toDetail(saved);
    }

    // ── List ──────────────────────────────────────────────────────────────────

    public PageResult<AdminMediaListItemResponse> listMedia(
            int page, int size, String q, String mimeType, String status, String storageProvider
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        // Build specification — exclude DELETED unless caller explicitly requests it
        Specification<MediaEntity> spec;
        if (status != null && !status.isBlank()) {
            spec = MediaSpecifications.withStatus(status);
        } else {
            spec = MediaSpecifications.excludeDeleted();
        }

        if (q != null && !q.isBlank()) {
            spec = spec.and(MediaSpecifications.matchesSearch(q));
        }
        if (mimeType != null && !mimeType.isBlank()) {
            spec = spec.and(MediaSpecifications.withMimeTypePrefix(mimeType));
        }
        if (storageProvider != null && !storageProvider.isBlank()) {
            spec = spec.and(MediaSpecifications.withStorageProvider(storageProvider));
        }

        PageRequest pageRequest = PageRequest.of(
                normalizedPage - 1, normalizedSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<MediaEntity> dbPage = mediaRepo.findAll(spec, pageRequest);

        return new PageResult<>(
                dbPage.getContent().stream().map(this::toListItem).toList(),
                normalizedPage,
                normalizedSize,
                dbPage.getTotalElements(),
                dbPage.getTotalPages() == 0 ? 1 : dbPage.getTotalPages());
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
        media.setUpdatedAt(Instant.now());
        mediaRepo.save(media);

        auditLogRepo.save(buildAudit(adminId, "MEDIA_UPDATED", mediaId, before, snapshot(media)));

        return toDetail(media);
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

    // ── Hard delete (permanent) ───────────────────────────────────────────────

    @Transactional
    public void hardDeleteMedia(UUID mediaId, UUID adminId) {
        MediaEntity media = mediaRepo.findById(mediaId)
                .orElseThrow(() -> new NotFoundException("Media not found."));

        // Remove from object storage
        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(minioProperties.getBucket())
                            .object(media.getFilePath())
                            .build());
        } catch (Exception e) {
            log.warn("Could not remove object {} from MinIO: {}", media.getFilePath(), e.getMessage());
        }

        auditLogRepo.save(buildAudit(adminId, "MEDIA_HARD_DELETED", mediaId,
                snapshot(media), null));
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

    private AdminMediaListItemResponse toListItem(MediaEntity m) {
        return new AdminMediaListItemResponse(
                m.getId(), m.getLegacyId(), m.getFilePath(), m.getPublicUrl(),
                m.getStorageProvider(),
                m.getMimeType(), m.getFileSize(), m.getWidth(), m.getHeight(),
                m.getAltText(), m.getTitle(), m.getCaption(),
                m.getStatus(), m.getCreatedAt(), m.getUpdatedAt());
    }

    private AdminMediaDetailResponse toDetail(MediaEntity m) {
        return new AdminMediaDetailResponse(
                m.getId(), m.getLegacyId(), m.getFilePath(), m.getPublicUrl(),
                m.getStorageProvider(),
                m.getMimeType(), m.getFileSize(), m.getWidth(), m.getHeight(),
                m.getAltText(), m.getTitle(), m.getCaption(),
                m.getSizes(), m.getStatus(), m.getCreatedAt(), m.getUpdatedAt());
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

    private static String sanitizeFilename(String original) {
        if (original == null || original.isBlank()) return "upload";
        // Keep extension intact, sanitize the rest
        String name = original.replaceAll("[^a-zA-Z0-9._-]", "_").toLowerCase(Locale.ROOT);
        return name.length() > 200 ? name.substring(0, 200) : name;
    }
}
