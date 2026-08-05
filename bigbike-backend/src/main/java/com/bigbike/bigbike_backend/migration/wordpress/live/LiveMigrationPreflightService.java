package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMediaPlanner.Reference;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Action;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.ActionCounts;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.ArticlePlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Issue;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Metadata;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.OwnerDecisionPlans;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.OwnerOverridesMetadata;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.ProductPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.ProductInferencePlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.ProductInferenceSummary;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.ProductVideoPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Safety;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.SeoSummary;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.SourceCounts;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.TargetCounts;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.VariantPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.Snapshot;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetArticle;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetBrand;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetCategory;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetProduct;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetVariant;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressArticleMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressPermalinkManagerMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressProductMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressVariationMapper;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.parser.PhpSerializeParser;
import com.bigbike.bigbike_backend.migration.wordpress.parser.WordPressSqlDumpRowReader;
import com.bigbike.bigbike_backend.service.video.YouTubeUrlParser;
import io.minio.MinioClient;
import java.math.BigDecimal;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Builds the production migration write-plan without exposing any write operation.
 * The caller must supply a PostgreSQL connection already placed in READ ONLY mode.
 */
public final class LiveMigrationPreflightService {

    private static final Pattern WP_UPLOAD_URL = Pattern.compile(
            "(?:https?:)?//[^\\s\\\"'<>]*/wp-content/uploads/([^\\s\\\"'<>?#]+)|"
                    + "(?<![A-Za-z0-9_])/wp-content/uploads/([^\\s\\\"'<>?#]+)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern INTERNAL_LEGACY_LINK = Pattern.compile(
            "(?:https?://(?:www\\.)?bigbike\\.vn)?/(?:sp/[^\\s\\\"'<>]+\\.html|"
                    + "tin-tuc/[^\\s\\\"'<>]+\\.html|vi(?:/|[\\\"']))",
            Pattern.CASE_INSENSITIVE);

    private final LiveWordPressSnapshotReader sourceReader =
            new LiveWordPressSnapshotReader(new WordPressSqlDumpRowReader());
    private final LiveTargetSnapshotReader targetReader = new LiveTargetSnapshotReader();
    private final WordPressProductMapper productMapper = new WordPressProductMapper();
    private final WordPressVariationMapper variationMapper = new WordPressVariationMapper();
    private final WordPressArticleMapper articleMapper = new WordPressArticleMapper();
    private final LiveMediaPlanner mediaPlanner = new LiveMediaPlanner();

    public LiveMigrationPreflightReport run(
            LiveMigrationPreflightOptions options,
            Connection targetConnection,
            MinioClient targetMinioClient) throws Exception {

        validateInputs(options, targetConnection);
        LiveMigrationOwnerOverrides.Loaded ownerOverrides =
                new LiveMigrationOwnerOverrides().load(options.ownerOverridesPath());
        var recoveryResult = new LiveSourceMediaRecoveryPlanner().plan(
                ownerOverrides.config(), options.recoveryStagingPath(), options.uploadsPath());
        String dumpSha256 = new com.bigbike.bigbike_backend.migration.wordpress.media.MediaChecksumService()
                .sha256Hex(options.dumpPath());
        long dumpBytes = Files.size(options.dumpPath());
        var backupValidation = new LiveOffsiteBackupManifestValidator().validate(
                options.offsiteBackupManifest(), options.snapshotId(), dumpSha256, Instant.now());

        var source = sourceReader.read(options.dumpPath(), options.tablePrefix());
        String dumpSha256AfterRead = new com.bigbike.bigbike_backend.migration.wordpress.media.MediaChecksumService()
                .sha256Hex(options.dumpPath());
        if (!dumpSha256.equals(dumpSha256AfterRead) || dumpBytes != Files.size(options.dumpPath())) {
            throw new IllegalStateException("Source dump changed while preflight was reading it");
        }
        Snapshot target = targetReader.read(targetConnection);
        var duplicateSelection = new LiveDuplicateProductSelectionPlanner().plan(
                source, ownerOverrides.config().duplicateProductSelection());
        Map<Long, String> attachmentPaths = source.attachmentPaths();
        String sourceCurrency = trimToNull(source.options().get("woocommerce_currency"));

        ProductResult productResult = planProducts(
                source, target, attachmentPaths, sourceCurrency,
                ownerOverrides.config(), duplicateSelection);
        VariantResult variantResult = planVariants(
                source, target, productResult.contextBySourceId(), attachmentPaths, sourceCurrency,
                ownerOverrides.config());
        ArticleResult articleResult = planArticles(source, target, attachmentPaths);

        List<Reference> mediaReferences = new ArrayList<>();
        mediaReferences.addAll(productResult.mediaReferences());
        mediaReferences.addAll(variantResult.mediaReferences());
        mediaReferences.addAll(articleResult.mediaReferences());
        LiveTargetContentRewritePlanner targetContentPlanner = new LiveTargetContentRewritePlanner();
        var targetContentScan = targetContentPlanner.scan(target);
        var redirectResult = new LiveRedirectPlanner().plan(
                source, target, productResult.contextBySourceId(), articleResult.contextBySourceId(),
                targetContentScan.legacyInternalPaths(), ownerOverrides.config().redirects());
        List<LiveMigrationOwnerOverrides.UnavailableFileFallback> unavailableFallbacks =
                activeUnavailableFallbacks(ownerOverrides.config(), options.uploadsPath());
        mediaReferences.addAll(filterFallbackMediaReferences(
                targetContentScan.mediaReferences(), unavailableFallbacks));
        var mediaResult = mediaPlanner.plan(
                mediaReferences, options.uploadsPath(), target.media(),
                options.targetMinioBucket(), options.hashTargetMedia(), targetMinioClient);
        var targetContentResult = targetContentPlanner.plan(
                targetContentScan, redirectResult.plans(), mediaResult.plans(), target.media(),
                ownerOverrides.config().targetContent(), unavailableFallbacks);
        var exactTargetFieldMutationResult =
                new LiveOwnerExactTargetFieldMutationPlanner().plan(
                        target, ownerOverrides.config().targetContent());
        var targetMediaCleanupResult = new LiveTargetMediaCleanupPlanner().plan(
                targetConnection, target, mediaResult.targetChecksumPlans(),
                ownerOverrides.config().targetMediaCleanup());

        List<Issue> issues = new ArrayList<>();
        issues.addAll(productResult.issues());
        issues.addAll(duplicateSelection.issues());
        issues.addAll(recoveryResult.issues());
        issues.addAll(variantResult.issues());
        issues.addAll(articleResult.issues());
        issues.addAll(mediaResult.issues());
        issues.addAll(redirectResult.issues());
        issues.addAll(targetContentResult.issues());
        issues.addAll(exactTargetFieldMutationResult.issues());
        issues.addAll(targetMediaCleanupResult.issues());
        for (String warning : source.warnings()) {
            issues.add(new Issue("ERROR", "SOURCE_DUMP", "", "DUMP_PARSE_WARNING", warning));
        }
        for (String error : backupValidation.errors()) {
            issues.add(new Issue(
                    "BLOCKER", "BACKUP", "", "OFFSITE_BACKUP_MANIFEST_INVALID", error));
        }
        List<String> blockers = new ArrayList<>();
        if (!options.finalSnapshot()) blockers.add("SOURCE_SNAPSHOT_NOT_FINAL");
        if (!options.freezeConfirmed()) blockers.add("CONTENT_WRITES_NOT_FROZEN");
        if (!backupValidation.valid()) blockers.add("OFFSITE_BACKUP_NOT_CONFIRMED");
        if (target.contentCategoriesPresent()) blockers.add("CONTENT_CATEGORY_CLEANUP_NOT_APPLIED");
        if (!target.mediaShaPresent()) blockers.add("MEDIA_SHA256_SCHEMA_NOT_APPLIED");
        if (!target.migrationAuditSchemaPresent()) blockers.add("MIGRATION_AUDIT_SCHEMA_NOT_APPLIED");
        if (!source.warnings().isEmpty()) blockers.add("SOURCE_DUMP_PARSE_WARNINGS");
        if (productResult.issues().stream().anyMatch(issue -> "BLOCKER".equals(issue.severity())
                && issue.code().startsWith("SOURCE_VIDEO_"))) {
            blockers.add("SOURCE_VIDEO_MAPPING_INVALID");
        }
        if (productResult.issues().stream().anyMatch(issue -> "BLOCKER".equals(issue.severity())
                && "LEGACY_PRODUCT_STATUS_REVIEW_REQUIRED".equals(issue.code()))) {
            blockers.add("LEGACY_PRODUCT_STATUS_REVIEW_REQUIRED");
        }
        blockers.addAll(mediaResult.blockers());
        blockers.addAll(duplicateSelection.blockers());
        blockers.addAll(recoveryResult.blockers());
        blockers.addAll(redirectResult.blockers());
        blockers.addAll(targetContentResult.blockers());
        blockers.addAll(exactTargetFieldMutationResult.blockers());
        blockers.addAll(targetMediaCleanupResult.blockers());
        if (hasAction(productResult.plans(), Action.CONFLICT)
                || hasVariantAction(variantResult.plans(), Action.CONFLICT)
                || hasArticleAction(articleResult.plans(), Action.CONFLICT)) {
            blockers.add("MIGRATION_CONFLICTS_PRESENT");
        }
        if (hasMissingRequired(productResult.plans(), variantResult.plans(), articleResult.plans())) {
            blockers.add("REQUIRED_FIELDS_MISSING");
        }
        if (hasAction(productResult.plans(), Action.MANUAL_REVIEW)) {
            blockers.add("PRODUCT_INFERENCE_MANUAL_REVIEW_REQUIRED");
        }

        FileStore fileStore = Files.getFileStore(options.reportDirectory().toAbsolutePath());
        long usableBytes = fileStore.getUsableSpace();
        if (usableBytes < mediaResult.projectedBytes() + 512L * 1024 * 1024) {
            blockers.add("INSUFFICIENT_DISK_HEADROOM");
        }

        Map<String, Integer> productStatuses = statusCounts(source.postsOfType("product"));
        Map<String, Integer> variationStatuses = statusCounts(source.postsOfType("product_variation"));
        Map<String, Integer> articleStatuses = statusCounts(source.postsOfType("post"));
        int productRedirectOnly = (int) source.postsOfType("product").stream()
                .filter(post -> !"publish".equals(post.postStatus()) && !post.postName().isBlank())
                .count();
        int privateArticles = articleStatuses.getOrDefault("private", 0);
        int trashAutoDraftArticles = articleStatuses.getOrDefault("trash", 0)
                + articleStatuses.getOrDefault("auto-draft", 0);
        int contentCategoryTerms = (int) source.taxonomyById().values().stream()
                .filter(tax -> "category".equals(tax.taxonomy())).count();
        int permalinkRows = permalinkRows(source.options().get("permalink-manager_uris"));

        SourceCounts sourceCounts = new SourceCounts(
                productResult.plans().size(), productRedirectOnly, productStatuses,
                variantResult.plans().size(), variationStatuses, articleResult.plans().size(),
                articleStatuses, privateArticles, trashAutoDraftArticles,
                (int) mediaReferences.stream().map(Reference::attachmentId).filter(java.util.Objects::nonNull)
                        .distinct().count(),
                (int) mediaReferences.stream().filter(ref -> ref.attachmentId() == null)
                        .map(Reference::relativePath).filter(java.util.Objects::nonNull).distinct().count(),
                contentCategoryTerms,
                source.rankMathRedirects().size() + source.fgRedirects().size() + permalinkRows);

        TargetCounts targetCounts = new TargetCounts(
                target.products().size(), target.variants().size(), target.articles().size(),
                target.media().size(), target.redirects().size(), target.categories().size(),
                target.brands().size(), target.articleTagCount(), target.protectedCounts());

        Safety safety = new Safety(
                Files.isReadable(options.dumpPath()), Files.isReadable(options.uploadsPath()),
                backupValidation.present(), backupValidation.valid(), backupValidation.errors(),
                target.contentCategoriesPresent(), target.mediaShaPresent(),
                target.migrationAuditSchemaPresent(), true,
                usableBytes, mediaResult.projectedBytes());

        Metadata metadata = new Metadata(
                options.snapshotId(), options.dumpPath().toAbsolutePath().toString(), dumpSha256,
                dumpBytes, options.uploadsPath().toAbsolutePath().toString(), options.tablePrefix(),
                options.finalSnapshot(), options.freezeConfirmed(), targetConnection.isReadOnly(),
                target.schema(), target.migrationVersion());

        SeoSummary seo = new SeoSummary(
                productResult.seoTitles(), productResult.seoDescriptions(), productResult.canonicals(),
                articleResult.seoTitles(), articleResult.seoDescriptions(), articleResult.canonicals(),
                productResult.internalLinks() + articleResult.internalLinks(),
                productResult.wordpressMediaLinks() + articleResult.wordpressMediaLinks());

        OwnerDecisionPlans ownerDecisions = new OwnerDecisionPlans(
                new OwnerOverridesMetadata(
                        ownerOverrides.config().version(), ownerOverrides.config().ownerDecisionDate(),
                        ownerOverrides.path().toString(), ownerOverrides.sha256()),
                duplicateSelection.plan(), summarizeInferences(productResult.inferences()),
                productResult.inferences(), recoveryResult.summary(), recoveryResult.plans(),
                unavailableFallbacks.stream().map(fallback ->
                        new LiveMigrationPreflightReport.UnavailableMediaFallbackPlan(
                                fallback.relativePath(), fallback.entityType(), fallback.entityId(),
                                fallback.fields(), fallback.action())).toList(),
                exactTargetFieldMutationResult.plans(),
                targetMediaCleanupResult.summary(), targetMediaCleanupResult.plans());

        return new LiveMigrationPreflightReport(
                Instant.now(), metadata, safety, ownerDecisions, sourceCounts, targetCounts,
                countProductActions(productResult.plans()), countVariantActions(variantResult.plans()),
                countArticleActions(articleResult.plans()), mediaResult.summary(),
                redirectResult.summary(), seo, targetContentResult.summary(),
                productResult.plans(), variantResult.plans(), articleResult.plans(),
                mediaResult.plans(), mediaResult.targetChecksumPlans(),
                targetContentResult.plans(),
                redirectResult.plans(), List.copyOf(issues),
                List.copyOf(new LinkedHashSet<>(blockers)));
    }

