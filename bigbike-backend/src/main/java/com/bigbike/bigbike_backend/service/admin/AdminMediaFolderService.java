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
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
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
        List<MediaFolderEntity> folders = folderRepo.findAll();
        Map<UUID, Long> counts = aggregateMediaCounts(folders);
        return folders.stream()
                .map(f -> mediaFolderMapper.toResponse(
                        f, counts.getOrDefault(f.getId(), 0L), depthOf(f, folders)))
                .sorted(java.util.Comparator
                        .comparingInt(MediaFolderResponse::depth)
                        .thenComparingInt(MediaFolderResponse::sortOrder)
                        .thenComparing(MediaFolderResponse::name, String.CASE_INSENSITIVE_ORDER))
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
        setParentForCreate(f, req.parentId());
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
        return mediaFolderMapper.toResponse(saved, 0, depthOf(saved, folderRepo.findAll()));
    }

    @Transactional
    public MediaFolderResponse update(UUID id, UpsertMediaFolderRequest req, UUID adminId) {
        MediaFolderEntity f = folderRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Folder not found."));
        ensureCustomFolder(f);
        String before = folderSnapshot(f);
        f.setName(req.name().trim());
        if (req.slug() != null && !req.slug().isBlank()) {
            String newSlug = slugify(req.slug());
            if (!newSlug.equals(f.getSlug()) && folderRepo.existsBySlug(newSlug)) {
                throw new ConflictException("Folder with slug '" + newSlug + "' already exists.");
            }
            f.setSlug(newSlug);
        }
        setParentForUpdate(f, req.parentId());
        f.setDescription(req.description());
        f.setUpdatedAt(Instant.now());
        MediaFolderEntity saved = folderRepo.save(f);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "MEDIA_FOLDER_UPDATED", "MEDIA_FOLDER", id, before, folderSnapshot(saved)));
        List<MediaFolderEntity> folders = folderRepo.findAll();
        long count = aggregateMediaCounts(folders).getOrDefault(id, 0L);
        return mediaFolderMapper.toResponse(saved, count, depthOf(saved, folders));
    }

    @Transactional
    public void delete(UUID id, UUID adminId) {
        MediaFolderEntity f = folderRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Folder not found."));
        ensureCustomFolder(f);
        if (folderRepo.findAll().stream().anyMatch(child -> id.equals(child.getParentId()))) {
            throw new ConflictException("A folder with children cannot be deleted.");
        }
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

    private Map<UUID, Long> aggregateMediaCounts(List<MediaFolderEntity> folders) {
        Map<UUID, Long> result = new HashMap<>();
        jdbc.query(
                "SELECT folder_id, COUNT(*) FROM media WHERE folder_id IS NOT NULL AND status <> 'DELETED' GROUP BY folder_id",
                rs -> { result.put((UUID) rs.getObject(1), rs.getLong(2)); });
        Map<UUID, List<UUID>> children = new HashMap<>();
        for (MediaFolderEntity folder : folders) {
            if (folder.getParentId() != null) {
                children.computeIfAbsent(folder.getParentId(), ignored -> new java.util.ArrayList<>())
                        .add(folder.getId());
            }
        }
        for (MediaFolderEntity folder : folders) {
            aggregateCount(folder.getId(), children, result, new HashSet<>());
        }
        return result;
    }

    private long aggregateCount(
            UUID id, Map<UUID, List<UUID>> children, Map<UUID, Long> counts, Set<UUID> visiting) {
        if (!visiting.add(id)) {
            throw new ConflictException("Media folder tree contains a cycle.");
        }
        long total = counts.getOrDefault(id, 0L);
        for (UUID childId : children.getOrDefault(id, List.of())) {
            total += aggregateCount(childId, children, counts, visiting);
        }
        visiting.remove(id);
        counts.put(id, total);
        return total;
    }

    private static int depthOf(MediaFolderEntity folder, List<MediaFolderEntity> folders) {
        int depth = 0;
        UUID parentId = folder.getParentId();
        Set<UUID> seen = new HashSet<>();
        while (parentId != null) {
            if (!seen.add(parentId)) {
                throw new ConflictException("Media folder tree contains a cycle.");
            }
            depth++;
            UUID current = parentId;
            MediaFolderEntity parent = folders.stream()
                    .filter(candidate -> current.equals(candidate.getId()))
                    .findFirst().orElse(null);
            parentId = parent == null ? null : parent.getParentId();
        }
        if (depth > 1) {
            throw new ConflictException("Media folders may be nested only one level below a root.");
        }
        return depth;
    }

    private void setParentForCreate(MediaFolderEntity folder, UUID parentId) {
        if (parentId == null) return;
        MediaFolderEntity parent = folderRepo.findById(parentId)
                .orElseThrow(() -> new NotFoundException("Parent media folder not found."));
        if (parent.getParentId() != null) {
            throw new ConflictException("Media folders may be nested only one level below a root.");
        }
        folder.setParentId(parentId);
    }

    private void setParentForUpdate(MediaFolderEntity folder, UUID parentId) {
        if (parentId != null && parentId.equals(folder.getId())) {
            throw new ConflictException("A media folder cannot be its own parent.");
        }
        if (parentId == null) {
            folder.setParentId(null);
            return;
        }
        setParentForCreate(folder, parentId);
    }

    private static void ensureCustomFolder(MediaFolderEntity folder) {
        if (folder.getSystemKey() != null && !folder.getSystemKey().isBlank()) {
            throw new ConflictException("System media folders cannot be changed.");
        }
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
