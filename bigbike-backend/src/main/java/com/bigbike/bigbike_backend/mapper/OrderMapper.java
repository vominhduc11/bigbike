package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderListItemResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderAddressResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderDetailResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderLineItemResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderListItemResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderNoteResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderPaymentResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderShippingItemResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface OrderMapper {

    @Mapping(target = "itemCount", source = "itemCount")
    @Mapping(target = "productNames", source = "productNames")
    OrderListItemResponse toCustomerListItem(OrderEntity entity, int itemCount, List<String> productNames);

    @Mapping(target = "itemCount", source = "itemCount")
    AdminOrderListItemResponse toAdminListItem(OrderEntity entity, int itemCount);

    @Mapping(target = "orderKey", source = "orderKey")
    @Mapping(target = "lineItems", source = "lineItems")
    @Mapping(target = "addresses", source = "addresses")
    @Mapping(target = "shippingItems", source = "shippingItems")
    @Mapping(target = "payments", source = "payments")
    @Mapping(target = "notes", source = "notes")
    OrderDetailResponse toDetailResponse(
            OrderEntity entity,
            String orderKey,
            List<OrderLineItemResponse> lineItems,
            List<OrderAddressResponse> addresses,
            List<OrderShippingItemResponse> shippingItems,
            List<OrderPaymentResponse> payments,
            List<OrderNoteResponse> notes
    );
}
