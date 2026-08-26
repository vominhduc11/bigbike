package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminNotificationService;
import com.bigbike.bigbike_backend.service.admin.AdminNotificationService.InboxView;
import com.bigbike.bigbike_backend.service.admin.AdminNotificationService.NotificationView;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.domain.auth.AdminUserProfile;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/notifications")
@RequiredArgsConstructor
public class AdminNotificationController extends AdminControllerSupport {

    private final AdminNotificationService notificationService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiDataResponse<Map<String, Object>> list(HttpServletRequest request) {
        AdminUserProfile user = devAdminAuthService.requireAnyPermission(
                request, "orders.read", "chat.read");
        boolean wildcard = user.permissions().contains("*");
        InboxView inbox = notificationService.inboxFor(
                resolveAdminId(),
                wildcard || user.permissions().contains("orders.read"),
                wildcard || user.permissions().contains("chat.read"));
        List<Map<String, Object>> mapped = inbox.items().stream().map(this::toMap).toList();
        return apiResponseFactory.data(
                Map.of("unreadCount", inbox.unreadCount(), "items", mapped), request);
    }

    // mark-read (by ids) endpoint removed 2026-07-15 (AUD-067): no UI caller — the bell
    // only ever advances the caller's high-water mark via mark-all-read below.
    @PostMapping("/mark-all-read")
    public ApiDataResponse<Map<String, Object>> markAllRead(HttpServletRequest request) {
        devAdminAuthService.requireAnyPermission(request, "orders.read", "chat.read");
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
                "payload", e.getPayload() != null ? e.getPayload() : "{}",
                "isRead", view.read(),
                "createdAt", e.getCreatedAt()
        );
    }
}
