package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.order.dto.OrderLineItemResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import org.mapstruct.Mapper;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface OrderItemMapper {

    OrderLineItemResponse toResponse(OrderLineItemEntity entity);
}
