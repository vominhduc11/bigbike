package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.ProductImportRow;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.File;
import org.junit.jupiter.api.Test;

/**
 * Guards {@code product-template/mau-day-du.json} — the hand-maintained example file referenced by
 * {@code HUONG-DAN.md} — against silently drifting out of sync with {@link ProductImportRow}'s wire
 * shape (exactly the drift found and fixed in this pass: stale top-level {@code specifications}/
 * {@code specStats}/{@code trustBadges} arrays the DTO no longer declares). Pure deserialization +
 * mapping, no Spring context / DB needed — mirrors the same {@code new ObjectMapper()} config
 * {@code ProductImportService} itself uses to parse an uploaded import file.
 */
class ProductTemplateFileRoundTripTest {

    @Test
    void templateFile_deserializesAndMapsCleanly() throws Exception {
        File file = new File("../product-template/mau-day-du.json");
        assertThat(file).as("product-template/mau-day-du.json must exist at the repo root").exists();

        ProductImportRow[] rows = new ObjectMapper().readValue(file, ProductImportRow[].class);
        assertThat(rows).as("template file should carry at least the 2 documented example products")
                .hasSizeGreaterThanOrEqualTo(2);

        for (ProductImportRow row : rows) {
            UpsertProductRequest request = ProductImportRowMapper.toUpsertRequest(row);
            assertThat(request.getSku()).as("every row must resolve to a request carrying its SKU").isNotBlank();
        }
    }
}
