package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.order.dto.OrderShippingItemResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderShippingItemEntity;
import org.mapstruct.Mapper;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface ShippingMapper {

    OrderShippingItemResponse toResponse(OrderShippingItemEntity entity);
}
