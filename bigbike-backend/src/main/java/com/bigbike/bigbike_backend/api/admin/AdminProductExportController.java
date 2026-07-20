package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.config.ClientIpResolver;
import com.bigbike.bigbike_backend.domain.auth.AdminUserProfile;
import com.bigbike.bigbike_backend.service.admin.AdminReportService;
import com.bigbike.bigbike_backend.service.admin.FullProductCatalogCsvExportService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
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

    @GetMapping(value = "/export.csv", produces = "text/csv")
    public ResponseEntity<StreamingResponseBody> exportFullCatalog(HttpServletRequest request) {
        AdminUserProfile actor = devAdminAuthService.requirePermission(request, "reports.export");
        adminReportService.recordFullProductCatalogExportAudit(
                actor.id(), clientIpResolver.resolve(request), request.getHeader("User-Agent"));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename("products_full_" + LocalDate.now().format(FILE_DATE) + ".csv").build());
        headers.set("X-Export-Streamed", "true");
        return ResponseEntity.ok().headers(headers).body(fullProductCatalogCsvExportService::writeTo);
    }
}
