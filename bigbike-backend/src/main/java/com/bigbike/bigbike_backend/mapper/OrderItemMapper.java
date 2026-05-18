package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.order.dto.OrderLineItemResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface OrderItemMapper {

    // productThumbnailUrl is resolved read-time by OrderReadService and passed in.
    @Mapping(target = "productThumbnailUrl", source = "productThumbnailUrl")
    OrderLineItemResponse toResponse(OrderLineItemEntity entity, String productThumbnailUrl);
}
