package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.media.MediaChecksumService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/** Versioned, secret-free owner decisions that are bound into every live-migration plan. */
final class LiveMigrationOwnerOverrides {

    private static final Set<Long> SCS_S10X_SOURCE_IDS = Set.of(41038L, 41181L);
    private static final Set<Long> OWNER_UNISEX_SOURCE_IDS = Set.of(35222L, 38995L, 39004L);
    private static final Set<Long> MISSING_ATTACHMENT_VARIANT_IDS = Set.of(30187L, 30188L);
    private static final String DEAD_MEDIA_PATH =
            "2021/05/mua-giay-scoyco-alpinestar-1024x772.png";
    private static final String ARTICLE_41091_BODY_BEFORE_SHA256 =
            "9c2f10d7789c92a8751ee2001b88bcbbccc0021dd215acdf9336b76b39d3d4e6";
    private static final String ARTICLE_41091_BODY_AFTER_SHA256 =
            "1f1f1228bc8f134f9ebc7dbec3094d97ce1a18c7ea4fcf706801c2d9d1ed6d4f";
    private static final String ARTICLE_41091_COVER_BEFORE_SHA256 =
            "5baec1551ea07d7aeb2bfe50cc7fa4a5f56c6153c7e525ced204c29f0bcdde52";
    private static final Set<String> ARTICLE_41091_BODY_MEDIA_IDS = Set.of(
            "738a58ea-f268-4f7a-8f35-57ecb1b6b1cc",
            "b80fbd1c-2da5-488e-86ed-22c4c38fa6dd",
            "e8bb5168-7d5c-4a1c-be6b-63a7d2bdc65d");
    private static final Set<String> ARTICLE_41091_BODY_IMAGE_URLS = Set.of(
            "/media/wp-uploads/2026/03/Non-bao-hiem-fullface-dat-chuan.jpg",
            "/media/wp-uploads/2026/03/Bang-chon-size-non-phu-hop-cho-tung-co-dau.jpg",
            "/media/wp-uploads/2026/03/Mu-bao-hiem-fullface-tai-Bigbike.jpg");
    private static final String ARTICLE_41091_COVER_MEDIA_ID =
            "ced523f3-c757-4546-afbd-f526f96d7b43";
    private static final String ARTICLE_41091_COVER_URL =
            "https://media.bigbike.vn/bigbike-media/wp-uploads/2026/03/"
                    + "shop-mu-bao-hiem-gan-day-thumbnail.jpg";

    private final ObjectMapper mapper = JsonMapper.builder().build();
    private final MediaChecksumService checksumService = new MediaChecksumService();

    Loaded load(Path path) throws Exception {
        if (path == null || !Files.isRegularFile(path) || !Files.isReadable(path)) {
            throw new IllegalArgumentException("Owner override file is missing or unreadable");
        }
        Path absolute = path.toAbsolutePath().normalize();
        Config config = mapper.readValue(absolute.toFile(), Config.class);
        validate(config);
        return new Loaded(absolute, checksumService.sha256Hex(absolute), config);
    }

