package com.bigbike.bigbike_backend.api.order;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.UnauthorizedException;
import com.bigbike.bigbike_backend.api.order.dto.OrderDetailResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderListItemResponse;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.service.order.CustomerOrderCancelService;
import com.bigbike.bigbike_backend.service.order.OrderReadService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/v1/customer/orders")
@RequiredArgsConstructor
public class CustomerOrderController {

    private final OrderReadService orderReadService;
    private final CustomerOrderCancelService customerOrderCancelService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiListResponse<OrderListItemResponse> listOrders(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) @Size(max = 32) String status,
            @RequestParam(required = false) @Size(max = 32) String paymentStatus,
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

    @PatchMapping("/{orderId}/cancel")
    public ApiDataResponse<OrderDetailResponse> cancelOrder(
            @PathVariable UUID orderId,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(
                customerOrderCancelService.cancel(requireCustomerId(), orderId),
                request
        );
    }

    private UUID requireCustomerId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomerPrincipal cp) {
            return cp.customerId();
        }
        throw new UnauthorizedException("Customer authentication required.");
    }
}
