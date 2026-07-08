package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.media.MediaFolderResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.UpsertMediaFolderRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.mapper.MediaFolderMapper;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaFolderEntity;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaFolderJpaRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import java.text.Normalizer;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminMediaFolderService {

    private final MediaFolderJpaRepository folderRepo;
    private final JdbcTemplate jdbc;
    private final AuditLogWriter auditLogWriter;
    private final MediaFolderMapper mediaFolderMapper;
    private final AuditLogFactory auditLogFactory;

    public List<MediaFolderResponse> listAll() {
        Map<UUID, Long> counts = mediaCountsByFolder();
        return folderRepo.findAll().stream()
                .map(f -> mediaFolderMapper.toResponse(f, counts.getOrDefault(f.getId(), 0L)))
                .sorted((a, b) -> a.name().compareToIgnoreCase(b.name()))
                .toList();
    }

    @Transactional
    public MediaFolderResponse create(UpsertMediaFolderRequest req, UUID adminId) {
        String slug = (req.slug() == null || req.slug().isBlank()) ? slugify(req.name()) : slugify(req.slug());
        // Names made entirely of non-alphanumeric chars (e.g. "@@@") slug to "" —
        // fall back to a short UUID-derived slug so the user isn't blocked.
        if (slug.isEmpty()) {
            slug = "folder-" + UUID.randomUUID().toString().substring(0, 8);
        }
        if (folderRepo.existsBySlug(slug)) {
            throw new ConflictException("Folder with slug '" + slug + "' already exists.");
        }
        Instant now = Instant.now();
        MediaFolderEntity f = new MediaFolderEntity();
        f.setName(req.name().trim());
        f.setSlug(slug);
        f.setDescription(req.description());
        f.setCreatedAt(now);
        f.setUpdatedAt(now);
        MediaFolderEntity saved;
        try {
            saved = folderRepo.save(f);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Concurrent insert with same slug raced past our existsBySlug check.
            throw new ConflictException("Folder with slug '" + f.getSlug() + "' already exists.");
        }
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "MEDIA_FOLDER_CREATED", "MEDIA_FOLDER", saved.getId(), null, folderSnapshot(saved)));
        return mediaFolderMapper.toResponse(saved, 0);
    }

    @Transactional
    public MediaFolderResponse update(UUID id, UpsertMediaFolderRequest req, UUID adminId) {
        MediaFolderEntity f = folderRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Folder not found."));
        String before = folderSnapshot(f);
        f.setName(req.name().trim());
        if (req.slug() != null && !req.slug().isBlank()) {
            String newSlug = slugify(req.slug());
            if (!newSlug.equals(f.getSlug()) && folderRepo.existsBySlug(newSlug)) {
                throw new ConflictException("Folder with slug '" + newSlug + "' already exists.");
            }
            f.setSlug(newSlug);
        }
        f.setDescription(req.description());
        f.setUpdatedAt(Instant.now());
        MediaFolderEntity saved = folderRepo.save(f);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "MEDIA_FOLDER_UPDATED", "MEDIA_FOLDER", id, before, folderSnapshot(saved)));
        long count = mediaCountsByFolder().getOrDefault(id, 0L);
        return mediaFolderMapper.toResponse(saved, count);
    }

    @Transactional
    public void delete(UUID id, UUID adminId) {
        MediaFolderEntity f = folderRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Folder not found."));
        String before = folderSnapshot(f);
        // ON DELETE SET NULL — media keep existing, folder_id becomes NULL
        folderRepo.delete(f);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "MEDIA_FOLDER_DELETED", "MEDIA_FOLDER", id, before, null));
    }

    private static String folderSnapshot(MediaFolderEntity f) {
        return "{\"id\":\"" + f.getId() + "\",\"name\":\"" + esc(f.getName())
                + "\",\"slug\":\"" + esc(f.getSlug())
                + "\",\"description\":\"" + esc(f.getDescription()) + "\"}";
    }

    private static String esc(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private Map<UUID, Long> mediaCountsByFolder() {
        Map<UUID, Long> result = new HashMap<>();
        jdbc.query(
                "SELECT folder_id, COUNT(*) FROM media WHERE folder_id IS NOT NULL AND status <> 'DELETED' GROUP BY folder_id",
                rs -> { result.put((UUID) rs.getObject(1), rs.getLong(2)); });
        return result;
    }

    /** ASCII-safe slug. Strips Vietnamese diacritics and non-alphanumeric chars. */
    static String slugify(String input) {
        if (input == null) return "";
        String n = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .replace('Đ', 'D').replace('đ', 'd')
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-+|-+$)", "");
        return n.length() > 160 ? n.substring(0, 160) : n;
    }
}
