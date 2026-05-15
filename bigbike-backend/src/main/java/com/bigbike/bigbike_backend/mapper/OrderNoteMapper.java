package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderNoteResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderNoteResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import org.mapstruct.Mapper;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface OrderNoteMapper {

    OrderNoteResponse toCustomerResponse(OrderNoteEntity entity);

    AdminOrderNoteResponse toAdminResponse(OrderNoteEntity entity);
}
