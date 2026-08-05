package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.VariantAttachmentOverride;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Applies only exact, versioned owner decisions that remove missing variant gallery references. */
final class LiveVariantAttachmentOverridePlanner {

    private final Map<Long, VariantAttachmentOverride> byVariantId;

    LiveVariantAttachmentOverridePlanner(List<VariantAttachmentOverride> overrides) {
        this.byVariantId = safe(overrides).stream().collect(Collectors.toMap(
                VariantAttachmentOverride::sourceVariantId,
                Function.identity(),
                (a, b) -> {
                    throw new IllegalArgumentException(
                            "Duplicate variant attachment override for " + a.sourceVariantId());
                },
                LinkedHashMap::new));
    }

    Result plan(
            long sourceVariantId,
            long sourceParentId,
            Long thumbnailAttachmentId,
            Collection<Long> galleryAttachmentIds) {
        List<Long> gallery = normalize(galleryAttachmentIds);
        VariantAttachmentOverride override = byVariantId.get(sourceVariantId);
        if (override == null) return new Result(gallery, false, true, List.of());

        List<String> mismatches = new java.util.ArrayList<>();
        if (sourceParentId != override.sourceParentId()) {
            mismatches.add("source parent changed from " + override.sourceParentId()
                    + " to " + sourceParentId);
        }
        if (thumbnailAttachmentId == null
                || thumbnailAttachmentId != override.expectedThumbnailAttachmentId()) {
            mismatches.add("thumbnail changed from "
                    + override.expectedThumbnailAttachmentId() + " to " + thumbnailAttachmentId);
        }
        if (!gallery.equals(safe(override.expectedGalleryAttachmentIds()))) {
            mismatches.add("gallery changed from " + override.expectedGalleryAttachmentIds()
                    + " to " + gallery);
        }
        if (!mismatches.isEmpty()) {
            return new Result(
                    gallery, true, false,
                    List.of("Exact owner attachment override did not match: "
                            + String.join("; ", mismatches)));
        }

        List<Long> retained = normalize(override.retainedGalleryAttachmentIds());
        if (!new LinkedHashSet<>(gallery).containsAll(retained)) {
            return new Result(
                    gallery, true, false,
                    List.of("Owner attachment override retained an ID absent from the source gallery"));
        }
        return new Result(
                retained,
                true,
                true,
                List.of("OWNER_OVERRIDE_REMOVE_EXACT_MISSING_GALLERY_REFERENCE:"
                        + sourceVariantId + ":30184"));
    }

    List<Long> configuredSourceVariantIds() {
        return List.copyOf(byVariantId.keySet());
    }

    /**
     * Reuses the immutable preflight attachment list at execution time so a raw source gallery
     * cannot reintroduce an attachment that an exact owner override removed.
     */
    static List<Long> reviewedGalleryForExecution(
            Collection<Long> reviewedAttachmentIds,
            Collection<Long> sourceGalleryAttachmentIds) {
        Set<Long> reviewed = new LinkedHashSet<>(normalize(reviewedAttachmentIds));
        return normalize(sourceGalleryAttachmentIds).stream()
                .filter(reviewed::contains)
                .toList();
    }

    private static List<Long> normalize(Collection<Long> values) {
        if (values == null) return List.of();
        return values.stream()
                .filter(java.util.Objects::nonNull)
                .filter(value -> value > 0)
                .distinct()
                .toList();
    }

    private static <T> List<T> safe(List<T> values) {
        return values == null ? List.of() : values;
    }

    record Result(
            List<Long> galleryAttachmentIds,
            boolean overridePresent,
            boolean valid,
            List<String> reasons) {}
}
