package com.bigbike.bigbike_backend.service.auth;

import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Applies cache invalidation and client notification only after the access mutation has committed.
 * Doing this before commit allows another request to re-populate a cache from the old database state.
 */
@Service
@RequiredArgsConstructor
public class AdminAccessChangeService {

    private static final String USER_ACCESS_DESTINATION = "/queue/admin/access";

    private final AdminAccountStatusService adminAccountStatusService;
    private final AdminPermissionService adminPermissionService;
    private final AdminUserJpaRepository adminUserRepo;
    private final SimpMessagingTemplate messagingTemplate;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleAdminAccessChange(AdminAccessChangeEvent event) {
        adminAccountStatusService.evict(event.adminUserId());
        notifyAdmin(event.adminUserId(), event.reason(), event.forceReauthentication());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleRolePermissionsChanged(AdminRolePermissionsChangedEvent event) {
        adminPermissionService.evict(event.roleId());
        adminUserRepo.findAllByRole(event.roleId()).forEach(admin -> {
            adminAccountStatusService.evict(admin.getId());
            notifyAdmin(admin.getId(), "ROLE_PERMISSIONS_CHANGED", false);
        });
    }

    private void notifyAdmin(java.util.UUID adminUserId, String reason, boolean forceReauthentication) {
        messagingTemplate.convertAndSendToUser(
                adminUserId.toString(),
                USER_ACCESS_DESTINATION,
                new AdminAccessChangeMessage(reason, forceReauthentication));
    }
}
