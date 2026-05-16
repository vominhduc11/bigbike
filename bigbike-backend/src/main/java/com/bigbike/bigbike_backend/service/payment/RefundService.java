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
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.RefundTransactionEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.RefundTransactionJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.receivable.ReceivableJpaRepository;
import com.bigbike.bigbike_backend.service.checkout.OrderNotificationService;
import com.bigbike.bigbike_backend.service.inventory.OrderStockRestoreService;
import com.bigbike.bigbike_backend.service.inventory.SerialLifecycleService;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.service.ws.AdminOrderWsService;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single, authoritative implementation of the refund flow.
 * Both AdminOrderService and AdminReturnService delegate here to keep behaviour consistent.
 */
@Service
@Slf4j
public class RefundService {

    private final OrderJpaRepository orderRepo;
    private final PaymentJpaRepository paymentRepo;
    private final OrderNoteJpaRepository noteRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final OrderNotificationService orderNotificationService;
    private final AdminOrderWsService adminOrderWsService;
    private final OrderStockRestoreService orderStockRestoreService;
    private final SerialLifecycleService serialLifecycleService;
    private final ReceivableJpaRepository receivableRepo;
    private final RefundTransactionJpaRepository refundTransactionRepo;
    private final WebRevalidationService webRevalidationService;

