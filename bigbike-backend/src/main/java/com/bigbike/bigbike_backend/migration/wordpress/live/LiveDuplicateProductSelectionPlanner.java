package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.DuplicateProductSelection;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.DuplicateProductSelectionPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Issue;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/** Resolves the exact SCS-S10X owner override without merging either source row. */
final class LiveDuplicateProductSelectionPlanner {

    Result plan(
            LiveWordPressSnapshotReader.Snapshot source,
            DuplicateProductSelection policy) {
        List<String> reasons = new ArrayList<>();
        List<Issue> issues = new ArrayList<>();
        List<String> blockers = new ArrayList<>();
        Map<Long, LocalDateTime> timestamps = new LinkedHashMap<>();
        List<WpPost> candidates = new ArrayList<>();

        for (Long sourceId : policy.sourceIds()) {
            WpPost post = source.postsById().get(sourceId);
            if (post == null) {
                reasons.add("Source post " + sourceId + " is missing from the snapshot");
                continue;
            }
            candidates.add(post);
            LocalDateTime modified = source.postModifiedGmt(sourceId);
            timestamps.put(sourceId, modified);
            if (!"product".equals(post.postType())) {
                reasons.add("Source post " + sourceId + " is not a product");
            }
            if (!"publish".equals(post.postStatus())) {
                reasons.add("Source product " + sourceId + " is not published in the snapshot");
            }
            String sku = LiveMigrationPreflightService.normalizeSku(
                    source.meta(sourceId).get("_sku"));
            if (!LiveMigrationPreflightService.normalizeSku(policy.sku()).equals(sku)) {
                reasons.add("Source product " + sourceId + " does not have exact normalized SKU "
                        + policy.sku());
            }
            if (modified == null) {
                reasons.add("Source product " + sourceId + " has no parseable post_modified_gmt");
            }
        }

        Long selectedId = null;
        Long excludedId = null;
        boolean timestampsUsable = candidates.size() == policy.sourceIds().size()
                && timestamps.size() == policy.sourceIds().size()
                && timestamps.values().stream().allMatch(java.util.Objects::nonNull)
                && new LinkedHashSet<>(timestamps.values()).size() == timestamps.size();
        boolean candidateEvidenceValid = reasons.isEmpty();
        if (timestampsUsable) {
            selectedId = timestamps.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse(null);
            Long chosenId = selectedId;
            excludedId = policy.sourceIds().stream()
                    .filter(id -> !id.equals(chosenId))
                    .min(Comparator.naturalOrder())
                    .orElse(null);
        } else if (timestamps.size() == policy.sourceIds().size()
                && timestamps.values().stream().allMatch(java.util.Objects::nonNull)) {
            reasons.add("The two post_modified_gmt values are equal or ambiguous");
        }

        boolean expectedMatched = candidateEvidenceValid
                && selectedId != null
                && selectedId == policy.expectedSelectedSourceId();
        if (selectedId != null && selectedId != policy.expectedSelectedSourceId()) {
            reasons.add("Latest post_modified_gmt selected source " + selectedId
                    + ", not expected source " + policy.expectedSelectedSourceId());
        }
        if (!expectedMatched) {
            blockers.add("OWNER_DUPLICATE_PRODUCT_SELECTION_UNRESOLVED");
            issues.add(new Issue(
                    "BLOCKER", "PRODUCT", policy.sku(),
                    "OWNER_DUPLICATE_PRODUCT_SELECTION_UNRESOLVED",
                    reasons.isEmpty()
                            ? "SCS-S10X owner selection evidence is incomplete"
                            : String.join("; ", reasons)));
            // Fail closed: neither duplicate may enter the normal import selection.
            selectedId = null;
            excludedId = null;
        } else {
            reasons.add("Source " + selectedId + " has the latest exact post_modified_gmt");
            reasons.add("No fields, SEO, translations, or media metadata are merged from source "
                    + excludedId);
        }

        DuplicateProductSelectionPlan plan = new DuplicateProductSelectionPlan(
                policy.sku(), List.copyOf(policy.sourceIds()), selectedId, excludedId,
                Map.copyOf(timestamps), policy.selectionRule(), policy.selectedProductStatus(),
                policy.excludedAliasPolicy(), expectedMatched, List.copyOf(reasons));
        return new Result(
                selectedId, excludedId, plan, List.copyOf(issues),
                List.copyOf(new LinkedHashSet<>(blockers)));
    }

    record Result(
            Long selectedSourceId,
            Long excludedSourceId,
            DuplicateProductSelectionPlan plan,
            List<Issue> issues,
            List<String> blockers) {}
}
