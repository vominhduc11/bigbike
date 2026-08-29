package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.api.cart.dto.CartItemResponse;
import com.bigbike.bigbike_backend.api.cart.dto.CartResponse;
import com.bigbike.bigbike_backend.api.cart.dto.CartTotalsResponse;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.mapstruct.Context;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface CartMapper {

    default CartResponse toResponse(CartEntity cart, List<CartItemEntity> items, Set<UUID> unavailableIds) {
        List<CartItemResponse> itemResponses = items.stream()
                .map(item -> toItemResponse(item, unavailableIds))
                .toList();
        return new CartResponse(
                cart.getId(),
                cart.getStatus(),
                cart.getCurrency(),
                itemResponses,
                toTotalsResponse(cart)
        );
    }

    CartTotalsResponse toTotalsResponse(CartEntity cart);

    @Mapping(target = "image", expression = "java(toImageAsset(item))")
    @Mapping(target = "available", expression = "java(!unavailableIds.contains(item.getId()))")
    CartItemResponse toItemResponse(CartItemEntity item, @Context Set<UUID> unavailableIds);

    default ImageAsset toImageAsset(CartItemEntity item) {
        if (item.getProductImageUrl() == null || item.getProductImageUrl().isBlank()) {
            return null;
        }
        return new ImageAsset(
                item.getProductImageId(),
                item.getProductImageUrl(),
                item.getProductImageAlt(),
                item.getProductImageWidth(),
                item.getProductImageHeight(),
                item.getProductImageMimeType()
        );
    }
}