    public RefundService(
            OrderJpaRepository orderRepo,
            PaymentJpaRepository paymentRepo,
            OrderNoteJpaRepository noteRepo,
            AuditLogJpaRepository auditLogRepo,
            OrderNotificationService orderNotificationService,
            AdminOrderWsService adminOrderWsService,
            OrderStockRestoreService orderStockRestoreService,
            SerialLifecycleService serialLifecycleService,
            ReceivableJpaRepository receivableRepo,
            RefundTransactionJpaRepository refundTransactionRepo,
            WebRevalidationService webRevalidationService) {
        this.orderRepo = orderRepo;
        this.paymentRepo = paymentRepo;
        this.noteRepo = noteRepo;
        this.auditLogRepo = auditLogRepo;
        this.orderNotificationService = orderNotificationService;
        this.adminOrderWsService = adminOrderWsService;
        this.orderStockRestoreService = orderStockRestoreService;
        this.serialLifecycleService = serialLifecycleService;
        this.receivableRepo = receivableRepo;
        this.refundTransactionRepo = refundTransactionRepo;
        this.webRevalidationService = webRevalidationService;
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
        if (!"PAID".equals(paymentStatus)) {
            throw new ConflictException(
                    "Refund requires payment status PAID. Current: " + paymentStatus);
        }

        BigDecimal scaled = refundAmount.setScale(2, RoundingMode.HALF_UP);
        BigDecimal alreadyRefunded = order.getRefundAmount() != null
                ? order.getRefundAmount() : BigDecimal.ZERO;
        BigDecimal maxRefundable = order.getPaidAmount().subtract(alreadyRefunded);

        if (scaled.compareTo(BigDecimal.ZERO) <= 0) {
            throw ValidationException.fromField("refundAmount", "INVALID", "refundAmount must be > 0.");
        }
        // Partial refunds are not supported — must refund the full remaining paid amount.
        if (scaled.compareTo(maxRefundable) != 0) {
            throw ValidationException.fromField("refundAmount", "INVALID",
                    "refundAmount must equal the full refundable amount (" + maxRefundable
                            + "). Partial refunds are not supported.");
        }

        Instant now = Instant.now();
        BigDecimal newTotalRefunded = alreadyRefunded.add(scaled);

        order.setRefundAmount(newTotalRefunded);
        if (refundReason != null && !refundReason.isBlank()) {
            order.setRefundReason(refundReason);
        }
        order.setRefundedAt(now);

        String orderStatusBeforeRefund = order.getStatus();
        boolean wasCompleted = "COMPLETED".equals(orderStatusBeforeRefund);
        // Active order: PENDING/ON_HOLD/PROCESSING — stock/serials were already
        // touched at checkout (non-serial qty decremented, serial RESERVED) but
        // markSoldForOrder was never called, so serials are RESERVED not SOLD.
        boolean wasActive = Set.of("PENDING", "ON_HOLD", "PROCESSING").contains(orderStatusBeforeRefund);
        order.setPaymentStatus("REFUNDED");
        // Flip order status to REFUNDED for any non-terminal or completed order.
        // Active orders (PROCESSING, ON_HOLD, PENDING) left with paymentStatus=REFUNDED
        // but order.status still active would be stuck — no further transition is valid.
        Set<String> nonRefundableTerminals = Set.of("CANCELLED", "FAILED", "REFUNDED");
        if (!nonRefundableTerminals.contains(order.getStatus())) {
            // Covers PENDING, ON_HOLD, PROCESSING (active) and COMPLETED
            order.setStatus("REFUNDED");
        }
        order.setUpdatedAt(now);
        orderRepo.save(order);

        if (wasCompleted) {
            // COMPLETED: serials are SOLD, non-serial stock was decremented.
            orderStockRestoreService.restoreForRefund(orderId);
            serialLifecycleService.restoreSoldSerialsForRefund(orderId, adminId);
            webRevalidationService.revalidateProductsForOrder(orderId);
        } else if (wasActive) {
            // ACTIVE (PENDING/ON_HOLD/PROCESSING): non-serial stock was decremented at checkout.
            // Serial-tracked items are RESERVED (not SOLD) — release the reservation back to IN_STOCK.
            orderStockRestoreService.restoreForRefund(orderId);
            serialLifecycleService.releaseReservationForOrder(orderId, "ORDER_REFUNDED");
            webRevalidationService.revalidateProductsForOrder(orderId);
        }

        // Cancel outstanding receivable when the order is refunded.
        // Avoids leaving a ghost debt on a returned credit-sale order.
        receivableRepo.findByOrderId(orderId).ifPresent(ar -> {
            if (!"CLOSED".equals(ar.getStatus()) && !"WRITTEN_OFF".equals(ar.getStatus())) {
                ar.setWrittenOffAmount(ar.getOutstandingAmount());
                ar.setOutstandingAmount(BigDecimal.ZERO);
                ar.setStatus("WRITTEN_OFF");
                ar.setWriteOffReason("ORDER_REFUNDED");
                ar.setWrittenOffAt(now);
                ar.setUpdatedAt(now);
                receivableRepo.save(ar);
            }
        });

        UUID resolvedPaymentId = paymentRepo.findByOrderId(orderId).stream().findFirst().map(p -> {
            p.setRefundAmount(newTotalRefunded);
            p.setRefundedAt(now);
            p.setStatus("REFUNDED");
            p.setUpdatedAt(now);
            paymentRepo.save(p);
            return p.getId();
        }).orElse(null);

        RefundTransactionEntity tx = new RefundTransactionEntity();
        tx.setOrder(order);
        tx.setPaymentId(resolvedPaymentId);
        tx.setAmount(scaled);
        tx.setReason(refundReason);
        tx.setNote((noteContent != null && !noteContent.isBlank()) ? noteContent : null);
        tx.setAdminId(adminId);
        tx.setIpAddress(clientIp);
        tx.setUserAgent(userAgent);
        tx.setCreatedAt(now);
        refundTransactionRepo.save(tx);

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

        try {
            orderNotificationService.sendOrderStatusUpdate(order, "REFUNDED", null);
        } catch (Exception e) {
            log.warn("Refund notification failed for order {}: {}",
                    order.getOrderNumber(), e.getMessage());
        }

        String customerName = order.getCustomerEmail() != null && !order.getCustomerEmail().isBlank()
                ? order.getCustomerEmail() : order.getCustomerPhone();
        adminOrderWsService.pushEvent(new OrderWsEvent(
                "ORDER_REFUND_CREATED", order.getId(), order.getOrderNumber(),
                customerName, order.getTotalAmount(),
                order.getStatus(), order.getPaymentStatus(), now));
    }
}
