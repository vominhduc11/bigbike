package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Action;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.ActionCounts;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Issue;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.ProductPlan;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import tools.jackson.databind.ObjectMapper;

/** Writes a full JSON plan plus an operator-focused Markdown summary atomically. */
final class LiveMigrationReportWriter {

    Paths write(LiveMigrationPreflightReport report, Path directory) throws Exception {
        Files.createDirectories(directory);
        String safeSnapshot = report.metadata().snapshotId().replaceAll("[^A-Za-z0-9._-]", "-");
        Path json = directory.resolve("live-preflight-" + safeSnapshot + ".json");
        Path markdown = directory.resolve("live-preflight-" + safeSnapshot + ".md");
        Path inferenceJson = directory.resolve("live-product-inference-" + safeSnapshot + ".json");
        Path inferenceMarkdown = directory.resolve("live-product-inference-" + safeSnapshot + ".md");

        ObjectMapper mapper = new ObjectMapper();
        String jsonBody = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(report) + "\n";
        String jsonSha256 = sha256(jsonBody);
        String planDigestSha256 = new LiveMigrationPlanDigest().digest(report);
        Map<String, Object> inferencePayload = new java.util.LinkedHashMap<>();
        inferencePayload.put("snapshotId", report.metadata().snapshotId());
        inferencePayload.put("ownerOverrides", report.ownerDecisions().overrides());
        inferencePayload.put("summary", report.ownerDecisions().productInferenceSummary());
        inferencePayload.put("rows", report.ownerDecisions().productInferences());
        String inferenceJsonBody = mapper.writerWithDefaultPrettyPrinter()
                .writeValueAsString(inferencePayload) + "\n";
        String inferenceJsonSha256 = sha256(inferenceJsonBody);
        writeAtomic(json, jsonBody);
        writeAtomic(markdown, markdown(report, json, jsonSha256, planDigestSha256));
        writeAtomic(inferenceJson, inferenceJsonBody);
        writeAtomic(inferenceMarkdown, inferenceMarkdown(
                report, inferenceJson, inferenceJsonSha256));
        return new Paths(
                json.toAbsolutePath(), markdown.toAbsolutePath(),
                inferenceJson.toAbsolutePath(), inferenceMarkdown.toAbsolutePath(),
                jsonSha256, inferenceJsonSha256, planDigestSha256);
    }

    private void writeAtomic(Path destination, String body) throws Exception {
        Path temporary = destination.resolveSibling(destination.getFileName() + ".part");
        Files.writeString(temporary, body, StandardCharsets.UTF_8);
        Files.move(temporary, destination, StandardCopyOption.REPLACE_EXISTING,
                StandardCopyOption.ATOMIC_MOVE);
    }

