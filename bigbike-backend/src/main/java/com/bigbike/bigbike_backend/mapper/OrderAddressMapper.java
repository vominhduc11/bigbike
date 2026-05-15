package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.order.dto.OrderAddressResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAddressEntity;
import org.mapstruct.Mapper;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface OrderAddressMapper {

    OrderAddressResponse toResponse(OrderAddressEntity entity);
}
