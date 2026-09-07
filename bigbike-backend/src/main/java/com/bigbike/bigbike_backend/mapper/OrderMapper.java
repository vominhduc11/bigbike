package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.OrderHistoryClassificationResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderAddressResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderDetailResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderLineItemResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderListItemResponse;
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
    @Mapping(target = "channel", source = "entity.channel")
    OrderListItemResponse toCustomerListItem(OrderEntity entity, int itemCount, List<String> productNames);

    @Mapping(target = "itemCount", source = "itemCount")
    @Mapping(target = "source", source = "entity.source")
    @Mapping(target = "orderScope", ignore = true)
    @Mapping(target = "historyClassification", ignore = true)
    AdminOrderListItemResponse toAdminListItem(OrderEntity entity, int itemCount);

    @Mapping(target = "customerName", source = "customerName")
    @Mapping(target = "lineItems", source = "lineItems")
    @Mapping(target = "addresses", source = "addresses")
    @Mapping(target = "shippingItems", source = "shippingItems")
    @Mapping(target = "payments", source = "payments")
    @Mapping(target = "historyClassification", source = "classification")
    @Mapping(target = "orderScope", expression = "java(classification == null ? \"OPERATIONAL\" : \"HISTORICAL\")")
    @Mapping(target = "canConfirmBankTransfer", source = "canConfirmBankTransfer")
    AdminOrderDetailResponse toAdminDetailResponse(
            OrderEntity entity, String customerName, List<OrderLineItemResponse> lineItems,
            List<OrderAddressResponse> addresses, List<OrderShippingItemResponse> shippingItems,
            List<OrderPaymentResponse> payments, OrderHistoryClassificationResponse classification,
            boolean canConfirmBankTransfer);

    @Mapping(target = "orderKey", source = "orderKey")
    @Mapping(target = "lineItems", source = "lineItems")
    @Mapping(target = "addresses", source = "addresses")
    @Mapping(target = "shippingItems", source = "shippingItems")
    @Mapping(target = "payments", source = "payments")
    @Mapping(target = "channel", source = "entity.channel")
    OrderDetailResponse toDetailResponse(
            OrderEntity entity,
            String orderKey,
            List<OrderLineItemResponse> lineItems,
            List<OrderAddressResponse> addresses,
            List<OrderShippingItemResponse> shippingItems,
            List<OrderPaymentResponse> payments
    );
}
