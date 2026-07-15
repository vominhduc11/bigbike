package com.bigbike.bigbike_backend.service.order;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.order.dto.OrderDetailResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.checkout.OrderNotificationService;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.service.ws.AdminOrderWsService;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@RequiredArgsConstructor
public class CustomerOrderCancelService {

    private final OrderJpaRepository orderRepo;
    private final OrderReadService orderReadService;
    private final WebRevalidationService webRevalidationService;
    private final AdminOrderWsService adminOrderWsService;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;
    private final OrderNotificationService orderNotificationService;

    @Transactional
    public OrderDetailResponse cancel(UUID customerId, UUID orderId) {
        OrderEntity order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy đơn hàng."));

        if (!customerId.equals(order.getCustomerId())) {
            throw new AccessDeniedException("Không có quyền thao tác đơn hàng này.");
        }

        if (!isCustomerCancellable(order)) {
            throw new ConflictException(
                    "Đơn hàng ở trạng thái " + order.getStatus()
                    + (order.getPaymentStatus() != null ? "/" + order.getPaymentStatus() : "")
                    + " không thể huỷ. Vui lòng liên hệ shop để được hỗ trợ."
            );
        }

        Instant now = Instant.now();
        String beforeStatus = order.getStatus();
        order.setStatus("CANCELLED");
        order.setCancelledAt(now);
        order.setUpdatedAt(now);

        if ("DELIVERY".equalsIgnoreCase(order.getFulfillmentType())) {
            order.setFulfillmentStatus("CANCELLED");
        }

        orderRepo.save(order);

        // Inventory is boolean availability only (owner decision 2026-06-23) — nothing to restore.
        webRevalidationService.revalidateProductsForOrder(orderId);

        // Notify the shop at the same level as a new order (owner decision 2026-07-15, §2 #3):
        // WebSocket + persistent admin inbox, an audit-log record, and a cancellation email
        // confirmation to the customer.
        String customerName = order.getCustomerName() != null && !order.getCustomerName().isBlank()
                ? order.getCustomerName()
                : (order.getCustomerEmail() != null ? order.getCustomerEmail() : "Khách hàng");
        adminOrderWsService.pushEvent(new OrderWsEvent(
                "ORDER_STATUS_CHANGED", order.getId(), order.getOrderNumber(),
                customerName, order.getTotalAmount(), "CANCELLED", order.getPaymentStatus(), now));

        auditLogWriter.save(auditLogFactory.build(
                "CUSTOMER", customerId, "ORDER_CANCELLED_BY_CUSTOMER", "ORDER", order.getId(),
                "{\"status\":\"" + beforeStatus + "\"}", "{\"status\":\"CANCELLED\"}"));

        OrderEntity emailSnapshot = order;
        runAfterCommit(() ->
                orderNotificationService.sendOrderStatusUpdate(emailSnapshot, "CANCELLED", null));

        return orderReadService.getCustomerOrderDetail(customerId, orderId);
    }

    private void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    /**
     * Customer may cancel their own order only when no money has been collected
     * and the goods have not left the warehouse:
     *   • PENDING                          — legacy / not yet confirmed
     *   • ON_HOLD                          — BACS placed, transfer not received
     *   • PROCESSING + not yet SHIPPED/DELIVERED — COD or BACS confirmed but still
     *                                            packable / cancellable in-house
     * In every case paymentStatus must be UNPAID. Once payment is captured (PAID),
     * the customer must contact the shop, which cancels the order and reconciles any
     * money returned manually (there is no system refund flow).
     */
    private static boolean isCustomerCancellable(OrderEntity order) {
        String paymentStatus = order.getPaymentStatus();
        if (!"UNPAID".equals(paymentStatus)) {
            return false;
        }

        String status = order.getStatus();
        if ("PENDING".equals(status) || "ON_HOLD".equals(status)) {
            return true;
        }
        if ("PROCESSING".equals(status)) {
            String fulfillment = order.getFulfillmentStatus();
            return !"SHIPPED".equals(fulfillment) && !"DELIVERED".equals(fulfillment);
        }
        return false;
    }
}
