package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.order.OrderHistoryClassificationResponse;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import jakarta.persistence.EntityManager;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.OptionalInt;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Streams every order matching the Orders-screen filters without a row cap. */
@Service
@RequiredArgsConstructor
public class AdminOrderCsvExportService {

    static final int PAGE_SIZE = 500;
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE_TIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(VN_ZONE);

    private final OrderJpaRepository orderRepository;
    private final EntityManager entityManager;
    private final OrderHistoryClassificationService historyClassificationService;
    private final OrderOperationsSettings orderOperationsSettings;

    public record ExportPlan(
            AdminOrderQueryOptions queryOptions,
            AdminOrderQueryOptions.OrderScope effectiveScope,
            Instant overdueCutoff,
            String reportScope
    ) {}

    public ExportPlan prepare(String orderScope, String attention) {
        AdminOrderQueryOptions options = AdminOrderQueryOptions.from(orderScope, attention);
        Instant overdueCutoff = resolveOverdueCutoff(options);
        AdminOrderQueryOptions.OrderScope effectiveScope = options.overdueOnly()
                ? AdminOrderQueryOptions.OrderScope.OPERATIONAL
                : options.orderScope();
        String reportScope = switch (effectiveScope) {
            case ALL -> "ALL_INCLUDING_HISTORICAL";
            case OPERATIONAL -> "OPERATIONAL_EXCLUDING_HISTORICAL";
            case HISTORICAL -> "HISTORICAL_ONLY";
        };
        return new ExportPlan(options, effectiveScope, overdueCutoff, reportScope);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public void writeTo(
            OutputStream outputStream,
            String status,
            String q,
            String from,
            String to
    ) throws IOException {
        writeTo(outputStream, status, q, from, to, prepare("ALL", null));
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public void writeTo(
            OutputStream outputStream,
            String status,
            String q,
            String from,
            String to,
            ExportPlan exportPlan
    ) throws IOException {
        Specification<OrderEntity> specification =
                AdminOrderSupport.buildFilterSpecification(
                        status,
                        q,
                        from,
                        to,
                        exportPlan.queryOptions(),
                        exportPlan.overdueCutoff()
                );
        Sort stableSort = Sort.by(
                Sort.Order.desc("placedAt").nullsLast(),
                Sort.Order.desc("createdAt"),
                Sort.Order.desc("id")
        );

        try (Writer writer = new OutputStreamWriter(outputStream, StandardCharsets.UTF_8);
             CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT)) {
            writer.write('\uFEFF');
            printer.printRecord(
                    "order_number", "status", "customer_email", "customer_phone",
                    "currency", "subtotal", "shipping", "total", "paid_amount",
                    "placed_at", "paid_at", "completed_at", "cancelled_at",
                    "report_scope", "order_scope", "history_batch_key"
            );

            int pageIndex = 0;
            Page<OrderEntity> page;
            do {
                page = orderRepository.findAll(
                        specification,
                        PageRequest.of(pageIndex, PAGE_SIZE, stableSort)
                );
                List<UUID> orderIds = page.getContent().stream().map(OrderEntity::getId).toList();
                Map<UUID, OrderHistoryClassificationResponse> classifications =
                        historyClassificationService.activeClassifications(orderIds);
                for (OrderEntity order : page.getContent()) {
                    OrderHistoryClassificationResponse classification = classifications.get(order.getId());
                    printer.printRecord(
                            order.getOrderNumber(),
                            order.getStatus(),
                            CsvExportUtil.escape(text(order.getCustomerEmail())),
                            CsvExportUtil.escape(text(order.getCustomerPhone())),
                            order.getCurrency(),
                            decimal(order.getSubtotalAmount()),
                            decimal(order.getShippingAmount()),
                            decimal(order.getTotalAmount()),
                            decimal(order.getPaidAmount()),
                            timestamp(order.getPlacedAt()),
                            timestamp(order.getPaidAt()),
                            timestamp(order.getCompletedAt()),
                            timestamp(order.getCancelledAt()),
                            exportPlan.reportScope(),
                            classification == null ? "OPERATIONAL" : "HISTORICAL",
                            classification == null ? "" : classification.batchKey()
                    );
                }
                pageIndex++;
                entityManager.clear();
            } while (page.hasNext());
            printer.flush();
        }
    }

    private Instant resolveOverdueCutoff(AdminOrderQueryOptions queryOptions) {
        if (!queryOptions.overdueOnly()) return null;
        OptionalInt configuredDays = orderOperationsSettings.overdueDays();
        if (configuredDays.isEmpty()) {
            throw ValidationException.fromField(
                    "attention",
                    "ORDER_OVERDUE_SETTING_UNAVAILABLE",
                    "The overdue-order threshold is missing or invalid."
            );
        }
        try {
            return Instant.now().minus(Duration.ofDays(configuredDays.getAsInt()));
        } catch (DateTimeException | ArithmeticException exception) {
            throw ValidationException.fromField(
                    "attention",
                    "ORDER_OVERDUE_SETTING_UNAVAILABLE",
                    "The overdue-order threshold is out of range."
            );
        }
    }

    private static String text(String value) {
        return value == null ? "" : value;
    }

    private static String decimal(BigDecimal value) {
        return value == null ? "0" : value.toPlainString();
    }

    private static String timestamp(Instant value) {
        return value == null ? "" : DATE_TIME.format(value);
    }
}
