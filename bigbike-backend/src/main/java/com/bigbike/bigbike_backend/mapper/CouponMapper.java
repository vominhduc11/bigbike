package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.coupon.AdminCouponDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.coupon.AdminCouponListItemResponse;
import com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface CouponMapper {

    @Mapping(target = "minimumAmount", source = "minAmount")
    @Mapping(target = "maximumAmount", source = "maxAmount")
    AdminCouponListItemResponse toListItem(CouponEntity entity);

    @Mapping(target = "minimumAmount", source = "minAmount")
    @Mapping(target = "maximumAmount", source = "maxAmount")
    AdminCouponDetailResponse toDetail(CouponEntity entity);
}