    private String markdown(
            LiveMigrationPreflightReport report,
            Path jsonPath,
            String jsonSha256,
            String planDigestSha256) {
        StringBuilder out = new StringBuilder(32_768);
        out.append("# BigBike live migration preflight\n\n");
        out.append("> Generated: ").append(report.generatedAt()).append("  \n");
        out.append("> Snapshot: `").append(escape(report.metadata().snapshotId())).append("`  \n");
        out.append("> Target DB writes: **none (READ ONLY transaction)**  \n");
        out.append("> Full record-level plan: `").append(escape(jsonPath.toAbsolutePath().toString()))
                .append("`\n\n");
        out.append("> Reviewed JSON SHA-256: `").append(jsonSha256).append("`  \n");
        out.append("> Immutable plan digest: `").append(planDigestSha256).append("`\n\n");

        out.append("## Cutover decision\n\n");
        if (report.blockers().isEmpty()) {
            out.append("Preflight has no blocker. This does not itself authorize a live write or cutover.\n\n");
        } else {
            out.append("**BLOCKED** — no live write/cutover is allowed while these remain:\n\n");
            for (String blocker : report.blockers()) out.append("- `").append(escape(blocker)).append("`\n");
            out.append("\n");
        }

        out.append("## Snapshot and safety\n\n");
        out.append("| Check | Value |\n|---|---|\n");
        row(out, "Dump", report.metadata().sourceDumpPath());
        row(out, "Dump SHA-256", report.metadata().sourceDumpSha256());
        row(out, "Dump bytes", Long.toString(report.metadata().sourceDumpBytes()));
        row(out, "Final snapshot", Boolean.toString(report.metadata().finalSnapshot()));
        row(out, "Freeze confirmed", Boolean.toString(report.metadata().freezeConfirmed()));
        row(out, "Off-VPS manifest", Boolean.toString(report.safety().offsiteBackupManifestPresent()));
        row(out, "Off-VPS manifest valid", Boolean.toString(report.safety().offsiteBackupManifestValid()));
        if (!report.safety().offsiteBackupManifestErrors().isEmpty()) {
            row(out, "Off-VPS manifest errors",
                    String.join("; ", report.safety().offsiteBackupManifestErrors()));
        }
        row(out, "Target migration", report.metadata().targetMigrationVersion());
        row(out, "Content-category cleanup pending",
                Boolean.toString(report.safety().contentCategoryCleanupPending()));
        row(out, "Media SHA-256 schema present",
                Boolean.toString(report.safety().mediaChecksumSchemaPresent()));
        row(out, "Migration audit schema present",
                Boolean.toString(report.safety().migrationAuditSchemaPresent()));
        row(out, "Filesystem usable bytes", Long.toString(report.safety().filesystemUsableBytes()));
        row(out, "Projected media bytes", Long.toString(report.safety().projectedAdditionalMediaBytes()));
        out.append("\n");

        out.append("## Hash-bound owner decisions\n\n");
        out.append("| Decision evidence | Value |\n|---|---|\n");
        row(out, "Override version", Integer.toString(report.ownerDecisions().overrides().version()));
        row(out, "Override date", report.ownerDecisions().overrides().ownerDecisionDate());
        row(out, "Override path", report.ownerDecisions().overrides().path());
        row(out, "Override SHA-256", report.ownerDecisions().overrides().sha256());
        var duplicate = report.ownerDecisions().duplicateProductSelection();
        row(out, "Duplicate SKU", duplicate.sku());
        row(out, "Duplicate timestamps", duplicate.postModifiedGmt().toString());
        row(out, "Selected / excluded", duplicate.selectedSourceId() + " / " + duplicate.excludedSourceId());
        row(out, "Expected selection matched", Boolean.toString(duplicate.expectedSelectionMatched()));
        var inference = report.ownerDecisions().productInferenceSummary();
        row(out, "Inference applied / fallback / manual",
                inference.applied() + " / " + inference.fallbackApplied() + " / " + inference.manualReview());
        var recovery = report.ownerDecisions().sourceMediaRecoverySummary();
        row(out, "Recovery same / pending / conflict",
                recovery.alreadyPresentSameHash() + " / " + recovery.pendingExplicitCopy()
                        + " / " + recovery.conflicts());
        row(out, "Unavailable exact-media fallbacks",
                Integer.toString(report.ownerDecisions().unavailableMediaFallbacks().size()));
        List<LiveMigrationPreflightReport.ExactTargetFieldMutationPlan> exactMutations =
                report.ownerDecisions().exactTargetFieldMutations() == null
                        ? List.of() : report.ownerDecisions().exactTargetFieldMutations();
        row(out, "Exact target-field mutations",
                exactMutations.stream().collect(java.util.stream.Collectors.groupingBy(
                        LiveMigrationPreflightReport.ExactTargetFieldMutationPlan::status,
                        java.util.TreeMap::new,
                        java.util.stream.Collectors.counting())).toString());
        out.append("\n");

        out.append("## Source and target counts\n\n");
        out.append("| Domain | Source selected | Target before |\n|---|---:|---:|\n");
        out.append("| Products | ").append(report.sourceCounts().productsPublished()).append(" | ")
                .append(report.targetCounts().products()).append(" |\n");
        out.append("| Variants | ").append(report.sourceCounts().selectedVariations()).append(" | ")
                .append(report.targetCounts().variants()).append(" |\n");
        out.append("| Articles | ").append(report.sourceCounts().selectedArticles()).append(" | ")
                .append(report.targetCounts().articles()).append(" |\n");
        out.append("| Referenced media files | ").append(report.mediaSummary().uniqueSourceFiles()).append(" | ")
                .append(report.targetCounts().media()).append(" |\n");
        out.append("| Redirect candidates | ").append(report.redirects().size()).append(" | ")
                .append(report.targetCounts().redirects()).append(" |\n\n");
        out.append("Source product statuses: `").append(escape(report.sourceCounts().productStatuses().toString()))
                .append("`  \n");
        out.append("Source article statuses: `").append(escape(report.sourceCounts().articleStatuses().toString()))
                .append("`\n\n");

        out.append("## Write-plan actions\n\n");
        out.append("| Domain | Insert | Fill blanks | Preserve | Skip | Conflict | Manual | Owner-excluded | SKU match | Slug match | Legacy match |\n");
        out.append("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n");
        actionRow(out, "Products", report.productActions());
        actionRow(out, "Variants", report.variantActions());
        actionRow(out, "Articles", report.articleActions());
        out.append("\n");

        out.append("## Product provenance and status audit\n\n");
        out.append("The JSON plan records target `createdAt`/`updatedAt`, audit counts, last audit time, "
                + "provenance and the status decision for every selected product.\n\n");
        out.append("| Metric | Count |\n|---|---|\n");
        row(out, "Provenance", countProductValues(report, true).toString());
        row(out, "Status decisions", countProductValues(report, false).toString());
        row(out, "Products flagged for manual review", Long.toString(report.products().stream()
                .filter(ProductPlan::manualReview).count()));
        out.append("\n");

        out.append("## Media checksum plan\n\n");
        out.append("| Metric | Count / bytes |\n|---|---:|\n");
        row(out, "References", Integer.toString(report.mediaSummary().references()));
        row(out, "Unique source files", Integer.toString(report.mediaSummary().uniqueSourceFiles()));
        row(out, "Reuse by SHA-256", Integer.toString(report.mediaSummary().reuseBySha256()));
        row(out, "New objects", Integer.toString(report.mediaSummary().insertObjects()));
        row(out, "Missing source files", Integer.toString(report.mediaSummary().missingFiles()));
        row(out, "Invalid source paths", Integer.toString(report.mediaSummary().invalidPaths()));
        row(out, "Target objects hashed", Integer.toString(report.mediaSummary().targetObjectsHashed()));
        row(out, "Target hash failures", Integer.toString(report.mediaSummary().targetObjectHashFailures()));
        row(out, "Target checksum fills", Integer.toString(report.mediaSummary().targetChecksumUpdates()));
        row(out, "Target duplicate hashes", Integer.toString(report.mediaSummary().targetDuplicateHashes()));
        row(out, "Bytes reused", Long.toString(report.mediaSummary().bytesReused()));
        row(out, "Bytes to copy", Long.toString(report.mediaSummary().bytesToCopy()));
        out.append("\n");

        out.append("## Existing target URL-only rewrite plan\n\n");
        out.append("| Fields | Planned | Conflict | Dead anchors unlinked | Dead images removed | WP media URLs before | Legacy links before | Remaining |\n");
        out.append("|---:|---:|---:|---:|---:|---:|---:|---:|\n");
        out.append("| ").append(report.targetContentRewriteSummary().fieldsWithLegacyUrls()).append(" | ")
                .append(report.targetContentRewriteSummary().plannedRewrites()).append(" | ")
                .append(report.targetContentRewriteSummary().conflicts()).append(" | ")
                .append(report.targetContentRewriteSummary().unlinkedDeadAnchors()).append(" | ")
                .append(report.targetContentRewriteSummary().removedDeadImages()).append(" | ")
                .append(report.targetContentRewriteSummary().wordpressMediaLinksBefore()).append(" | ")
                .append(report.targetContentRewriteSummary().legacyInternalLinksBefore()).append(" | ")
                .append(report.targetContentRewriteSummary().legacyUrlsRemainingAfterPlan()).append(" |\n\n");

        out.append("### Unresolved target-content fields\n\n");
        out.append("These rows are preserved and remain blockers. HTML policy may unwrap only reviewed dead `<a href>` elements; plain-text, non-anchor, canonical, and structured/JSON URLs are not deleted.\n\n");
        out.append("| Entity | ID | Field | Kind | Before SHA-256 | Remaining | Evidence |\n");
        out.append("|---|---|---|---|---|---:|---|\n");
        for (var plan : report.targetContentRewrites()) {
            if (plan.action() != Action.CONFLICT) continue;
            out.append("| ").append(cell(plan.entityType())).append(" | ")
                    .append(cell(plan.entityId())).append(" | ")
                    .append(cell(plan.field())).append(" | ")
                    .append(cell(plan.contentKind())).append(" | ")
                    .append(cell(plan.beforeSha256())).append(" | ")
                    .append(plan.legacyUrlsRemainingAfterPlan()).append(" | ")
                    .append(cell(String.join("; ", plan.reasons()))).append(" |\n");
        }
        out.append("\n");

        out.append("## Exact owner-approved target-field mutations\n\n");
        out.append("These rows are planning-only. A pending row remains a blocker and is not "
                + "executed by the general migration executor. A fresh preflight must observe "
                + "the exact approved after-state before migration execution can pass.\n\n");
        out.append("| Entity | ID | Field | Action | Observed SHA-256 | Planned SHA-256 | Null | Status | Operations | Evidence |\n");
        out.append("|---|---|---|---|---|---|---|---|---|---|\n");
        for (var plan : exactMutations) {
            out.append("| ").append(cell(plan.entityType())).append(" | ")
                    .append(cell(plan.entityId())).append(" | ")
                    .append(cell(plan.field())).append(" | ")
                    .append(cell(plan.action())).append(" | ")
                    .append(cell(plan.observedSha256())).append(" | ")
                    .append(cell(plan.plannedAfterSha256())).append(" | ")
                    .append(plan.plannedNull()).append(" | ")
                    .append(cell(plan.status())).append(" | ")
                    .append(cell(String.join("; ", plan.operations()))).append(" | ")
                    .append(cell(String.join("; ", plan.reasons()))).append(" |\n");
        }
        out.append("\n");

        out.append("## Redirect plan\n\n");
        out.append("| Insert | Update existing | Preserve | Conflict | Unresolved | Content rewrite only | Acknowledged 404 | Loop | Chain | Content-category |\n");
        out.append("|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n");
        out.append("| ").append(report.redirectSummary().planned()).append(" | ")
                .append(report.redirectSummary().updateExisting()).append(" | ")
                .append(report.redirectSummary().preserveExisting()).append(" | ")
                .append(report.redirectSummary().conflicts()).append(" | ")
                .append(report.redirectSummary().unresolved()).append(" | ")
                .append(report.redirectSummary().contentRewriteOnly()).append(" | ")
                .append(report.redirectSummary().acknowledgedNoSafeTarget()).append(" | ")
                .append(report.redirectSummary().loops()).append(" | ")
                .append(report.redirectSummary().chains()).append(" | ")
                .append(report.redirectSummary().contentCategoryRedirects()).append(" |\n\n");

        out.append("## Target media cleanup review plan\n\n");
        out.append("No cleanup write is performed by this preflight or migration executor. ")
                .append("Every candidate requires verified backup, final rescan, exact-list review, and a separate confirmation.\n\n");
        out.append("| Missing | Missing delete candidates | Missing referenced blockers | Duplicate groups | Duplicate rows | Rebind+delete rows | Rebind fields | DB delete candidates |\n");
        out.append("|---:|---:|---:|---:|---:|---:|---:|---:|\n");
        var cleanup = report.ownerDecisions().targetMediaCleanupSummary();
        out.append("| ").append(cleanup.missingObjects()).append(" | ")
                .append(cleanup.missingUnreferencedDeletionCandidates()).append(" | ")
                .append(cleanup.missingReferencedBlockers()).append(" | ")
                .append(cleanup.duplicateHashGroups()).append(" | ")
                .append(cleanup.duplicateRows()).append(" | ")
                .append(cleanup.duplicateRowsPlannedForRebindAndDelete()).append(" | ")
                .append(cleanup.rebindFields()).append(" | ")
                .append(cleanup.databaseDeletionCandidates()).append(" |\n\n");

        out.append("## Product category mapping\n\n");
        out.append("| Source ID | Source slug | Source categories | Target categories | Confidence | Brand | Gender | Action |\n");
        out.append("|---:|---|---|---|---|---|---|---|\n");
        for (ProductPlan product : report.products()) {
            out.append("| ").append(product.sourceId()).append(" | ")
                    .append(cell(product.sourceSlug())).append(" | ")
                    .append(cell(String.join(", ", product.sourceCategorySlugs()))).append(" | ")
                    .append(cell(String.join(", ", product.targetCategorySlugs()))).append(" | ")
                    .append(cell(product.categoryConfidence())).append(" | ")
                    .append(cell(product.targetBrandSlug())).append(" | ")
                    .append(cell(product.targetGender())).append(" | ")
                    .append(product.action()).append(" |\n");
        }
        out.append("\n");

        out.append("## Issues (first 100; JSON contains all)\n\n");
        out.append("| Severity | Domain | Source | Code | Message |\n|---|---|---|---|---|\n");
        List<Issue> samples = report.issues().stream().limit(100).toList();
        for (Issue issue : samples) {
            out.append("| ").append(cell(issue.severity())).append(" | ")
                    .append(cell(issue.domain())).append(" | ").append(cell(issue.sourceId())).append(" | ")
                    .append(cell(issue.code())).append(" | ").append(cell(issue.message())).append(" |\n");
        }
        out.append("\n");

        out.append("## Protected target domains\n\n");
        out.append("The planner did not expose any write path for customers, orders, or admins. Baseline counts: `")
                .append(escape(report.targetCounts().protectedDomains().toString())).append("`.\n");
        return out.toString();
    }

