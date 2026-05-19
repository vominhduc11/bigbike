package com.bigbike.bigbike_backend.persistence.repository.commerce.cart;

import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CartItemJpaRepository extends JpaRepository<CartItemEntity, UUID> {

    List<CartItemEntity> findByCartId(UUID cartId);

    Optional<CartItemEntity> findByCartIdAndProductIdAndProductVariantId(UUID cartId, UUID productId, UUID productVariantId);
}
