package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.UpdateMediaRequest;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AdminMediaService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final Set<String> ALLOWED_STATUSES = Set.of("ACTIVE", "INACTIVE", "DELETED");
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "video/mp4");
    private static final long MAX_UPLOAD_BYTES = 50L * 1024 * 1024; // 50 MB

    private final MediaJpaRepository mediaRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final PaginationService paginationService;
    private final MinioClient minioClient;
    private final MinioProperties minioProperties;
    private final MediaUrlProperties mediaUrlProperties;

    public AdminMediaService(
            MediaJpaRepository mediaRepo,
            AuditLogJpaRepository auditLogRepo,
            PaginationService paginationService,
            MinioClient minioClient,
            MinioProperties minioProperties,
            MediaUrlProperties mediaUrlProperties
    ) {
        this.mediaRepo = mediaRepo;
        this.auditLogRepo = auditLogRepo;
        this.paginationService = paginationService;
        this.minioClient = minioClient;
        this.minioProperties = minioProperties;
        this.mediaUrlProperties = mediaUrlProperties;
    }

    // ── Upload ────────────────────────────────────────────────────────────────

    @Transactional
    public AdminMediaDetailResponse uploadMedia(MultipartFile file, String altText, UUID adminId) {
        String mimeType = file.getContentType() != null ? file.getContentType().toLowerCase(Locale.ROOT) : "";
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

        String publicUrl = mediaUrlProperties.getPublicBaseUrl() + "/" + objectKey;

        Instant now = Instant.now();
        MediaEntity media = new MediaEntity();
        media.setFilePath(objectKey);
        media.setPublicUrl(publicUrl);
        media.setStorageProvider("minio");
        media.setBucket(bucket);
        media.setMimeType(mimeType);
        media.setFileSize(file.getSize());
        media.setAltText(altText != null ? altText.strip() : null);
        media.setTitle(safeFilename);
        media.setStatus("ACTIVE");
        media.setCreatedAt(now);
        media.setUpdatedAt(now);
        MediaEntity saved = mediaRepo.save(media);

        auditLogRepo.save(buildAudit(adminId, "MEDIA_UPLOADED", saved.getId(), null,
                "{\"filePath\":\"" + objectKey + "\",\"mimeType\":\"" + mimeType + "\"}"));

        return toDetail(saved);
    }

    // ── List ──────────────────────────────────────────────────────────────────

    public PageResult<AdminMediaListItemResponse> listMedia(
            int page, int size, String q, String mimeType, String status, String storageProvider
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        Stream<MediaEntity> stream = mediaRepo.findAll().stream();

        if (q != null && !q.isBlank()) {
            String qLower = q.toLowerCase(Locale.ROOT);
            stream = stream.filter(m ->
                    matchesQ(m.getTitle(), qLower) ||
                    matchesQ(m.getFilePath(), qLower) ||
                    matchesQ(m.getAltText(), qLower)
            );
        }
        if (mimeType != null && !mimeType.isBlank()) {
            stream = stream.filter(m -> mimeType.equalsIgnoreCase(m.getMimeType()));
        }
        if (status != null && !status.isBlank()) {
            stream = stream.filter(m -> status.equalsIgnoreCase(m.getStatus()));
        }
        if (storageProvider != null && !storageProvider.isBlank()) {
            stream = stream.filter(m -> storageProvider.equalsIgnoreCase(m.getStorageProvider()));
        }

        List<AdminMediaListItemResponse> items = stream
                .sorted(Comparator.comparing(MediaEntity::getCreatedAt, Comparator.reverseOrder()))
                .map(this::toListItem)
                .toList();

        return paginationService.paginate(items, normalizedPage, normalizedSize);
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

        if (req.status() != null) {
            String newStatus = req.status().toUpperCase(Locale.ROOT);
            if (!ALLOWED_STATUSES.contains(newStatus)) {
                throw ValidationException.fromField("status", "INVALID", "Unknown media status: " + newStatus);
            }
            media.setStatus(newStatus);
        }

        String before = snapshot(media);

        if (req.altText() != null) media.setAltText(req.altText());
        if (req.title() != null) media.setTitle(req.title());
        if (req.caption() != null) media.setCaption(req.caption());
        media.setUpdatedAt(Instant.now());
        mediaRepo.save(media);

        auditLogRepo.save(buildAudit(adminId, "MEDIA_UPDATED", mediaId, before, snapshot(media)));

        return toDetail(media);
    }

    // ── Logical delete ────────────────────────────────────────────────────────

    @Transactional
    public void deleteMedia(UUID mediaId, UUID adminId) {
        MediaEntity media = mediaRepo.findById(mediaId)
                .orElseThrow(() -> new NotFoundException("Media not found."));

        String before = "{\"status\":\"" + media.getStatus() + "\"}";
        media.setStatus("DELETED");
        media.setUpdatedAt(Instant.now());
        mediaRepo.save(media);

        auditLogRepo.save(buildAudit(adminId, "MEDIA_DELETED", mediaId, before, "{\"status\":\"DELETED\"}"));
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private AdminMediaListItemResponse toListItem(MediaEntity m) {
        return new AdminMediaListItemResponse(
                m.getId(), m.getLegacyId(), m.getFilePath(), m.getPublicUrl(),
                m.getMimeType(), m.getFileSize(), m.getWidth(), m.getHeight(),
                m.getAltText(), m.getTitle(), m.getStatus(), m.getCreatedAt()
        );
    }

    private AdminMediaDetailResponse toDetail(MediaEntity m) {
        return new AdminMediaDetailResponse(
                m.getId(), m.getLegacyId(), m.getFilePath(), m.getPublicUrl(),
                m.getStorageProvider(),  // expose provider name, not bucket secret
                m.getMimeType(), m.getFileSize(), m.getWidth(), m.getHeight(),
                m.getAltText(), m.getTitle(), m.getCaption(),
                m.getSizes(), m.getStatus(), m.getCreatedAt(), m.getUpdatedAt()
        );
    }

    // ── Build helpers ─────────────────────────────────────────────────────────

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

    private static String snapshot(MediaEntity m) {
        return "{\"altText\":\"" + nvl(m.getAltText()) + "\",\"title\":\"" + nvl(m.getTitle()) +
               "\",\"caption\":\"" + nvl(m.getCaption()) + "\",\"status\":\"" + nvl(m.getStatus()) + "\"}";
    }

    private static boolean matchesQ(String field, String qLower) {
        return field != null && field.toLowerCase(Locale.ROOT).contains(qLower);
    }

    private static String nvl(String s) { return s != null ? s : ""; }

    private static String sanitizeFilename(String original) {
        if (original == null || original.isBlank()) return "upload";
        String name = original.replaceAll("[^a-zA-Z0-9._-]", "_");
        return name.length() > 200 ? name.substring(name.length() - 200) : name;
    }
}
