package com.bigbike.bigbike_backend.api.checkout;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.payment.sepay.PaymentInfoService;
import com.bigbike.bigbike_backend.service.payment.sepay.PaymentInfoService.PaymentInfoResponse;
import com.bigbike.bigbike_backend.service.payment.sepay.PaymentInfoService.PaymentStatusResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/checkout")
public class CheckoutPaymentController {

    private final PaymentInfoService paymentInfoService;
    private final ApiResponseFactory apiResponseFactory;

    public CheckoutPaymentController(
            PaymentInfoService paymentInfoService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.paymentInfoService = paymentInfoService;
        this.apiResponseFactory = apiResponseFactory;
    }

    /** Trả về thông tin ngân hàng + URL QR cho trang chờ thanh toán. Public — dùng orderId, không cần JWT. */
    @GetMapping("/{orderId}/payment-info")
    public ApiDataResponse<PaymentInfoResponse> getPaymentInfo(
            @PathVariable UUID orderId,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(paymentInfoService.getPaymentInfo(orderId), request);
    }

    /** Polling: FE gọi mỗi 8s để biết khi nào paymentStatus = PAID. */
    @GetMapping("/{orderId}/payment-status")
    public ApiDataResponse<PaymentStatusResponse> getPaymentStatus(
            @PathVariable UUID orderId,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(paymentInfoService.getPaymentStatus(orderId), request);
    }
}
