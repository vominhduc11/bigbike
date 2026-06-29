package com.bigbike.bigbike_backend.api.admin.dto;

import java.util.List;

/**
 * Report returned by {@code POST /api/v1/admin/translate/backfill} (one-time operational tool).
 *
 * <p>One {@link TypeResult} per processed entity type. In {@code dryRun} mode nothing is written —
 * {@code samples} carry a few real before/after translations so the operator can eyeball quality
 * before authorising the real run.
 */
public record TranslationBackfillResponse(
        boolean dryRun,
        boolean includeTrashed,
        int limit,
        int sampleSize,
        long totalTranslated,
        long totalRemaining,
        List<TypeResult> results) {

    /** Per-entity-type outcome. {@code candidatesTotal} = records still missing English before this run. */
    public record TypeResult(
            String type,
            boolean geminiEnabled,
            int candidatesTotal,
            int processed,
            int translated,
            int failed,
            int remainingAfter,
            List<String> failedIds,
            List<Sample> samples) {
    }

    /** A dry-run before/after preview for a single record (no DB write). */
    public record Sample(
            String id,
            String viName,
            String enName,
            List<FieldPreview> fields) {
    }

    /** One translated field, source vs machine output (values truncated for readability). */
    public record FieldPreview(String field, String vi, String en) {
    }
}
