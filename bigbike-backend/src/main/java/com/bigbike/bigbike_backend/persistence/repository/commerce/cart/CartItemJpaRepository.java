package com.bigbike.bigbike_backend.persistence.repository.commerce.cart;

import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import java.util.List;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CartItemJpaRepository extends JpaRepository<CartItemEntity, UUID> {

    List<CartItemEntity> findByCartId(UUID cartId);

    // Dedup an add-to-cart by the varchar PKs (product_pk / product_variant_pk), not the UUID columns:
    // those are null for migrated wp-* catalog, so two distinct wp-* products would otherwise collide
    // on (null, null) and merge onto one cart line. variantPk is null for a product without a variant.
    @Query("""
            SELECT ci FROM CartItemEntity ci
            WHERE ci.cart.id = :cartId AND ci.productPk = :productPk
              AND ((:variantPk IS NULL AND ci.productVariantPk IS NULL) OR ci.productVariantPk = :variantPk)
            """)
    Optional<CartItemEntity> findByCartIdAndProductPkAndProductVariantPk(
            @Param("cartId") UUID cartId,
            @Param("productPk") String productPk,
            @Param("variantPk") String variantPk);

    @Query(value = """
            select interaction.action_type as actionType, count(item.id) as cartLines
            from cart_items item
            join chat_interactions interaction on interaction.id = item.assistant_interaction_id
            where item.updated_at >= :from and item.updated_at < :to
            group by interaction.action_type
            """, nativeQuery = true)
    List<ActionCartSummary> summarizeAssistantCartLinesBetween(
            @Param("from") Instant from, @Param("to") Instant to);

    interface ActionCartSummary {
        String getActionType();
        Long getCartLines();
    }
}
