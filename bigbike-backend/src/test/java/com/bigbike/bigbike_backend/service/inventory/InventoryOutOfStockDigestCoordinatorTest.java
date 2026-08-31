package com.bigbike.bigbike_backend.service.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.repository.admin.AdminNotificationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.inventory.InventoryOutOfStockDigestRunJpaRepository;
import com.bigbike.bigbike_backend.service.admin.AdminNotificationService;
import com.bigbike.bigbike_backend.service.ws.AdminInventoryWsService;
import com.bigbike.bigbike_backend.service.ws.InventoryWsEvent;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class InventoryOutOfStockDigestCoordinatorTest {

    @Mock private InventoryOutOfStockDigestRunJpaRepository runRepository;
    @Mock private AdminNotificationJpaRepository notificationRepository;
    @Mock private AdminNotificationService notificationService;
    @Mock private AdminInventoryWsService inventoryWsService;
    @Mock private ObjectMapper objectMapper;

    private InventoryOutOfStockDigestCoordinator coordinator;

    @BeforeEach
    void setUp() {
        coordinator = new InventoryOutOfStockDigestCoordinator(
                runRepository, notificationRepository, notificationService,
                inventoryWsService, objectMapper);
    }

    @Test
    void manyItemsCreateOneAggregatedNotification() throws Exception {
        LocalDate date = LocalDate.of(2026, 8, 31);
        Instant now = Instant.parse("2026-08-31T01:00:00Z");
        List<InventoryOutOfStockDigest.ProductItem> products = List.of(
                product("p1", now), product("p2", now), product("p3", now));
        InventoryOutOfStockDigest digest = new InventoryOutOfStockDigest(
                1, date, now, new InventoryOutOfStockDigest.Counts(3, 0, 0),
                products, List.of());
        UUID notificationId = UUID.randomUUID();
        when(runRepository.insertIfAbsent(date, "NOTIFIED", now)).thenReturn(1);
        when(objectMapper.writeValueAsString(digest)).thenReturn("{snapshot}");
        when(notificationService.persistInventoryDigest("{snapshot}", now)).thenReturn(notificationId);
        when(runRepository.attachNotification(date, notificationId)).thenReturn(1);

        assertThat(coordinator.record(digest)).isTrue();

        verify(notificationService).persistInventoryDigest("{snapshot}", now);
        ArgumentCaptor<InventoryWsEvent> event = ArgumentCaptor.forClass(InventoryWsEvent.class);
        verify(inventoryWsService).pushEvent(event.capture());
        assertThat(event.getValue().type()).isEqualTo("INVENTORY_OUT_OF_STOCK_DIGEST_READY");
        assertThat(event.getValue().productId()).isNull();
    }

    @Test
    void emptyDayCreatesNoNotification() {
        LocalDate date = LocalDate.of(2026, 8, 31);
        Instant now = Instant.parse("2026-08-31T01:00:00Z");
        InventoryOutOfStockDigest digest = new InventoryOutOfStockDigest(
                1, date, now, new InventoryOutOfStockDigest.Counts(0, 0, 0),
                List.of(), List.of());
        when(runRepository.insertIfAbsent(date, "EMPTY", now)).thenReturn(1);

        assertThat(coordinator.record(digest)).isTrue();

        verify(notificationService, never()).persistInventoryDigest(any(), any());
        verify(inventoryWsService, never()).pushEvent(any());
    }

    @Test
    void existingDateCannotCreateASecondNotification() {
        LocalDate date = LocalDate.of(2026, 8, 31);
        Instant now = Instant.parse("2026-08-31T01:00:00Z");
        InventoryOutOfStockDigest digest = new InventoryOutOfStockDigest(
                1, date, now, new InventoryOutOfStockDigest.Counts(1, 0, 0),
                List.of(product("p1", now)), List.of());
        when(runRepository.insertIfAbsent(date, "NOTIFIED", now)).thenReturn(0);

        assertThat(coordinator.record(digest)).isFalse();
        verify(notificationService, never()).persistInventoryDigest(any(), any());
    }

    private static InventoryOutOfStockDigest.ProductItem product(String id, Instant since) {
        return new InventoryOutOfStockDigest.ProductItem(
                id, "Sản phẩm " + id, "Product " + id, "SKU-" + id,
                "/admin/products/" + id, since, 1, false);
    }
}
