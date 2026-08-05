package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.ExactTargetFieldMutation;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.TargetContentPolicy;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.ExactTargetFieldMutationPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Issue;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.Snapshot;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetArticle;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/**
 * Proves exact owner-approved target-field mutations without exposing a database write path.
 * Pending mutations intentionally remain blockers for the general migration executor.
 */
final class LiveOwnerExactTargetFieldMutationPlanner {

    static final String PENDING = "PENDING_SEPARATE_EXECUTOR_CONFIRMATION";
    static final String ALREADY_APPLIED = "ALREADY_APPLIED";
    static final String CONFLICT = "CONFLICT";

    private final ObjectMapper mapper = JsonMapper.builder().build();

    Result plan(Snapshot target, TargetContentPolicy policy) {
        List<ExactTargetFieldMutationPlan> plans = new ArrayList<>();
        List<Issue> issues = new ArrayList<>();
        Set<String> blockers = new LinkedHashSet<>();

        for (ExactTargetFieldMutation mutation : safe(
                policy == null ? null : policy.exactFieldMutations())) {
            ExactTargetFieldMutationPlan plan = planOne(target, mutation);
            plans.add(plan);
            String source = mutation.entityId() + ":" + mutation.field();
            if (PENDING.equals(plan.status())) {
                issues.add(new Issue(
                        "BLOCKER", "TARGET_CONTENT", source,
                        "OWNER_EXACT_TARGET_FIELD_MUTATION_PENDING",
                        "Exact owner-approved field mutation is proven but requires a separate "
                                + "hash-bound executor confirmation"));
                blockers.add(
                        "OWNER_EXACT_TARGET_FIELD_MUTATIONS_REQUIRE_SEPARATE_EXECUTOR_CONFIRMATION");
            } else if (CONFLICT.equals(plan.status())) {
                issues.add(new Issue(
                        "BLOCKER", "TARGET_CONTENT", source,
                        "OWNER_EXACT_TARGET_FIELD_MUTATION_CONFLICT",
                        String.join("; ", plan.reasons())));
                blockers.add("OWNER_EXACT_TARGET_FIELD_MUTATION_CONFLICTS");
            }
        }
        return new Result(List.copyOf(plans), List.copyOf(issues), List.copyOf(blockers));
    }

    private ExactTargetFieldMutationPlan planOne(
            Snapshot target, ExactTargetFieldMutation mutation) {
        if (!"ARTICLE".equals(mutation.entityType())) {
            return conflict(mutation, null, "Unsupported entity type: " + mutation.entityType());
        }
        List<TargetArticle> matches = safe(target == null ? null : target.articles()).stream()
                .filter(article -> mutation.entityId().equals(article.id()))
                .toList();
        if (matches.size() != 1) {
            return conflict(mutation, null,
                    "Expected exactly one target article but found " + matches.size());
        }
        TargetArticle article = matches.get(0);
        return switch (mutation.field()) {
            case "body_blocks" -> planBodyBlocks(article, mutation);
            case "cover_image_url" -> planCoverImageUrl(article, mutation);
            default -> conflict(mutation, null,
                    "Unsupported exact target field: " + mutation.field());
        };
    }

    private ExactTargetFieldMutationPlan planBodyBlocks(
            TargetArticle article, ExactTargetFieldMutation mutation) {
        String current = article.bodyBlocksText();
        String observedSha = sha256OrNull(current);
        if (mutation.expectedAfterSha256() != null
                && mutation.expectedAfterSha256().equals(observedSha)) {
            return alreadyApplied(
                    mutation, observedSha,
                    List.of("Whole-field SHA-256 already matches the approved after-state"));
        }
        if (current == null || !mutation.expectedBeforeSha256().equals(observedSha)) {
            return conflict(mutation, observedSha,
                    "body_blocks whole-field SHA-256 does not match the approved before- or after-state");
        }

        String planned;
        try {
            planned = removeExactTopLevelImageNodes(current, mutation.exactValues());
        } catch (RuntimeException e) {
            return conflict(mutation, observedSha,
                    "Exact JSON image-node transform failed: " + e.getMessage());
        }
        String plannedSha = sha256OrNull(planned);
        if (!mutation.expectedAfterSha256().equals(plannedSha)) {
            return conflict(mutation, observedSha,
                    "Planned body_blocks SHA-256 differs from the approved after-state: "
                            + plannedSha);
        }
        List<String> operations = mutation.exactValues().stream()
                .map(value -> "REMOVE_EXACT_TOP_LEVEL_IMAGE_NODE:" + value)
                .toList();
        return plan(
                mutation, observedSha, plannedSha, PENDING, operations,
                List.of(
                        "Observed whole-field SHA-256 matches the approved before-state",
                        "Exactly one top-level image node matched each approved URL",
                        "All retained JSON elements remain byte-identical and in source order",
                        "Planned whole-field SHA-256 matches the approved after-state",
                        "No database write path is exposed by this planner"));
    }

    private ExactTargetFieldMutationPlan planCoverImageUrl(
            TargetArticle article, ExactTargetFieldMutation mutation) {
        String current = article.coverImageUrl();
        String observedSha = sha256OrNull(current);
        if (mutation.plannedNull() && current == null) {
            return alreadyApplied(
                    mutation, null,
                    List.of("Target field is already null as approved"));
        }
        if (!mutation.plannedNull()
                || mutation.exactValues().size() != 1
                || current == null
                || !current.equals(mutation.exactValues().get(0))
                || !mutation.expectedBeforeSha256().equals(observedSha)) {
            return conflict(mutation, observedSha,
                    "cover_image_url does not match the exact approved value and whole-field SHA-256");
        }
        return plan(
                mutation, observedSha, null, PENDING,
                List.of("SET_NULL_IF_EXACT_VALUE:" + current),
                List.of(
                        "Observed URL and whole-field SHA-256 match the approved before-state",
                        "Only cover_image_url is planned to become null",
                        "The referenced media row is not a deletion target in this mutation",
                        "No database write path is exposed by this planner"));
    }

