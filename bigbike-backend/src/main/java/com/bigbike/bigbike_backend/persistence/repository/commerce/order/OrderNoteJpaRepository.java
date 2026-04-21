package com.bigbike.bigbike_backend.persistence.repository.commerce.order;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderNoteJpaRepository extends JpaRepository<OrderNoteEntity, UUID> {

    List<OrderNoteEntity> findByOrderId(UUID orderId);

    List<OrderNoteEntity> findByOrderIdOrderByCreatedAtAsc(UUID orderId);
}