    private ProductResult planProducts(
            LiveWordPressSnapshotReader.Snapshot source,
            Snapshot target,
            Map<Long, String> attachmentPaths,
            String sourceCurrency,
            LiveMigrationOwnerOverrides.Config ownerOverrides,
            LiveDuplicateProductSelectionPlanner.Result duplicateSelection) {

        List<WpPost> selected = source.postsOfType("product").stream()
                .filter(post -> "publish".equals(post.postStatus()))
                .filter(post -> !ownerOverrides.duplicateProductSelection().sourceIds().contains(post.id())
                        || (duplicateSelection.selectedSourceId() != null
                            && duplicateSelection.selectedSourceId().equals(post.id())))
                .sorted(Comparator.comparingLong(WpPost::id))
                .toList();
        Map<String, List<TargetProduct>> targetBySku = multiIndex(target.products(), p -> normalizeSku(p.sku()));
        Map<String, List<TargetProduct>> targetBySlug = multiIndex(target.products(), p -> normalizeSlug(p.slug()));
        Map<String, List<TargetProduct>> targetByLegacy = indexProductLegacy(target.products());
        Map<String, List<WpPost>> sourceBySku = multiIndex(selected,
                post -> normalizeSku(source.meta(post.id()).get("_sku")));
        Map<String, List<WpPost>> sourceBySlug = multiIndex(selected, post -> normalizeSlug(post.postName()));
        Map<String, TargetCategory> activeCategories = target.categories().stream()
                .filter(category -> !category.deleted())
                .filter(category -> category.visible() || "uncategorized".equals(normalizeSlug(category.slug())))
                .filter(category -> normalizeSlug(category.slug()) != null)
                .collect(Collectors.toMap(category -> normalizeSlug(category.slug()), Function.identity(), (a, b) -> a));
        TargetCategory uncategorized = activeCategories.get("uncategorized");
        Map<String, TargetBrand> brandsBySlug = target.brands().stream()
                .filter(TargetBrand::visible)
                .filter(brand -> normalizeSlug(brand.slug()) != null)
                .collect(Collectors.toMap(brand -> normalizeSlug(brand.slug()), Function.identity(), (a, b) -> a));
        Map<String, TargetBrand> brandsById = target.brands().stream()
                .filter(brand -> hasText(brand.id()))
                .collect(Collectors.toMap(TargetBrand::id, Function.identity(), (a, b) -> a));
        LiveProductInferencePlanner inferencePlanner = new LiveProductInferencePlanner(
                ownerOverrides.productInference(), source, target, selected);

        List<ProductPlan> plans = new ArrayList<>();
        Map<Long, ProductContext> contexts = new LinkedHashMap<>();
        List<Reference> mediaReferences = new ArrayList<>();
        List<Issue> issues = new ArrayList<>();
        List<ProductInferencePlan> inferences = new ArrayList<>();
        int seoTitles = 0, seoDescriptions = 0, canonicals = 0, internalLinks = 0, wpMediaLinks = 0;

        for (WpPost post : selected) {
            Map<String, String> meta = source.meta(post.id());
            var mapped = productMapper.map(post, source.metaByPost().getOrDefault(post.id(), List.of()));
            List<String> reasons = new ArrayList<>();
            List<String> missing = new ArrayList<>();
            List<String> fieldsToFill = new ArrayList<>();
            List<String> preserved = new ArrayList<>();
            List<String> seoFields = sourceSeoFields(meta);
            if (hasText(mapped.seoTitle())) seoTitles++;
            if (hasText(mapped.seoDescription())) seoDescriptions++;
            String canonical = firstNonBlank(meta.get("rank_math_canonical"), meta.get("_yoast_wpseo_canonical"));
            if (hasText(canonical)) canonicals++;
            internalLinks += countMatches(INTERNAL_LEGACY_LINK, post.postContent())
                    + countMatches(INTERNAL_LEGACY_LINK, post.postExcerpt());
            List<String> descriptionInlinePaths = extractInlineMediaPaths(post.postContent());
            List<String> excerptInlinePaths = extractInlineMediaPaths(post.postExcerpt());
            List<String> ogInlinePaths = mergePaths(
                    extractInlineMediaPaths(meta.get("rank_math_facebook_image")),
                    extractInlineMediaPaths(meta.get("_yoast_wpseo_opengraph-image")));
            List<String> inlinePaths = mergePaths(
                    descriptionInlinePaths, excerptInlinePaths, ogInlinePaths);
            wpMediaLinks += inlinePaths.size();

            String skuKey = normalizeSku(mapped.sku());
            String slugKey = normalizeSlug(mapped.slug());
            boolean sourceDuplicate = isDuplicate(sourceBySku, skuKey) || isDuplicate(sourceBySlug, slugKey);
            if (sourceDuplicate) reasons.add("Duplicate normalized SKU or slug exists in source snapshot");

            Match<TargetProduct> match = matchProduct(
                    post.id(), skuKey, slugKey, targetBySku, targetBySlug, targetByLegacy);
            reasons.addAll(match.conflicts());
            TargetProduct existing = match.target();
            String targetProvenance = productProvenance(post.id(), existing, match.method());
            String statusDecision = productStatusDecision(existing, targetProvenance);
            boolean ownerSelectedDuplicate = duplicateSelection.selectedSourceId() != null
                    && duplicateSelection.selectedSourceId().equals(post.id());
            if (ownerSelectedDuplicate) {
                statusDecision = existing == null
                        ? "OWNER_OVERRIDE_INSERT_AS_DRAFT_SCS_S10X"
                        : "DRAFT".equals(existing.publishStatus())
                                ? "OWNER_OVERRIDE_PRESERVE_DRAFT_SCS_S10X"
                                : "OWNER_OVERRIDE_FORCE_DRAFT_SCS_S10X";
            }

            List<String> sourceCategorySlugs = source.taxonomyTerms(post.id(), "product_cat").stream()
                    .map(term -> term.term().slug()).filter(LiveMigrationPreflightService::hasText)
                    .map(LiveMigrationPreflightService::normalizeSlug).filter(java.util.Objects::nonNull)
                    .distinct().toList();
            List<String> exactCategorySlugs = sourceCategorySlugs.stream()
                    .filter(activeCategories::containsKey).distinct().toList();
            String categoryConfidence;
            List<String> plannedCategories;
            if (!exactCategorySlugs.isEmpty()) {
                plannedCategories = exactCategorySlugs;
                categoryConfidence = "EXACT_SLUG";
            } else if (uncategorized != null) {
                plannedCategories = List.of(uncategorized.slug());
                categoryConfidence = sourceCategorySlugs.isEmpty()
                        ? "FALLBACK_NO_SOURCE_CATEGORY" : "FALLBACK_UNMAPPED_SOURCE_CATEGORY";
            } else {
                plannedCategories = List.of();
                categoryConfidence = "MISSING_SYSTEM_FALLBACK";
            }

            // Existing target taxonomy is owner-authored data and therefore remains the
            // authoritative baseline. Exact source-slug links may only be appended.
            if (existing != null && existing.categorySlugs() != null
                    && !existing.categorySlugs().isEmpty()) {
                LinkedHashSet<String> preservedCategories = new LinkedHashSet<>(existing.categorySlugs());
                boolean appendedExact = preservedCategories.addAll(exactCategorySlugs);
                plannedCategories = List.copyOf(preservedCategories);
                categoryConfidence = appendedExact
                        ? "TARGET_PRESERVED_PLUS_EXACT_SLUG" : "TARGET_PRESERVED";
            }

            List<String> sourceBrandSlugs = source.taxonomyTerms(post.id(), "pwb-brand").stream()
                    .map(term -> normalizeSlug(term.term().slug())).filter(java.util.Objects::nonNull)
                    .distinct().toList();
            List<String> mappedBrands = sourceBrandSlugs.stream().filter(brandsBySlug::containsKey).toList();
            String sourceBrandSlug = mappedBrands.size() == 1 ? mappedBrands.get(0) : null;
            String existingBrandSlug = existing == null || !hasText(existing.brandId())
                    ? null
                    : java.util.Optional.ofNullable(brandsById.get(existing.brandId()))
                            .map(TargetBrand::slug).map(LiveMigrationPreflightService::normalizeSlug)
                            .orElse(null);
            String targetBrandSlug = existingBrandSlug != null ? existingBrandSlug : sourceBrandSlug;
            boolean ambiguousBrandRequiresWrite = mappedBrands.size() > 1
                    && (existing == null || !hasText(existing.brandId()));

            List<String> sourceGenderSlugs = source.taxonomyTerms(post.id(), "pa_gender").stream()
                    .map(term -> normalizeSlug(term.term().slug())).filter(java.util.Objects::nonNull)
                    .distinct().toList();
            List<String> mappedGenders = sourceGenderSlugs.stream()
                    .map(LiveMigrationPreflightService::mapDirectGender)
                    .filter(java.util.Objects::nonNull).distinct().toList();
            String sourceGender = resolveDirectGender(sourceGenderSlugs);
            boolean directUnisex = "Unisex".equals(sourceGender) && mappedGenders.size() == 2;
            boolean ambiguousGender = mappedGenders.size() > 1 && !directUnisex;
            String targetGender = existing != null && hasText(existing.gender())
                    ? existing.gender().trim() : sourceGender;
            String effectiveSku = trimToNull(mapped.sku());
            String effectiveBrandSlug = targetBrandSlug;
            String effectiveGender = targetGender;
            List<String> inferenceManualFields = new ArrayList<>();
            boolean manualReview = sourceDuplicate || !match.conflicts().isEmpty()
                    || mappedBrands.size() > 1
                    || ambiguousGender
                    || (existing == null
                        && "FALLBACK_UNMAPPED_SOURCE_CATEGORY".equals(categoryConfidence));
            if (existing == null) {
                LiveProductInferencePlanner.Result inferred = inferencePlanner.infer(
                        post, mapped.sku(), sourceBrandSlugs, mappedBrands,
                        sourceGender, sourceGenderSlugs, sourceCategorySlugs);
                inferences.addAll(inferred.plans());
                effectiveSku = inferred.sku();
                effectiveBrandSlug = inferred.brandSlug();
                effectiveGender = inferred.gender();
                inferenceManualFields.addAll(inferred.manualFields());
                if (!inferred.manualFields().isEmpty()) {
                    manualReview = true;
                    reasons.add("Controlled inference still requires manual resolution for "
                            + inferred.manualFields());
                }
                for (ProductInferencePlan inference : inferred.plans()) {
                    if (inference.manualFollowUp()) {
                        String severity = "MANUAL_REVIEW".equals(inference.decision())
                                ? "BLOCKER" : "WARNING";
                        String code = "MANUAL_REVIEW".equals(inference.decision())
                                ? "PRODUCT_INFERENCE_MANUAL_REVIEW_REQUIRED"
                                : "PRODUCT_INFERENCE_FOLLOW_UP_REQUIRED";
                        issues.add(new Issue(
                                severity, "PRODUCT", Long.toString(post.id()), code,
                                inference.field() + ": " + inference.evidence()));
                    }
                }
            }
            targetBrandSlug = effectiveBrandSlug;
            targetGender = effectiveGender;
            if (!ownerSelectedDuplicate && existing != null && isLegacyProvenance(targetProvenance)
                    && "PUBLISHED".equals(existing.publishStatus())) {
                if (existing.adminAuditCount() > 0) {
                    manualReview = true;
                    reasons.add("Existing legacy-linked product is PUBLISHED and has admin audit activity; "
                            + "preserve target status and do not auto-downgrade");
                } else if ("DOWNGRADE_CONFIRMED_LEGACY_TO_DRAFT".equals(statusDecision)) {
                    reasons.add("Exact legacy_id and deterministic target ID identify an old import; "
                            + "no admin audit exists, so status downgrade to DRAFT is explicitly planned");
                } else {
                    manualReview = true;
                    reasons.add("Existing legacy-linked product is PUBLISHED but has no attributable admin audit; "
                            + "status requires manual provenance review");
                    issues.add(new Issue(
                            "BLOCKER", "PRODUCT", Long.toString(post.id()),
                            "LEGACY_PRODUCT_STATUS_REVIEW_REQUIRED",
                            "Target " + existing.id() + " is PUBLISHED with legacy provenance but no "
                                    + "attributable admin audit; no automatic status change is planned"));
                }
            }
            if (mappedBrands.size() > 1) {
                reasons.add(ambiguousBrandRequiresWrite
                        ? "Multiple source brands map to target brands"
                        : "Multiple source brands map to target brands; preserve the existing target brand");
                if (!ambiguousBrandRequiresWrite) {
                    issues.add(new Issue(
                            "WARNING", "PRODUCT", Long.toString(post.id()),
                            "SOURCE_BRAND_AMBIGUITY_TARGET_PRESERVED",
                            "Source maps to multiple brands; target brand " + existingBrandSlug
                                    + " is nonblank and remains unchanged"));
                }
            }
            if (ambiguousGender) reasons.add("Multiple source genders cannot map to one target field");
            if (sourceGenderSlugs.size() > mappedGenders.size()) {
                reasons.add("One or more source gender terms have no direct target mapping");
                manualReview = true;
            }

            ProductVideoResolution videoResolution = resolveProductVideos(source, meta);
            List<ProductVideoPlan> sourceVideos = videoResolution.videos();
            List<Long> productMediaIds = productAttachmentIds(mapped);
            List<Long> videoMediaIds = productVideoMediaAttachmentIds(sourceVideos);
            List<Long> ogMediaIds = seoOgAttachmentIds(meta);
            List<Long> attachmentIds = mergeAttachmentIds(
                    productMediaIds, videoMediaIds, ogMediaIds);
            Action action;
            String targetId;
            String targetSlug;
            if (sourceDuplicate || !match.conflicts().isEmpty()
                    || (existing != null && (ambiguousBrandRequiresWrite || ambiguousGender))) {
                action = Action.CONFLICT;
                targetId = existing == null ? null : existing.id();
                targetSlug = existing == null ? null : existing.slug();
            } else if (existing == null) {
                targetId = "wp-prod-" + post.id();
                targetSlug = trimToNull(post.postName());
                require(missing, "slug", post.postName());
                require(missing, "name", post.postTitle());
                require(missing, "sku", effectiveSku);
                if (!isPositive(sourceRetailPrice(mapped.regularPrice(), mapped.price()))) {
                    missing.add("retailPrice");
                }
                require(missing, "stockState", mapped.stockStatus());
                if (!"VND".equalsIgnoreCase(sourceCurrency)) missing.add("currency");
                if (plannedCategories.isEmpty()) missing.add("categoryIds");
                if (!hasText(effectiveBrandSlug)) missing.add("brandId");
                if (!hasText(effectiveGender)) missing.add("gender");
                action = missing.isEmpty() ? Action.INSERT : Action.MANUAL_REVIEW;
                if (action == Action.MANUAL_REVIEW) manualReview = true;
                if (action == Action.INSERT) {
                    addProductMediaReferences(
                            mediaReferences, post, attachmentIds, inlinePaths,
                            attachmentPaths);
                }
            } else {
                targetId = existing.id();
                targetSlug = existing.slug();
                addIfBlank(fieldsToFill, "legacyId", existing.legacyId(), Long.toString(post.id()));
                addIfBlank(fieldsToFill, "sku", existing.sku(), mapped.sku());
                addIfBlank(fieldsToFill, "name", existing.name(), mapped.name());
                addIfBlank(fieldsToFill, "shortDescription", existing.shortDescription(), post.postExcerpt());
                addIfBlank(fieldsToFill, "description", existing.description(), mapped.description());
                addIfMissingPositive(fieldsToFill, "retailPrice", existing.retailPrice(),
                        sourceRetailPrice(mapped.regularPrice(), mapped.price()));
                addIfNull(fieldsToFill, "salePrice", existing.salePrice(),
                        sourceSalePrice(mapped.regularPrice(), mapped.price(), mapped.salePrice()));
                addIfNull(fieldsToFill, "stockQuantity", existing.stockQuantity(), mapped.stockQuantity());
                addIfNull(fieldsToFill, "manageStock", existing.manageStock(), mapped.manageStock());
                addIfBlank(fieldsToFill, "backorders", existing.backorders(), mapped.backorders());
                addIfNull(fieldsToFill, "weightKg", existing.weightKg(), mapped.weightKg());
                addIfNull(fieldsToFill, "lengthCm", existing.lengthCm(), mapped.lengthCm());
                addIfNull(fieldsToFill, "widthCm", existing.widthCm(), mapped.widthCm());
                addIfNull(fieldsToFill, "heightCm", existing.heightCm(), mapped.heightCm());
                addIfBlank(fieldsToFill, "seoTitle", existing.seoTitle(), mapped.seoTitle());
                addIfBlank(fieldsToFill, "seoDescription", existing.seoDescription(), mapped.seoDescription());
                addIfBlank(fieldsToFill, "seoCanonicalUrl", existing.seoCanonicalUrl(), canonical);
                if (!hasText(existing.seoOgImageId()) && !hasText(existing.seoOgImageUrl())
                        && !seoOgAttachmentIds(meta).isEmpty()) {
                    fieldsToFill.add("seoOgImage");
                }
                if (!hasText(existing.brandId()) && sourceBrandSlug != null) fieldsToFill.add("brandId");
                if (!hasText(existing.gender()) && sourceGender != null) fieldsToFill.add("gender");
                if (!hasText(existing.imageId()) && !hasText(existing.imageUrl()) && mapped.thumbnailId() != null) {
                    fieldsToFill.add("image");
                }
                if (isEmptyJsonArray(existing.galleryText()) && mapped.galleryIds() != null
                        && !mapped.galleryIds().isEmpty()) fieldsToFill.add("gallery");
                if (isEmptyJsonArray(existing.videosText()) && !sourceVideos.isEmpty()) {
                    fieldsToFill.add("videos");
                }
                for (String category : exactCategorySlugs) {
                    if (existing.categorySlugs().stream()
                            .noneMatch(value -> category.equals(normalizeSlug(value)))) {
                        fieldsToFill.add("categoryIds:" + category);
                    }
                }
                preserved.addAll(preservedProductFields(existing));
                if (hasText(existing.name()) && hasText(mapped.name())
                        && !normalizeContent(existing.name()).equals(normalizeContent(mapped.name()))) {
                    manualReview = true;
                    reasons.add("Matched key but source and target names differ; no name overwrite planned");
                }
                boolean statusDowngrade = "DOWNGRADE_CONFIRMED_LEGACY_TO_DRAFT".equals(statusDecision)
                        || "OWNER_OVERRIDE_FORCE_DRAFT_SCS_S10X".equals(statusDecision);
                action = fieldsToFill.isEmpty() && !statusDowngrade
                        ? Action.PRESERVE : Action.UPDATE_FILL_BLANKS;
                List<Long> requiredMediaIds = new ArrayList<>();
                if (fieldsToFill.contains("image") && mapped.thumbnailId() != null) {
                    requiredMediaIds.add(mapped.thumbnailId());
                }
                if (fieldsToFill.contains("gallery") && mapped.galleryIds() != null) {
                    requiredMediaIds.addAll(mapped.galleryIds());
                }
                if (fieldsToFill.contains("videos")) requiredMediaIds.addAll(videoMediaIds);
                if (fieldsToFill.contains("seoOgImage")) requiredMediaIds.addAll(ogMediaIds);
                List<String> requiredInlinePaths = new ArrayList<>();
                if (fieldsToFill.contains("description")) {
                    requiredInlinePaths.addAll(descriptionInlinePaths);
                }
                if (fieldsToFill.contains("shortDescription")) {
                    requiredInlinePaths.addAll(excerptInlinePaths);
                }
                if (fieldsToFill.contains("seoOgImage")) {
                    requiredInlinePaths.addAll(ogInlinePaths);
                }
                addProductMediaReferences(
                        mediaReferences, post, requiredMediaIds, requiredInlinePaths,
                        attachmentPaths);
            }

            boolean videoWritePlanned = action == Action.INSERT || fieldsToFill.contains("videos");
            for (VideoProblem problem : videoResolution.problems()) {
                String severity = videoWritePlanned ? "BLOCKER" : "WARNING";
                issues.add(new Issue(severity, "PRODUCT_VIDEO", problem.sourceId(),
                        problem.code(), problem.message() + " (product " + post.id() + ")"));
                if (videoWritePlanned) {
                    manualReview = true;
                    reasons.add(problem.message());
                }
            }

            for (String warning : mapped.warnings()) {
                issues.add(new Issue("WARNING", "PRODUCT", Long.toString(post.id()),
                        "SOURCE_MAPPING_WARNING", warning));
            }
            if (existing == null && "FALLBACK_UNMAPPED_SOURCE_CATEGORY".equals(categoryConfidence)) {
                issues.add(new Issue("WARNING", "PRODUCT", Long.toString(post.id()),
                        "CATEGORY_MAPPING_UNCERTAIN", "No exact target category slug; use uncategorized"));
            }

            ProductPlan plan = new ProductPlan(
                    post.id(), "PUBLISHED", source.postModifiedGmt(post.id()),
                    effectiveSku, trimToNull(mapped.slug()),
                    targetId, targetSlug, match.method(), action, List.copyOf(fieldsToFill),
                    List.copyOf(preserved), List.copyOf(missing), sourceCategorySlugs,
                    plannedCategories, categoryConfidence, sourceBrandSlugs, targetBrandSlug,
                    sourceGenderSlugs, targetGender, attachmentIds,
                    sourceVideos,
                    seoFields,
                    existing == null ? null : existing.createdAt(),
                    existing == null ? null : existing.updatedAt(),
                    targetProvenance,
                    existing == null ? 0 : existing.auditCount(),
                    existing == null ? 0 : existing.adminAuditCount(),
                    existing == null ? 0 : existing.statusAuditCount(),
                    existing == null ? null : existing.lastAuditAt(),
                    statusDecision,
                    manualReview, List.copyOf(reasons));
            plans.add(plan);
            contexts.put(post.id(), new ProductContext(post, mapped, meta, plan, existing, inlinePaths));
        }

        if (duplicateSelection.selectedSourceId() == null) {
            appendPendingDuplicatePlans(
                    source, ownerOverrides, duplicateSelection, activeCategories,
                    plans, contexts);
        } else {
            appendExcludedDuplicatePlan(
                    source, target, ownerOverrides, duplicateSelection, activeCategories,
                    plans, contexts, issues);
        }

        return new ProductResult(List.copyOf(plans), Map.copyOf(contexts),
                List.copyOf(mediaReferences), List.copyOf(issues), List.copyOf(inferences),
                seoTitles, seoDescriptions,
                canonicals, internalLinks, wpMediaLinks);
    }

