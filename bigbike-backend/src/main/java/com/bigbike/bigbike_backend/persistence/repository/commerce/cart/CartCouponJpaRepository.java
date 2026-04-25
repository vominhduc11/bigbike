package com.bigbike.bigbike_backend.persistence.repository.commerce.cart;

import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartCouponEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CartCouponJpaRepository extends JpaRepository<CartCouponEntity, UUID> {

    List<CartCouponEntity> findByCartId(UUID cartId);

    Optional<CartCouponEntity> findByCartIdAndCouponCode(UUID cartId, String couponCode);

    void deleteAllByCartId(UUID cartId);
}
