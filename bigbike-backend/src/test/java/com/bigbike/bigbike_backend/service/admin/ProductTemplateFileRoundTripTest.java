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
 * shape (exactly the drift found and fixed in this pass: stale top-level structured
 * {@code specifications}/{@code specStats}/{@code trustBadges} array fields from the pre-V255
 * model, backfilled into HTML and dropped at V329/V330 — not to be confused with the current
 * HTML-only {@code specifications}/{@code specStats}/{@code trustBadges} nested-object fields the
 * DTO declares today). Pure deserialization + mapping, no Spring context / DB needed — mirrors the
 * same {@code new ObjectMapper()} config {@code ProductImportService} itself uses to parse an
 * uploaded import file.
 */
class ProductTemplateFileRoundTripTest {

    @Test
    void templateFile_deserializesAndMapsCleanly() throws Exception {
        File file = new File("../product-template/mau-day-du.json");
        assertThat(file).as("product-template/mau-day-du.json must exist at the repo root").exists();

        ProductImportRow[] rows = new ObjectMapper().readValue(file, ProductImportRow[].class);
        assertThat(rows).as("template file should carry at least the 2 documented example products")
                .hasSizeGreaterThanOrEqualTo(2);

        assertThat(rows[0].getGenders()).containsExactly("Nam", "Nữ");
        assertThat(rows[1].getGenders()).isEmpty();

        for (ProductImportRow row : rows) {
            UpsertProductRequest request = ProductImportRowMapper.toUpsertRequest(row);
            assertThat(request.getSku()).as("every row must resolve to a request carrying its SKU").isNotBlank();
        }
    }

    @Test
    void oldScalarGenderFileStillMapsToCanonicalRequest() {
        ProductImportRow row = new ProductImportRow();
        row.setGender("Nam");

        UpsertProductRequest request = ProductImportRowMapper.toUpsertRequest(row);

        assertThat(request.getGenders()).containsExactly("Nam");
        assertThat(request.isGendersPresent()).isTrue();
    }
}
