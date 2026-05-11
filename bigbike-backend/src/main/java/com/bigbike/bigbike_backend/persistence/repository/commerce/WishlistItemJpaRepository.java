package com.bigbike.bigbike_backend.persistence.repository.commerce;

import com.bigbike.bigbike_backend.persistence.entity.commerce.WishlistItemEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WishlistItemJpaRepository extends JpaRepository<WishlistItemEntity, UUID> {

    List<WishlistItemEntity> findByCustomerIdOrderByAddedAtDesc(UUID customerId);

    Optional<WishlistItemEntity> findByCustomerIdAndProductId(UUID customerId, String productId);

    boolean existsByCustomerIdAndProductId(UUID customerId, String productId);

    void deleteByCustomerIdAndProductId(UUID customerId, String productId);
}