    private void appendExcludedDuplicatePlan(
            LiveWordPressSnapshotReader.Snapshot source,
            Snapshot target,
            LiveMigrationOwnerOverrides.Config ownerOverrides,
            LiveDuplicateProductSelectionPlanner.Result selection,
            Map<String, TargetCategory> activeCategories,
            List<ProductPlan> plans,
            Map<Long, ProductContext> contexts,
            List<Issue> issues) {
        if (selection.excludedSourceId() == null) return;
        WpPost post = source.postsById().get(selection.excludedSourceId());
        if (post == null) return;
        Map<String, String> meta = source.meta(post.id());
        var mapped = productMapper.map(post, source.metaByPost().getOrDefault(post.id(), List.of()));
        List<String> sourceCategories = source.taxonomyTerms(post.id(), "product_cat").stream()
                .map(term -> normalizeSlug(term.term().slug()))
                .filter(java.util.Objects::nonNull).distinct().toList();
        List<String> safeTargetCategories = sourceCategories.stream()
                .filter(activeCategories::containsKey)
                .filter(slug -> !"uncategorized".equals(slug))
                .distinct().toList();
        String categoryConfidence = safeTargetCategories.size() == 1
                ? "EXACT_SLUG_ALIAS_ONLY" : "NO_UNIQUE_SAFE_ALIAS_CATEGORY";
        List<String> reasons = new ArrayList<>(List.of(
                "Excluded by exact owner override for duplicate SKU "
                        + ownerOverrides.duplicateProductSelection().sku(),
                "No title, body, SEO, translation, or media metadata is imported from this row"));
        if (safeTargetCategories.size() != 1) {
            reasons.add("Alias must remain ACKNOWLEDGED_NO_SAFE_TARGET until a safe category or published product exists");
        }
        ProductPlan plan = new ProductPlan(
                post.id(), post.postStatus().toUpperCase(Locale.ROOT), source.postModifiedGmt(post.id()),
                trimToNull(meta.get("_sku")), trimToNull(post.postName()), null, null,
                "OWNER_OVERRIDE_EXCLUDED", Action.EXCLUDE_OWNER_OVERRIDE,
                List.of(), List.of(), List.of(), sourceCategories, safeTargetCategories,
                categoryConfidence, List.of(), null, List.of(), null,
                List.of(), List.of(), List.of(), null, null,
                "OWNER_OVERRIDE_EXCLUDED_SOURCE_ROW", 0, 0, 0, null,
                "EXCLUDED_NO_CONTENT_IMPORT", false, List.copyOf(reasons));
        plans.add(plan);
        contexts.put(post.id(), new ProductContext(
                post, mapped, immutableMapAllowingNullValues(meta), plan, null, List.of()));
        plans.sort(Comparator.comparingLong(ProductPlan::sourceId));
        issues.add(new Issue(
                "INFO", "PRODUCT", Long.toString(post.id()),
                "OWNER_DUPLICATE_SOURCE_EXCLUDED", String.join("; ", reasons)));
    }

