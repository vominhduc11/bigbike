package com.bigbike.bigbike_backend.service.cart;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartJpaRepository;
import com.bigbike.bigbike_backend.service.audit.AuditLogRetentionCleanupService;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

class RetentionBatchSchedulerTest {

    @Test
    void cartSchedulerUsesIndependentFiveHundredRowBatches() {
        CartJpaRepository carts = mock(CartJpaRepository.class);
        when(carts.deleteExpiredRetentionBatch(any(), eq(500))).thenReturn(500, 2);

        new CartRetentionCleanupService(carts, transactionManager()).purgeExpiredCarts();

        verify(carts, times(2)).deleteExpiredRetentionBatch(any(), eq(500));
    }

    @Test
    void auditSchedulerUsesIndependentFiveHundredRowBatches() {
        AuditLogJpaRepository auditLogs = mock(AuditLogJpaRepository.class);
        when(auditLogs.deleteOlderThanBatch(any(), eq(500))).thenReturn(500, 0);

        new AuditLogRetentionCleanupService(auditLogs, transactionManager()).purgeExpiredAuditLogs();

        verify(auditLogs, times(2)).deleteOlderThanBatch(any(), eq(500));
    }

    private PlatformTransactionManager transactionManager() {
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        return transactionManager;
    }
}
