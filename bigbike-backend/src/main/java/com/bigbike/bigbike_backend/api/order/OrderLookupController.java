package com.bigbike.bigbike_backend.api.order;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.api.order.dto.OrderDetailResponse;
import com.bigbike.bigbike_backend.service.order.OrderReadService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderLookupController {

    private final OrderReadService orderReadService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/lookup")
    public ApiDataResponse<OrderDetailResponse> lookup(
            @RequestParam(required = false) String orderNumber,
            @RequestParam(required = false) String orderKey,
            HttpServletRequest request
    ) {
        if (orderNumber == null || orderNumber.isBlank()) {
            throw ValidationException.fromField("orderNumber", "REQUIRED", "orderNumber is required.");
        }
        if (orderKey == null || orderKey.isBlank()) {
            throw ValidationException.fromField("orderKey", "REQUIRED", "orderKey is required.");
        }
        return apiResponseFactory.data(
                orderReadService.guestLookup(orderNumber, orderKey),
                request
        );
    }
}
