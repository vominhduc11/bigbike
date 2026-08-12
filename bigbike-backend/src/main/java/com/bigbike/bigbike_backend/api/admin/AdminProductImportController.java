package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImportReportResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.ProductImportService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitConcurrencyGuard;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Bulk product import (JSON) + single-product JSON export. Split out from
 * {@link AdminCatalogController} the same way {@code AdminReportController} already is —
 * same permission domain ({@code products.update}), cleaner review unit.
 */
@RestController
@RequestMapping("/api/v1/admin/products/import")
@RequiredArgsConstructor
public class AdminProductImportController extends AdminControllerSupport {

    private final ProductImportService productImportService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;
    private final RateLimitConcurrencyGuard rateLimitConcurrencyGuard;

    @PostMapping(value = "/validate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiDataResponse<ImportReportResponse> validateImport(
            @RequestParam("file") MultipartFile file,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        try (RateLimitConcurrencyGuard.Lease ignored = rateLimitConcurrencyGuard.acquireAdminImport()) {
            return apiResponseFactory.data(productImportService.validateImport(file), request);
        }
    }

    @PostMapping(value = "/commit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiDataResponse<ImportReportResponse> commitImport(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String skipRowKeys,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        Set<String> skip = parseSkipRowKeys(skipRowKeys);
        try (RateLimitConcurrencyGuard.Lease ignored = rateLimitConcurrencyGuard.acquireAdminImport()) {
            return apiResponseFactory.data(
                    productImportService.commitImport(file, skip, resolveAdminId()), request);
        }
    }

    /** Full JSON export shape, scoped to one product (array of one). */
    @GetMapping("/export/{id}")
    public ResponseEntity<byte[]> exportProduct(@PathVariable String id, HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        try (RateLimitConcurrencyGuard.Lease ignored = rateLimitConcurrencyGuard.acquireAdminExport()) {
            ProductImportService.ProductExportFile file = productImportService.exportProductAsTemplateJson(id);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.filename() + "\"")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(file.content());
        }
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
