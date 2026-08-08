package com.bigbike.bigbike_backend.api.admin.dto;

import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import java.util.List;

/**
 * Outcome of importing (or dry-run validating) one product from a bulk-import file —
 * one result per JSON array element.
 *
 * <p>Carries no variant counters: import never creates, updates or removes variants
 * (PRODUCT_RULE_009, owner decision 2026-08-08). A file that still contains a {@code variants}
 * array gets an {@code IGNORED} entry in {@code warnings} instead.
 */
public record ImportRowResult(
        int rowNumber,
        String rowKey,
        String productId,
        String productName,
        String action,      // CREATE | UPDATE | SKIPPED_BY_USER
        String status,       // OK | WARNING | ERROR
        List<ApiErrorDetail> errors,
        List<ApiErrorDetail> warnings
) {
}