    private void actionRow(StringBuilder out, String domain, ActionCounts counts) {
        out.append("| ").append(domain).append(" | ").append(counts.insert()).append(" | ")
                .append(counts.updateFillBlanks()).append(" | ").append(counts.preserve()).append(" | ")
                .append(counts.skip()).append(" | ").append(counts.conflict()).append(" | ")
                .append(counts.manualReview()).append(" | ")
                .append(counts.excludedOwnerOverride()).append(" | ")
                .append(counts.matchedBySku()).append(" | ").append(counts.matchedBySlug()).append(" | ")
                .append(counts.matchedByLegacyId()).append(" |\n");
    }

    private void row(StringBuilder out, String key, String value) {
        out.append("| ").append(cell(key)).append(" | ").append(cell(value)).append(" |\n");
    }

    private Map<String, Long> countProductValues(
            LiveMigrationPreflightReport report, boolean provenance) {
        Map<String, Long> counts = new TreeMap<>();
        for (ProductPlan product : report.products()) {
            String value = provenance ? product.targetProvenance() : product.statusDecision();
            counts.merge(value == null ? "UNKNOWN" : value, 1L, Long::sum);
        }
        return counts;
    }

    private String cell(String value) {
        return escape(value == null ? "" : value).replace("\n", " ");
    }

