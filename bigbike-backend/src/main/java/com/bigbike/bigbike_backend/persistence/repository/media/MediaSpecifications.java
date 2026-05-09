package com.bigbike.bigbike_backend.persistence.repository.media;

import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import java.time.Instant;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

public final class MediaSpecifications {

    private MediaSpecifications() {}

    public static Specification<MediaEntity> excludeDeleted() {
        return (root, query, cb) -> cb.notEqual(root.get("status"), "DELETED");
    }

    public static Specification<MediaEntity> withStatus(String status) {
        return (root, query, cb) -> cb.equal(
                cb.upper(root.get("status")),
                status.toUpperCase(Locale.ROOT));
    }

    public static Specification<MediaEntity> withMimeTypePrefix(String prefix) {
        return (root, query, cb) -> cb.like(
                cb.lower(root.get("mimeType")),
                prefix.toLowerCase(Locale.ROOT) + "%");
    }

    public static Specification<MediaEntity> withStorageProvider(String provider) {
        return (root, query, cb) -> cb.equal(
                cb.upper(root.get("storageProvider")),
                provider.toUpperCase(Locale.ROOT));
    }

    public static Specification<MediaEntity> matchesSearch(String q) {
        String pattern = "%" + q.toLowerCase(Locale.ROOT) + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("title")), pattern),
                cb.like(cb.lower(root.get("filePath")), pattern),
                cb.like(cb.lower(root.get("altText")), pattern));
    }

    public static Specification<MediaEntity> uploadedAfter(Instant from) {
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), from);
    }

    public static Specification<MediaEntity> uploadedBefore(Instant to) {
        return (root, query, cb) -> cb.lessThan(root.get("createdAt"), to);
    }

    public static Specification<MediaEntity> fileSizeAtLeast(long bytes) {
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("fileSize"), bytes);
    }

    public static Specification<MediaEntity> fileSizeAtMost(long bytes) {
        return (root, query, cb) -> cb.lessThanOrEqualTo(root.get("fileSize"), bytes);
    }

    public static Specification<MediaEntity> widthAtLeast(int px) {
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("width"), px);
    }

    public static Specification<MediaEntity> heightAtLeast(int px) {
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("height"), px);
    }

    public static Specification<MediaEntity> inFolder(java.util.UUID folderId) {
        return (root, query, cb) -> cb.equal(root.get("folderId"), folderId);
    }

    /** Match media whose folder_id IS NULL — "uncategorized" bucket. */
    public static Specification<MediaEntity> noFolder() {
        return (root, query, cb) -> cb.isNull(root.get("folderId"));
    }

    public static Specification<MediaEntity> idIn(java.util.Collection<java.util.UUID> ids) {
        return (root, query, cb) -> {
            if (ids == null || ids.isEmpty()) return cb.disjunction(); // never matches
            return root.get("id").in(ids);
        };
    }
}
