package com.bigbike.bigbike_backend.persistence.repository.commerce.payment;

import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.RefundTransactionEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefundTransactionJpaRepository extends JpaRepository<RefundTransactionEntity, UUID> {

    List<RefundTransactionEntity> findByOrderIdOrderByCreatedAtAsc(UUID orderId);

    @Query("SELECT COALESCE(SUM(rt.amount), 0) FROM RefundTransactionEntity rt " +
           "WHERE rt.createdAt >= :from AND rt.createdAt < :to")
    BigDecimal sumRefundAmountInRange(@Param("from") Instant from, @Param("to") Instant to);
}
