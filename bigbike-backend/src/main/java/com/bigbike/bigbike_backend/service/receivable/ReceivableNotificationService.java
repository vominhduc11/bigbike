package com.bigbike.bigbike_backend.service.receivable;

import com.bigbike.bigbike_backend.persistence.entity.commerce.receivable.ReceivableEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.receivable.ReceivableJpaRepository;
import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;

/**
 * Sends admin email digest for overdue receivables.
 * Called by ReceivableOverdueScheduler after each daily run.
 */
@Service
public class ReceivableNotificationService {

    private static final Logger log = LoggerFactory.getLogger(ReceivableNotificationService.class);

    private final ReceivableJpaRepository receivableRepo;
    private final EmailDispatchService emailDispatch;
    private final String adminEmail;

    public ReceivableNotificationService(
            ReceivableJpaRepository receivableRepo,
            EmailDispatchService emailDispatch,
            @Value("${bigbike.mail.admin:info@bigbike.vn}") String adminEmail) {
        this.receivableRepo = receivableRepo;
        this.emailDispatch = emailDispatch;
        this.adminEmail = adminEmail;
    }

    /** Sends an overdue-receivables digest to the admin email. No-op if there are no overdue records. */
    public void sendOverdueDigestIfAny() {
        List<ReceivableEntity> overdue = receivableRepo.findByStatus("OVERDUE");
        if (overdue.isEmpty()) {
            log.info("ReceivableNotificationService: no overdue receivables — digest skipped.");
            return;
        }

        LocalDate today = LocalDate.now();
        BigDecimal totalOutstanding = overdue.stream()
                .map(ReceivableEntity::getOutstandingAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(0, RoundingMode.HALF_UP);

        List<OverdueRow> rows = overdue.stream()
                .map(ar -> new OverdueRow(
                        ar.getCustomerName() != null ? ar.getCustomerName() : "(không tên)",
                        ar.getCustomerPhone() != null ? ar.getCustomerPhone() : "",
                        ar.getOutstandingAmount().setScale(0, RoundingMode.HALF_UP),
                        ar.getDueDate(),
                        ar.getDueDate() != null ? ChronoUnit.DAYS.between(ar.getDueDate(), today) : 0L
                ))
                .sorted((a, b) -> Long.compare(b.daysOverdue(), a.daysOverdue()))
                .toList();

        Context ctx = new Context();
        ctx.setVariable("rows", rows);
        ctx.setVariable("totalOutstanding", totalOutstanding);
        ctx.setVariable("count", overdue.size());
        ctx.setVariable("reportDate", today.toString());

        String subject = String.format("[BigBike] %d công nợ quá hạn — %s", overdue.size(), today);
        emailDispatch.send(adminEmail, subject, "overdue-receivables", ctx);
        log.info("ReceivableNotificationService: overdue digest sent to {} ({} items, total {})",
                adminEmail, overdue.size(), totalOutstanding);
    }

    public record OverdueRow(
            String customerName,
            String customerPhone,
            BigDecimal outstandingAmount,
            LocalDate dueDate,
            long daysOverdue
    ) {}
}
