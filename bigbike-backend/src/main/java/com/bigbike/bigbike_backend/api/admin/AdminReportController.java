package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse;
import com.bigbike.bigbike_backend.service.admin.AdminReportService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
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

    private final AdminReportService adminReportService;
    private final DevAdminAuthService devAdminAuthService;

    public AdminReportController(
            AdminReportService adminReportService,
            DevAdminAuthService devAdminAuthService
    ) {
        this.adminReportService = adminReportService;
        this.devAdminAuthService = devAdminAuthService;
    }

    @GetMapping("/analytics")
    public AdminAnalyticsResponse getAnalytics(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "orders.read");
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
        devAdminAuthService.requirePermission(request, "orders.read");
        byte[] csv = adminReportService.exportOrdersCsv(status, paymentStatus, from, to);
        return csvResponse(csv, "orders_" + LocalDate.now().format(FILE_DATE) + ".csv");
    }

    @GetMapping("/customers/export")
    public ResponseEntity<byte[]> exportCustomers(
            @RequestParam(required = false) String status,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "customers.read");
        byte[] csv = adminReportService.exportCustomersCsv(status);
        return csvResponse(csv, "customers_" + LocalDate.now().format(FILE_DATE) + ".csv");
    }

    @GetMapping("/products/export")
    public ResponseEntity<byte[]> exportProducts(
            @RequestParam(required = false) String publishStatus,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.read");
        byte[] csv = adminReportService.exportProductsCsv(publishStatus);
        return csvResponse(csv, "products_" + LocalDate.now().format(FILE_DATE) + ".csv");
    }

    private ResponseEntity<byte[]> csvResponse(byte[] csv, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        return ResponseEntity.ok().headers(headers).body(csv);
    }
}
