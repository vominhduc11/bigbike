package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.ClientIpResolver;
import com.bigbike.bigbike_backend.domain.auth.AdminUserProfile;
import com.bigbike.bigbike_backend.domain.commerce.OrderStatus;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.customer.CustomerStatus;
import com.bigbike.bigbike_backend.service.admin.AdminCustomerCsvExportService;
import com.bigbike.bigbike_backend.service.admin.AdminOrderCsvExportService;
import com.bigbike.bigbike_backend.service.admin.AdminReportService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@Validated
@RestController
@RequestMapping("/api/v1/admin/reports")
@RequiredArgsConstructor
public class AdminReportController {

    private static final DateTimeFormatter FILE_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");

    private static final Set<String> VALID_ORDER_STATUSES =
            Arrays.stream(OrderStatus.values()).map(Enum::name).collect(Collectors.toUnmodifiableSet());
    private static final Set<String> VALID_PUBLISH_STATUSES =
            Arrays.stream(PublishStatus.values()).map(Enum::name).collect(Collectors.toUnmodifiableSet());
    private static final Set<String> VALID_CUSTOMER_STATUSES =
            Arrays.stream(CustomerStatus.values()).map(Enum::name).collect(Collectors.toUnmodifiableSet());

    private final AdminReportService adminReportService;
    private final AdminOrderCsvExportService adminOrderCsvExportService;
    private final AdminCustomerCsvExportService adminCustomerCsvExportService;
    private final DevAdminAuthService devAdminAuthService;
    private final ClientIpResolver clientIpResolver;

