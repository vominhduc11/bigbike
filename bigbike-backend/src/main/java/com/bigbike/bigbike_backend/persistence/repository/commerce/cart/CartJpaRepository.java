package com.bigbike.bigbike_backend.persistence.repository.commerce.cart;

import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CartJpaRepository extends JpaRepository<CartEntity, UUID> {

    List<CartEntity> findByCustomerId(UUID customerId);

    Optional<CartEntity> findBySessionId(String sessionId);

    List<CartEntity> findByStatus(String status);

    List<CartEntity> findByExpiresAtBefore(Instant threshold);
}
