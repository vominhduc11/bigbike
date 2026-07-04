package com.bigbike.bigbike_backend.api.admin.dto;

import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import java.util.List;

/**
 * Outcome of importing (or dry-run validating) one product from a bulk-import file.
 * One row per product regardless of file format — a CSV "product group" (main row +
 * its variant child rows) or one JSON array element both collapse to a single result here.
 */
public record ImportRowResult(
        int rowNumber,
        String rowKey,
        String productId,
        String productName,
        String action,      // CREATE | UPDATE | SKIPPED_BY_USER
        String status,       // OK | WARNING | ERROR
        List<ApiErrorDetail> errors,
        List<ApiErrorDetail> warnings,
        int variantsInFile,
        int variantsAdded,
        int variantsUpdated,
        int variantsRemoved,
        List<String> removedVariantSkus
) {
}
