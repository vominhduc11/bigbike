package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.ClientIpResolver;
import com.bigbike.bigbike_backend.domain.auth.AdminUserProfile;
import com.bigbike.bigbike_backend.domain.commerce.OrderStatus;
import com.bigbike.bigbike_backend.domain.commerce.PaymentStatus;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.service.admin.AdminReportService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin/reports")
public class AdminReportController {

    private static final DateTimeFormatter FILE_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");

    private static final Set<String> VALID_ORDER_STATUSES =
            Arrays.stream(OrderStatus.values()).map(Enum::name).collect(Collectors.toUnmodifiableSet());
    private static final Set<String> VALID_PAYMENT_STATUSES =
            Arrays.stream(PaymentStatus.values()).map(Enum::name).collect(Collectors.toUnmodifiableSet());
    private static final Set<String> VALID_PUBLISH_STATUSES =
            Arrays.stream(PublishStatus.values()).map(Enum::name).collect(Collectors.toUnmodifiableSet());

    private final AdminReportService adminReportService;
    private final DevAdminAuthService devAdminAuthService;
    private final AuditLogJpaRepository auditLogRepo;
    private final ClientIpResolver clientIpResolver;

    public AdminReportController(
            AdminReportService adminReportService,
            DevAdminAuthService devAdminAuthService,
            AuditLogJpaRepository auditLogRepo,
            ClientIpResolver clientIpResolver
    ) {
        this.adminReportService = adminReportService;
        this.devAdminAuthService = devAdminAuthService;
        this.auditLogRepo = auditLogRepo;
        this.clientIpResolver = clientIpResolver;
    }

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
    public ResponseEntity<byte[]> exportOrders(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String paymentStatus,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            HttpServletRequest request
    ) {
        AdminUserProfile actor = devAdminAuthService.requirePermission(request, "reports.export");
        validateDateRange(from, to);
        if (status != null && !status.isBlank()
                && !VALID_ORDER_STATUSES.contains(status.toUpperCase(Locale.ROOT))) {
            throw ValidationException.fromField("status", "INVALID_ORDER_STATUS",
                    "Unknown order status: " + status);
        }
        if (paymentStatus != null && !paymentStatus.isBlank()
                && !VALID_PAYMENT_STATUSES.contains(paymentStatus.toUpperCase(Locale.ROOT))) {
            throw ValidationException.fromField("paymentStatus", "INVALID_PAYMENT_STATUS",
                    "Unknown payment status: " + paymentStatus);
        }
        AdminReportService.ExportResult ordersResult = adminReportService.exportOrdersCsv(status, paymentStatus, from, to);
        recordExportAudit(actor, "ORDERS",
                "{\"exportType\":\"ORDERS\",\"filters\":{"
                        + "\"status\":" + jsonStr(status)
                        + ",\"paymentStatus\":" + jsonStr(paymentStatus)
                        + ",\"from\":" + jsonStr(from)
                        + ",\"to\":" + jsonStr(to)
                        + "},\"rowLimit\":10000}",
                request);
        return csvResponse(ordersResult, "orders_" + LocalDate.now().format(FILE_DATE) + ".csv");
    }

    @GetMapping("/customers/export")
    public ResponseEntity<byte[]> exportCustomers(
            @RequestParam(required = false) String status,
            HttpServletRequest request
    ) {
        AdminUserProfile actor = devAdminAuthService.requirePermission(request, "reports.export");
        AdminReportService.ExportResult customersResult = adminReportService.exportCustomersCsv(status);
        recordExportAudit(actor, "CUSTOMERS",
                "{\"exportType\":\"CUSTOMERS\",\"filters\":{"
                        + "\"status\":" + jsonStr(status)
                        + "},\"rowLimit\":10000}",
                request);
        return csvResponse(customersResult, "customers_" + LocalDate.now().format(FILE_DATE) + ".csv");
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
        recordExportAudit(actor, "PRODUCTS",
                "{\"exportType\":\"PRODUCTS\",\"filters\":{"
                        + "\"publishStatus\":" + jsonStr(publishStatus)
                        + "},\"rowLimit\":10000}",
                request);
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

    private void recordExportAudit(AdminUserProfile actor, String exportType,
                                   String afterData, HttpServletRequest request) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(parseActorId(actor.id()));
        log.setAction("REPORT_EXPORT_CREATED");
        log.setResourceType("REPORT");
        log.setAfterData(afterData);
        log.setIpAddress(clientIpResolver.resolve(request));
        log.setUserAgent(request.getHeader("User-Agent"));
        log.setCreatedAt(Instant.now());
        auditLogRepo.save(log);
    }

    private static UUID parseActorId(String id) {
        if (id == null) return null;
        try { return UUID.fromString(id); }
        catch (IllegalArgumentException e) { return null; }
    }

    private static String jsonStr(String value) {
        if (value == null || value.isBlank()) return "null";
        return "\"" + value + "\"";
    }
}
