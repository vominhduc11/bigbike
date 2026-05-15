package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.receivable.ReceivableAgingResponse;
import com.bigbike.bigbike_backend.api.admin.dto.receivable.ReceivableDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.receivable.ReceivableListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.receivable.ReceivableSummaryResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.receivable.ReceivableEntity;
import java.math.BigDecimal;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface ReceivableMapper {

    @Mapping(target = "orderNumber", source = "orderNumber")
    @Mapping(target = "overdueDays", source = "overdueDays")
    ReceivableListItemResponse toListItemResponse(
            ReceivableEntity entity,
            String orderNumber,
            Integer overdueDays
    );

    @Mapping(target = "orderNumber", source = "orderNumber")
    @Mapping(target = "overdueDays", source = "overdueDays")
    ReceivableDetailResponse toDetailResponse(
            ReceivableEntity entity,
            String orderNumber,
            Integer overdueDays
    );

    ReceivableSummaryResponse toSummaryResponse(
            BigDecimal totalOutstanding,
            BigDecimal overdueOutstanding,
            BigDecimal writtenOffTotal,
            long countOpen,
            long countOverdue
    );

    ReceivableAgingResponse toAgingResponse(
            BigDecimal notDue,
            BigDecimal days0To30,
            BigDecimal days31To60,
            BigDecimal days61To90,
            BigDecimal over90
    );
}
