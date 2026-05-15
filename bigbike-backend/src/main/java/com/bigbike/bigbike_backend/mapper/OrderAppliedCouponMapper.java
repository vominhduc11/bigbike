package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.order.OrderAppliedCouponResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAppliedCouponEntity;
import org.mapstruct.Mapper;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface OrderAppliedCouponMapper {

    OrderAppliedCouponResponse toResponse(OrderAppliedCouponEntity entity);
}
