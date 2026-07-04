package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImportReportResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.ProductImportService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Pattern;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Bulk product import (CSV/JSON) + the matching round-trip export. Split out from
 * {@link AdminCatalogController} the same way {@code AdminReportController} already is —
 * same permission domain ({@code products.update}), cleaner review unit.
 */
@Validated
@RestController
@RequestMapping("/api/v1/admin/products/import")
@RequiredArgsConstructor
public class AdminProductImportController extends AdminControllerSupport {

    private static final String TYPE_REGEX = "^(csv|json)$";

    private final ProductImportService productImportService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @PostMapping(value = "/validate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiDataResponse<ImportReportResponse> validateImport(
            @RequestParam("file") MultipartFile file,
            @RequestParam @Pattern(regexp = TYPE_REGEX, message = "type must be csv or json") String type,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(productImportService.validateImport(file, type), request);
    }

    @PostMapping(value = "/commit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiDataResponse<ImportReportResponse> commitImport(
            @RequestParam("file") MultipartFile file,
            @RequestParam @Pattern(regexp = TYPE_REGEX, message = "type must be csv or json") String type,
            @RequestParam(required = false) String skipRowKeys,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        Set<String> skip = parseSkipRowKeys(skipRowKeys);
        return apiResponseFactory.data(
                productImportService.commitImport(file, type, skip, resolveAdminId()), request);
    }

    /**
     * Round-trip export: the full 41-column template shape (one row per product/variant),
     * for "download current catalog to edit and re-import." Deliberately separate from
     * {@code GET /api/v1/admin/reports/products/export} (13-column reporting overview,
     * gated by {@code reports.export}) — this one is a catalog-authoring capability.
     */
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportTemplate(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        byte[] csv = productImportService.exportCurrentCatalogAsTemplateCsv();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"bigbike-products.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csv);
    }

    private static Set<String> parseSkipRowKeys(String raw) {
        if (raw == null || raw.isBlank()) {
            return Set.of();
        }
        List<String> keys = Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
        return Set.copyOf(keys);
    }
}
