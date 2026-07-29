package com.bigbike.bigbike_backend.service.admin;

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
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
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

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public void writeTo(
            OutputStream outputStream,
            String status,
            String q,
            String from,
            String to
    ) throws IOException {
        Specification<OrderEntity> specification =
                AdminOrderSupport.buildFilterSpecification(status, q, from, to);
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
                    "placed_at", "paid_at", "completed_at", "cancelled_at"
            );

            int pageIndex = 0;
            Page<OrderEntity> page;
            do {
                page = orderRepository.findAll(
                        specification,
                        PageRequest.of(pageIndex, PAGE_SIZE, stableSort)
                );
                for (OrderEntity order : page.getContent()) {
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
                            timestamp(order.getCancelledAt())
                    );
                }
                pageIndex++;
                entityManager.clear();
            } while (page.hasNext());
            printer.flush();
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
