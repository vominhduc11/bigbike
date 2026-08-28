package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.persistence.repository.admin.AdminNotificationJpaRepository;
import com.bigbike.bigbike_backend.service.ws.AdminOrderWsService;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Reproduces the REAL production path: checkout/status-change call pushEvent() from inside
 * an open transaction, so persistence happens in an afterCommit callback. The existing
 * suite only calls persistFromWsEvent() directly, which never exercises that callback.
 */
@SpringBootTest
class AdminNotificationAfterCommitTest {

    @Autowired AdminOrderWsService adminOrderWsService;
    @Autowired AdminNotificationJpaRepository notificationRepository;
    @Autowired TransactionTemplate transactionTemplate;

    @Test
    void notificationIsPersistedWhenPushedFromInsideATransaction() {
        String orderNumber = "BB-AFTERCOMMIT-" + UUID.randomUUID().toString().substring(0, 8);
        long before = notificationRepository.count();

        transactionTemplate.executeWithoutResult(status ->
                adminOrderWsService.pushEvent(new OrderWsEvent(
                        "NEW_ORDER", UUID.randomUUID(), orderNumber,
                        "Nguyễn Văn A", BigDecimal.valueOf(1_500_000),
                        "PROCESSING", "COD", Instant.now())));

        long after = notificationRepository.count();
        System.out.println(">>> notifications before=" + before + " after=" + after);
        assertThat(after).isEqualTo(before + 1);
    }
}
