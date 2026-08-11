package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Immutable, validated export request shared by streaming and audit. */
public record ProductCsvExportPlan(
        ProductCsvExportScope scope,
        String q,
        String categoryId,
        String brandId,
        ProductStockState stockState,
        Set<PublishStatus> publishStatuses,
        Set<String> categoryIds,
        List<String> selectedIds,
        boolean includeDraft,
        boolean includeTrash,
        ProductCsvExportPreset preset,
        List<String> columns,
        List<String> columnGroups
) {

    public Map<String, Object> auditFilters() {
        Map<String, Object> filters = new LinkedHashMap<>();
        if (q != null && !q.isBlank()) filters.put("q", q);
        if (categoryId != null && !categoryId.isBlank()) filters.put("categoryId", categoryId);
        if (brandId != null && !brandId.isBlank()) filters.put("brandId", brandId);
        if (stockState != null) filters.put("stockState", stockState.name());
        if (scope == ProductCsvExportScope.SELECTED) filters.put("ids", selectedIds);
        filters.put("publishStatuses", publishStatuses.stream().map(Enum::name).toList());
        return filters;
    }
}