    private void appendPendingDuplicatePlans(
            LiveWordPressSnapshotReader.Snapshot source,
            LiveMigrationOwnerOverrides.Config ownerOverrides,
            LiveDuplicateProductSelectionPlanner.Result selection,
            Map<String, TargetCategory> activeCategories,
            List<ProductPlan> plans,
            Map<Long, ProductContext> contexts) {
        for (Long sourceId : ownerOverrides.duplicateProductSelection().sourceIds()) {
            WpPost post = source.postsById().get(sourceId);
            if (post == null) continue;
            Map<String, String> meta = source.meta(post.id());
            var mapped = productMapper.map(
                    post, source.metaByPost().getOrDefault(post.id(), List.of()));
            List<String> sourceCategories = source.taxonomyTerms(post.id(), "product_cat").stream()
                    .map(term -> normalizeSlug(term.term().slug()))
                    .filter(java.util.Objects::nonNull).distinct().toList();
            List<String> safeTargetCategories = sourceCategories.stream()
                    .filter(activeCategories::containsKey)
                    .filter(slug -> !"uncategorized".equals(slug))
                    .distinct().toList();
            List<String> reasons = new ArrayList<>(selection.plan().reasons());
            reasons.add("Both duplicate source records are stopped; no content or media write is planned");
            ProductPlan plan = new ProductPlan(
                    post.id(), post.postStatus().toUpperCase(Locale.ROOT),
                    source.postModifiedGmt(post.id()), trimToNull(meta.get("_sku")),
                    trimToNull(post.postName()), null, null, "OWNER_OVERRIDE_PENDING",
                    Action.MANUAL_REVIEW, List.of(), List.of(), List.of(),
                    sourceCategories, safeTargetCategories,
                    safeTargetCategories.size() == 1
                            ? "EXACT_SLUG_ALIAS_ONLY" : "NO_UNIQUE_SAFE_ALIAS_CATEGORY",
                    List.of(), null, List.of(), null, List.of(), List.of(), List.of(),
                    null, null, "OWNER_OVERRIDE_PENDING_EVIDENCE", 0, 0, 0, null,
                    "BLOCKED_UNEXPECTED_POST_MODIFIED_GMT", true, List.copyOf(reasons));
            plans.add(plan);
            contexts.put(post.id(), new ProductContext(
                    post, mapped, immutableMapAllowingNullValues(meta), plan, null, List.of()));
        }
        plans.sort(Comparator.comparingLong(ProductPlan::sourceId));
    }

