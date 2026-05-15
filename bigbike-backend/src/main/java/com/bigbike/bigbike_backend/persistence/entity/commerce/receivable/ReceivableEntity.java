package com.bigbike.bigbike_backend.persistence.entity.commerce.receivable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "accounts_receivable")
public class ReceivableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "customer_id")
    private UUID customerId;

    @Column(name = "customer_name", length = 255)
    private String customerName;

    @Column(name = "customer_phone", length = 50)
    private String customerPhone;

    @Column(name = "original_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal originalAmount;

    @Column(name = "paid_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Column(name = "outstanding_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal outstandingAmount;

    @Column(name = "written_off_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal writtenOffAmount = BigDecimal.ZERO;

    /** OPEN | PARTIALLY_PAID | OVERDUE | CLOSED | WRITTEN_OFF */
    @Column(nullable = false, length = 50)
    private String status = "OPEN";

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "payment_terms_days")
    private Integer paymentTermsDays;

    @Column(name = "credit_limit_snapshot", precision = 19, scale = 2)
    private BigDecimal creditLimitSnapshot;

    /** POS | ADMIN_ORDER | MIGRATION */
    @Column(name = "created_from", nullable = false, length = 50)
    private String createdFrom = "ADMIN_ORDER";

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "write_off_reason", columnDefinition = "text")
    private String writeOffReason;

    @Column(name = "written_off_at")
    private Instant writtenOffAt;

    @Column(name = "created_by_admin_id")
    private UUID createdByAdminId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private Long version;
}
