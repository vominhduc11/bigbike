package com.bigbike.bigbike_backend.migration.wordpress.live;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Complete, serializable write-plan produced without mutating source or target. */
public record LiveMigrationPreflightReport(
        Instant generatedAt,
        Metadata metadata,
        Safety safety,
        OwnerDecisionPlans ownerDecisions,
        SourceCounts sourceCounts,
        TargetCounts targetCounts,
        ActionCounts productActions,
        ActionCounts variantActions,
        ActionCounts articleActions,
        MediaSummary mediaSummary,
        RedirectSummary redirectSummary,
        SeoSummary seoSummary,
        TargetContentRewriteSummary targetContentRewriteSummary,
        List<ProductPlan> products,
        List<VariantPlan> variants,
        List<ArticlePlan> articles,
        List<MediaPlan> media,
        List<TargetMediaChecksumPlan> targetMediaChecksums,
        List<TargetContentRewritePlan> targetContentRewrites,
        List<RedirectPlan> redirects,
        List<Issue> issues,
        List<String> blockers) {

    public enum Action {
        INSERT,
        UPDATE_FILL_BLANKS,
        UPDATE_REDIRECT_TARGET,
        REWRITE_URLS_ONLY,
        ACKNOWLEDGED_NO_SAFE_TARGET,
        MANUAL_REVIEW,
        EXCLUDE_OWNER_OVERRIDE,
        PRESERVE,
        SKIP,
        CONFLICT
    }

    public record Metadata(
            String snapshotId,
            String sourceDumpPath,
            String sourceDumpSha256,
            long sourceDumpBytes,
            String sourceUploadsPath,
            String tablePrefix,
            boolean finalSnapshot,
            boolean freezeConfirmed,
            boolean targetTransactionReadOnly,
            String targetSchema,
            String targetMigrationVersion) {}

    public record Safety(
            boolean sourceDumpReadable,
            boolean sourceUploadsReadable,
            boolean offsiteBackupManifestPresent,
            boolean offsiteBackupManifestValid,
            List<String> offsiteBackupManifestErrors,
            boolean contentCategoryCleanupPending,
            boolean mediaChecksumSchemaPresent,
            boolean migrationAuditSchemaPresent,
            boolean protectedTargetDomainsReadOnly,
            long filesystemUsableBytes,
            long projectedAdditionalMediaBytes) {}

    public record SourceCounts(
            int productsPublished,
            int productsRedirectOnly,
            Map<String, Integer> productStatuses,
            int selectedVariations,
            Map<String, Integer> variationStatuses,
            int selectedArticles,
            Map<String, Integer> articleStatuses,
            int articlesPrivateSkipped,
            int articlesTrashOrAutoDraftSkipped,
            int referencedAttachmentIds,
            int referencedInlineMediaPaths,
            int contentCategoryTerms,
            int sourceRedirectRows) {}

    public record TargetCounts(
            long products,
            long variants,
            long articles,
            long media,
            long redirects,
            long productCategories,
            long brands,
            long articleTags,
            Map<String, Long> protectedDomains) {}

    public record ActionCounts(
            int insert,
            int updateFillBlanks,
            int preserve,
            int skip,
            int conflict,
            int manualReview,
            int excludedOwnerOverride,
            int matchedBySku,
            int matchedBySlug,
            int matchedByLegacyId) {}

    public record ProductPlan(
            long sourceId,
            String sourceStatus,
            LocalDateTime sourceModifiedGmt,
            String sourceSku,
            String sourceSlug,
            String targetId,
            String targetSlug,
            String matchMethod,
            Action action,
            List<String> fieldsToFill,
            List<String> preservedFields,
            List<String> missingRequiredFields,
            List<String> sourceCategorySlugs,
            List<String> targetCategorySlugs,
            String categoryConfidence,
            List<String> sourceBrandSlugs,
            String targetBrandSlug,
            List<String> sourceGenderSlugs,
            String targetGender,
            List<Long> attachmentIds,
            List<ProductVideoPlan> videos,
            List<String> sourceSeoFieldsPresent,
            Instant targetCreatedAt,
            Instant targetUpdatedAt,
            String targetProvenance,
            int targetAuditCount,
            int targetAdminAuditCount,
            int targetStatusAuditCount,
            Instant targetLastAuditAt,
            String statusDecision,
            boolean manualReview,
            /**
             * Bilingual wording planned for this product, or null when it is single-language.
             * Present either because Polylang pairs this source post with a translated one, or
             * because the owner supplied Vietnamese wording for a published English-only product.
             */
            ProductTranslationPlan translation,
            List<String> reasons) {}

    /**
     * The exact bilingual text a product will be written with.
     *
     * <p>Vietnamese values are only set when the owner supplied them for an English-only source;
     * otherwise the ordinary source mapping already provides the primary language. English values
     * always come from a real source post — nothing here is machine-translated.</p>
     */
    public record ProductTranslationPlan(
            String origin,
            Long partnerSourceId,
            String translationGroup,
            String nameVi,
            String shortDescriptionVi,
            String descriptionVi,
            String seoTitleVi,
            String seoDescriptionVi,
            String nameEn,
            String slugEn,
            String shortDescriptionEn,
            String descriptionEn,
            String seoTitleEn,
            String seoDescriptionEn) {}

    /**
     * Direct product-video mapping from the WordPress source.
     *
     * <p>WordPress ACF stores an ID in {@code videos_N_video}. That ID can point either to the
     * legacy custom {@code video} post type (whose {@code youtube_url} remains external) or to an
     * uploaded attachment. Keeping both IDs and the reviewed URL in the immutable plan makes the
     * write auditable without downloading third-party media.</p>
     */
    public record ProductVideoPlan(
            long sourceVideoId,
            String provider,
            String url,
            String title,
            String description,
            Long uploadAttachmentId,
            Long thumbnailAttachmentId) {}

    public record VariantPlan(
            long sourceId,
            long sourceParentId,
            String sourceSku,
            String targetId,
            String targetParentId,
            String matchMethod,
            Action action,
            List<String> fieldsToFill,
            List<String> missingRequiredFields,
            Map<String, String> sourceOptions,
            List<Long> attachmentIds,
            /**
             * SKU the owner-approved rule derived for a variation WordPress left without one.
             * Null whenever the source already carries a SKU, so the write path can tell an
             * inherited value from a generated one.
             */
            String plannedSku,
            List<String> reasons) {}

    public record ArticlePlan(
            long sourceId,
            String sourceStatus,
            String sourceSlug,
            String targetId,
            String targetSlug,
            String matchMethod,
            Action action,
            List<String> fieldsToFill,
            List<String> missingRequiredFields,
            List<String> tagsToAdd,
            List<Long> attachmentIds,
            List<String> inlineMediaPaths,
            List<String> sourceSeoFieldsPresent,
            boolean manualReview,
            List<String> reasons) {}

    public record MediaSummary(
            int references,
            int uniqueSourceFiles,
            int reuseBySha256,
            int insertObjects,
            int missingFiles,
            int invalidPaths,
            int targetObjectsHashed,
            int targetObjectHashFailures,
            int targetChecksumUpdates,
            int targetDuplicateHashes,
            long uniqueSourceBytes,
            long bytesReused,
            long bytesToCopy) {}

    public record MediaPlan(
            Long sourceAttachmentId,
            String sourceRelativePath,
            String sha256,
            Long fileSize,
            String targetMediaId,
            Action action,
            List<String> referencedBy,
            List<String> reasons) {}

    /** Full target-object integrity audit and nullable SHA-256 backfill plan. */
    public record TargetMediaChecksumPlan(
            String targetMediaId,
            String bucket,
            String objectKey,
            String sha256,
            Long objectBytes,
            Action action,
            List<String> reasons) {}

    public record TargetContentRewriteSummary(
            int fieldsWithLegacyUrls,
            int plannedRewrites,
            int conflicts,
            int unlinkedDeadAnchors,
            int removedDeadImages,
            int wordpressMediaLinksBefore,
            int legacyInternalLinksBefore,
            int legacyUrlsRemainingAfterPlan) {}

    /** URL-only rewrite bound to exact before/after SHA-256 values; no prose is replaced. */
    public record TargetContentRewritePlan(
            String entityType,
            String entityId,
            String field,
            String contentKind,
            String canonicalPath,
            String beforeSha256,
            String afterSha256,
            int wordpressMediaLinksBefore,
            int legacyInternalLinksBefore,
            int legacyUrlsRemainingAfterPlan,
            Action action,
            List<String> operations,
            List<String> reasons) {}

    public record RedirectSummary(
            int planned,
            int updateExisting,
            int preserveExisting,
            int conflicts,
            int unresolved,
            int contentRewriteOnly,
            int acknowledgedNoSafeTarget,
            int loops,
            int chains,
            int contentCategoryRedirects) {}

    public record RedirectPlan(
            String sourcePath,
            String targetPath,
            String sourceType,
            Long sourceId,
            String reason,
            String confidence,
            Action action,
            String existingRedirectId,
            String existingSourcePattern,
            String existingTargetUrl,
            Boolean existingEnabled,
            List<String> issues) {}

    public record SeoSummary(
            int productSeoTitles,
            int productSeoDescriptions,
            int productCanonicals,
            int articleSeoTitles,
            int articleSeoDescriptions,
            int articleCanonicals,
            int internalLinksRequiringRewrite,
            int wordpressMediaLinksRequiringRewrite) {}

    public record Issue(
            String severity,
            String domain,
            String sourceId,
            String code,
            String message) {}

    /** Owner decisions and read-only cleanup/recovery plans bound into the immutable digest. */
    public record OwnerDecisionPlans(
            OwnerOverridesMetadata overrides,
            DuplicateProductSelectionPlan duplicateProductSelection,
            ProductInferenceSummary productInferenceSummary,
            List<ProductInferencePlan> productInferences,
            SourceMediaRecoverySummary sourceMediaRecoverySummary,
            List<SourceMediaRecoveryPlan> sourceMediaRecovery,
            List<UnavailableMediaFallbackPlan> unavailableMediaFallbacks,
            List<ExactTargetFieldMutationPlan> exactTargetFieldMutations,
            TargetMediaCleanupSummary targetMediaCleanupSummary,
            List<TargetMediaCleanupPlan> targetMediaCleanup) {}

    public record OwnerOverridesMetadata(
            int version,
            String ownerDecisionDate,
            String path,
            String sha256) {}

    public record DuplicateProductSelectionPlan(
            String sku,
            List<Long> sourceIds,
            Long selectedSourceId,
            Long excludedSourceId,
            Map<Long, LocalDateTime> postModifiedGmt,
            String selectionRule,
            String selectedProductStatus,
            String excludedAliasPolicy,
            boolean expectedSelectionMatched,
            List<String> reasons) {}

    public record ProductInferenceSummary(
            int applied,
            int fallbackApplied,
            int manualReview,
            int skuInferred,
            int brandInferred,
            int genderInferred) {}

    public record ProductInferencePlan(
            long sourceId,
            String field,
            String sourceValue,
            String inferredValue,
            String evidence,
            String ruleId,
            String confidence,
            String uniquenessCheck,
            String decision,
            boolean manualFollowUp) {}

    public record SourceMediaRecoverySummary(
            int approved,
            int alreadyPresentSameHash,
            int pendingExplicitCopy,
            int conflicts,
            int unavailableFallbacks) {}

    public record SourceMediaRecoveryPlan(
            String relativePath,
            String stagedPath,
            String destinationPath,
            String sha256,
            long bytes,
            String mimeType,
            String destinationState,
            String action,
            List<String> reasons) {}

    public record UnavailableMediaFallbackPlan(
            String relativePath,
            String entityType,
            String entityId,
            List<String> fields,
            String action) {}

    /**
     * Planning-only, owner-approved target-field mutation. The live migration executor does not
     * execute these rows; a pending row remains a blocker until a separately confirmed exact
     * mutation has been applied and a fresh preflight observes the expected after-state.
     */
    public record ExactTargetFieldMutationPlan(
            String entityType,
            String entityId,
            String field,
            String action,
            List<String> targetMediaIds,
            List<String> exactValues,
            String expectedBeforeSha256,
            String observedSha256,
            String expectedAfterSha256,
            String plannedAfterSha256,
            boolean plannedNull,
            String status,
            List<String> operations,
            List<String> reasons) {}

    public record TargetMediaCleanupSummary(
            int missingObjects,
            int missingUnreferencedDeletionCandidates,
            int missingReferencedBlockers,
            int duplicateHashGroups,
            int duplicateRows,
            int duplicateRowsPlannedForRebindAndDelete,
            int rebindFields,
            int databaseDeletionCandidates) {}

    public record TargetMediaCleanupPlan(
            String targetMediaId,
            String sha256,
            String bucket,
            String objectKey,
            String publicUrl,
            String integrityState,
            String canonicalMediaId,
            int referenceCount,
            int auditCount,
            int adminAuditCount,
            Instant createdAt,
            String recommendedAction,
            List<MediaReferenceEvidence> references,
            List<TargetMediaRebindPlan> rebinds,
            List<String> reasons) {}

    public record MediaReferenceEvidence(
            String table,
            String column,
            String rowKey,
            String matchedBy) {}

    public record TargetMediaRebindPlan(
            String table,
            String column,
            String rowKey,
            String beforeSha256,
            String afterSha256,
            List<String> replacements,
            String optimisticPredicate) {}
}