    private VariantResult planVariants(
            LiveWordPressSnapshotReader.Snapshot source,
            Snapshot target,
            Map<Long, ProductContext> products,
            Map<Long, String> attachmentPaths,
            String sourceCurrency,
            LiveMigrationOwnerOverrides.Config ownerOverrides) {

        List<WpPost> selected = source.postsOfType("product_variation").stream()
                .filter(post -> products.containsKey(post.postParent()))
                .filter(post -> {
                    Action parentAction = products.get(post.postParent()).plan().action();
                    return parentAction != Action.EXCLUDE_OWNER_OVERRIDE
                            && parentAction != Action.MANUAL_REVIEW
                            && parentAction != Action.CONFLICT
                            && parentAction != Action.SKIP;
                })
                .filter(post -> Set.of("publish", "private").contains(post.postStatus()))
                .sorted(Comparator.comparingLong(WpPost::id))
                .toList();
        Map<String, List<TargetVariant>> targetBySku = multiIndex(target.variants(), v -> normalizeSku(v.sku()));
        Map<String, TargetVariant> targetById = target.variants().stream()
                .collect(Collectors.toMap(TargetVariant::id, Function.identity(), (a, b) -> a));
        Map<String, List<WpPost>> sourceBySku = multiIndex(selected,
                post -> normalizeSku(source.meta(post.id()).get("_sku")));
        var attachmentOverridePlanner = new LiveVariantAttachmentOverridePlanner(
                ownerOverrides.sourceMediaRecovery().variantAttachmentOverrides());

        List<VariantPlan> plans = new ArrayList<>();
        List<Reference> mediaReferences = new ArrayList<>();
        List<Issue> issues = new ArrayList<>();

        for (WpPost post : selected) {
            ProductContext parent = products.get(post.postParent());
            Map<String, String> meta = source.meta(post.id());
            var mapped = variationMapper.map(post, source.metaByPost().getOrDefault(post.id(), List.of()));
            List<String> reasons = new ArrayList<>();
            List<String> missing = new ArrayList<>();
            List<String> fields = new ArrayList<>();
            List<Long> attachments = new ArrayList<>();
            Long thumbnailId = parseLong(meta.get("_thumbnail_id"));
            var attachmentOverride = attachmentOverridePlanner.plan(
                    post.id(), post.postParent(), thumbnailId, mapped.galleryAttachmentIds());
            List<Long> galleryAttachmentIds = attachmentOverride.galleryAttachmentIds();
            reasons.addAll(attachmentOverride.reasons());
            if (thumbnailId != null) attachments.add(thumbnailId);
            attachments.addAll(galleryAttachmentIds);
            attachments = attachments.stream().filter(java.util.Objects::nonNull)
                    .filter(id -> id > 0).distinct().toList();

            String targetParentId = parent.plan().targetId();
            String skuKey = normalizeSku(mapped.sku());
            BigDecimal sourceRetailPrice = sourceRetailPrice(mapped.regularPrice(), mapped.price());
            BigDecimal sourceSalePrice = sourceSalePrice(
                    mapped.regularPrice(), mapped.price(), mapped.salePrice());
            BigDecimal parentRetailPrice = parent.target() != null
                    && isPositive(parent.target().retailPrice())
                    ? parent.target().retailPrice()
                    : sourceRetailPrice(parent.mapped().regularPrice(), parent.mapped().price());
            boolean hasSharedPrice = isPositive(parentRetailPrice);
            boolean sourceDuplicate = isDuplicate(sourceBySku, skuKey);
            if (sourceDuplicate) reasons.add("Duplicate normalized variation SKU in source snapshot");

            TargetVariant byId = targetById.get("wp-var-" + post.id());
            List<TargetVariant> skuMatches = skuKey == null
                    ? List.of() : targetBySku.getOrDefault(skuKey, List.of());
            TargetVariant existing = null;
            String matchMethod = "NONE";
            if (skuMatches.size() > 1) {
                reasons.add("Multiple target variants match normalized SKU");
            } else if (skuMatches.size() == 1) {
                existing = skuMatches.get(0);
                matchMethod = "SKU";
            }
            if (byId != null) {
                if (existing != null && !existing.id().equals(byId.id())) {
                    reasons.add("Variation SKU and deterministic legacy ID resolve to different target rows");
                } else if (existing == null) {
                    existing = byId;
                    matchMethod = "LEGACY_ID";
                }
            }
            if (existing != null && targetParentId != null
                    && !targetParentId.equals(existing.productId())) {
                reasons.add("Matched target variation belongs to another product");
            }

            Action action;
            String targetId = existing == null ? "wp-var-" + post.id() : existing.id();
            if (parent.plan().action() == Action.SKIP || parent.plan().action() == Action.CONFLICT) {
                action = Action.SKIP;
                reasons.add("Parent product is not eligible for write");
            } else if (!attachmentOverride.valid() || sourceDuplicate || skuMatches.size() > 1
                    || reasons.stream().anyMatch(reason -> reason.contains("different target")
                    || reason.contains("another product"))) {
                action = Action.CONFLICT;
            } else if (existing == null) {
                require(missing, "sku", mapped.sku());
                require(missing, "name", post.postTitle());
                require(missing, "stockState", meta.get("_stock_status"));
                if (!"VND".equalsIgnoreCase(sourceCurrency)) missing.add("currency");
                if (!hasSharedPrice && !isPositive(sourceRetailPrice)) {
                    missing.add("retailPrice");
                }
                if (!hasText(targetParentId)) missing.add("productId");
                action = missing.isEmpty() ? Action.INSERT : Action.SKIP;
                if (action == Action.INSERT) {
                    addAttachmentReferences(mediaReferences, attachments, attachmentPaths,
                            "VARIANT", Long.toString(post.id()));
                }
            } else {
                addIfBlank(fields, "sku", existing.sku(), mapped.sku());
                addIfBlank(fields, "name", existing.name(), post.postTitle());
                addIfMissingPositive(fields, "retailPrice", existing.retailPrice(), sourceRetailPrice);
                addIfNull(fields, "salePrice", existing.salePrice(), sourceSalePrice);
                if (existing.optionCount() == 0 && mapped.attributes() != null
                        && mapped.attributes().entrySet().stream()
                                .anyMatch(entry -> hasText(entry.getKey()) && hasText(entry.getValue()))) {
                    fields.add("options");
                }
                if (!hasText(existing.imageId()) && !hasText(existing.imageUrl()) && !attachments.isEmpty()) {
                    fields.add("image");
                }
                if (existing.galleryCount() == 0 && galleryAttachmentIds.stream()
                                .anyMatch(id -> id != null && id > 0)) {
                    fields.add("gallery");
                }
                action = fields.isEmpty() ? Action.PRESERVE : Action.UPDATE_FILL_BLANKS;
                List<Long> requiredAttachments = new ArrayList<>();
                if (fields.contains("image")) {
                    if (thumbnailId != null && thumbnailId > 0) {
                        requiredAttachments.add(thumbnailId);
                    } else {
                        galleryAttachmentIds.stream()
                                .filter(id -> id != null && id > 0).findFirst()
                                .ifPresent(requiredAttachments::add);
                    }
                }
                if (fields.contains("gallery")) {
                    requiredAttachments.addAll(galleryAttachmentIds);
                }
                addAttachmentReferences(mediaReferences, requiredAttachments, attachmentPaths,
                        "VARIANT", Long.toString(post.id()));
            }

            for (String warning : mapped.warnings()) {
                issues.add(new Issue("WARNING", "VARIANT", Long.toString(post.id()),
                        "SOURCE_MAPPING_WARNING", warning));
            }
            plans.add(new VariantPlan(
                    post.id(), post.postParent(), trimToNull(mapped.sku()), targetId,
                    targetParentId, matchMethod, action, List.copyOf(fields), List.copyOf(missing),
                    mapped.attributes() == null ? Map.of() : Map.copyOf(mapped.attributes()),
                    attachments, List.copyOf(reasons)));
        }
        return new VariantResult(List.copyOf(plans), List.copyOf(mediaReferences), List.copyOf(issues));
    }

