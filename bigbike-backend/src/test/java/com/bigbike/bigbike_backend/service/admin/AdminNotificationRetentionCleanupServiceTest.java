package com.bigbike.bigbike_backend.service.admin;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.repository.admin.AdminNotificationJpaRepository;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

class AdminNotificationRetentionCleanupServiceTest {

    @Test
    void schedulerUsesIndependentFiveHundredRowBatches() {
        AdminNotificationJpaRepository notifications = mock(AdminNotificationJpaRepository.class);
        when(notifications.deleteOlderThanBatch(any(), eq(500))).thenReturn(500, 2);

        new AdminNotificationRetentionCleanupService(notifications, transactionManager())
                .purgeExpiredNotifications();

        verify(notifications, times(2)).deleteOlderThanBatch(any(), eq(500));
    }

    private PlatformTransactionManager transactionManager() {
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        return transactionManager;
    }
}
