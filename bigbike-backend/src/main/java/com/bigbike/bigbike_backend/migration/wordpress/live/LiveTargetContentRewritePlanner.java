package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMediaPlanner.Reference;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Action;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Issue;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.MediaPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.RedirectPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.TargetContentRewritePlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.TargetContentRewriteSummary;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.TargetContentPolicy;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.UnavailableFileFallback;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.Snapshot;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetMedia;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/** Plans exact-hash URL-only repairs for existing target product/article content. */
final class LiveTargetContentRewritePlanner {

    Scan scan(Snapshot target) {
        List<FieldInput> fields = new ArrayList<>();
        List<Reference> mediaReferences = new ArrayList<>();
        LiveMigrationContentRewriter canonicalRewriter = new LiveMigrationContentRewriter(List.of());

        for (var product : target.products()) {
            addHtml(fields, mediaReferences, "PRODUCT", product.id(),
                    "short_description", product.shortDescription());
            addHtml(fields, mediaReferences, "PRODUCT", product.id(),
                    "description", product.description());
            addHtml(fields, mediaReferences, "PRODUCT", product.id(),
                    "short_description_en", product.shortDescriptionEn());
            addHtml(fields, mediaReferences, "PRODUCT", product.id(),
                    "description_en", product.descriptionEn());
            addJson(fields, mediaReferences, "PRODUCT", product.id(),
                    "description_blocks", product.descriptionBlocksText());
            addCanonical(fields, "PRODUCT", product.id(), "seo_canonical_url",
                    product.seoCanonicalUrl(), "/product/" + product.slug() + "/",
                    canonicalRewriter);
        }
        for (var article : target.articles()) {
            addHtml(fields, mediaReferences, "ARTICLE", article.id(), "excerpt", article.excerpt());
            addHtml(fields, mediaReferences, "ARTICLE", article.id(), "body", article.body());
            addHtml(fields, mediaReferences, "ARTICLE", article.id(), "excerpt_en", article.excerptEn());
            addHtml(fields, mediaReferences, "ARTICLE", article.id(), "body_en", article.bodyEn());
            addJson(fields, mediaReferences, "ARTICLE", article.id(),
                    "body_blocks", article.bodyBlocksText());
            addCanonical(fields, "ARTICLE", article.id(), "seo_canonical_url",
                    article.seoCanonicalUrl(), "/tin-tuc/" + article.slug() + "/",
                    canonicalRewriter);
        }
        for (var brand : target.brands()) {
            addStructured(fields, mediaReferences, "BRAND", brand.id(),
                    "banner_url", brand.bannerUrl());
        }
        LinkedHashSet<String> legacyInternalPaths = new LinkedHashSet<>();
        for (FieldInput field : fields) {
            if (field.canonicalPath() == null) {
                legacyInternalPaths.addAll(
                        LiveMigrationContentRewriter.legacyInternalPaths(field.value()));
            }
        }
        return new Scan(
                List.copyOf(fields), List.copyOf(mediaReferences), List.copyOf(legacyInternalPaths));
    }

    Result plan(
            Scan scan,
            List<RedirectPlan> redirects,
            List<MediaPlan> mediaPlans,
            List<TargetMedia> targetMedia) {
        return plan(
                scan, redirects, mediaPlans, targetMedia,
                new TargetContentPolicy(true, true, false, false, false), List.of());
    }

