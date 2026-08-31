package com.bigbike.bigbike_backend.persistence.repository.commerce.order;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderOverdueReminderOrderEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderOverdueReminderOrderJpaRepository
        extends JpaRepository<OrderOverdueReminderOrderEntity, UUID> {
}
