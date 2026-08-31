package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import jakarta.persistence.EntityManager;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

@ExtendWith(MockitoExtension.class)
class AdminOrderCsvExportServiceTest {

    @Mock
    private OrderJpaRepository orderRepository;

    @Mock
    private EntityManager entityManager;

    @Mock
    private OrderHistoryClassificationService historyClassificationService;

    @Mock
    private OrderOperationsSettings orderOperationsSettings;

    @InjectMocks
    private AdminOrderCsvExportService service;

    @Test
    void writesEveryPageWithoutApplyingTheReportRowCap() throws Exception {
        OrderEntity first = order("BB-CSV-FIRST", Instant.parse("2026-07-21T16:59:59Z"));
        OrderEntity second = order("BB-CSV-SECOND", Instant.parse("2026-07-20T00:00:00Z"));
        PageRequest firstPage = PageRequest.of(0, AdminOrderCsvExportService.PAGE_SIZE);
        PageRequest secondPage = PageRequest.of(1, AdminOrderCsvExportService.PAGE_SIZE);

        when(orderRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(
                        new PageImpl<>(List.of(first), firstPage, 501),
                        new PageImpl<>(List.of(second), secondPage, 501)
                );
        when(historyClassificationService.activeClassifications(any())).thenReturn(Map.of());

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        service.writeTo(output, "PROCESSING", "BB-CSV", "2026-07-20", "2026-07-21");

        String csv = output.toString(StandardCharsets.UTF_8);
        assertThat(csv).startsWith("\uFEFForder_number,status");
        assertThat(csv).contains("report_scope,order_scope,history_batch_key");
        assertThat(csv).contains("ALL_INCLUDING_HISTORICAL,OPERATIONAL");
        assertThat(csv).contains("BB-CSV-FIRST");
        assertThat(csv).contains("BB-CSV-SECOND");
        verify(orderRepository, times(2)).findAll(any(Specification.class), any(Pageable.class));
        verify(entityManager, times(2)).clear();
    }

    private static OrderEntity order(String orderNumber, Instant placedAt) {
        OrderEntity order = new OrderEntity();
        order.setId(UUID.randomUUID());
        order.setOrderNumber(orderNumber);
        order.setStatus("PROCESSING");
        order.setCurrency("VND");
        order.setSubtotalAmount(BigDecimal.valueOf(100_000));
        order.setShippingAmount(BigDecimal.ZERO);
        order.setTotalAmount(BigDecimal.valueOf(100_000));
        order.setPaidAmount(BigDecimal.ZERO);
        order.setPlacedAt(placedAt);
        order.setCreatedAt(placedAt);
        order.setUpdatedAt(placedAt);
        return order;
    }
}