    private void validate(Config config) {
        require(config != null, "Owner override JSON is empty");
        require(config.version() == 1 || config.version() == 2,
                "Unsupported owner override version");
        require("2026-08-03".equals(config.ownerDecisionDate()),
                "Owner decision date must be 2026-08-03");

        DuplicateProductSelection duplicate = config.duplicateProductSelection();
        require(duplicate != null, "Duplicate product selection is required");
        require("SCS-S10X".equalsIgnoreCase(text(duplicate.sku())),
                "Duplicate product SKU must be SCS-S10X");
        require(new LinkedHashSet<>(safe(duplicate.sourceIds())).equals(SCS_S10X_SOURCE_IDS),
                "Duplicate product source IDs must be exactly 41038 and 41181");
        require("LATEST_POST_MODIFIED_GMT".equals(duplicate.selectionRule()),
                "SCS-S10X must use the latest post_modified_gmt selection rule");
        require(duplicate.expectedSelectedSourceId() == 41181L,
                "Expected SCS-S10X selection must be source 41181");
        require(!duplicate.mergeAllowed(), "SCS-S10X merge must remain disabled");
        require("DRAFT".equals(duplicate.selectedProductStatus()),
                "Selected SCS-S10X product must remain DRAFT");

        ProductInference inference = config.productInference();
        require(inference != null && inference.enabled(), "Controlled product inference must be enabled");
        require(hasText(inference.brandRuleId()) && hasText(inference.brandFallbackSlug()),
                "Brand inference rule and fallback are required");
        require(hasText(inference.genderTokenRuleId()) && hasText(inference.neutralCategoryRuleId()),
                "Gender inference rule IDs are required");
        require(!safe(inference.femaleTokens()).isEmpty()
                        && !safe(inference.maleTokens()).isEmpty()
                        && !safe(inference.unisexTokens()).isEmpty(),
                "Gender inference tokens are required");
        require(hasText(inference.skuRuleId()), "SKU inference rule ID is required");
        validateManualFieldOverrides(config.version(), inference.manualFieldOverrides());

        SourceMediaRecovery recovery = config.sourceMediaRecovery();
        require(recovery != null && recovery.recoveryManifestVersion() == 1,
                "Recovery manifest version 1 is required");
        require(safe(recovery.approvedFiles()).size() == 4,
                "Exactly four approved recovery files are required");
        Set<String> recoveryPaths = new LinkedHashSet<>();
        for (ApprovedRecoveryFile file : safe(recovery.approvedFiles())) {
            String normalizedPath = LiveMediaPlanner.normalizeRelativePath(file.relativePath());
            require(normalizedPath != null && normalizedPath.equals(file.relativePath()),
                    "Recovery path must be normalized and relative: " + file.relativePath());
            require(file.sha256() != null && file.sha256().matches("[0-9a-f]{64}"),
                    "Recovery SHA-256 is malformed: " + file.relativePath());
            require(file.bytes() > 0 && hasText(file.mimeType()),
                    "Recovery bytes/MIME are required: " + file.relativePath());
            require(recoveryPaths.add(file.relativePath()),
                    "Duplicate recovery path: " + file.relativePath());
        }
        List<UnavailableFileFallback> unavailable = safe(recovery.unavailableFileFallbacks());
        require(unavailable.size() == 1, "Exactly one unavailable-media fallback is required");
        UnavailableFileFallback dead = unavailable.get(0);
        require(DEAD_MEDIA_PATH.equals(dead.relativePath())
                        && "ARTICLE".equals(dead.entityType())
                        && "wp-art-26064".equals(dead.entityId())
                        && new LinkedHashSet<>(safe(dead.fields()))
                                .equals(Set.of("body", "body_en"))
                        && "REMOVE_EXACT_DEAD_IMAGE_ONLY".equals(dead.action()),
                "Unavailable-media fallback must match the exact wp-art-26064 decision");
        validateVariantAttachmentOverrides(
                config.version(), recovery.variantAttachmentOverrides());

        TargetMediaCleanup cleanup = config.targetMediaCleanup();
        require(cleanup != null && cleanup.duplicateObjectRetentionHours() >= 24,
                "Duplicate target objects must be retained for at least 24 hours");
        require(!cleanup.deleteDuplicateObjectsBeforeCutover(),
                "Duplicate target objects cannot be deleted before cutover");

        RedirectPolicy redirects = config.redirects();
        require(redirects != null && redirects.acknowledgeNoSafeTarget(),
                "No-safe-target URLs must carry the owner acknowledgment");
        require("ACKNOWLEDGED_NO_SAFE_TARGET".equals(redirects.acknowledgedAction()),
                "Unexpected no-safe-target action");
        require(!redirects.allowHomepageFallback() && !redirects.allowGenericProductListingFallback(),
                "Homepage/product-listing fallbacks must remain disabled");

        TargetContentPolicy content = config.targetContent();
        require(content != null && content.unlinkDeadInternalAnchors()
                        && content.preserveAnchorText()
                        && !content.removePlainTextUrls()
                        && !content.removeStructuredUrls()
                        && !content.rewriteExternalLinks(),
                "Target-content policy does not match the owner decision");
        validateExactTargetFieldMutations(config.version(), content.exactFieldMutations());
    }

