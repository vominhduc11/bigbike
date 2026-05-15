package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.order.dto.OrderPaymentResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import org.mapstruct.Mapper;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface PaymentMapper {

    OrderPaymentResponse toResponse(PaymentEntity entity);
}
