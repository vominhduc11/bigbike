package com.bigbike.bigbike_backend.service.cart;

import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class CartCalculator {

    private static final int SCALE = 2;
    private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

    public void recalculateItem(CartItemEntity item) {
        BigDecimal subtotal = item.getUnitPrice()
                .multiply(BigDecimal.valueOf(item.getQuantity()))
                .setScale(SCALE, ROUNDING);
        item.setLineSubtotal(subtotal);
        item.setLineDiscount(BigDecimal.ZERO.setScale(SCALE, ROUNDING));
        item.setLineTotal(subtotal.subtract(item.getLineDiscount()).setScale(SCALE, ROUNDING));
    }

    public void recalculateCart(CartEntity cart, List<CartItemEntity> items) {
        BigDecimal subtotal = items.stream()
                .map(CartItemEntity::getLineSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(SCALE, ROUNDING);
        BigDecimal discount = items.stream()
                .map(CartItemEntity::getLineDiscount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(SCALE, ROUNDING);

        cart.setSubtotalAmount(subtotal);
        cart.setDiscountAmount(discount);
        cart.setShippingAmount(BigDecimal.ZERO.setScale(SCALE, ROUNDING));
        cart.setFeeAmount(BigDecimal.ZERO.setScale(SCALE, ROUNDING));
        cart.setTotalAmount(
                subtotal.subtract(discount)
                        .add(cart.getShippingAmount())
                        .add(cart.getFeeAmount())
                        .setScale(SCALE, ROUNDING)
        );
    }
}