    private ArticleResult planArticles(
            LiveWordPressSnapshotReader.Snapshot source,
            Snapshot target,
            Map<Long, String> attachmentPaths) {

        Set<String> selectedStatuses = Set.of("publish", "draft", "archive", "archived");
        List<WpPost> selected = source.postsOfType("post").stream()
                .filter(post -> selectedStatuses.contains(post.postStatus()))
                .sorted(Comparator.comparingLong(WpPost::id))
                .toList();
        Map<String, List<TargetArticle>> targetBySlug = multiIndex(target.articles(), a -> normalizeSlug(a.slug()));
        Map<String, TargetArticle> targetById = target.articles().stream()
                .collect(Collectors.toMap(TargetArticle::id, Function.identity(), (a, b) -> a));
        Map<String, List<WpPost>> sourceBySlug = multiIndex(selected, post -> normalizeSlug(post.postName()));

        List<ArticlePlan> plans = new ArrayList<>();
        Map<Long, ArticleContext> contexts = new LinkedHashMap<>();
        List<Reference> mediaReferences = new ArrayList<>();
        List<Issue> issues = new ArrayList<>();
        int seoTitles = 0, seoDescriptions = 0, canonicals = 0, internalLinks = 0, wpMediaLinks = 0;

        for (WpPost skipped : source.postsOfType("post")) {
            if ("private".equals(skipped.postStatus())) {
                issues.add(new Issue("INFO", "ARTICLE", Long.toString(skipped.id()),
                        "PRIVATE_ARTICLE_SKIPPED", "Private WordPress article excluded by owner decision"));
            }
        }

        for (WpPost post : selected) {
            Map<String, String> meta = source.meta(post.id());
            var mapped = articleMapper.map(post, source.metaByPost().getOrDefault(post.id(), List.of()));
            String sourceStatus = mapArticleStatus(post.postStatus());
            List<String> reasons = new ArrayList<>();
            List<String> missing = new ArrayList<>();
            List<String> fields = new ArrayList<>();
            List<String> seoFields = sourceSeoFields(meta);
            if (hasText(mapped.seoTitle())) seoTitles++;
            if (hasText(mapped.seoDescription())) seoDescriptions++;
            String canonical = firstNonBlank(meta.get("rank_math_canonical"), meta.get("_yoast_wpseo_canonical"));
            if (hasText(canonical)) canonicals++;
            internalLinks += countMatches(INTERNAL_LEGACY_LINK, post.postContent())
                    + countMatches(INTERNAL_LEGACY_LINK, post.postExcerpt());
            List<String> bodyInlinePaths = extractInlineMediaPaths(post.postContent());
            List<String> excerptInlinePaths = extractInlineMediaPaths(post.postExcerpt());
            List<String> ogInlinePaths = mergePaths(
                    extractInlineMediaPaths(meta.get("rank_math_facebook_image")),
                    extractInlineMediaPaths(meta.get("_yoast_wpseo_opengraph-image")));
            List<String> inlinePaths = mergePaths(
                    bodyInlinePaths, excerptInlinePaths, ogInlinePaths);
            wpMediaLinks += inlinePaths.size();

            String slugKey = normalizeSlug(post.postName());
            boolean sourceDuplicate = isDuplicate(sourceBySlug, slugKey);
            List<TargetArticle> slugMatches = slugKey == null
                    ? List.of() : targetBySlug.getOrDefault(slugKey, List.of());
            List<TargetArticle> legacyMatches = java.util.stream.Stream.of(
                            targetById.get("wp-art-" + post.id()),
                            targetById.get("wp-article-" + post.id()))
                    .filter(java.util.Objects::nonNull).distinct().toList();
            TargetArticle byLegacyId = legacyMatches.size() == 1 ? legacyMatches.get(0) : null;
            TargetArticle existing = null;
            String matchMethod = "NONE";
            if (legacyMatches.size() > 1) {
                reasons.add("Multiple target articles claim the same legacy ID");
            }
            if (slugMatches.size() > 1) {
                reasons.add("Multiple target articles match normalized slug");
            }
            if (byLegacyId != null) {
                existing = byLegacyId;
                matchMethod = "LEGACY_ID";
            } else if (slugMatches.size() == 1) {
                existing = slugMatches.get(0);
                matchMethod = "SLUG";
            }
            if (byLegacyId != null && slugMatches.size() == 1
                    && !byLegacyId.id().equals(slugMatches.get(0).id())) {
                reasons.add("Article legacy ID and slug resolve to different target rows");
            }
            if (sourceDuplicate) reasons.add("Duplicate normalized article slug in source snapshot");

            List<String> sourceTags = source.taxonomyTerms(post.id(), "post_tag").stream()
                    .map(term -> trimToNull(term.term().name())).filter(java.util.Objects::nonNull)
                    .distinct().toList();
            List<Long> attachments = new ArrayList<>();
            if (mapped.thumbnailId() != null) attachments.add(mapped.thumbnailId());
            if (mapped.productImageId() != null) attachments.add(mapped.productImageId());
            attachments.addAll(seoOgAttachmentIds(meta));
            attachments = attachments.stream().filter(id -> id != null && id > 0).distinct().toList();

            Action action;
            String targetId = existing == null ? "wp-article-" + post.id() : existing.id();
            String targetSlug = existing == null ? trimToNull(post.postName()) : existing.slug();
            List<String> tagsToAdd;
            if (sourceDuplicate || slugMatches.size() > 1 || legacyMatches.size() > 1
                    || reasons.stream().anyMatch(reason -> reason.contains("different target"))) {
                action = Action.CONFLICT;
                tagsToAdd = List.of();
            } else if (existing == null) {
                require(missing, "slug", post.postName());
                require(missing, "title", post.postTitle());
                require(missing, "body", post.postContent());
                action = missing.isEmpty() ? Action.INSERT : Action.SKIP;
                tagsToAdd = sourceTags;
                if (action == Action.INSERT) {
                    addAttachmentReferences(mediaReferences, attachments, attachmentPaths,
                            "ARTICLE", Long.toString(post.id()));
                    addInlineReferences(mediaReferences, inlinePaths, "ARTICLE", Long.toString(post.id()));
                }
            } else {
                addIfBlank(fields, "slug", existing.slug(), post.postName());
                addIfBlank(fields, "title", existing.title(), post.postTitle());
                addIfBlank(fields, "excerpt", existing.excerpt(), post.postExcerpt());
                addIfBlank(fields, "body", existing.body(), post.postContent());
                addIfBlank(fields, "seoTitle", existing.seoTitle(), mapped.seoTitle());
                addIfBlank(fields, "seoDescription", existing.seoDescription(), mapped.seoDescription());
                addIfBlank(fields, "seoCanonicalUrl", existing.seoCanonicalUrl(), canonical);
                if (!hasText(existing.seoOgImageId()) && !hasText(existing.seoOgImageUrl())
                        && !seoOgAttachmentIds(meta).isEmpty()) fields.add("seoOgImage");
                if (!hasText(existing.coverImageId()) && !hasText(existing.coverImageUrl())
                        && mapped.thumbnailId() != null) fields.add("coverImage");
                if (!hasText(existing.productImageUrl()) && mapped.productImageId() != null) {
                    fields.add("productImage");
                }
                if (!existing.publishedAtPresent() && "PUBLISHED".equals(sourceStatus)
                        && (post.postDateGmt() != null || post.postDate() != null)) {
                    fields.add("publishedAt");
                }
                Set<String> existingTags = target.tagsByArticle().getOrDefault(existing.id(), List.of()).stream()
                        .map(LiveMigrationPreflightService::normalizeContent).collect(Collectors.toSet());
                tagsToAdd = sourceTags.stream()
                        .filter(tag -> !existingTags.contains(normalizeContent(tag))).toList();
                if (!tagsToAdd.isEmpty()) fields.add("tags");
                action = fields.isEmpty() ? Action.PRESERVE : Action.UPDATE_FILL_BLANKS;
                List<Long> requiredAttachments = new ArrayList<>();
                if (fields.contains("coverImage") && mapped.thumbnailId() != null) {
                    requiredAttachments.add(mapped.thumbnailId());
                }
                if (fields.contains("productImage") && mapped.productImageId() != null) {
                    requiredAttachments.add(mapped.productImageId());
                }
                if (fields.contains("seoOgImage")) requiredAttachments.addAll(seoOgAttachmentIds(meta));
                addAttachmentReferences(mediaReferences, requiredAttachments, attachmentPaths,
                        "ARTICLE", Long.toString(post.id()));
                List<String> requiredInlinePaths = new ArrayList<>();
                if (fields.contains("body")) requiredInlinePaths.addAll(bodyInlinePaths);
                if (fields.contains("excerpt")) requiredInlinePaths.addAll(excerptInlinePaths);
                if (fields.contains("seoOgImage")) requiredInlinePaths.addAll(ogInlinePaths);
                addInlineReferences(
                        mediaReferences, requiredInlinePaths, "ARTICLE", Long.toString(post.id()));
            }

            boolean manualReview = sourceDuplicate || !reasons.isEmpty();
            if (existing != null && hasText(existing.title()) && hasText(post.postTitle())
                    && !normalizeContent(existing.title()).equals(normalizeContent(post.postTitle()))) {
                manualReview = true;
                reasons.add("Matched key but source and target titles differ; no title overwrite planned");
            }
            for (String warning : mapped.warnings()) {
                issues.add(new Issue("WARNING", "ARTICLE", Long.toString(post.id()),
                        "SOURCE_MAPPING_WARNING", warning));
            }
            ArticlePlan plan = new ArticlePlan(
                    post.id(), sourceStatus, trimToNull(post.postName()), targetId, targetSlug,
                    matchMethod, action, List.copyOf(fields), List.copyOf(missing), tagsToAdd,
                    attachments, inlinePaths, seoFields, manualReview, List.copyOf(reasons));
            plans.add(plan);
            contexts.put(post.id(), new ArticleContext(post, plan, existing));
        }

        return new ArticleResult(List.copyOf(plans), Map.copyOf(contexts),
                List.copyOf(mediaReferences), List.copyOf(issues), seoTitles, seoDescriptions,
                canonicals, internalLinks, wpMediaLinks);
    }

    private Match<TargetProduct> matchProduct(
            long sourceId,
            String sku,
            String slug,
            Map<String, List<TargetProduct>> bySku,
            Map<String, List<TargetProduct>> bySlug,
            Map<String, List<TargetProduct>> byLegacy) {
        List<String> conflicts = new ArrayList<>();
        List<TargetProduct> skuMatches = sku == null ? List.of() : bySku.getOrDefault(sku, List.of());
        List<TargetProduct> slugMatches = slug == null ? List.of() : bySlug.getOrDefault(slug, List.of());
        List<TargetProduct> legacyMatches = byLegacy.getOrDefault(Long.toString(sourceId), List.of());
        if (skuMatches.size() > 1) conflicts.add("Multiple target products match normalized SKU");
        if (slugMatches.size() > 1) conflicts.add("Multiple target products match normalized slug");
        if (legacyMatches.size() > 1) conflicts.add("Multiple target products claim the same legacy ID");

        TargetProduct target = null;
        String method = "NONE";
        if (skuMatches.size() == 1) {
            target = skuMatches.get(0);
            method = "SKU";
        } else if (skuMatches.isEmpty() && slugMatches.size() == 1) {
            target = slugMatches.get(0);
            method = "SLUG";
        } else if (skuMatches.isEmpty() && slugMatches.isEmpty() && legacyMatches.size() == 1) {
            target = legacyMatches.get(0);
            method = "LEGACY_ID";
        }

        if (target != null && slugMatches.size() == 1 && !target.id().equals(slugMatches.get(0).id())) {
            conflicts.add("SKU and slug resolve to different target products");
        }
        if (target != null && legacyMatches.size() == 1 && !target.id().equals(legacyMatches.get(0).id())) {
            conflicts.add("Natural key and legacy ID resolve to different target products");
        }
        return new Match<>(target, method, List.copyOf(conflicts));
    }

    private String productProvenance(long sourceId, TargetProduct target, String matchMethod) {
        if (target == null) return "NEW_TARGET_ROW";
        String sourceKey = Long.toString(sourceId);
        boolean exactLegacyColumn = sourceKey.equals(normalizeLegacy(target.legacyId()));
        boolean deterministicId = ("wp-prod-" + sourceId).equals(target.id());
        if (exactLegacyColumn && deterministicId) return "EXACT_LEGACY_ID_AND_DETERMINISTIC_ID";
        if (exactLegacyColumn) return "EXACT_LEGACY_ID";
        if (deterministicId) return "DETERMINISTIC_LEGACY_ID";
        return "MATCHED_BY_" + (hasText(matchMethod) ? matchMethod : "UNKNOWN")
                + "_WITHOUT_LEGACY_MARKER";
    }

    private String productStatusDecision(TargetProduct target, String provenance) {
        if (target == null) return "INSERT_AS_DRAFT";
        if (!isLegacyProvenance(provenance)) return "PRESERVE_EXISTING_STATUS_MATCH_ONLY";
        if (!"PUBLISHED".equals(target.publishStatus())) return "PRESERVE_EXISTING_NONPUBLIC_STATUS";
        if (target.adminAuditCount() > 0) return "PRESERVE_PUBLISHED_ADMIN_AUDIT_PRESENT";
        if ("EXACT_LEGACY_ID_AND_DETERMINISTIC_ID".equals(provenance)) {
            return "DOWNGRADE_CONFIRMED_LEGACY_TO_DRAFT";
        }
        return "BLOCKED_PENDING_LEGACY_STATUS_REVIEW";
    }

    private boolean isLegacyProvenance(String provenance) {
        return provenance != null && (provenance.startsWith("EXACT_LEGACY_ID")
                || provenance.startsWith("DETERMINISTIC_LEGACY_ID"));
    }

    private Map<String, List<TargetProduct>> indexProductLegacy(List<TargetProduct> products) {
        Map<String, List<TargetProduct>> result = new HashMap<>();
        for (TargetProduct product : products) {
            String legacy = normalizeLegacy(product.legacyId());
            if (legacy != null) result.computeIfAbsent(legacy, ignored -> new ArrayList<>()).add(product);
            if (product.id() != null && product.id().startsWith("wp-prod-")) {
                String fromId = normalizeLegacy(product.id().substring("wp-prod-".length()));
                if (fromId != null) {
                    List<TargetProduct> values = result.computeIfAbsent(fromId, ignored -> new ArrayList<>());
                    if (!values.contains(product)) values.add(product);
                }
            }
        }
        return result;
    }

