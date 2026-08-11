package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Query parameters for the streamed admin product CSV export. */
@Getter
@Setter
@NoArgsConstructor
public class ProductCsvExportQuery {

    @Pattern(regexp = "^(FILTERED|SELECTED|ALL)$", message = "Invalid export scope.")
    private String scope = "FILTERED";

    @Size(max = 100, message = "Search query must not exceed 100 characters.")
    private String q;

    @Size(max = 100, message = "Category id must not exceed 100 characters.")
    private String categoryId;

    @Size(max = 100, message = "Brand id must not exceed 100 characters.")
    private String brandId;

    @Pattern(regexp = "^(DRAFT|PUBLISHED|TRASH|ALL)$", message = "Invalid publishStatus.")
    private String publishStatus;

    @Pattern(regexp = "^(IN_STOCK|OUT_OF_STOCK|ALL)$", message = "Invalid stockState.")
    private String stockState;

    private boolean includeDraft;
    private boolean includeTrash;

    private String ids;

    @Pattern(regexp = "^(PRICING|CONTENT_SEO|MEDIA|FULL)$", message = "Invalid preset.")
    private String preset = "PRICING";

    @Size(max = 10000, message = "columns must not exceed 10000 characters.")
    private String columns;

    @Size(max = 1000, message = "columnGroups must not exceed 1000 characters.")
    private String columnGroups;
}
