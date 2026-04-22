package com.bigbike.bigbike_backend.api.order;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.order.dto.OrderDetailResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderListItemResponse;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.service.order.OrderReadService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/customer/orders")
public class CustomerOrderController {

    private final OrderReadService orderReadService;
    private final ApiResponseFactory apiResponseFactory;

    public CustomerOrderController(OrderReadService orderReadService, ApiResponseFactory apiResponseFactory) {
        this.orderReadService = orderReadService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping
    public ApiListResponse<OrderListItemResponse> listOrders(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String paymentStatus,
            HttpServletRequest request
    ) {
        UUID customerId = requireCustomerId();
        return apiResponseFactory.list(
                orderReadService.listCustomerOrders(customerId, page, size, status, paymentStatus),
                request
        );
    }

    @GetMapping("/{orderId}")
    public ApiDataResponse<OrderDetailResponse> getOrderDetail(
            @PathVariable UUID orderId,
            HttpServletRequest request
    ) {
        UUID customerId = requireCustomerId();
        return apiResponseFactory.data(
                orderReadService.getCustomerOrderDetail(customerId, orderId),
                request
        );
    }

    private UUID requireCustomerId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomerPrincipal cp) {
            return cp.customerId();
        }
        throw new IllegalStateException("Customer authentication required but not found.");
    }
}