    private static <T> Map<String, List<T>> multiIndex(Collection<T> values, Function<T, String> keyFn) {
        Map<String, List<T>> result = new HashMap<>();
        for (T value : values) {
            String key = keyFn.apply(value);
            if (key != null) result.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value);
        }
        return result;
    }

    private boolean isDuplicate(Map<String, ? extends List<?>> index, String key) {
        if (key == null) return false;
        List<?> values = index.get(key);
        return values != null && values.size() > 1;
    }

    private List<Long> productAttachmentIds(WordPressProductMapper.MappedProduct mapped) {
        List<Long> result = new ArrayList<>();
        if (mapped.thumbnailId() != null) result.add(mapped.thumbnailId());
        if (mapped.galleryIds() != null) result.addAll(mapped.galleryIds());
        return result.stream().filter(java.util.Objects::nonNull)
                .filter(id -> id > 0).distinct().toList();
    }

    @SafeVarargs
    private static List<Long> mergeAttachmentIds(Collection<Long>... values) {
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        if (values != null) {
            for (Collection<Long> collection : values) {
                if (collection == null) continue;
                collection.stream().filter(java.util.Objects::nonNull).filter(id -> id > 0)
                        .forEach(result::add);
            }
        }
        return List.copyOf(result);
    }

    ProductVideoResolution resolveProductVideos(
            LiveWordPressSnapshotReader.Snapshot source,
            Map<String, String> productMeta) {
        if (productMeta == null || productMeta.isEmpty()) {
            return new ProductVideoResolution(List.of(), List.of());
        }

        List<Map.Entry<String, String>> references = productMeta.entrySet().stream()
                .filter(entry -> entry.getKey().matches("^videos_[0-9]+_video$"))
                .sorted(Comparator.comparingInt(entry -> videoFieldIndex(entry.getKey())))
                .toList();
        List<ProductVideoPlan> videos = new ArrayList<>();
        List<VideoProblem> problems = new ArrayList<>();
        Set<Long> seen = new LinkedHashSet<>();

        for (Map.Entry<String, String> reference : references) {
            Long sourceId = parseLong(reference.getValue());
            if (sourceId == null || sourceId <= 0) {
                problems.add(new VideoProblem(
                        trimToNull(reference.getValue()), "SOURCE_VIDEO_REFERENCE_INVALID",
                        "ACF video reference is not a positive WordPress post id"));
                continue;
            }
            if (!seen.add(sourceId)) continue;

            WpPost sourceVideo = source.postsById().get(sourceId);
            if (sourceVideo == null) {
                problems.add(new VideoProblem(
                        Long.toString(sourceId), "SOURCE_VIDEO_REFERENCE_MISSING",
                        "ACF video reference does not exist in the source snapshot"));
                continue;
            }
            if ("video".equals(sourceVideo.postType())) {
                Map<String, String> videoMeta = source.meta(sourceId);
                String youtubeUrl = trimToNull(videoMeta.get("youtube_url"));
                if (!YouTubeUrlParser.isYouTubeUrl(youtubeUrl)) {
                    problems.add(new VideoProblem(
                            Long.toString(sourceId), "SOURCE_VIDEO_URL_INVALID",
                            "Legacy video post has no supported YouTube URL"));
                    continue;
                }
                Long thumbnailId = parseLong(videoMeta.get("_thumbnail_id"));
                if (thumbnailId != null) {
                    WpPost thumbnail = source.postsById().get(thumbnailId);
                    if (thumbnail == null || !"attachment".equals(thumbnail.postType())) {
                        problems.add(new VideoProblem(
                                Long.toString(sourceId), "SOURCE_VIDEO_THUMBNAIL_INVALID",
                                "Legacy video thumbnail does not reference an attachment"));
                        thumbnailId = null;
                    }
                }
                videos.add(new ProductVideoPlan(
                        sourceId, "youtube", youtubeUrl, trimToNull(sourceVideo.postTitle()),
                        firstNonBlank(sourceVideo.postExcerpt(), sourceVideo.postContent()),
                        null, thumbnailId));
                continue;
            }
            if ("attachment".equals(sourceVideo.postType())
                    && sourceVideo.postMimeType() != null
                    && sourceVideo.postMimeType().toLowerCase(Locale.ROOT).startsWith("video/")) {
                videos.add(new ProductVideoPlan(
                        sourceId, "upload", null, trimToNull(sourceVideo.postTitle()),
                        firstNonBlank(sourceVideo.postExcerpt(), sourceVideo.postContent()),
                        sourceId, null));
                continue;
            }
            problems.add(new VideoProblem(
                    Long.toString(sourceId), "SOURCE_VIDEO_TYPE_UNSUPPORTED",
                    "ACF video reference is neither a legacy video post nor a video attachment"));
        }

        if (videos.size() > 20) {
            problems.add(new VideoProblem(
                    "", "SOURCE_VIDEO_LIMIT_EXCEEDED",
                    "Product has more than the target limit of 20 videos"));
        }
        return new ProductVideoResolution(List.copyOf(videos), List.copyOf(problems));
    }

    private int videoFieldIndex(String key) {
        try {
            int start = "videos_".length();
            return Integer.parseInt(key.substring(start, key.length() - "_video".length()));
        } catch (RuntimeException ignored) {
            return Integer.MAX_VALUE;
        }
    }

    private List<Long> productVideoMediaAttachmentIds(List<ProductVideoPlan> videos) {
        if (videos == null || videos.isEmpty()) return List.of();
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        for (ProductVideoPlan video : videos) {
            if (video.uploadAttachmentId() != null && video.uploadAttachmentId() > 0) {
                result.add(video.uploadAttachmentId());
            }
            if (video.thumbnailAttachmentId() != null && video.thumbnailAttachmentId() > 0) {
                result.add(video.thumbnailAttachmentId());
            }
        }
        return List.copyOf(result);
    }

    private List<Long> seoOgAttachmentIds(Map<String, String> meta) {
        if (meta == null || meta.isEmpty()) return List.of();
        return java.util.stream.Stream.of(
                        meta.get("rank_math_facebook_image_id"),
                        meta.get("_yoast_wpseo_opengraph-image-id"))
                .map(LiveMigrationPreflightService::parseLong)
                .filter(java.util.Objects::nonNull).filter(id -> id > 0)
                .distinct().toList();
    }

    private void addProductMediaReferences(
            List<Reference> result,
            WpPost post,
            Collection<Long> attachmentIds,
            List<String> inlinePaths,
            Map<Long, String> attachmentPaths) {
        addAttachmentReferences(result, attachmentIds, attachmentPaths,
                "PRODUCT", Long.toString(post.id()));
        addInlineReferences(result, inlinePaths, "PRODUCT", Long.toString(post.id()));
    }

    private void addAttachmentReferences(
            List<Reference> result,
            Collection<Long> attachmentIds,
            Map<Long, String> attachmentPaths,
            String sourceType,
            String sourceId) {
        for (Long attachmentId : attachmentIds) {
            if (attachmentId == null) continue;
            result.add(new Reference(attachmentId, attachmentPaths.get(attachmentId), sourceType, sourceId));
        }
    }

    private void addInlineReferences(
            List<Reference> result,
            Collection<String> paths,
            String sourceType,
            String sourceId) {
        for (String path : paths) result.add(new Reference(null, path, sourceType, sourceId));
    }

    static List<String> extractInlineMediaPaths(String html) {
        if (!hasText(html)) return List.of();
        LinkedHashSet<String> paths = new LinkedHashSet<>();
        Matcher matcher = WP_UPLOAD_URL.matcher(html);
        while (matcher.find()) {
            String path = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
            if (hasText(path)) paths.add(path);
        }
        return List.copyOf(paths);
    }

    @SafeVarargs
    private static List<String> mergePaths(Collection<String>... values) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        if (values != null) {
            for (Collection<String> collection : values) {
                if (collection != null) result.addAll(collection);
            }
        }
        return List.copyOf(result);
    }

    private List<String> sourceSeoFields(Map<String, String> meta) {
        List<String> result = new ArrayList<>();
        addSeoPresence(result, "seoTitle", firstNonBlank(meta.get("rank_math_title"), meta.get("_yoast_wpseo_title")));
        addSeoPresence(result, "seoDescription",
                firstNonBlank(meta.get("rank_math_description"), meta.get("_yoast_wpseo_metadesc")));
        addSeoPresence(result, "canonical",
                firstNonBlank(meta.get("rank_math_canonical"), meta.get("_yoast_wpseo_canonical")));
        addSeoPresence(result, "ogImage",
                firstNonBlank(meta.get("rank_math_facebook_image_id"),
                        meta.get("_yoast_wpseo_opengraph-image-id"), meta.get("rank_math_facebook_image")));
        addSeoPresence(result, "noindex",
                firstNonBlank(meta.get("rank_math_robots"), meta.get("_yoast_wpseo_meta-robots-noindex")));
        return List.copyOf(result);
    }

    private void addSeoPresence(List<String> result, String field, String value) {
        if (hasText(value)) result.add(field);
    }

    private List<String> preservedProductFields(TargetProduct product) {
        List<String> result = new ArrayList<>();
        if (hasText(product.sku())) result.add("sku");
        if (hasText(product.name())) result.add("name");
        if (hasText(product.description())) result.add("description");
        if (isPositive(product.retailPrice())) result.add("retailPrice");
        if (hasText(product.brandId())) result.add("brand");
        if (hasText(product.gender())) result.add("gender");
        if (hasText(product.publishStatus())) result.add("publishStatus");
        if (hasText(product.seoTitle()) || hasText(product.seoDescription())
                || hasText(product.seoCanonicalUrl())) result.add("seo");
        if (hasText(product.imageId()) || hasText(product.imageUrl())
                || !isEmptyJsonArray(product.galleryText())) result.add("media");
        if (!product.categorySlugs().isEmpty()) result.add("categories");
        return result;
    }

    private static void addIfBlank(List<String> fields, String field, String target, String source) {
        if (!hasText(target) && hasText(source)) fields.add(field);
    }

    private static void addIfNull(List<String> fields, String field, Object target, Object source) {
        if (target == null && source != null) fields.add(field);
    }

    private static void addIfMissingPositive(
            List<String> fields, String field, BigDecimal target, BigDecimal source) {
        if (!isPositive(target) && isPositive(source)) fields.add(field);
    }

    private static void require(List<String> missing, String field, String value) {
        if (!hasText(value)) missing.add(field);
    }

    static BigDecimal sourceRetailPrice(BigDecimal regularPrice, BigDecimal currentPrice) {
        if (isPositive(regularPrice)) return regularPrice;
        return isPositive(currentPrice) ? currentPrice : null;
    }

    static BigDecimal sourceSalePrice(
            BigDecimal regularPrice, BigDecimal currentPrice, BigDecimal salePrice) {
        BigDecimal retailPrice = sourceRetailPrice(regularPrice, currentPrice);
        if (!isPositive(retailPrice) || !isPositive(salePrice)) return null;
        return salePrice.compareTo(retailPrice) < 0 ? salePrice : null;
    }

    static String mapDirectGender(String sourceSlug) {
        String normalized = normalizeSlug(sourceSlug);
        if (normalized == null) return null;
        return switch (normalized) {
            case "nam", "male", "men" -> "Nam";
            case "nu", "nữ", "female", "women" -> "Nữ";
            case "unisex" -> "Unisex";
            default -> null;
        };
    }

    static String resolveDirectGender(Collection<String> sourceSlugs) {
        if (sourceSlugs == null || sourceSlugs.isEmpty()) return null;
        List<String> mapped = sourceSlugs.stream()
                .map(LiveMigrationPreflightService::mapDirectGender)
                .filter(java.util.Objects::nonNull).distinct().toList();
        if (mapped.size() != sourceSlugs.stream().filter(java.util.Objects::nonNull).distinct().count()) {
            return null;
        }
        if (mapped.size() == 1) return mapped.get(0);
        return new HashSet<>(mapped).equals(Set.of("Nam", "Nữ")) ? "Unisex" : null;
    }

    private static boolean isPositive(BigDecimal value) {
        return value != null && value.compareTo(BigDecimal.ZERO) > 0;
    }

    private static Long parseLong(String value) {
        if (!hasText(value)) return null;
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    static String normalizeSku(String value) {
        if (!hasText(value)) return null;
        return value.trim().replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
    }

    static String normalizeSlug(String value) {
        if (!hasText(value)) return null;
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        while (normalized.startsWith("/")) normalized = normalized.substring(1);
        while (normalized.endsWith("/")) normalized = normalized.substring(0, normalized.length() - 1);
        return normalized.isBlank() ? null : normalized;
    }

    private static String normalizeLegacy(String value) {
        if (!hasText(value)) return null;
        String normalized = value.trim();
        return normalized.matches("[0-9]+") ? normalized : null;
    }

    private static String normalizeContent(String value) {
        if (!hasText(value)) return "";
        return value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private static String trimToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String value : values) if (hasText(value)) return value.trim();
        return null;
    }

    private boolean isEmptyJsonArray(String value) {
        return value == null || value.isBlank() || "null".equals(value.trim()) || "[]".equals(value.trim());
    }

    private int countMatches(Pattern pattern, String value) {
        if (!hasText(value)) return 0;
        int count = 0;
        Matcher matcher = pattern.matcher(value);
        while (matcher.find()) count++;
        return count;
    }

    private String mapArticleStatus(String status) {
        return switch (status) {
            case "publish" -> "PUBLISHED";
            case "archive", "archived" -> "ARCHIVED";
            default -> "DRAFT";
        };
    }

    private Map<String, Integer> statusCounts(List<WpPost> posts) {
        Map<String, Integer> result = new LinkedHashMap<>();
        posts.stream().map(WpPost::postStatus).sorted()
                .forEach(status -> result.merge(status, 1, Integer::sum));
        return Map.copyOf(result);
    }

    private int permalinkRows(String raw) {
        if (!hasText(raw)) return 0;
        try {
            return new WordPressPermalinkManagerMapper(new PhpSerializeParser()).parse(raw).entries().size();
        } catch (RuntimeException e) {
            return 0;
        }
    }

    private List<LiveMigrationOwnerOverrides.UnavailableFileFallback> activeUnavailableFallbacks(
            LiveMigrationOwnerOverrides.Config overrides,
            Path uploadsRoot) {
        Path base = uploadsRoot.toAbsolutePath().normalize();
        List<LiveMigrationOwnerOverrides.UnavailableFileFallback> result = new ArrayList<>();
        for (LiveMigrationOwnerOverrides.UnavailableFileFallback fallback
                : overrides.sourceMediaRecovery().unavailableFileFallbacks()) {
            String relative = LiveMediaPlanner.normalizeRelativePath(fallback.relativePath());
            if (relative == null) {
                throw new IllegalArgumentException("Unavailable-media fallback path is invalid");
            }
            Path candidate = base.resolve(relative).normalize();
            if (!candidate.startsWith(base)) {
                throw new IllegalArgumentException("Unavailable-media fallback escapes uploads root");
            }
            if (Files.exists(candidate)) {
                throw new IllegalStateException(
                        "Previously unavailable media now exists but has no owner-reviewed exact SHA-256: "
                                + relative);
            }
            result.add(fallback);
        }
        return List.copyOf(result);
    }

    private List<Reference> filterFallbackMediaReferences(
            List<Reference> references,
            List<LiveMigrationOwnerOverrides.UnavailableFileFallback> fallbacks) {
        Set<String> excluded = new HashSet<>();
        for (LiveMigrationOwnerOverrides.UnavailableFileFallback fallback : fallbacks) {
            for (String field : fallback.fields()) {
                excluded.add("TARGET_" + fallback.entityType() + "|"
                        + fallback.entityId() + ":" + field + "|" + fallback.relativePath());
            }
        }
        return references.stream().filter(reference -> !excluded.contains(
                reference.sourceType() + "|" + reference.sourceId() + "|"
                        + LiveMediaPlanner.normalizeRelativePath(reference.relativePath())))
                .toList();
    }

    private ProductInferenceSummary summarizeInferences(List<ProductInferencePlan> plans) {
        int applied = 0;
        int fallback = 0;
        int manual = 0;
        int sku = 0;
        int brand = 0;
        int gender = 0;
        for (ProductInferencePlan plan : plans) {
            if ("APPLIED".equals(plan.decision())) applied++;
            if ("FALLBACK_APPLIED".equals(plan.decision())) fallback++;
            if ("MANUAL_REVIEW".equals(plan.decision())) manual++;
            if (plan.inferredValue() != null) {
                if ("sku".equals(plan.field())) sku++;
                if ("brandId".equals(plan.field())) brand++;
                if ("gender".equals(plan.field())) gender++;
            }
        }
        return new ProductInferenceSummary(applied, fallback, manual, sku, brand, gender);
    }

    private void validateInputs(LiveMigrationPreflightOptions options, Connection connection) throws Exception {
        if (!Files.isRegularFile(options.dumpPath()) || !Files.isReadable(options.dumpPath())) {
            throw new IllegalArgumentException("Source dump is not a readable file");
        }
        if (!Files.isDirectory(options.uploadsPath()) || !Files.isReadable(options.uploadsPath())) {
            throw new IllegalArgumentException("Source uploads path is not a readable directory");
        }
        if (!Files.isRegularFile(options.ownerOverridesPath())
                || !Files.isReadable(options.ownerOverridesPath())) {
            throw new IllegalArgumentException("Owner override file is not readable");
        }
        if (!Files.isDirectory(options.recoveryStagingPath())
                || !Files.isReadable(options.recoveryStagingPath())) {
            throw new IllegalArgumentException("Recovery staging path is not a readable directory");
        }
        Files.createDirectories(options.reportDirectory());
        if (!connection.isReadOnly()) {
            throw new IllegalStateException("Target database connection is not read-only");
        }
    }

    private boolean hasAction(List<ProductPlan> plans, Action action) {
        return plans.stream().anyMatch(plan -> plan.action() == action);
    }

    private boolean hasVariantAction(List<VariantPlan> plans, Action action) {
        return plans.stream().anyMatch(plan -> plan.action() == action);
    }

    private boolean hasArticleAction(List<ArticlePlan> plans, Action action) {
        return plans.stream().anyMatch(plan -> plan.action() == action);
    }

    private boolean hasMissingRequired(
            List<ProductPlan> products, List<VariantPlan> variants, List<ArticlePlan> articles) {
        return products.stream().anyMatch(plan -> !plan.missingRequiredFields().isEmpty())
                || variants.stream().anyMatch(plan -> !plan.missingRequiredFields().isEmpty())
                || articles.stream().anyMatch(plan -> !plan.missingRequiredFields().isEmpty());
    }

    private ActionCounts countProductActions(List<ProductPlan> plans) {
        return actionCounts(plans.stream().map(plan -> new CountableAction(
                plan.action(), plan.matchMethod())).toList());
    }

    private ActionCounts countVariantActions(List<VariantPlan> plans) {
        return actionCounts(plans.stream().map(plan -> new CountableAction(
                plan.action(), plan.matchMethod())).toList());
    }

    private ActionCounts countArticleActions(List<ArticlePlan> plans) {
        return actionCounts(plans.stream().map(plan -> new CountableAction(
                plan.action(), plan.matchMethod())).toList());
    }

    private ActionCounts actionCounts(List<CountableAction> values) {
        return new ActionCounts(
                countAction(values, Action.INSERT), countAction(values, Action.UPDATE_FILL_BLANKS),
                countAction(values, Action.PRESERVE), countAction(values, Action.SKIP),
                countAction(values, Action.CONFLICT), countAction(values, Action.MANUAL_REVIEW),
                countAction(values, Action.EXCLUDE_OWNER_OVERRIDE), countMethod(values, "SKU"),
                countMethod(values, "SLUG"), countMethod(values, "LEGACY_ID"));
    }

    private int countAction(List<CountableAction> values, Action action) {
        return (int) values.stream().filter(value -> value.action() == action).count();
    }

    private int countMethod(List<CountableAction> values, String method) {
        return (int) values.stream().filter(value -> method.equals(value.matchMethod())).count();
    }

    static <K, V> Map<K, V> immutableMapAllowingNullValues(Map<K, V> values) {
        return Collections.unmodifiableMap(new LinkedHashMap<>(values));
    }

    record ProductContext(
            WpPost post,
            WordPressProductMapper.MappedProduct mapped,
            Map<String, String> meta,
            ProductPlan plan,
            TargetProduct target,
            List<String> inlineMediaPaths) {}

    record ArticleContext(WpPost post, ArticlePlan plan, TargetArticle target) {}

    private record ProductResult(
            List<ProductPlan> plans,
            Map<Long, ProductContext> contextBySourceId,
            List<Reference> mediaReferences,
            List<Issue> issues,
            List<ProductInferencePlan> inferences,
            int seoTitles,
            int seoDescriptions,
            int canonicals,
            int internalLinks,
            int wordpressMediaLinks) {}

    private record VariantResult(
            List<VariantPlan> plans,
            List<Reference> mediaReferences,
            List<Issue> issues) {}

    private record ArticleResult(
            List<ArticlePlan> plans,
            Map<Long, ArticleContext> contextBySourceId,
            List<Reference> mediaReferences,
            List<Issue> issues,
            int seoTitles,
            int seoDescriptions,
            int canonicals,
            int internalLinks,
            int wordpressMediaLinks) {}

    private record Match<T>(T target, String method, List<String> conflicts) {}
    private record CountableAction(Action action, String matchMethod) {}
    record ProductVideoResolution(
            List<ProductVideoPlan> videos,
            List<VideoProblem> problems) {}
    record VideoProblem(String sourceId, String code, String message) {}
}