    String removeExactTopLevelImageNodes(String raw, List<String> exactUrls) {
        List<String> elements = splitCanonicalTopLevelArray(raw);
        Set<String> expected = new LinkedHashSet<>(safe(exactUrls));
        if (expected.size() != safe(exactUrls).size() || expected.isEmpty()) {
            throw new IllegalArgumentException("Approved image URLs must be unique and non-empty");
        }

        Set<String> found = new LinkedHashSet<>();
        List<String> retained = new ArrayList<>();
        for (String element : elements) {
            JsonNode node;
            try {
                node = mapper.readTree(element);
            } catch (Exception e) {
                throw new IllegalArgumentException("Top-level element is not valid JSON", e);
            }
            String type = text(node, "type");
            String url = text(node, "url");
            if (node != null && node.isObject() && "image".equals(type) && expected.contains(url)) {
                if (!found.add(url)) {
                    throw new IllegalArgumentException("Approved image URL occurs more than once: " + url);
                }
                continue;
            }
            retained.add(element);
        }
        if (!found.equals(expected)) {
            Set<String> missing = new LinkedHashSet<>(expected);
            missing.removeAll(found);
            throw new IllegalArgumentException("Approved image nodes not found exactly: " + missing);
        }
        return "[" + String.join(", ", retained) + "]";
    }

    private List<String> splitCanonicalTopLevelArray(String raw) {
        if (raw == null || raw.length() < 2 || raw.charAt(0) != '['
                || raw.charAt(raw.length() - 1) != ']') {
            throw new IllegalArgumentException("Value is not a top-level JSON array");
        }
        List<String> elements = new ArrayList<>();
        int depth = 0;
        int start = 1;
        boolean inString = false;
        boolean escaped = false;
        for (int i = 1; i < raw.length() - 1; i++) {
            char value = raw.charAt(i);
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (value == '\\') {
                    escaped = true;
                } else if (value == '"') {
                    inString = false;
                }
                continue;
            }
            if (value == '"') {
                inString = true;
            } else if (value == '{' || value == '[') {
                depth++;
            } else if (value == '}' || value == ']') {
                depth--;
                if (depth < 0) {
                    throw new IllegalArgumentException("Unbalanced nested JSON delimiters");
                }
            } else if (value == ',' && depth == 0) {
                addElement(elements, raw.substring(start, i));
                start = i + 1;
            }
        }
        if (inString || escaped || depth != 0) {
            throw new IllegalArgumentException("Unbalanced JSON string or nested delimiters");
        }
        String tail = raw.substring(start, raw.length() - 1);
        if (!tail.isBlank()) {
            addElement(elements, tail);
        } else if (!elements.isEmpty()) {
            throw new IllegalArgumentException("Trailing empty JSON array element");
        }
        String reconstructed = "[" + String.join(", ", elements) + "]";
        if (!raw.equals(reconstructed)) {
            throw new IllegalArgumentException(
                    "JSON array formatting differs from the reviewed byte-preserving shape");
        }
        return List.copyOf(elements);
    }

    private void addElement(List<String> elements, String rawElement) {
        String element = rawElement.trim();
        if (element.isEmpty()) {
            throw new IllegalArgumentException("Empty top-level JSON array element");
        }
        elements.add(element);
    }

    private String text(JsonNode node, String field) {
        if (node == null || !node.isObject() || node.get(field) == null
                || !node.get(field).isString()) {
            return null;
        }
        return node.get(field).asString();
    }

    private ExactTargetFieldMutationPlan alreadyApplied(
            ExactTargetFieldMutation mutation, String observedSha, List<String> reasons) {
        return plan(
                mutation, observedSha, observedSha, ALREADY_APPLIED, List.of(), reasons);
    }

    private ExactTargetFieldMutationPlan conflict(
            ExactTargetFieldMutation mutation, String observedSha, String reason) {
        return plan(
                mutation, observedSha, null, CONFLICT, List.of(), List.of(reason));
    }

    private ExactTargetFieldMutationPlan plan(
            ExactTargetFieldMutation mutation,
            String observedSha,
            String plannedAfterSha,
            String status,
            List<String> operations,
            List<String> reasons) {
        return new ExactTargetFieldMutationPlan(
                mutation.entityType(), mutation.entityId(), mutation.field(), mutation.action(),
                List.copyOf(safe(mutation.targetMediaIds())),
                List.copyOf(safe(mutation.exactValues())),
                mutation.expectedBeforeSha256(), observedSha, mutation.expectedAfterSha256(),
                plannedAfterSha, mutation.plannedNull(), status,
                List.copyOf(operations), List.copyOf(reasons));
    }

    private String sha256OrNull(String value) {
        if (value == null) return null;
        try {
            return java.util.HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256")
                            .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private static <T> List<T> safe(List<T> values) {
        return values == null ? List.of() : values;
    }

    record Result(
            List<ExactTargetFieldMutationPlan> plans,
            List<Issue> issues,
            List<String> blockers) {}
}
