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
        Object[] agg = receivableRepo.getSummaryAggregates();
        BigDecimal totalOutstanding = agg[0] instanceof BigDecimal b ? b : BigDecimal.ZERO;
        BigDecimal overdueOutstanding = agg[1] instanceof BigDecimal b ? b : BigDecimal.ZERO;
        long countOpen = agg[2] instanceof Number n ? n.longValue() : 0L;
        long countOverdue = agg[3] instanceof Number n ? n.longValue() : 0L;
        BigDecimal writtenOff = receivableRepo.sumWrittenOff();

        return new ReceivableSummaryResponse(
                totalOutstanding, overdueOutstanding,
                writtenOff != null ? writtenOff : BigDecimal.ZERO,
                countOpen, countOverdue);
    }

    public ReceivableAgingResponse getAging() {
        Object[] row = receivableRepo.getAgingBuckets();
        return new ReceivableAgingResponse(
                toBigDecimal(row[0]), toBigDecimal(row[1]),
                toBigDecimal(row[2]), toBigDecimal(row[3]), toBigDecimal(row[4]));
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

    private static BigDecimal toBigDecimal(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal b) return b;
        if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        return BigDecimal.ZERO;
    }
}
