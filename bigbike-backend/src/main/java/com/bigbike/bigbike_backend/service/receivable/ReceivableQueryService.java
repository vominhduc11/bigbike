package com.bigbike.bigbike_backend.service.receivable;

import com.bigbike.bigbike_backend.api.admin.dto.receivable.ReceivableAgingResponse;
import com.bigbike.bigbike_backend.api.admin.dto.receivable.ReceivableDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.receivable.ReceivableListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.receivable.ReceivableSummaryResponse;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.commerce.receivable.ReceivableEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.receivable.ReceivableJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ReceivableQueryService {

    private final ReceivableJpaRepository receivableRepo;
    private final OrderJpaRepository orderRepo;

    public ReceivableQueryService(ReceivableJpaRepository receivableRepo, OrderJpaRepository orderRepo) {
        this.receivableRepo = receivableRepo;
        this.orderRepo = orderRepo;
    }

    public PageResult<ReceivableListItemResponse> listReceivables(
            int page, int size, String status, UUID customerId, String keyword) {
        PageRequest pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<ReceivableEntity> pageResult = receivableRepo.findFiltered(
                "ALL".equals(status) ? null : status,
                customerId,
                keyword != null && keyword.isBlank() ? null : keyword,
                pageable);

        List<ReceivableListItemResponse> items = pageResult.getContent().stream()
                .map(this::toListItem)
                .toList();

        return new PageResult<>(items, page, size,
                (int) pageResult.getTotalElements(), pageResult.getTotalPages());
    }

    public ReceivableDetailResponse getDetail(UUID receivableId) {
        ReceivableEntity ar = receivableRepo.findById(receivableId)
                .orElseThrow(() -> new NotFoundException("Công nợ không tồn tại: " + receivableId));
        String orderNumber = orderRepo.findById(ar.getOrderId())
                .map(o -> o.getOrderNumber()).orElse(null);
        return toDetail(ar, orderNumber);
    }

    public PageResult<ReceivableListItemResponse> listByCustomer(UUID customerId, int page, int size) {
        PageRequest pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<ReceivableEntity> pageResult = receivableRepo.findByCustomerId(customerId, pageable);
        List<ReceivableListItemResponse> items = pageResult.getContent().stream()
                .map(this::toListItem).toList();
        return new PageResult<>(items, page, size,
                (int) pageResult.getTotalElements(), pageResult.getTotalPages());
    }

    public ReceivableSummaryResponse getSummary() {
        BigDecimal totalOutstanding = orZero(receivableRepo.sumTotalOutstanding());
        BigDecimal overdueOutstanding = orZero(receivableRepo.sumOverdueOutstanding());
        long countOpen = receivableRepo.countOpen();
        long countOverdue = receivableRepo.countOverdue();
        BigDecimal writtenOff = orZero(receivableRepo.sumWrittenOff());

        return new ReceivableSummaryResponse(
                totalOutstanding, overdueOutstanding, writtenOff, countOpen, countOverdue);
    }

    public ReceivableAgingResponse getAging() {
        List<Object[]> rows = receivableRepo.findOpenReceivablesForAging();
        LocalDate today = LocalDate.now();
        BigDecimal notDue = BigDecimal.ZERO;
        BigDecimal days0_30 = BigDecimal.ZERO;
        BigDecimal days31_60 = BigDecimal.ZERO;
        BigDecimal days61_90 = BigDecimal.ZERO;
        BigDecimal over90 = BigDecimal.ZERO;

        for (Object[] row : rows) {
            LocalDate dueDate = row[0] instanceof LocalDate d ? d : null;
            BigDecimal amt = toBigDecimal(row[1]);
            if (dueDate == null || !dueDate.isBefore(today)) {
                notDue = notDue.add(amt);
            } else {
                long overdueDays = today.toEpochDay() - dueDate.toEpochDay();
                if (overdueDays <= 30) days0_30 = days0_30.add(amt);
                else if (overdueDays <= 60) days31_60 = days31_60.add(amt);
                else if (overdueDays <= 90) days61_90 = days61_90.add(amt);
                else over90 = over90.add(amt);
            }
        }

        return new ReceivableAgingResponse(notDue, days0_30, days31_60, days61_90, over90);
    }

    // ── Mapping helpers ───────────────────────────────────────────────────────

    public ReceivableDetailResponse toDetail(ReceivableEntity ar, String orderNumber) {
        return new ReceivableDetailResponse(
                ar.getId(), ar.getOrderId(), orderNumber,
                ar.getCustomerId(), ar.getCustomerName(), ar.getCustomerPhone(),
                ar.getOriginalAmount(), ar.getPaidAmount(), ar.getOutstandingAmount(),
                ar.getWrittenOffAmount(), ar.getStatus(),
                ar.getDueDate(), ar.getPaymentTermsDays(),
                computeOverdueDays(ar.getDueDate(), ar.getStatus()),
                ar.getCreditLimitSnapshot(),
                ar.getCreatedFrom(), ar.getNote(),
                ar.getWriteOffReason(), ar.getWrittenOffAt(),
                ar.getCreatedByAdminId(), ar.getCreatedAt(), ar.getUpdatedAt());
    }

    private ReceivableListItemResponse toListItem(ReceivableEntity ar) {
        String orderNumber = orderRepo.findById(ar.getOrderId())
                .map(o -> o.getOrderNumber()).orElse(null);
        return new ReceivableListItemResponse(
                ar.getId(), ar.getOrderId(), orderNumber,
                ar.getCustomerId(), ar.getCustomerName(), ar.getCustomerPhone(),
                ar.getOriginalAmount(), ar.getPaidAmount(), ar.getOutstandingAmount(),
                ar.getStatus(), ar.getDueDate(),
                computeOverdueDays(ar.getDueDate(), ar.getStatus()),
                ar.getCreatedFrom(), ar.getCreatedAt());
    }

    private static Integer computeOverdueDays(LocalDate dueDate, String status) {
        if (dueDate == null || "CLOSED".equals(status) || "WRITTEN_OFF".equals(status)) return null;
        long days = LocalDate.now().toEpochDay() - dueDate.toEpochDay();
        return days > 0 ? (int) days : null;
    }

    private static BigDecimal orZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private static BigDecimal toBigDecimal(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal b) return b;
        if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        return BigDecimal.ZERO;
    }
}
