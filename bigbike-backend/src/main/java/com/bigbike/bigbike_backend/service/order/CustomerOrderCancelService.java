package com.bigbike.bigbike_backend.service.order;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.order.dto.OrderDetailResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.service.inventory.OrderStockRestoreService;
import com.bigbike.bigbike_backend.service.inventory.SerialLifecycleService;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerOrderCancelService {

    private final OrderJpaRepository orderRepo;
    private final OrderReadService orderReadService;
    private final SerialLifecycleService serialLifecycleService;
    private final OrderStockRestoreService orderStockRestoreService;

    public CustomerOrderCancelService(
            OrderJpaRepository orderRepo,
            OrderReadService orderReadService,
            SerialLifecycleService serialLifecycleService,
            OrderStockRestoreService orderStockRestoreService
    ) {
        this.orderRepo = orderRepo;
        this.orderReadService = orderReadService;
        this.serialLifecycleService = serialLifecycleService;
        this.orderStockRestoreService = orderStockRestoreService;
    }

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
        order.setStatus("CANCELLED");
        order.setCancelledAt(now);
        order.setUpdatedAt(now);

        if ("DELIVERY".equalsIgnoreCase(order.getFulfillmentType())) {
            order.setFulfillmentStatus("CANCELLED");
        }

        orderRepo.save(order);

        serialLifecycleService.releaseReservationForOrder(orderId, "ORDER_CANCELLED_BY_CUSTOMER");
        orderStockRestoreService.restoreForCancel(orderId);

        return orderReadService.getCustomerOrderDetail(customerId, orderId);
    }

    /**
     * Customer may cancel their own order only when no money has been collected
     * and the goods have not left the warehouse:
     *   • PENDING                          — legacy / not yet confirmed
     *   • ON_HOLD                          — BACS placed, transfer not received
     *   • PROCESSING + not yet SHIPPED/DELIVERED — COD or BACS confirmed but still
     *                                            packable / cancellable in-house
     * In every case paymentStatus must be UNPAID. Once payment is captured (PAID),
     * customers must request a refund via admin so the financial flow goes through RefundService.
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