    @GetMapping("/analytics")
    public AdminAnalyticsResponse getAnalytics(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "reports.read");
        validateDateRange(from, to);
        return adminReportService.getAnalytics(from, to);
    }

    @GetMapping("/orders/export")
    public ResponseEntity<StreamingResponseBody> exportOrders(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            HttpServletRequest request
    ) {
        AdminUserProfile actor = devAdminAuthService.requirePermission(request, "reports.export");
        validateOrderDateRange(from, to);
        if (status != null && !status.isBlank()
                && !VALID_ORDER_STATUSES.contains(status.toUpperCase(Locale.ROOT))) {
            throw ValidationException.fromField("status", "INVALID_ORDER_STATUS",
                    "Unknown order status: " + status);
        }
        adminReportService.recordExportAudit(
                actor.id(),
                "ORDERS",
                filters(
                        "searchApplied", q != null && !q.isBlank(),
                        "status", blankToNull(status),
                        "from", blankToNull(from),
                        "to", blankToNull(to)
                ),
                null,
                true,
                clientIpResolver.resolve(request),
                request.getHeader("User-Agent")
        );
        return completeOrderCsvResponse(
                outputStream -> adminOrderCsvExportService.writeTo(
                        outputStream, status, q, from, to
                ),
                "orders_" + LocalDate.now().format(FILE_DATE) + ".csv"
        );
    }

    @GetMapping("/customers/export")
    public ResponseEntity<StreamingResponseBody> exportCustomers(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean synthetic,
            @RequestParam(required = false) Boolean emailVerified,
            HttpServletRequest request
    ) {
        AdminUserProfile actor = devAdminAuthService.requirePermission(request, "reports.export");
        if (status != null && !status.isBlank()
                && !VALID_CUSTOMER_STATUSES.contains(status.toUpperCase(Locale.ROOT))) {
            throw ValidationException.fromField("status", "INVALID_CUSTOMER_STATUS",
                    "Unknown customer status: " + status);
        }
        adminReportService.recordExportAudit(
                actor.id(),
                "CUSTOMERS",
                filters(
                        "searchApplied", q != null && !q.isBlank(),
                        "status", blankToNull(status),
                        "synthetic", synthetic,
                        "emailVerified", emailVerified
                ),
                null,
                true,
                clientIpResolver.resolve(request),
                request.getHeader("User-Agent")
        );
        return completeCustomerCsvResponse(
                outputStream -> adminCustomerCsvExportService.writeTo(
                        outputStream, q, status, synthetic, emailVerified
                ),
                "customers_" + LocalDate.now().format(FILE_DATE) + ".csv"
        );
    }

    @GetMapping("/products/export")
    public ResponseEntity<byte[]> exportProducts(
            @RequestParam(required = false) String publishStatus,
            HttpServletRequest request
    ) {
        AdminUserProfile actor = devAdminAuthService.requirePermission(request, "reports.export");
        if (publishStatus != null && !publishStatus.isBlank()
                && !VALID_PUBLISH_STATUSES.contains(publishStatus.toUpperCase(Locale.ROOT))) {
            throw ValidationException.fromField("publishStatus", "INVALID_PUBLISH_STATUS",
                    "Unknown publish status: " + publishStatus);
        }
        AdminReportService.ExportResult productsResult = adminReportService.exportProductsCsv(publishStatus);
        adminReportService.recordExportAudit(
                actor.id(),
                "PRODUCTS",
                filters("publishStatus", blankToNull(publishStatus)),
                clientIpResolver.resolve(request),
                request.getHeader("User-Agent")
        );
        return csvResponse(productsResult, "products_" + LocalDate.now().format(FILE_DATE) + ".csv");
    }

    private void validateDateRange(String from, String to) {
        Instant fromInstant = parseDate(from, "from");
        Instant toInstant   = parseDate(to,   "to");
        if (fromInstant != null && toInstant != null && fromInstant.isAfter(toInstant)) {
            throw ValidationException.fromField("from", "DATE_RANGE_INVALID",
                    "'from' must not be after 'to'.");
        }
    }

    // REPORT_RULE_008: date validation uses VN timezone for start-of-day boundary,
    // consistent with AdminReportService which parses dates in Asia/Ho_Chi_Minh.
    private static final java.time.ZoneId VN_ZONE = java.time.ZoneId.of("Asia/Ho_Chi_Minh");

    private Instant parseDate(String value, String fieldName) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value).atStartOfDay(VN_ZONE).toInstant();
        } catch (Exception e) {
            try {
                return Instant.parse(value);
            } catch (Exception ignored) {
                throw ValidationException.fromField(fieldName, "INVALID_DATE_FORMAT",
                        "Date must be in YYYY-MM-DD format: " + value);
            }
        }
    }

    // RBAUD-005: set X-Export-Truncated: true when result was capped at EXPORT_MAX_ROWS
    private ResponseEntity<byte[]> csvResponse(AdminReportService.ExportResult result, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.set("X-Export-Max-Rows", String.valueOf(AdminReportService.EXPORT_MAX_ROWS));
        if (result.truncated()) {
            headers.set("X-Export-Truncated", "true");
        }
        return ResponseEntity.ok().headers(headers).body(result.csv());
    }

    private void validateOrderDateRange(String from, String to) {
        LocalDate fromDate = parseCalendarDate(from, "from");
        LocalDate toDate = parseCalendarDate(to, "to");
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw ValidationException.fromField(
                    "from", "DATE_RANGE_INVALID", "'from' must not be after 'to'."
            );
        }
    }

    private LocalDate parseCalendarDate(String value, String fieldName) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value);
        } catch (Exception exception) {
            throw ValidationException.fromField(
                    fieldName,
                    "INVALID_DATE_FORMAT",
                    "Date must be in YYYY-MM-DD format: " + value
            );
        }
    }

    private ResponseEntity<StreamingResponseBody> completeOrderCsvResponse(
            StreamingResponseBody body, String filename
    ) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.set("X-Export-Uncapped", "true");
        return ResponseEntity.ok().headers(headers).body(body);
    }

    private ResponseEntity<StreamingResponseBody> completeCustomerCsvResponse(
            StreamingResponseBody body, String filename
    ) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.set("X-Export-Uncapped", "true");
        return ResponseEntity.ok().headers(headers).body(body);
    }

    private static Map<String, Object> filters(Object... keyValues) {
        Map<String, Object> filters = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            filters.put((String) keyValues[i], keyValues[i + 1]);
        }
        return filters;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
