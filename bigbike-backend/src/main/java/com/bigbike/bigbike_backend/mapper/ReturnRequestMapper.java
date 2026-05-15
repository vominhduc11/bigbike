package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminReturnDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminReturnListItemResponse;
import com.bigbike.bigbike_backend.api.order.dto.CustomerReturnResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnHistoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnItemEntity;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface ReturnRequestMapper {

    CustomerReturnResponse.ReturnItemResponse toCustomerItem(ReturnItemEntity entity);

    CustomerReturnResponse.ReturnHistoryResponse toCustomerHistory(ReturnHistoryEntity entity);

    @Mapping(target = "orderNumber", source = "orderNumber")
    @Mapping(target = "items", source = "items")
    @Mapping(target = "history", source = "history")
    CustomerReturnResponse toCustomerDetail(
            ReturnEntity entity,
            String orderNumber,
            List<CustomerReturnResponse.ReturnItemResponse> items,
            List<CustomerReturnResponse.ReturnHistoryResponse> history
    );

    AdminReturnDetailResponse.ReturnItemResponse toAdminItem(ReturnItemEntity entity);

    AdminReturnDetailResponse.ReturnHistoryResponse toAdminHistory(ReturnHistoryEntity entity);

    @Mapping(target = "orderNumber", source = "orderNumber")
    @Mapping(target = "customerEmail", source = "customerEmail")
    @Mapping(target = "items", source = "items")
    @Mapping(target = "history", source = "history")
    AdminReturnDetailResponse toAdminDetail(
            ReturnEntity entity,
            String orderNumber,
            String customerEmail,
            List<AdminReturnDetailResponse.ReturnItemResponse> items,
            List<AdminReturnDetailResponse.ReturnHistoryResponse> history
    );

    @Mapping(target = "orderNumber", source = "orderNumber")
    @Mapping(target = "customerEmail", source = "customerEmail")
    AdminReturnListItemResponse toAdminListItem(
            ReturnEntity entity,
            String orderNumber,
            String customerEmail
    );
}
