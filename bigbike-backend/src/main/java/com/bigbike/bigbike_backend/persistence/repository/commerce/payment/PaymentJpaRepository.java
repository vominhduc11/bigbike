package com.bigbike.bigbike_backend.persistence.repository.commerce.payment;

import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentJpaRepository extends JpaRepository<PaymentEntity, UUID> {

    List<PaymentEntity> findByOrderId(UUID orderId);

    List<PaymentEntity> findByStatus(String status);

    Optional<PaymentEntity> findByTransactionId(String transactionId);

    Optional<PaymentEntity> findByProviderReference(String providerReference);
}
