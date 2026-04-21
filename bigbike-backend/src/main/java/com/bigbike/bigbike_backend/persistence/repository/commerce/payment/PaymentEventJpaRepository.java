package com.bigbike.bigbike_backend.persistence.repository.commerce.payment;

import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEventEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentEventJpaRepository extends JpaRepository<PaymentEventEntity, UUID> {

    List<PaymentEventEntity> findByPaymentId(UUID paymentId);

    List<PaymentEventEntity> findByOrderId(UUID orderId);

    List<PaymentEventEntity> findByProvider(String provider);

    Optional<PaymentEventEntity> findByEventId(String eventId);
}