    Result plan(
            Scan scan,
            List<RedirectPlan> redirects,
            List<MediaPlan> mediaPlans,
            List<TargetMedia> targetMedia,
            TargetContentPolicy policy,
            List<UnavailableFileFallback> unavailableFallbacks) {
        Map<String, String> mediaUrls = mediaPublicUrls(mediaPlans, targetMedia);
        LiveMigrationContentRewriter rewriter = new LiveMigrationContentRewriter(redirects);
        List<TargetContentRewritePlan> plans = new ArrayList<>();
        List<Issue> issues = new ArrayList<>();
        int rewrites = 0;
        int conflicts = 0;
        int mediaBefore = 0;
        int internalBefore = 0;
        int remaining = 0;
        int unlinkedDeadAnchors = 0;
        int removedDeadImages = 0;

        for (FieldInput field : scan.fields()) {
            int beforeMedia = LiveMigrationContentRewriter.wordpressUploadLinkCount(field.value());
            int beforeInternal = field.canonicalPath() == null
                    ? LiveMigrationContentRewriter.legacyInternalLinkCount(field.value()) : 1;
            mediaBefore += beforeMedia;
            internalBefore += beforeInternal;
            LiveMigrationContentRewriter.RewriteResult rewriteResult = field.canonicalPath() == null
                    ? rewriter.rewriteTargetField(
                            field.value(), mediaUrls, field.entityType(), field.entityId(),
                            field.field(), field.htmlField(), policy, unavailableFallbacks)
                    : new LiveMigrationContentRewriter.RewriteResult(
                            rewriter.rewriteCanonical(field.value(), field.canonicalPath()),
                            List.of("REWRITE_CANONICAL_TO_CURRENT_ROUTE"), 0, 0);
            String rewritten = rewriteResult.value();
            int afterMedia = LiveMigrationContentRewriter.wordpressUploadLinkCount(rewritten);
            int afterInternal = field.canonicalPath() == null
                    ? LiveMigrationContentRewriter.legacyInternalLinkCount(rewritten) : 0;
            int afterRemaining = afterMedia + afterInternal;
            List<String> reasons = new ArrayList<>();
            Action action;
            if (rewritten == null || rewritten.equals(field.value())) {
                action = Action.CONFLICT;
                conflicts++;
                reasons.add("No reviewed redirect/media mapping changed the legacy URL");
                reasons.add(unresolvedPolicyReason(field.contentKind()));
                reasons.add(unresolvedSamples(field.value()));
            } else if (afterRemaining > 0) {
                action = Action.CONFLICT;
                conflicts++;
                reasons.add("Rewritten value would still contain " + afterRemaining + " legacy URL(s)");
                reasons.add(unresolvedPolicyReason(field.contentKind()));
                reasons.add(unresolvedSamples(rewritten));
            } else {
                action = Action.REWRITE_URLS_ONLY;
                rewrites++;
                unlinkedDeadAnchors += rewriteResult.unlinkedDeadAnchors();
                removedDeadImages += rewriteResult.removedDeadImages();
                reasons.add("Only reviewed legacy URLs change; prose and JSON structure are preserved");
            }
            int plannedRemaining = action == Action.CONFLICT
                    ? beforeMedia + beforeInternal : afterRemaining;
            remaining += plannedRemaining;
            TargetContentRewritePlan plan = new TargetContentRewritePlan(
                    field.entityType(), field.entityId(), field.field(), field.contentKind(),
                    field.canonicalPath(),
                    sha256(field.value()), rewritten == null ? null : sha256(rewritten),
                    beforeMedia, beforeInternal, plannedRemaining, action,
                    action == Action.REWRITE_URLS_ONLY
                            ? rewriteResult.operations() : List.of(),
                    reasons.stream().filter(value -> value != null && !value.isBlank()).toList());
            plans.add(plan);
            if (action == Action.CONFLICT) {
                issues.add(new Issue(
                        "BLOCKER", field.entityType(), field.entityId(),
                        "TARGET_CONTENT_REWRITE_UNRESOLVED",
                        field.field() + ": " + String.join("; ", reasons)));
            }
        }

        TargetContentRewriteSummary summary = new TargetContentRewriteSummary(
                scan.fields().size(), rewrites, conflicts, unlinkedDeadAnchors,
                removedDeadImages, mediaBefore, internalBefore, remaining);
        List<String> blockers = conflicts == 0
                ? List.of() : List.of("TARGET_CONTENT_REWRITE_INCOMPLETE");
        return new Result(List.copyOf(plans), summary, List.copyOf(issues), blockers);
    }

    private String unresolvedSamples(String value) {
        List<String> samples = new ArrayList<>();
        for (String path : LiveMigrationContentRewriter.wordpressUploadPaths(value)) {
            samples.add("wp-content/uploads/" + path);
            if (samples.size() == 5) break;
        }
        if (samples.size() < 5) {
            for (String path : LiveMigrationContentRewriter.legacyInternalPaths(value)) {
                samples.add(path);
                if (samples.size() == 5) break;
            }
        }
        return samples.isEmpty() ? null : "Unresolved sample(s): " + samples;
    }

    private String unresolvedPolicyReason(String contentKind) {
        return switch (contentKind) {
            case "HTML" -> "Only reviewed <a href> elements may be unlinked; plain-text or non-anchor URLs are preserved";
            case "JSON_STRUCTURED" -> "Structured/JSON URLs are preserved when no safe target exists";
            case "STRUCTURED_URL" -> "Structured URL is preserved when no safe target exists";
            case "CANONICAL" -> "Canonical URL requires a separately safe canonical policy";
            default -> "Unresolved URL is preserved for manual review";
        };
    }

