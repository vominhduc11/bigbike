package com.bigbike.bigbike_backend.persistence.repository.commerce.cart;

import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CartJpaRepository extends JpaRepository<CartEntity, UUID> {

    List<CartEntity> findByCustomerId(UUID customerId);

    Optional<CartEntity> findByCustomerIdAndStatus(UUID customerId, String status);

    List<CartEntity> findBySessionId(String sessionId);

    List<CartEntity> findBySessionIdAndStatus(String sessionId, String status);

    Page<CartEntity> findByStatus(String status, Pageable pageable);

    Page<CartEntity> findByExpiresAtBefore(Instant threshold, Pageable pageable);
}
