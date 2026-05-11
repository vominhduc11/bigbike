package com.bigbike.bigbike_backend.service.order;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.order.dto.OrderDetailResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.service.inventory.OrderStockRestoreService;
import com.bigbike.bigbike_backend.service.inventory.SerialLifecycleService;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerOrderCancelService {

    private static final Set<String> CANCELLABLE_STATUSES = Set.of("PENDING");

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

        if (!CANCELLABLE_STATUSES.contains(order.getStatus())) {
            throw new ConflictException(
                    "Đơn hàng ở trạng thái " + order.getStatus() + " không thể huỷ. " +
                    "Chỉ có thể huỷ đơn đang chờ xử lý (PENDING)."
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
}