    private void validateManualFieldOverrides(
            int version, List<ManualFieldOverride> overrides) {
        List<ManualFieldOverride> values = safe(overrides);
        if (version == 1) {
            require(values.isEmpty(), "Owner override v1 cannot contain manual field decisions");
            return;
        }
        require(values.size() == OWNER_UNISEX_SOURCE_IDS.size(),
                "Owner override v2 must contain exactly three gender decisions");
        Set<Long> ids = new LinkedHashSet<>();
        for (ManualFieldOverride override : values) {
            require(ids.add(override.sourceId()),
                    "Duplicate owner gender decision for source " + override.sourceId());
            require("gender".equals(override.field())
                            && "Unisex".equals(override.value())
                            && "OWNER_MANUAL_GENDER_V2".equals(override.ruleId())
                            && "OWNER_CONFIRMED".equals(override.confidence())
                            && hasText(override.evidence()),
                    "Owner gender decision does not match the approved v2 policy");
        }
        require(ids.equals(OWNER_UNISEX_SOURCE_IDS),
                "Owner override v2 gender source IDs must be exactly 35222, 38995 and 39004");
    }

    private void validateVariantAttachmentOverrides(
            int version, List<VariantAttachmentOverride> overrides) {
        List<VariantAttachmentOverride> values = safe(overrides);
        if (version == 1) {
            require(values.isEmpty(), "Owner override v1 cannot drop attachment references");
            return;
        }
        require(values.size() == MISSING_ATTACHMENT_VARIANT_IDS.size(),
                "Owner override v2 requires exactly two attachment-reference decisions");
        Set<Long> ids = new LinkedHashSet<>();
        for (VariantAttachmentOverride override : values) {
            require(ids.add(override.sourceVariantId()),
                    "Duplicate variant attachment override for " + override.sourceVariantId());
            require(override.sourceParentId() == 30183L
                            && override.expectedThumbnailAttachmentId() == 30186L
                            && safe(override.expectedGalleryAttachmentIds())
                                    .equals(List.of(30184L, 30185L))
                            && safe(override.retainedGalleryAttachmentIds())
                                    .equals(List.of(30185L))
                            && "REMOVE_EXACT_MISSING_GALLERY_REFERENCE".equals(override.action())
                            && hasText(override.evidence()),
                    "Variant attachment override does not match the exact 30184 owner decision");
        }
        require(ids.equals(MISSING_ATTACHMENT_VARIANT_IDS),
                "Attachment override source IDs must be exactly 30187 and 30188");
    }

