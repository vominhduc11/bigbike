package com.bigbike.bigbike_backend.persistence.repository.media;

import java.sql.Types;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Tag persistence is intentionally schema-light: a flat join table
 * {@code media_tags(media_id, tag)}. Operations live here as JDBC
 * queries because nothing about tags benefits from JPA mapping.
 */
@Repository
public class MediaTagJdbc {

    private final JdbcTemplate jdbc;

    public MediaTagJdbc(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /** Returns the tags currently attached to a single media. */
    public List<String> tagsFor(UUID mediaId) {
        return jdbc.query("SELECT tag FROM media_tags WHERE media_id = ? ORDER BY tag",
                (rs, n) -> rs.getString(1), mediaId);
    }

    /**
     * Replaces the tag set for a media in one transaction-friendly call:
     * deletes everything not in {@code newTags}, inserts everything missing.
     */
    public void replaceTags(UUID mediaId, Collection<String> newTags) {
        Set<String> normalized = new HashSet<>();
        if (newTags != null) {
            for (String raw : newTags) {
                if (raw == null) continue;
                String t = raw.trim().toLowerCase();
                if (!t.isEmpty()) normalized.add(t);
            }
        }
        Set<String> existing = new HashSet<>(tagsFor(mediaId));

        Set<String> toDelete = new HashSet<>(existing);
        toDelete.removeAll(normalized);
        Set<String> toAdd = new HashSet<>(normalized);
        toAdd.removeAll(existing);

        if (!toDelete.isEmpty()) {
            jdbc.batchUpdate("DELETE FROM media_tags WHERE media_id = ? AND tag = ?",
                    toDelete.stream().map(t -> new Object[] { mediaId, t }).toList(),
                    new int[] { Types.OTHER, Types.VARCHAR });
        }
        if (!toAdd.isEmpty()) {
            jdbc.batchUpdate("INSERT INTO media_tags (media_id, tag) VALUES (?, ?)",
                    toAdd.stream().map(t -> new Object[] { mediaId, t }).toList(),
                    new int[] { Types.OTHER, Types.VARCHAR });
        }
    }

    /** All distinct tags currently in use, ordered alphabetically. */
    public List<String> allTags() {
        return jdbc.query("SELECT DISTINCT tag FROM media_tags ORDER BY tag",
                (rs, n) -> rs.getString(1));
    }

    /** Tags that match a prefix, for autocomplete. */
    public List<String> findByPrefix(String prefix, int limit) {
        if (prefix == null || prefix.isBlank()) {
            return jdbc.query("SELECT tag, COUNT(*) AS c FROM media_tags GROUP BY tag ORDER BY c DESC LIMIT ?",
                    (rs, n) -> rs.getString(1), Math.max(1, Math.min(limit, 50)));
        }
        return jdbc.query(
                "SELECT DISTINCT tag FROM media_tags WHERE tag LIKE ? ORDER BY tag LIMIT ?",
                (rs, n) -> rs.getString(1),
                prefix.toLowerCase() + "%",
                Math.max(1, Math.min(limit, 50)));
    }

    /** Returns the set of media IDs that have a specific tag (for filtering). */
    public Set<UUID> mediaIdsWithTag(String tag) {
        if (tag == null || tag.isBlank()) return Set.of();
        Set<UUID> ids = new HashSet<>();
        jdbc.query("SELECT media_id FROM media_tags WHERE tag = ?",
                rs -> { ids.add((UUID) rs.getObject(1)); },
                tag.toLowerCase());
        return ids;
    }

    /** Bulk fetch tags for multiple media at once (avoids N+1 in list view). */
    public java.util.Map<UUID, List<String>> tagsForMany(Collection<UUID> mediaIds) {
        if (mediaIds == null || mediaIds.isEmpty()) return java.util.Map.of();
        UUID[] arr = mediaIds.toArray(new UUID[0]);
        java.util.Map<UUID, List<String>> result = new java.util.HashMap<>();
        jdbc.query(
                "SELECT media_id, tag FROM media_tags WHERE media_id = ANY(?::uuid[]) ORDER BY tag",
                ps -> ps.setArray(1, ps.getConnection().createArrayOf("uuid", arr)),
                rs -> {
                    UUID id = (UUID) rs.getObject(1);
                    result.computeIfAbsent(id, k -> new java.util.ArrayList<>()).add(rs.getString(2));
                });
        return result;
    }
}
