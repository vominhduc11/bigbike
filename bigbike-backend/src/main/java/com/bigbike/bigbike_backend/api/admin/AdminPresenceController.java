package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.service.auth.AdminAccountStatusService;
import com.bigbike.bigbike_backend.service.auth.AdminPermissionService;
import com.bigbike.bigbike_backend.service.ws.AdminPresenceService;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class AdminPresenceController {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String SESSION_ATTR_ADMIN_USER_ID = "adminUserId";

    private final AdminPresenceService presenceService;
    private final AdminAccountStatusService adminAccountStatusService;
    private final AdminPermissionService adminPermissionService;

    @MessageMapping("/admin/presence")
    public void updatePresence(PresenceCommand command, SimpMessageHeaderAccessor accessor) {
        Object rawUserId = accessor.getSessionAttributes() != null
                ? accessor.getSessionAttributes().get(SESSION_ATTR_ADMIN_USER_ID) : null;
        UUID adminId = rawUserId instanceof UUID userId ? userId : null;
        String sessionId = accessor.getSessionId();
        if (adminId == null || sessionId == null || command == null) {
            throw new IllegalArgumentException("Admin presence session is invalid.");
        }

        String requiredPermission = requiredPermission(command.entityType());
        if (!hasPermission(adminId, requiredPermission)) {
            throw new IllegalArgumentException("Not permitted to publish admin presence.");
        }

        String action = command.action() != null ? command.action().trim().toUpperCase() : "";
        if ("JOIN".equals(action)) {
            presenceService.join(adminId, sessionId, command.entityType(), command.entityId());
        } else if ("LEAVE".equals(action)) {
            presenceService.leave(adminId, sessionId, command.entityType(), command.entityId());
        } else {
            throw new IllegalArgumentException("Invalid presence action.");
        }
    }

    private String requiredPermission(String entityType) {
        return switch (entityType != null ? entityType.trim().toUpperCase() : "") {
            case "ORDER" -> "orders.read";
            case "PRODUCT" -> "products.read";
            default -> throw new IllegalArgumentException("Invalid presence entity type.");
        };
    }

    private boolean hasPermission(UUID adminId, String requiredPermission) {
        AdminAccountStatusService.Snapshot snapshot = adminAccountStatusService.getSnapshot(adminId);
        if (snapshot == null || !STATUS_ACTIVE.equals(snapshot.status())) return false;
        List<String> permissions = adminPermissionService.getPermissionsForRole(snapshot.role());
        return permissions.contains("*") || permissions.contains(requiredPermission);
    }

    public record PresenceCommand(String action, String entityType, String entityId) {}
}
