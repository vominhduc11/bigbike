package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerOrderSummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerOrderSummaryResponse.LatestOrder;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface CustomerMapper {

    @Mapping(target = "orderCount", source = "orderCount")
    @Mapping(target = "totalSpent", source = "totalSpent")
    @Mapping(target = "isSynthetic", source = "entity.synthetic")
    AdminCustomerListItemResponse toListItem(
            CustomerEntity entity,
            int orderCount,
            BigDecimal totalSpent
    );

    @Mapping(target = "addresses", source = "addresses")
    @Mapping(target = "orderSummary", source = "orderSummary")
    @Mapping(target = "isSynthetic", source = "entity.synthetic")
    AdminCustomerDetailResponse toDetail(
            CustomerEntity entity,
            List<com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerAddressResponse> addresses,
            AdminCustomerOrderSummaryResponse orderSummary
    );

    LatestOrder toLatestOrder(OrderEntity entity);

    @Mapping(target = "latestOrders", source = "latestOrders")
    AdminCustomerOrderSummaryResponse toOrderSummary(
            int orderCount,
            BigDecimal totalSpent,
            BigDecimal avgOrderValue,
            String segment,
            Instant firstOrderAt,
            Instant lastOrderAt,
            List<LatestOrder> latestOrders
    );
}