    private void validateExactTargetFieldMutations(
            int version, List<ExactTargetFieldMutation> mutations) {
        List<ExactTargetFieldMutation> values = safe(mutations);
        if (version == 1) {
            require(values.isEmpty(), "Owner override v1 cannot contain exact target field mutations");
            return;
        }
        require(values.size() == 2,
                "Owner override v2 requires exactly two wp-art-41091 field decisions");
        Map<String, ExactTargetFieldMutation> byField = new java.util.LinkedHashMap<>();
        for (ExactTargetFieldMutation mutation : values) {
            require("ARTICLE".equals(mutation.entityType())
                            && "wp-art-41091".equals(mutation.entityId())
                            && byField.putIfAbsent(mutation.field(), mutation) == null,
                    "Exact target field mutation must be unique and limited to wp-art-41091");
        }
        ExactTargetFieldMutation body = byField.get("body_blocks");
        require(body != null
                        && "REMOVE_EXACT_JSON_IMAGE_NODES".equals(body.action())
                        && ARTICLE_41091_BODY_BEFORE_SHA256.equals(body.expectedBeforeSha256())
                        && ARTICLE_41091_BODY_AFTER_SHA256.equals(body.expectedAfterSha256())
                        && !body.plannedNull()
                        && new LinkedHashSet<>(safe(body.targetMediaIds()))
                                .equals(ARTICLE_41091_BODY_MEDIA_IDS)
                        && new LinkedHashSet<>(safe(body.exactValues()))
                                .equals(ARTICLE_41091_BODY_IMAGE_URLS)
                        && hasText(body.evidence()),
                "wp-art-41091 body_blocks mutation does not match the approved exact policy");
        ExactTargetFieldMutation cover = byField.get("cover_image_url");
        require(cover != null
                        && "SET_NULL_IF_EXACT_VALUE".equals(cover.action())
                        && ARTICLE_41091_COVER_BEFORE_SHA256.equals(cover.expectedBeforeSha256())
                        && cover.expectedAfterSha256() == null
                        && cover.plannedNull()
                        && safe(cover.targetMediaIds()).equals(List.of(ARTICLE_41091_COVER_MEDIA_ID))
                        && safe(cover.exactValues()).equals(List.of(ARTICLE_41091_COVER_URL))
                        && hasText(cover.evidence()),
                "wp-art-41091 cover mutation does not match the approved exact policy");
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new IllegalArgumentException(message);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String text(String value) {
        return value == null ? "" : value.trim();
    }

    private static <T> List<T> safe(List<T> values) {
        return values == null ? List.of() : values;
    }

    record Loaded(Path path, String sha256, Config config) {}

    record Config(
            int version,
            String ownerDecisionDate,
            DuplicateProductSelection duplicateProductSelection,
            ProductInference productInference,
            SourceMediaRecovery sourceMediaRecovery,
            TargetMediaCleanup targetMediaCleanup,
            RedirectPolicy redirects,
            TargetContentPolicy targetContent) {}

    record DuplicateProductSelection(
            String sku,
            List<Long> sourceIds,
            String selectionRule,
            long expectedSelectedSourceId,
            boolean mergeAllowed,
            String selectedProductStatus,
            String excludedAliasPolicy) {}

    record ProductInference(
            boolean enabled,
            String brandRuleId,
            String brandFallbackSlug,
            Map<String, String> brandAliases,
            String genderTokenRuleId,
            List<String> femaleTokens,
            List<String> maleTokens,
            List<String> unisexTokens,
            String neutralCategoryRuleId,
            List<String> unisexNeutralSourceCategorySlugs,
            String skuRuleId,
            List<String> skuIgnoredTokens,
            List<ManualFieldOverride> manualFieldOverrides) {}

    record ManualFieldOverride(
            long sourceId,
            String field,
            String value,
            String evidence,
            String ruleId,
            String confidence) {}

    record SourceMediaRecovery(
            int recoveryManifestVersion,
            List<ApprovedRecoveryFile> approvedFiles,
            List<UnavailableFileFallback> unavailableFileFallbacks,
            List<VariantAttachmentOverride> variantAttachmentOverrides) {
        SourceMediaRecovery(
                int recoveryManifestVersion,
                List<ApprovedRecoveryFile> approvedFiles,
                List<UnavailableFileFallback> unavailableFileFallbacks) {
            this(recoveryManifestVersion, approvedFiles, unavailableFileFallbacks, List.of());
        }
    }

    record ApprovedRecoveryFile(
            String relativePath,
            String sha256,
            long bytes,
            String mimeType) {}

    record UnavailableFileFallback(
            String relativePath,
            String entityType,
            String entityId,
            List<String> fields,
            String action) {}

    record VariantAttachmentOverride(
            long sourceVariantId,
            long sourceParentId,
            long expectedThumbnailAttachmentId,
            List<Long> expectedGalleryAttachmentIds,
            List<Long> retainedGalleryAttachmentIds,
            String action,
            String evidence) {}

    record TargetMediaCleanup(
            String missingObjectPolicy,
            List<String> duplicateCanonicalPriority,
            boolean deleteDuplicateObjectsBeforeCutover,
            int duplicateObjectRetentionHours) {}

    record RedirectPolicy(
            boolean acknowledgeNoSafeTarget,
            String acknowledgedAction,
            boolean allowHomepageFallback,
            boolean allowGenericProductListingFallback) {}

    record TargetContentPolicy(
            boolean unlinkDeadInternalAnchors,
            boolean preserveAnchorText,
            boolean removePlainTextUrls,
            boolean removeStructuredUrls,
            boolean rewriteExternalLinks,
            List<ExactTargetFieldMutation> exactFieldMutations) {
        TargetContentPolicy(
                boolean unlinkDeadInternalAnchors,
                boolean preserveAnchorText,
                boolean removePlainTextUrls,
                boolean removeStructuredUrls,
                boolean rewriteExternalLinks) {
            this(unlinkDeadInternalAnchors, preserveAnchorText, removePlainTextUrls,
                    removeStructuredUrls, rewriteExternalLinks, List.of());
        }
    }

    record ExactTargetFieldMutation(
            String entityType,
            String entityId,
            String field,
            String action,
            List<String> targetMediaIds,
            List<String> exactValues,
            String expectedBeforeSha256,
            String expectedAfterSha256,
            boolean plannedNull,
            String evidence) {}
}
