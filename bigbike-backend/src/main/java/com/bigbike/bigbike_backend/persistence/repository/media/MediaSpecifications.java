package com.bigbike.bigbike_backend.persistence.repository.media;

import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
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
}
