package com.bigbike.bigbike_backend.service.payment;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderNoteJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.service.checkout.OrderNotificationService;
import com.bigbike.bigbike_backend.service.inventory.OrderStockRestoreService;
import com.bigbike.bigbike_backend.service.ws.AdminOrderWsService;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single, authoritative implementation of the refund flow.
 * Both AdminOrderService and AdminReturnService delegate here to keep behaviour consistent.
 */
@Service
public class RefundService {

    private final OrderJpaRepository orderRepo;
    private final PaymentJpaRepository paymentRepo;
    private final OrderNoteJpaRepository noteRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final OrderNotificationService orderNotificationService;
    private final AdminOrderWsService adminOrderWsService;
    private final OrderStockRestoreService orderStockRestoreService;

    public RefundService(
            OrderJpaRepository orderRepo,
            PaymentJpaRepository paymentRepo,
            OrderNoteJpaRepository noteRepo,
            AuditLogJpaRepository auditLogRepo,
            OrderNotificationService orderNotificationService,
            AdminOrderWsService adminOrderWsService,
            OrderStockRestoreService orderStockRestoreService) {
        this.orderRepo = orderRepo;
        this.paymentRepo = paymentRepo;
        this.noteRepo = noteRepo;
        this.auditLogRepo = auditLogRepo;
        this.orderNotificationService = orderNotificationService;
        this.adminOrderWsService = adminOrderWsService;
        this.orderStockRestoreService = orderStockRestoreService;
    }

    /**
     * Apply a refund to an order. Participates in the caller's transaction.
     *
     * @param orderId          target order
     * @param adminId          acting admin (null if system-initiated)
     * @param refundAmount     amount to refund (must be > 0 and ≤ remaining refundable)
     * @param refundReason     stored on the order; may be null
     * @param noteContent      explicit note text; if null/blank an auto-generated note is used
     * @param customerVisible  whether the order note should be visible to the customer
     */
    @Transactional
    public void applyRefund(
            UUID orderId,
            UUID adminId,
            BigDecimal refundAmount,
            String refundReason,
            String noteContent,
            boolean customerVisible,
            String clientIp,
            String userAgent) {

        OrderEntity order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found."));

        String paymentStatus = order.getPaymentStatus();
        if (!"PAID".equals(paymentStatus) && !"PARTIALLY_PAID".equals(paymentStatus)
                && !"PARTIALLY_REFUNDED".equals(paymentStatus)) {
            throw new ConflictException(
                    "Refund requires payment status PAID, PARTIALLY_PAID, or PARTIALLY_REFUNDED. Current: "
                            + paymentStatus);
        }

        BigDecimal scaled = refundAmount.setScale(2, RoundingMode.HALF_UP);
        BigDecimal alreadyRefunded = order.getRefundAmount() != null
                ? order.getRefundAmount() : BigDecimal.ZERO;
        BigDecimal maxRefundable = order.getPaidAmount().subtract(alreadyRefunded);

        if (scaled.compareTo(BigDecimal.ZERO) <= 0) {
            throw ValidationException.fromField("refundAmount", "INVALID", "refundAmount must be > 0.");
        }
        if (scaled.compareTo(maxRefundable) > 0) {
            throw ValidationException.fromField("refundAmount", "INVALID",
                    "refundAmount (" + scaled + ") exceeds refundable amount (" + maxRefundable + ").");
        }

        Instant now = Instant.now();
        BigDecimal newTotalRefunded = alreadyRefunded.add(scaled);

        order.setRefundAmount(newTotalRefunded);
        if (refundReason != null && !refundReason.isBlank()) {
            order.setRefundReason(refundReason);
        }
        order.setRefundedAt(now);

        boolean fullRefund = newTotalRefunded.compareTo(order.getPaidAmount()) == 0;
        boolean wasCompleted = "COMPLETED".equals(order.getStatus());
        if (fullRefund) {
            order.setPaymentStatus("REFUNDED");
            if (wasCompleted) {
                order.setStatus("REFUNDED");
            }
        } else {
            order.setPaymentStatus("PARTIALLY_REFUNDED");
        }
        order.setUpdatedAt(now);
        orderRepo.save(order);

        if (fullRefund && wasCompleted) {
            orderStockRestoreService.restoreForRefund(orderId);
        }

        paymentRepo.findByOrderId(orderId).stream().findFirst().ifPresent(p -> {
            p.setRefundAmount(newTotalRefunded);
            p.setRefundedAt(now);
            if (fullRefund) p.setStatus("REFUNDED");
            p.setUpdatedAt(now);
            paymentRepo.save(p);
        });

        String resolvedNote = (noteContent != null && !noteContent.isBlank())
                ? noteContent
                : "Hoàn tiền " + scaled + " VND" + (refundReason != null ? " — " + refundReason : "");
        OrderNoteEntity note = new OrderNoteEntity();
        note.setOrder(order);
        note.setAuthorType("ADMIN");
        note.setAuthorId(adminId);
        note.setNoteType("REFUND");
        note.setContent(resolvedNote);
        note.setCustomerVisible(customerVisible);
        note.setCreatedAt(now);
        noteRepo.save(note);

        AuditLogEntity auditLog = new AuditLogEntity();
        auditLog.setActorType("ADMIN");
        auditLog.setActorId(adminId);
        auditLog.setAction("ORDER_REFUND_CREATED");
        auditLog.setResourceType("ORDER");
        auditLog.setResourceId(orderId);
        auditLog.setBeforeData("{\"paymentStatus\":\"" + paymentStatus
                + "\",\"refundAmount\":\"" + alreadyRefunded + "\"}");
        auditLog.setAfterData("{\"paymentStatus\":\"" + order.getPaymentStatus()
                + "\",\"refundAmount\":\"" + newTotalRefunded + "\"}");
        auditLog.setIpAddress(clientIp);
        auditLog.setUserAgent(userAgent);
        auditLog.setCreatedAt(now);
        auditLogRepo.save(auditLog);

        if (fullRefund) {
            try {
                orderNotificationService.sendOrderStatusUpdate(order, "REFUNDED", null);
            } catch (Exception e) {
                LoggerFactory.getLogger(RefundService.class)
                        .warn("Refund notification failed for order {}: {}",
                                order.getOrderNumber(), e.getMessage());
            }
        }

        String customerName = order.getCustomerEmail() != null && !order.getCustomerEmail().isBlank()
                ? order.getCustomerEmail() : order.getCustomerPhone();
        adminOrderWsService.pushEvent(new OrderWsEvent(
                "ORDER_REFUND_CREATED", order.getId(), order.getOrderNumber(),
                customerName, order.getTotalAmount(),
                order.getStatus(), order.getPaymentStatus(), now));
    }
}
