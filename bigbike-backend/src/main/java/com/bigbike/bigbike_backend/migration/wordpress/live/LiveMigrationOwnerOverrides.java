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

    /**
     * Owner decision 2026-08-05. The three v2 rows plus the twenty-two products whose only
     * unresolved required field was {@code gender}; every one of them is equipment sold in a
     * single cut, so the owner confirmed {@code Unisex} for the whole group at once.
     */
    private static final Set<Long> OWNER_V3_UNISEX_SOURCE_IDS = Set.of(
            35222L, 38995L, 39004L,
            26364L, 26955L, 28387L, 29114L, 29371L, 29381L, 29790L, 29808L, 29819L, 30139L,
            31348L, 31361L, 31372L, 31628L, 32398L, 36698L, 36725L, 36949L, 36984L, 39478L,
            40018L, 42618L);

    /**
     * Owner decision 2026-08-05. Every source product that is absent from the target and whose
     * variations carry no {@code _sku}: the thirty-eight already visible in the reviewed plan,
     * plus the seventeen that only become visible once the gender/category decisions stop their
     * parent from being held for manual review. The seven products the owner already re-entered
     * by hand are deliberately excluded so the migration never writes over them.
     */
    private static final Set<Long> OWNER_V3_VARIANT_SKU_PARENT_IDS = Set.of(
            5951L, 8478L, 11376L, 25206L, 25843L, 26187L, 26287L, 26948L, 27555L, 29106L,
            29489L, 33313L, 33983L, 34037L, 34065L, 35115L, 35222L, 35277L, 35346L, 36296L,
            36357L, 36670L, 37104L, 37368L, 37433L, 38995L, 39004L, 39563L, 39835L, 39854L,
            40089L, 40467L, 40469L, 40471L, 40496L, 40559L, 40706L, 41070L,
            26364L, 26955L, 28387L, 29114L, 29371L, 29381L, 29790L, 29808L, 29819L, 31361L,
            31628L, 32398L, 36949L, 36984L, 39478L, 40018L, 42618L);

    /**
     * Owner decision 2026-08-05. WordPress holds two byte-identical extra rows for jacket JK157
     * — same colour, same size, same price, same stock — so only the first of each pair is
     * imported. Nothing is deleted on the old site.
     */
    private static final Set<Long> OWNER_V3_SKIPPED_DUPLICATE_VARIANT_IDS = Set.of(35273L, 35275L);

    /**
     * Owner decision 2026-08-05: the seven products whose variations the owner already re-entered
     * by hand in the new admin (target IDs of the form {@code var_<uuid>}). The migration leaves
     * them completely alone.
     */
    private static final Set<Long> OWNER_V3_RETAINED_MANUAL_PARENT_IDS =
            Set.of(26942L, 30587L, 34009L, 38771L, 39532L, 40513L, 41359L);

    /** Owner decision 2026-08-05: the two Polylang pairs whose Vietnamese half is migrated. */
    private static final Map<Long, Long> OWNER_V3_TRANSLATION_PAIRS =
            Map.of(41038L, 41181L, 41070L, 41176L);

    /**
     * Owner decision 2026-08-05: the four published English-only products. Their Vietnamese
     * half either does not exist or is still a WordPress draft, so the owner supplies the
     * Vietnamese wording and the English original moves into the {@code *_en} columns.
     */
    private static final Set<Long> OWNER_V3_TRANSLATED_SOURCE_IDS =
            Set.of(36670L, 36698L, 36725L, 41190L);

    /**
     * Owner decision 2026-08-05: the twenty-two products the owner re-filed by hand, plus the
     * three whose category is only knowable once the duplicate/translation decisions are applied
     * ({@code 41038} SCS-S10X, {@code 36670} and {@code 41190} English-only products). Every one
     * of these currently resolves to "uncategorized" in the target.
     */
    private static final Set<Long> OWNER_V3_CATEGORY_SOURCE_IDS = Set.of(
            26364L, 26955L, 28387L, 29114L, 29371L, 29381L, 29790L, 29808L, 29819L, 30139L,
            31348L, 31361L, 31372L, 31628L, 32398L, 36698L, 36725L, 36949L, 36984L, 39478L,
            40018L, 42618L,
            41038L, 36670L, 41190L);

    /**
     * Owner decision 2026-08-05: the seven illustrations embedded in the description of product
     * 39478 (POC P10 helmet) whose files are gone from the uploads tree — searched in full,
     * including resized variants. Its five real product photos are intact and unaffected.
     */
    private static final Set<String> POC_P10_DEAD_IMAGE_PATHS = Set.of(
            "2024/02/mu-bao-hiem-poc-p10-mau-trang-bong.png",
            "2024/02/chat-lieu-bao-ve-an-toan.png",
            "2024/02/thong-gio-mat-me-1.png",
            "2024/02/lot-non-em-ai.jpg",
            "2024/02/num-van-tang-chinh-kich-thuoc.png",
            "2024/02/khoa-nam-cham-non-poc-1.png",
            "2024/02/op-tai.png");

    /**
     * Owner decision 2026-08-05 (v4) — CORRECTS the v3 premise. The seven illustrations above are
     * not lost: product 39478 embedded them straight from {@code https://poc-helmet.com}, which is
     * why they were never in our uploads tree. All seven still serve HTTP 200. The owner chose to
     * copy them into our own store rather than drop them, so v4 approves them as recovery files.
     * Values below were measured from the downloaded bytes: path -> {sha256, bytes, mimeType}.
     */
    private static final Map<String, String[]> POC_P10_RECOVERED_FILES = Map.of(
            "2024/02/mu-bao-hiem-poc-p10-mau-trang-bong.png",
            new String[] {"ab9c8e57d7ba94f31fadbeb7d54a43b62c6122eed6313867bcf2a40691800af5",
                    "330781", "image/png"},
            "2024/02/chat-lieu-bao-ve-an-toan.png",
            new String[] {"03150a3ae0f4831758a77fa6061b6c59368bb2ea9e942b1c77e41481166e9f57",
                    "1727154", "image/png"},
            "2024/02/thong-gio-mat-me-1.png",
            new String[] {"280e3888d48f93c0b0db26cb3aa2e684f7f0c73d93b5d2beb597c22bcf0bfada",
                    "1988347", "image/png"},
            "2024/02/lot-non-em-ai.jpg",
            new String[] {"2a07562e1dd508517178b742806d448e145a7c59ab86879f7fb7ae244ae4fdf2",
                    "709037", "image/jpeg"},
            "2024/02/num-van-tang-chinh-kich-thuoc.png",
            new String[] {"41748974c9626608d79bead8dc936691e2dbe3450dd517850bfa5fda802775d5",
                    "1918408", "image/png"},
            "2024/02/khoa-nam-cham-non-poc-1.png",
            new String[] {"2be1850409265fa89cc4974d65ec7660113660a5ecf993ff7949675fc693812d",
                    "909235", "image/png"},
            "2024/02/op-tai.png",
            new String[] {"9638a5c3c4e03d297b4d77efa5c68dda0a3c3c18c6fd293185811966e65f66a1",
                    "1397943", "image/png"});

    private static final String OWNER_V3_DECISION_DATE = "2026-08-05";
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
        require(config.version() >= 1 && config.version() <= 4,
                "Unsupported owner override version");
        boolean v3 = config.version() >= 3;
        require(v3
                        ? OWNER_V3_DECISION_DATE.equals(config.ownerDecisionDate())
                        : "2026-08-03".equals(config.ownerDecisionDate()),
                "Owner decision date must be "
                        + (v3 ? OWNER_V3_DECISION_DATE : "2026-08-03"));

        DuplicateProductSelection duplicate = config.duplicateProductSelection();
        require(duplicate != null, "Duplicate product selection is required");
        require("SCS-S10X".equalsIgnoreCase(text(duplicate.sku())),
                "Duplicate product SKU must be SCS-S10X");
        require(new LinkedHashSet<>(safe(duplicate.sourceIds())).equals(SCS_S10X_SOURCE_IDS),
                "Duplicate product source IDs must be exactly 41038 and 41181");
        require("LATEST_POST_MODIFIED_GMT".equals(duplicate.selectionRule()),
                "SCS-S10X must use the latest post_modified_gmt selection rule");
        // v3: WordPress edited 41038 on 2026-05-12, so the unchanged rule now resolves to the
        // Vietnamese row. The owner reviewed the evidence and made 41038 the canonical product.
        require(duplicate.expectedSelectedSourceId() == (v3 ? 41038L : 41181L),
                "Expected SCS-S10X selection must be source " + (v3 ? "41038" : "41181"));
        require(v3 == duplicate.mergeAllowed(),
                v3 ? "SCS-S10X v3 must allow the reviewed translation merge"
                        : "SCS-S10X merge must remain disabled");
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
        validateProductCategoryOverrides(config.version(), inference.productCategoryOverrides());

        SourceMediaRecovery recovery = config.sourceMediaRecovery();
        require(recovery != null && recovery.recoveryManifestVersion() == 1,
                "Recovery manifest version 1 is required");
        // Owner decision 2026-08-05 (v4): the seven POC P10 illustrations are not lost — they were
        // hotlinked from https://poc-helmet.com. They are recovered into our own store instead of
        // being dropped, so v4 carries eleven approved recovery files rather than four.
        int expectedRecoveryFiles = config.version() >= 4 ? 11 : 4;
        require(safe(recovery.approvedFiles()).size() == expectedRecoveryFiles,
                "Exactly " + expectedRecoveryFiles + " approved recovery files are required");
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
        if (config.version() >= 4) {
            require(recoveryPaths.containsAll(POC_P10_RECOVERED_FILES.keySet()),
                    "Owner override v4 must approve the seven recovered POC P10 illustrations");
            for (ApprovedRecoveryFile file : safe(recovery.approvedFiles())) {
                String[] pinned = POC_P10_RECOVERED_FILES.get(file.relativePath());
                if (pinned == null) continue;
                require(pinned[0].equals(file.sha256())
                                && Long.parseLong(pinned[1]) == file.bytes()
                                && pinned[2].equals(file.mimeType()),
                        "Recovered POC P10 file does not match the reviewed bytes: "
                                + file.relativePath());
            }
        }
        List<UnavailableFileFallback> unavailable = safe(recovery.unavailableFileFallbacks());
        List<UnavailableFileFallback> sourceSide = unavailable.stream()
                .filter(value -> value.entityType() != null
                        && value.entityType().startsWith("SOURCE_"))
                .toList();
        validateSourceDeadImageFallbacks(config.version(), sourceSide);
        unavailable = unavailable.stream().filter(value -> !sourceSide.contains(value)).toList();
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
        // v3 extends the already-approved "unlink the dead anchor, keep the words" behaviour
        // from HTML fields to the JSON block fields. Structured URLs that are not anchors stay
        // untouched, which is why removeStructuredUrls must remain false above.
        require(v3 == content.unlinkDeadAnchorsInStructuredContent(),
                v3 ? "Owner override v3 must unlink dead anchors inside structured content"
                        : "Structured-content anchor unlinking requires owner override v3");
        validateExactTargetFieldMutations(config.version(), content.exactFieldMutations());

        validateVariantSkuGeneration(config.version(), config.variantSkuGeneration());
        validateTranslationMerge(config.version(), config.translationMerge());
        validateSourceTranslationOverrides(config.version(), config.sourceTranslationOverrides());
    }

    private void validateProductCategoryOverrides(
            int version, Map<Long, List<String>> overrides) {
        Map<Long, List<String>> values = overrides == null ? Map.of() : overrides;
        if (version < 3) {
            require(values.isEmpty(), "Product category overrides require owner override v3");
            return;
        }
        require(values.size() == OWNER_V3_CATEGORY_SOURCE_IDS.size(),
                "Owner override v3 must review exactly "
                        + OWNER_V3_CATEGORY_SOURCE_IDS.size() + " product categories");
        require(values.keySet().equals(OWNER_V3_CATEGORY_SOURCE_IDS),
                "Product category overrides do not match the reviewed product set");
        values.forEach((sourceId, slugs) -> {
            List<String> targets = safe(slugs);
            require(!targets.isEmpty(),
                    "Product category override needs at least one target for " + sourceId);
            Set<String> unique = new LinkedHashSet<>();
            for (String slug : targets) {
                require(hasText(slug)
                                && slug.equals(slug.trim().toLowerCase(java.util.Locale.ROOT)),
                        "Target category slug must be normalized for source " + sourceId);
                require(!"uncategorized".equals(slug),
                        "Product category override must not resolve to uncategorized: " + sourceId);
                require(unique.add(slug),
                        "Duplicate target category for source " + sourceId + ": " + slug);
            }
        });
    }

    private void validateVariantSkuGeneration(int version, VariantSkuGeneration generation) {
        if (version < 3) {
            require(generation == null, "Variant SKU generation requires owner override v3");
            return;
        }
        require(generation != null && generation.enabled(),
                "Owner override v3 requires the reviewed variant SKU generation decision");
        require("VARIANT_SKU_PARENT_PLUS_OPTIONS_V3".equals(generation.ruleId()),
                "Unexpected variant SKU generation rule");
        require("<parentSku>-<optionValues…>".equals(generation.pattern()),
                "Unexpected variant SKU generation pattern");
        require(new LinkedHashSet<>(safe(generation.parentSourceIds()))
                        .equals(OWNER_V3_VARIANT_SKU_PARENT_IDS),
                "Variant SKU generation must cover exactly the thirty-eight reviewed parents");
        require(new LinkedHashSet<>(safe(generation.retainedManualParentSourceIds()))
                        .equals(OWNER_V3_RETAINED_MANUAL_PARENT_IDS),
                "Retained hand-entered parents must be exactly the seven reviewed products");
        require(java.util.Collections.disjoint(
                        safe(generation.parentSourceIds()),
                        safe(generation.retainedManualParentSourceIds())),
                "A product cannot both generate SKUs and be retained as hand-entered");
        require(new LinkedHashSet<>(generation.skippedDuplicateVariantSourceIds())
                        .equals(OWNER_V3_SKIPPED_DUPLICATE_VARIANT_IDS),
                "Skipped duplicate variations must be exactly the two reviewed JK157 rows");
        require(hasText(generation.evidence()), "Variant SKU generation evidence is required");
    }

    private void validateTranslationMerge(int version, TranslationMerge merge) {
        if (version < 3) {
            require(merge == null, "Translation merge requires owner override v3");
            return;
        }
        require(merge != null && merge.enabled(),
                "Owner override v3 requires the reviewed translation merge decision");
        require("language".equals(merge.languageTaxonomy())
                        && "post_translations".equals(merge.translationGroupTaxonomy()),
                "Translation merge must read the exact Polylang taxonomies");
        require("vi".equals(merge.primaryLanguageSlug())
                        && "en".equals(merge.secondaryLanguageSlug()),
                "Translation merge must keep Vietnamese primary and English secondary");
        Map<Long, Long> pairs = merge.pairs() == null ? Map.of() : merge.pairs();
        require(pairs.equals(OWNER_V3_TRANSLATION_PAIRS),
                "Translation merge pairs must be exactly 41038<-41181 and 41070<-41176");
        require(hasText(merge.evidence()), "Translation merge evidence is required");
    }

    private void validateSourceTranslationOverrides(
            int version, List<SourceTranslationOverride> overrides) {
        List<SourceTranslationOverride> values = safe(overrides);
        if (version < 3) {
            require(values.isEmpty(), "Source translation overrides require owner override v3");
            return;
        }
        Set<Long> ids = new LinkedHashSet<>();
        for (SourceTranslationOverride override : values) {
            require(ids.add(override.sourceId()),
                    "Duplicate translation override for source " + override.sourceId());
            require(hasText(override.nameVi()) && hasText(override.descriptionVi()),
                    "Vietnamese name and description are required for source "
                            + override.sourceId());
            require(hasText(override.evidence()),
                    "Translation evidence is required for source " + override.sourceId());
        }
        require(ids.equals(OWNER_V3_TRANSLATED_SOURCE_IDS),
                "Translation overrides must cover exactly 36670, 36698, 36725 and 41190");
    }

    private void validateManualFieldOverrides(
            int version, List<ManualFieldOverride> overrides) {
        List<ManualFieldOverride> values = safe(overrides);
        if (version == 1) {
            require(values.isEmpty(), "Owner override v1 cannot contain manual field decisions");
            return;
        }
        boolean v3 = version >= 3;
        Set<Long> expectedIds = v3 ? OWNER_V3_UNISEX_SOURCE_IDS : OWNER_UNISEX_SOURCE_IDS;
        String expectedRuleId = v3 ? "OWNER_MANUAL_GENDER_V3" : "OWNER_MANUAL_GENDER_V2";
        require(values.size() == expectedIds.size(),
                "Owner override v" + version + " must contain exactly "
                        + expectedIds.size() + " gender decisions");
        Set<Long> ids = new LinkedHashSet<>();
        for (ManualFieldOverride override : values) {
            require(ids.add(override.sourceId()),
                    "Duplicate owner gender decision for source " + override.sourceId());
            require("gender".equals(override.field())
                            && !hasText(override.value())
                            && expectedRuleId.equals(override.ruleId())
                            && "OWNER_CONFIRMED".equals(override.confidence())
                            && hasText(override.evidence()),
                    "Owner gender decision does not match the approved v" + version + " policy");
        }
        require(ids.equals(expectedIds),
                "Owner override v" + version + " gender source IDs do not match the reviewed set");
    }

    private void validateSourceDeadImageFallbacks(
            int version, List<UnavailableFileFallback> fallbacks) {
        if (version < 3) {
            require(fallbacks.isEmpty(),
                    "Source-side dead-image fallbacks require owner override v3");
            return;
        }
        if (version >= 4) {
            // v4 recovers the seven POC P10 illustrations into our own store, so there is no
            // dead-image removal left to declare on the source side.
            require(fallbacks.isEmpty(),
                    "Owner override v4 recovers the POC P10 images instead of removing them");
            return;
        }
        require(fallbacks.size() == POC_P10_DEAD_IMAGE_PATHS.size(),
                "Owner override v3 must list exactly the reviewed POC P10 dead images");
        Set<String> paths = new LinkedHashSet<>();
        for (UnavailableFileFallback fallback : fallbacks) {
            require("SOURCE_PRODUCT".equals(fallback.entityType())
                            && "39478".equals(fallback.entityId())
                            && safe(fallback.fields()).equals(List.of("description"))
                            && "REMOVE_EXACT_DEAD_IMAGE_ONLY".equals(fallback.action()),
                    "Source dead-image fallback does not match the reviewed POC P10 decision");
            require(paths.add(fallback.relativePath()),
                    "Duplicate source dead-image path: " + fallback.relativePath());
        }
        require(paths.equals(POC_P10_DEAD_IMAGE_PATHS),
                "Source dead-image paths do not match the seven reviewed files");
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
            TargetContentPolicy targetContent,
            VariantSkuGeneration variantSkuGeneration,
            TranslationMerge translationMerge,
            List<SourceTranslationOverride> sourceTranslationOverrides) {

        Config(
                int version,
                String ownerDecisionDate,
                DuplicateProductSelection duplicateProductSelection,
                ProductInference productInference,
                SourceMediaRecovery sourceMediaRecovery,
                TargetMediaCleanup targetMediaCleanup,
                RedirectPolicy redirects,
                TargetContentPolicy targetContent) {
            this(version, ownerDecisionDate, duplicateProductSelection, productInference,
                    sourceMediaRecovery, targetMediaCleanup, redirects, targetContent,
                    null, null, List.of());
        }

        public List<SourceTranslationOverride> sourceTranslationOverrides() {
            return sourceTranslationOverrides == null ? List.of() : sourceTranslationOverrides;
        }
    }

    /**
     * Owner decision 2026-08-05. Builds a deterministic SKU for variations WordPress left
     * without one, from the parent SKU plus the variation's own option values. Restricted to an
     * explicit parent list so it can never silently widen to products the owner already curated.
     */
    record VariantSkuGeneration(
            boolean enabled,
            String ruleId,
            String pattern,
            List<Long> parentSourceIds,
            /**
             * Products whose variations the owner already re-entered by hand in the new admin.
             * Their SKU-less source variations are skipped on purpose, so they must not keep an
             * unresolved required field either — otherwise the migration stays blocked on data
             * the owner deliberately chose not to import.
             */
            List<Long> retainedManualParentSourceIds,
            /**
             * Variations WordPress stores twice with identical options. Importing both is
             * impossible — they would resolve to the same SKU — so the owner reviewed each pair
             * and the later row is skipped.
             */
            List<Long> skippedDuplicateVariantSourceIds,
            String evidence) {

        public List<Long> skippedDuplicateVariantSourceIds() {
            return skippedDuplicateVariantSourceIds == null
                    ? List.of() : skippedDuplicateVariantSourceIds;
        }
    }

    /**
     * Owner decision 2026-08-05. Polylang keeps translations as two separate posts joined by a
     * {@code post_translations} term. The Vietnamese row stays canonical and the English row's
     * wording is copied into the target's {@code *_en} columns instead of becoming its own
     * product.
     */
    record TranslationMerge(
            boolean enabled,
            String languageTaxonomy,
            String translationGroupTaxonomy,
            String primaryLanguageSlug,
            String secondaryLanguageSlug,
            Map<Long, Long> pairs,
            String evidence) {}

    /**
     * Owner-supplied Vietnamese wording for a published English-only source product. The English
     * original is preserved in the {@code *_en} columns.
     */
    record SourceTranslationOverride(
            long sourceId,
            String nameVi,
            String shortDescriptionVi,
            String descriptionVi,
            String seoTitleVi,
            String seoDescriptionVi,
            String evidence) {}

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
            List<ManualFieldOverride> manualFieldOverrides,
            /**
             * Owner-reviewed target categories, keyed by source product ID.
             *
             * <p>Deliberately per-product rather than a source-slug map: a slug map would also
             * move products that are already filed correctly. {@code giay-bao-ho} alone sits on
             * seventeen source products, eleven of which the target already categorises, and
             * {@code chua-phan-loai} carries both a helmet and a women's jacket. Only the exact
             * products the owner reviewed may move.</p>
             */
            Map<Long, List<String>> productCategoryOverrides) {

        ProductInference(
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
                List<ManualFieldOverride> manualFieldOverrides) {
            this(enabled, brandRuleId, brandFallbackSlug, brandAliases, genderTokenRuleId,
                    femaleTokens, maleTokens, unisexTokens, neutralCategoryRuleId,
                    unisexNeutralSourceCategorySlugs, skuRuleId, skuIgnoredTokens,
                    manualFieldOverrides, Map.of());
        }

        public Map<Long, List<String>> productCategoryOverrides() {
            return productCategoryOverrides == null ? Map.of() : productCategoryOverrides;
        }
    }

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
            List<ExactTargetFieldMutation> exactFieldMutations,
            /**
             * Applies the same "drop the {@code <a>} wrapper, keep every character of the visible
             * text" rule to anchors that live inside JSON block fields. Non-anchor structured URLs
             * are still preserved — that is governed by {@code removeStructuredUrls}.
             */
            Boolean unlinkDeadAnchorsInStructuredContent) {

        /** Absent in the v1/v2 files, which predate the decision; absent means "no". */
        TargetContentPolicy {
            unlinkDeadAnchorsInStructuredContent =
                    Boolean.TRUE.equals(unlinkDeadAnchorsInStructuredContent);
        }

        TargetContentPolicy(
                boolean unlinkDeadInternalAnchors,
                boolean preserveAnchorText,
                boolean removePlainTextUrls,
                boolean removeStructuredUrls,
                boolean rewriteExternalLinks) {
            this(unlinkDeadInternalAnchors, preserveAnchorText, removePlainTextUrls,
                    removeStructuredUrls, rewriteExternalLinks, List.of(), false);
        }

        TargetContentPolicy(
                boolean unlinkDeadInternalAnchors,
                boolean preserveAnchorText,
                boolean removePlainTextUrls,
                boolean removeStructuredUrls,
                boolean rewriteExternalLinks,
                List<ExactTargetFieldMutation> exactFieldMutations) {
            this(unlinkDeadInternalAnchors, preserveAnchorText, removePlainTextUrls,
                    removeStructuredUrls, rewriteExternalLinks, exactFieldMutations, false);
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
