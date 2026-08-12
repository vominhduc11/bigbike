package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.config.ClientIpResolver;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitConcurrencyGuard;
import com.bigbike.bigbike_backend.api.admin.dto.ProductCsvExportQuery;
import com.bigbike.bigbike_backend.domain.auth.AdminUserProfile;
import com.bigbike.bigbike_backend.service.admin.AdminReportService;
import com.bigbike.bigbike_backend.service.admin.FullProductCatalogCsvExportService;
import com.bigbike.bigbike_backend.service.admin.ProductCsvExportPlan;
import jakarta.validation.Valid;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/** Full operational catalog export. Kept separate from the limited Reports product CSV. */
@RestController
@RequestMapping("/api/v1/admin/products")
@RequiredArgsConstructor
public class AdminProductExportController {

    private static final DateTimeFormatter FILE_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final FullProductCatalogCsvExportService fullProductCatalogCsvExportService;
    private final AdminReportService adminReportService;
    private final DevAdminAuthService devAdminAuthService;
    private final ClientIpResolver clientIpResolver;
    private final RateLimitConcurrencyGuard rateLimitConcurrencyGuard;

    @GetMapping(value = "/export.csv", produces = "text/csv")
    public ResponseEntity<StreamingResponseBody> exportFullCatalog(
            @Valid @ModelAttribute ProductCsvExportQuery query,
            HttpServletRequest request
    ) {
        AdminUserProfile actor = devAdminAuthService.requirePermission(request, "reports.export");
        ProductCsvExportPlan plan = fullProductCatalogCsvExportService.plan(query);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename(fileName(plan)).build());
        headers.set("X-Export-Streamed", "true");
        AtomicLong rowCount = new AtomicLong();
        AtomicBoolean completed = new AtomicBoolean();
        RateLimitConcurrencyGuard.Lease exportLease = rateLimitConcurrencyGuard.acquireAdminExport();
        StreamingResponseBody body = outputStream -> {
            try {
                fullProductCatalogCsvExportService.writeTo(outputStream, plan, rowCount::addAndGet);
                completed.set(true);
            } finally {
                try {
                    adminReportService.recordProductCatalogCsvExportAudit(
                            actor.id(), plan, rowCount.get(), completed.get(),
                            clientIpResolver.resolve(request), request.getHeader("User-Agent"));
                } finally {
                    exportLease.close();
                }
            }
        };
        return ResponseEntity.ok().headers(headers).body(body);
    }

    private static String fileName(ProductCsvExportPlan plan) {
        String slug = switch (plan.scope()) {
            case SELECTED -> "dang-chon";
            case ALL -> "toanbo";
            case FILTERED -> slugify(plan.q());
        };
        return "sanpham_" + slug + "_" + LocalDate.now().format(FILE_DATE) + ".csv";
    }

    private static String slugify(String value) {
        if (value == null || value.isBlank()) return "bo-loc";
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .toLowerCase(java.util.Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
        if (normalized.isBlank()) return "bo-loc";
        return normalized.length() > 60 ? normalized.substring(0, 60).replaceAll("-$", "") : normalized;
    }
}
