package com.bigbike.bigbike_backend.service.auth;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@ExtendWith(MockitoExtension.class)
class AdminAccessChangeServiceTest {

    @Mock AdminAccountStatusService accountStatusService;
    @Mock AdminPermissionService permissionService;
    @Mock AdminUserJpaRepository adminUserRepo;
    @Mock SimpMessagingTemplate messagingTemplate;

    @Test
    void accountChangeEvictsOnlyThatAccountAndNotifiesEveryOpenSessionThroughItsUserQueue() {
        AdminAccessChangeService service = service();
        UUID adminId = UUID.randomUUID();

        service.handleAdminAccessChange(new AdminAccessChangeEvent(adminId, "ROLE_CHANGED", false));

        verify(accountStatusService).evict(adminId);
        verify(messagingTemplate).convertAndSendToUser(
                eq(adminId.toString()), eq("/queue/admin/access"),
                eq(new AdminAccessChangeMessage("ROLE_CHANGED", false)));
    }

    @Test
    void rolePermissionChangeEvictsAndNotifiesEveryAdminAssignedToThatRole() {
        AdminAccessChangeService service = service();
        AdminUserEntity first = admin(UUID.randomUUID(), "OPERATIONS");
        AdminUserEntity second = admin(UUID.randomUUID(), "OPERATIONS");
        when(adminUserRepo.findAllByRole("OPERATIONS")).thenReturn(List.of(first, second));

        service.handleRolePermissionsChanged(new AdminRolePermissionsChangedEvent("OPERATIONS"));

        verify(permissionService).evict("OPERATIONS");
        verify(accountStatusService).evict(first.getId());
        verify(accountStatusService).evict(second.getId());
        verify(messagingTemplate).convertAndSendToUser(
                eq(first.getId().toString()), eq("/queue/admin/access"),
                eq(new AdminAccessChangeMessage("ROLE_PERMISSIONS_CHANGED", false)));
        verify(messagingTemplate).convertAndSendToUser(
                eq(second.getId().toString()), eq("/queue/admin/access"),
                eq(new AdminAccessChangeMessage("ROLE_PERMISSIONS_CHANGED", false)));
    }

    private AdminAccessChangeService service() {
        return new AdminAccessChangeService(
                accountStatusService, permissionService, adminUserRepo, messagingTemplate);
    }

    private static AdminUserEntity admin(UUID id, String role) {
        AdminUserEntity user = new AdminUserEntity();
        user.setId(id);
        user.setRole(role);
        return user;
    }
}
