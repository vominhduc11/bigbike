package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminNotificationService;
import com.bigbike.bigbike_backend.service.admin.AdminNotificationService.InboxView;
import com.bigbike.bigbike_backend.service.admin.AdminNotificationService.NotificationView;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/v1/admin/notifications")
@RequiredArgsConstructor
public class AdminNotificationController extends AdminControllerSupport {

    private final AdminNotificationService notificationService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;
    private final ObjectMapper objectMapper;

    @GetMapping
    public ApiDataResponse<Map<String, Object>> list(HttpServletRequest request) {
        var user = devAdminAuthService.requireAnyPermission(request, "orders.read", "inventory.read");
        InboxView inbox = notificationService.inboxFor(
                resolveAdminId(),
                hasPermission(user.permissions(), "orders.read"),
                hasPermission(user.permissions(), "inventory.read"));
        List<Map<String, Object>> mapped = inbox.items().stream().map(this::toMap).toList();
        return apiResponseFactory.data(
                Map.of("unreadCount", inbox.unreadCount(), "items", mapped), request);
    }

    // mark-read (by ids) endpoint removed 2026-07-15 (AUD-067): no UI caller — the bell
    // only ever advances the caller's high-water mark via mark-all-read below.
    @PostMapping("/mark-all-read")
    public ApiDataResponse<Map<String, Object>> markAllRead(HttpServletRequest request) {
        devAdminAuthService.requireAnyPermission(request, "orders.read", "inventory.read");
        long remaining = notificationService.markAllReadFor(resolveAdminId());
        return apiResponseFactory.data(Map.of("unreadCount", remaining), request);
    }

    private Map<String, Object> toMap(NotificationView view) {
        var e = view.notification();
        return Map.of(
                "id", e.getId(),
                "type", e.getType(),
                "orderId", e.getOrderId() != null ? e.getOrderId() : "",
                "orderNumber", e.getOrderNumber() != null ? e.getOrderNumber() : "",
                "payload", parsePayload(e.getPayload()),
                "isRead", view.read(),
                "createdAt", e.getCreatedAt()
        );
    }

    private static boolean hasPermission(List<String> permissions, String permission) {
        return permissions.contains("*") || permissions.contains(permission);
    }

    private Object parsePayload(String payload) {
        if (payload == null || payload.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readTree(payload);
        } catch (Exception exception) {
            return Map.of();
        }
    }
}
