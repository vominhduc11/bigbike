package com.bigbike.bigbike_backend.service.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.analytics.Ga4EventOutboxEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.analytics.Ga4EventOutboxJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class Ga4RefundOutboxServiceTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Mock Ga4EventOutboxJpaRepository outboxRepository;
    @Mock OrderLineItemJpaRepository lineItemRepository;
    @Mock CustomerJpaRepository customerRepository;

    private Ga4RefundOutboxService service;

    @BeforeEach
    void setUp() {
        service = new Ga4RefundOutboxService(
                outboxRepository, lineItemRepository, customerRepository);
    }

    @Test
    void storesOneStableSanitizedFullRefundForRegisteredCustomer() throws Exception {
        OrderEntity order = order();
        OrderLineItemEntity line = lineItem(order);
        CustomerEntity customer = new CustomerEntity();
        customer.setId(order.getCustomerId());
        customer.setSynthetic(false);
        when(lineItemRepository.findByOrderId(order.getId())).thenReturn(List.of(line));
        when(customerRepository.findById(order.getCustomerId())).thenReturn(Optional.of(customer));

        service.enqueueCancellationRefund(order);

        ArgumentCaptor<Ga4EventOutboxEntity> captor =
                ArgumentCaptor.forClass(Ga4EventOutboxEntity.class);
        verify(outboxRepository).save(captor.capture());
        Ga4EventOutboxEntity event = captor.getValue();
        assertThat(event.getOrderId()).isEqualTo(order.getId());
        assertThat(event.getEventName()).isEqualTo("refund");
        assertThat(event.getStatus()).isEqualTo("PENDING");

        JsonNode root = JSON.readTree(event.getPayloadJson());
        assertThat(root.path("client_id").asText()).isEqualTo("123456789.987654321");
        assertThat(root.path("user_id").asText()).isEqualTo(order.getCustomerId().toString());
        JsonNode refund = root.path("events").get(0);
        assertThat(refund.path("name").asText()).isEqualTo("refund");
        assertThat(refund.path("params").path("transaction_id").asText())
                .isEqualTo("BB-ANALYTICS-1");
        assertThat(refund.path("params").path("value").asLong()).isEqualTo(1_550_000L);
        assertThat(refund.path("params").path("items").get(0).path("item_id").asText())
                .isEqualTo("HELMET-M");
        assertThat(refund.path("params").path("items").get(0).path("quantity").asInt())
                .isEqualTo(1);
        assertThat(refund.path("params").path("event_id").asText())
                .isEqualTo(event.getId().toString());
        assertThat(event.getPayloadJson())
                .doesNotContain("buyer@example.com", "0909000000", "123 Private Street", "order-key");
    }

    @Test
    void omitsUserIdForSyntheticGuestAndDoesNotDuplicateAnOrderEvent() throws Exception {
        OrderEntity order = order();
        order.setGa4ClientId(null);
        CustomerEntity guest = new CustomerEntity();
        guest.setId(order.getCustomerId());
        guest.setSynthetic(true);
        when(lineItemRepository.findByOrderId(order.getId())).thenReturn(List.of(lineItem(order)));
        when(customerRepository.findById(order.getCustomerId())).thenReturn(Optional.of(guest));

        service.enqueueCancellationRefund(order);

        ArgumentCaptor<Ga4EventOutboxEntity> captor =
                ArgumentCaptor.forClass(Ga4EventOutboxEntity.class);
        verify(outboxRepository).save(captor.capture());
        JsonNode payload = JSON.readTree(captor.getValue().getPayloadJson());
        assertThat(payload.has("user_id")).isFalse();
        assertThat(payload.path("client_id").asText())
                .isEqualTo(Ga4RefundOutboxService.FALLBACK_CLIENT_ID);

        when(outboxRepository.existsByOrderIdAndEventName(order.getId(), "refund")).thenReturn(true);
        service.enqueueCancellationRefund(order);
        verify(lineItemRepository).findByOrderId(order.getId());
        verify(outboxRepository).save(any(Ga4EventOutboxEntity.class));
    }

    @Test
    void duplicateCheckStopsBeforeReadingOrderDetails() {
        OrderEntity order = order();
        when(outboxRepository.existsByOrderIdAndEventName(order.getId(), "refund")).thenReturn(true);

        service.enqueueCancellationRefund(order);

        verify(lineItemRepository, never()).findByOrderId(any());
        verify(outboxRepository, never()).save(any());
    }

    @Test
    void orderPlacedBeforeProductionMeasurementCutoverIsNeverSubtracted() {
        OrderEntity order = order();
        order.setPlacedAt(Instant.parse("2026-09-05T16:59:59Z"));

        service.enqueueCancellationRefund(order);

        verify(outboxRepository, never()).existsByOrderIdAndEventName(any(), any());
        verify(lineItemRepository, never()).findByOrderId(any());
        verify(outboxRepository, never()).save(any());
    }

    private static OrderEntity order() {
        OrderEntity order = new OrderEntity();
        order.setId(UUID.fromString("10000000-0000-0000-0000-000000000001"));
        order.setCustomerId(UUID.fromString("20000000-0000-0000-0000-000000000002"));
        order.setOrderNumber("BB-ANALYTICS-1");
        order.setOrderKey("order-key");
        order.setCustomerName("Private Buyer");
        order.setCustomerEmail("buyer@example.com");
        order.setCustomerPhone("0909000000");
        order.setGa4ClientId("123456789.987654321");
        order.setCurrency("VND");
        order.setTotalAmount(new BigDecimal("1550000.00"));
        order.setPlacedAt(Instant.parse("2026-09-09T01:00:00Z"));
        return order;
    }

    private static OrderLineItemEntity lineItem(OrderEntity order) {
        OrderLineItemEntity line = new OrderLineItemEntity();
        line.setId(UUID.fromString("30000000-0000-0000-0000-000000000003"));
        line.setOrder(order);
        line.setSku("HELMET-M");
        line.setProductName("Mũ bảo hiểm");
        line.setVariantName("Size M");
        line.setUnitPrice(new BigDecimal("1550000.00"));
        line.setQuantity(1);
        line.setMetadata("123 Private Street");
        return line;
    }
}
