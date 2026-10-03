package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.admin.AdminNotificationEntity;
import com.bigbike.bigbike_backend.persistence.repository.admin.AdminNotificationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.admin.AdminNotificationReadJpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class AdminNotificationScopeTest {

    @Mock private AdminNotificationJpaRepository notificationRepository;
    @Mock private AdminNotificationReadJpaRepository readRepository;

    private AdminNotificationService service;

    @BeforeEach
    void setUp() {
        service = new AdminNotificationService(notificationRepository, readRepository);
    }

    @Test
    void inventoryOnlyInboxCannotLoadOrderRows() {
        UUID adminId = UUID.randomUUID();
        AdminNotificationEntity inventory = notification("INVENTORY_OUT_OF_STOCK_DIGEST");
        when(readRepository.findById(adminId)).thenReturn(Optional.empty());
        when(notificationRepository.findInventoryVisible(any(Pageable.class)))
                .thenReturn(List.of(inventory));
        when(notificationRepository.countInventoryVisible()).thenReturn(1L);

        var inbox = service.inboxFor(adminId, false, true);

        assertThat(inbox.items()).singleElement().satisfies(item ->
                assertThat(item.notification().getType())
                        .isEqualTo("INVENTORY_OUT_OF_STOCK_DIGEST"));
        assertThat(inbox.unreadCount()).isEqualTo(1);
        verify(notificationRepository, never()).findVisible(any(Pageable.class));
        verify(notificationRepository, never()).findAllVisible(any(Pageable.class));
    }

    @Test
    void callerWithoutEitherScopeIsRejected() {
        assertThatThrownBy(() -> service.inboxFor(UUID.randomUUID(), false, false))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static AdminNotificationEntity notification(String type) {
        AdminNotificationEntity notification = new AdminNotificationEntity();
        notification.setId(UUID.randomUUID());
        notification.setType(type);
        notification.setCreatedAt(Instant.parse("2026-08-31T01:00:00Z"));
        return notification;
    }
}
