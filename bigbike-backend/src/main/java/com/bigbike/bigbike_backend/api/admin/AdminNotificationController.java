package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.persistence.entity.admin.AdminNotificationEntity;
import com.bigbike.bigbike_backend.service.admin.AdminNotificationService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/notifications")
public class AdminNotificationController {

    private final AdminNotificationService notificationService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminNotificationController(
            AdminNotificationService notificationService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory) {
        this.notificationService = notificationService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping
    public ApiDataResponse<Map<String, Object>> listUnread(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "orders.read");
        List<AdminNotificationEntity> items = notificationService.listUnread();
        long unreadCount = notificationService.countUnread();
        List<Map<String, Object>> mapped = items.stream().map(this::toMap).toList();
        return apiResponseFactory.data(Map.of("unreadCount", unreadCount, "items", mapped), request);
    }

    @PostMapping("/mark-read")
    public ApiDataResponse<Map<String, Object>> markRead(
            @RequestBody MarkReadRequest body, HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "orders.read");
        int updated = notificationService.markRead(body.ids());
        return apiResponseFactory.data(Map.of("updated", updated), request);
    }

    @PostMapping("/mark-all-read")
    public ApiDataResponse<Map<String, Object>> markAllRead(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "orders.read");
        int updated = notificationService.markAllRead();
        return apiResponseFactory.data(Map.of("updated", updated), request);
    }

    private Map<String, Object> toMap(AdminNotificationEntity e) {
        return Map.of(
                "id", e.getId(),
                "type", e.getType(),
                "orderId", e.getOrderId() != null ? e.getOrderId() : "",
                "orderNumber", e.getOrderNumber() != null ? e.getOrderNumber() : "",
                "payload", e.getPayload() != null ? e.getPayload() : "{}",
                "isRead", e.isRead(),
                "createdAt", e.getCreatedAt()
        );
    }

    public record MarkReadRequest(List<UUID> ids) {}
}
