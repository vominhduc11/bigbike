package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.order.dto.OrderPaymentResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface PaymentMapper {

    @Mapping(
            target = "status",
            expression = "java(entity.getStatus() == null ? null : entity.getStatus().name())"
    )
    OrderPaymentResponse toResponse(PaymentEntity entity);
}