    private void addHtml(
            List<FieldInput> fields,
            List<Reference> references,
            String entityType,
            String entityId,
            String field,
            String value) {
        addContent(fields, references, entityType, entityId, field, value, "HTML");
    }

    private void addJson(
            List<FieldInput> fields,
            List<Reference> references,
            String entityType,
            String entityId,
            String field,
            String value) {
        addContent(fields, references, entityType, entityId, field, value, "JSON_STRUCTURED");
    }

    private void addStructured(
            List<FieldInput> fields,
            List<Reference> references,
            String entityType,
            String entityId,
            String field,
            String value) {
        addContent(fields, references, entityType, entityId, field, value, "STRUCTURED_URL");
    }

    private void addContent(
            List<FieldInput> fields,
            List<Reference> references,
            String entityType,
            String entityId,
            String field,
            String value,
            String contentKind) {
        int media = LiveMigrationContentRewriter.wordpressUploadLinkCount(value);
        int internal = LiveMigrationContentRewriter.legacyInternalLinkCount(value);
        if (media == 0 && internal == 0) return;
        fields.add(new FieldInput(
                entityType, entityId, field, value, null, contentKind));
        for (String path : LiveMigrationContentRewriter.wordpressUploadPaths(value)) {
            references.add(new Reference(null, path, "TARGET_" + entityType, entityId + ":" + field));
        }
    }

    private void addCanonical(
            List<FieldInput> fields,
            String entityType,
            String entityId,
            String field,
            String value,
            String canonicalPath,
            LiveMigrationContentRewriter rewriter) {
        if (value == null || value.isBlank()) return;
        String rewritten = rewriter.rewriteCanonical(value, canonicalPath);
        if (rewritten != null && !rewritten.equals(value)) {
            fields.add(new FieldInput(
                    entityType, entityId, field, value, canonicalPath, "CANONICAL"));
        }
    }

    private Map<String, String> mediaPublicUrls(
            List<MediaPlan> plans, List<TargetMedia> targetMedia) {
        Map<String, TargetMedia> targetById = new HashMap<>();
        for (TargetMedia media : targetMedia) targetById.put(media.id(), media);
        Map<String, String> insertedUrlByTargetId = new HashMap<>();
        for (MediaPlan plan : plans) {
            if (plan.action() != Action.INSERT) continue;
            insertedUrlByTargetId.put(plan.targetMediaId(),
                    "/media/" + LiveMediaPlanner.migrationObjectKey(
                            plan.sha256(), plan.sourceRelativePath()));
        }

        Map<String, String> result = new LinkedHashMap<>();
        for (MediaPlan plan : plans) {
            if (plan.action() == Action.SKIP || plan.action() == Action.CONFLICT) continue;
            String relative = LiveMediaPlanner.normalizeRelativePath(plan.sourceRelativePath());
            if (relative == null) continue;
            String publicUrl = insertedUrlByTargetId.get(plan.targetMediaId());
            if (publicUrl == null) {
                TargetMedia target = targetById.get(plan.targetMediaId());
                if (target != null) {
                    publicUrl = trimToNull(target.publicUrl());
                    if (publicUrl == null) {
                        String objectKey = LiveMediaPlanner.targetObjectKey(target);
                        if (objectKey != null) publicUrl = "/media/" + objectKey;
                    }
                }
            }
            if (safePublicUrl(publicUrl)) result.putIfAbsent(relative, publicUrl);
        }
        return Map.copyOf(result);
    }

    private boolean safePublicUrl(String value) {
        String url = trimToNull(value);
        if (url == null) return false;
        String lower = url.toLowerCase();
        if (lower.contains("wp-content/uploads") || lower.contains("localhost")
                || lower.contains("127.0.0.1") || lower.contains("minio:9000")) {
            return false;
        }
        if (url.startsWith("/media/")) return true;
        try {
            URI uri = URI.create(url);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null;
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    record Scan(
            List<FieldInput> fields,
            List<Reference> mediaReferences,
            List<String> legacyInternalPaths) {}

    record Result(
            List<TargetContentRewritePlan> plans,
            TargetContentRewriteSummary summary,
            List<Issue> issues,
            List<String> blockers) {}

    private record FieldInput(
            String entityType,
            String entityId,
            String field,
            String value,
            String canonicalPath,
            String contentKind) {
        boolean htmlField() {
            return "HTML".equals(contentKind);
        }
    }
}
