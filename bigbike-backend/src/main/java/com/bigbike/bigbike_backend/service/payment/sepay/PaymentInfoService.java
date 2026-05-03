package com.bigbike.bigbike_backend.service.payment.sepay;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class PaymentInfoService {

    private final OrderJpaRepository orderRepo;
    private final SepayRuntimeSettingsResolver settingsResolver;
    private final SepayQrService qrService;

    public PaymentInfoService(
            OrderJpaRepository orderRepo,
            SepayRuntimeSettingsResolver settingsResolver,
            SepayQrService qrService
    ) {
        this.orderRepo = orderRepo;
        this.settingsResolver = settingsResolver;
        this.qrService = qrService;
    }

    public record PaymentInfoResponse(
            UUID orderId,
            String orderNumber,
            String status,
            String paymentStatus,
            long amountVnd,
            String transferContent,
            String bankName,
            String accountNumber,
            String accountHolder,
            String qrVietQrUrl,
            String expiresAt
    ) {}

    public record PaymentStatusResponse(
            UUID orderId,
            String orderNumber,
            String status,
            String paymentStatus
    ) {}

    public PaymentInfoResponse getPaymentInfo(UUID orderId) {
        OrderEntity order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found: " + orderId));

        var settings = settingsResolver.get();
        long amountVnd = order.getTotalAmount().longValue();
        String content = order.getOrderNumber();

        String vietQrUrl = settings.bankBin().isBlank() ? null :
                qrService.buildVietQrUrl(settings.bankBin(), settings.accountNumber(),
                        settings.accountHolder(), amountVnd, content);

        return new PaymentInfoResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getStatus(),
                order.getPaymentStatus(),
                amountVnd,
                content,
                settings.bankName(),
                settings.accountNumber(),
                settings.accountHolder(),
                vietQrUrl,
                order.getPendingPaymentExpiresAt() != null ? order.getPendingPaymentExpiresAt().toString() : null
        );
    }

    public PaymentStatusResponse getPaymentStatus(UUID orderId) {
        OrderEntity order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found: " + orderId));
        return new PaymentStatusResponse(
                order.getId(), order.getOrderNumber(), order.getStatus(), order.getPaymentStatus());
    }
}
