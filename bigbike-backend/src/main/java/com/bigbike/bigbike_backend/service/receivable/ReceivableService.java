package com.bigbike.bigbike_backend.service.receivable;

import com.bigbike.bigbike_backend.api.admin.dto.receivable.RecordReceivablePaymentRequest;
import com.bigbike.bigbike_backend.api.admin.dto.receivable.ReceivableDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.receivable.WriteOffReceivableRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.receivable.ReceivableEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.payment.PaymentJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.receivable.ReceivableJpaRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReceivableService {

    private final ReceivableJpaRepository receivableRepo;
    private final OrderJpaRepository orderRepo;
    private final PaymentJpaRepository paymentRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final ReceivableQueryService queryService;

    public ReceivableService(
            ReceivableJpaRepository receivableRepo,
            OrderJpaRepository orderRepo,
            PaymentJpaRepository paymentRepo,
            AuditLogJpaRepository auditLogRepo,
            ReceivableQueryService queryService
    ) {
        this.receivableRepo = receivableRepo;
        this.orderRepo = orderRepo;
        this.paymentRepo = paymentRepo;
        this.auditLogRepo = auditLogRepo;
        this.queryService = queryService;
    }

    /**
     * Creates a receivable record for a credit order.
     * Called from PosOrderService or AdminOrderService when paymentMethod=CREDIT.
     */
    @Transactional
    public ReceivableEntity createReceivableForOrder(
            OrderEntity order,
            CustomerEntity customer,
            BigDecimal downPayment,
            String createdFrom,
            UUID createdByAdminId
    ) {
        if (receivableRepo.findByOrderId(order.getId()).isPresent()) {
            throw new ConflictException("Order đã có công nợ: " + order.getId());
        }

        Instant now = Instant.now();
        BigDecimal outstanding = order.getTotalAmount().subtract(downPayment != null ? downPayment : BigDecimal.ZERO);

        ReceivableEntity ar = new ReceivableEntity();
        ar.setOrderId(order.getId());
        ar.setCustomerId(customer != null ? customer.getId() : null);
        ar.setCustomerName(order.getCustomerName());
        ar.setCustomerPhone(order.getCustomerPhone());
        ar.setOriginalAmount(order.getTotalAmount());
        ar.setPaidAmount(downPayment != null ? downPayment.setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        ar.setOutstandingAmount(outstanding.setScale(2, RoundingMode.HALF_UP));
        ar.setWrittenOffAmount(BigDecimal.ZERO);
        ar.setStatus("OPEN");
        ar.setCreatedFrom(createdFrom);
        ar.setCreatedByAdminId(createdByAdminId);

        if (customer != null && customer.getPaymentTermsDays() != null) {
            ar.setPaymentTermsDays(customer.getPaymentTermsDays());
            ar.setDueDate(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(customer.getPaymentTermsDays()));
            ar.setCreditLimitSnapshot(customer.getCreditLimit());
        }

        ar.setCreatedAt(now);
        ar.setUpdatedAt(now);
        return receivableRepo.save(ar);
    }

    /**
     * Records a payment against an open receivable.
     * Updates both the receivable and the parent order's paidAmount/paymentStatus.
     */
    @Transactional
    public ReceivableDetailResponse recordPayment(
            UUID receivableId,
            RecordReceivablePaymentRequest req,
            UUID adminId
    ) {
        return recordPayment(receivableId, req, adminId, null, null);
    }

    @Transactional
    public ReceivableDetailResponse recordPayment(
            UUID receivableId,
            RecordReceivablePaymentRequest req,
            UUID adminId,
            String clientIp,
            String userAgent
    ) {
        ReceivableEntity ar = receivableRepo.findById(receivableId)
                .orElseThrow(() -> new NotFoundException("Công nợ không tồn tại: " + receivableId));

        if ("CLOSED".equals(ar.getStatus()) || "WRITTEN_OFF".equals(ar.getStatus())) {
            throw new ConflictException("Không thể ghi nhận thanh toán cho công nợ có trạng thái: " + ar.getStatus());
        }

        BigDecimal amount = req.amount().setScale(2, RoundingMode.HALF_UP);
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw ValidationException.fromField("amount", "INVALID", "Số tiền thanh toán phải lớn hơn 0.");
        }
        if (amount.compareTo(ar.getOutstandingAmount()) > 0) {
            throw new ConflictException(String.format(
                    "Số tiền thu (%,.0f) vượt quá số còn nợ (%,.0f).",
                    amount, ar.getOutstandingAmount()));
        }

        Instant now = Instant.now();
        OrderEntity order = orderRepo.findById(ar.getOrderId())
                .orElseThrow(() -> new NotFoundException("Order không tồn tại: " + ar.getOrderId()));

        // Update receivable amounts
        ar.setPaidAmount(ar.getPaidAmount().add(amount));
        ar.setOutstandingAmount(ar.getOutstandingAmount().subtract(amount));
        ar.setUpdatedAt(now);

        // Determine new status
        if (ar.getOutstandingAmount().compareTo(BigDecimal.ZERO) <= 0) {
            ar.setStatus("CLOSED");
        } else if (ar.getPaidAmount().compareTo(BigDecimal.ZERO) > 0) {
            ar.setStatus("PARTIALLY_PAID");
        }

        // Update order paid amount and payment status — only flip to PAID when fully settled
        BigDecimal newOrderPaid = order.getPaidAmount().add(amount);
        order.setPaidAmount(newOrderPaid);
        BigDecimal net = order.getTotalAmount().subtract(
                order.getRefundAmount() != null ? order.getRefundAmount() : BigDecimal.ZERO);
        if (newOrderPaid.compareTo(net) >= 0) {
            order.setPaymentStatus("PAID");
            order.setPaidAt(now);
        }
        order.setUpdatedAt(now);
        orderRepo.save(order);

        // Create payment record
        PaymentEntity payment = new PaymentEntity();
        payment.setOrder(order);
        payment.setPaymentMethod(req.paymentMethod());
        payment.setProvider("ADMIN_RECEIVABLE");
        payment.setStatus("PAID");
        payment.setAmount(amount);
        payment.setCurrency("VND");
        payment.setTransactionId(req.referenceNumber());
        payment.setPaidAt(now);
        payment.setCreatedAt(now);
        payment.setUpdatedAt(now);
        if (req.note() != null && !req.note().isBlank()) {
            payment.setMetadata("{\"note\":\"" + req.note().replace("\"", "'") + "\"}");
        }
        paymentRepo.save(payment);

        // Audit log
        auditLog("RECEIVABLE_PAYMENT_RECORDED",
                "RECEIVABLE", ar.getId(), adminId,
                String.format("{\"receivableId\":\"%s\",\"amount\":%s,\"paymentMethod\":\"%s\",\"remaining\":%s}",
                        ar.getId(), amount.setScale(0, RoundingMode.HALF_UP),
                        req.paymentMethod(), ar.getOutstandingAmount().setScale(0, RoundingMode.HALF_UP)),
                clientIp, userAgent);

        receivableRepo.save(ar);
        return queryService.toDetail(ar, order.getOrderNumber());
    }

    /**
     * Writes off the outstanding balance.
     * Requires receivables.write_off permission (enforced at controller layer).
     */
    @Transactional
    public ReceivableDetailResponse writeOff(UUID receivableId, WriteOffReceivableRequest req, UUID adminId) {
        return writeOff(receivableId, req, adminId, null, null);
    }

    @Transactional
    public ReceivableDetailResponse writeOff(UUID receivableId, WriteOffReceivableRequest req, UUID adminId,
                                             String clientIp, String userAgent) {
        ReceivableEntity ar = receivableRepo.findById(receivableId)
                .orElseThrow(() -> new NotFoundException("Công nợ không tồn tại: " + receivableId));

        if ("CLOSED".equals(ar.getStatus()) || "WRITTEN_OFF".equals(ar.getStatus())) {
            throw new ConflictException("Công nợ đã ở trạng thái: " + ar.getStatus());
        }

        Instant now = Instant.now();
        ar.setWrittenOffAmount(ar.getOutstandingAmount());
        ar.setOutstandingAmount(BigDecimal.ZERO);
        ar.setStatus("WRITTEN_OFF");
        ar.setWriteOffReason(req.reason());
        ar.setWrittenOffAt(now);
        ar.setUpdatedAt(now);
        receivableRepo.save(ar);

        // Update order paymentStatus to WRITTEN_OFF (POSREC-006)
        OrderEntity order = orderRepo.findById(ar.getOrderId()).orElse(null);
        String orderNumber = null;
        if (order != null) {
            orderNumber = order.getOrderNumber();
            order.setPaymentStatus("WRITTEN_OFF");
            order.setUpdatedAt(now);
            orderRepo.save(order);
        }

        auditLog("RECEIVABLE_WRITTEN_OFF",
                "RECEIVABLE", ar.getId(), adminId,
                String.format("{\"receivableId\":\"%s\",\"reason\":\"%s\",\"writtenOffAmount\":%s}",
                        ar.getId(), req.reason().replace("\"", "'"),
                        ar.getWrittenOffAmount().setScale(0, RoundingMode.HALF_UP)),
                clientIp, userAgent);

        return queryService.toDetail(ar, orderNumber);
    }

    /**
     * Refreshes overdue status for all OPEN/PARTIALLY_PAID receivables past their due date.
     * Intended to be called by a scheduled task (or manually).
     * AR_RULE_008: Overdue receivables are flagged by scheduler.
     */
    @Transactional
    public int refreshOverdueStatus() {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        List<ReceivableEntity> candidates = receivableRepo.findOverdueCandidates(today);
        for (ReceivableEntity ar : candidates) {
            ar.setStatus("OVERDUE");
            ar.setUpdatedAt(Instant.now());
            receivableRepo.save(ar);
        }
        return candidates.size();
    }

    private void auditLog(String action, String resourceType, UUID resourceId, UUID adminId, String afterData) {
        auditLog(action, resourceType, resourceId, adminId, afterData, null, null);
    }

    private void auditLog(String action, String resourceType, UUID resourceId, UUID adminId, String afterData,
                          String clientIp, String userAgent) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(adminId);
        log.setAction(action);
        log.setResourceType(resourceType);
        log.setResourceId(resourceId);
        log.setAfterData(afterData);
        if (clientIp != null) log.setIpAddress(clientIp);
        if (userAgent != null) log.setUserAgent(userAgent);
        log.setCreatedAt(Instant.now());
        auditLogRepo.save(log);
    }
}