    private String escape(String value) {
        return value == null ? "" : value.replace("|", "\\|");
    }

    private String sha256(String value) throws Exception {
        return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
    }

    private String inferenceMarkdown(
            LiveMigrationPreflightReport report,
            Path jsonPath,
            String jsonSha256) {
        StringBuilder out = new StringBuilder(32_768);
        out.append("# BigBike controlled product inference\n\n");
        out.append("> Snapshot: `").append(escape(report.metadata().snapshotId())).append("`  \n");
        out.append("> Full JSON: `").append(escape(jsonPath.toAbsolutePath().toString())).append("`  \n");
        out.append("> JSON SHA-256: `").append(jsonSha256).append("`\n\n");
        var summary = report.ownerDecisions().productInferenceSummary();
        out.append("| Applied | Fallback | Manual review | SKU | Brand | Gender |\n");
        out.append("|---:|---:|---:|---:|---:|---:|\n");
        out.append("| ").append(summary.applied()).append(" | ")
                .append(summary.fallbackApplied()).append(" | ")
                .append(summary.manualReview()).append(" | ")
                .append(summary.skuInferred()).append(" | ")
                .append(summary.brandInferred()).append(" | ")
                .append(summary.genderInferred()).append(" |\n\n");
        out.append("| Source ID | Field | Source | Inferred | Evidence | Rule | Confidence | Uniqueness | Decision | Follow-up |\n");
        out.append("|---:|---|---|---|---|---|---|---|---|---|\n");
        for (var row : report.ownerDecisions().productInferences()) {
            out.append("| ").append(row.sourceId()).append(" | ")
                    .append(cell(row.field())).append(" | ")
                    .append(cell(row.sourceValue())).append(" | ")
                    .append(cell(row.inferredValue())).append(" | ")
                    .append(cell(row.evidence())).append(" | ")
                    .append(cell(row.ruleId())).append(" | ")
                    .append(cell(row.confidence())).append(" | ")
                    .append(cell(row.uniquenessCheck())).append(" | ")
                    .append(cell(row.decision())).append(" | ")
                    .append(row.manualFollowUp()).append(" |\n");
        }
        return out.toString();
    }

    record Paths(
            Path json,
            Path markdown,
            Path inferenceJson,
            Path inferenceMarkdown,
            String jsonSha256,
            String inferenceJsonSha256,
            String planDigestSha256) {}
}
