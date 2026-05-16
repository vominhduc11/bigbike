package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.persistence.entity.admin.AdminNotificationEntity;
import com.bigbike.bigbike_backend.persistence.repository.admin.AdminNotificationJpaRepository;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminNotificationService {

    private static final int MAX_UNREAD_FETCH = 50;

    private final AdminNotificationJpaRepository notificationRepo;

    @Transactional
    public void persistFromWsEvent(OrderWsEvent event) {
        AdminNotificationEntity n = new AdminNotificationEntity();
        n.setType(event.type());
        n.setOrderId(event.orderId());
        n.setOrderNumber(event.orderNumber());
        n.setPayload(buildPayload(event));
        n.setCreatedAt(Instant.now());
        notificationRepo.save(n);
    }

    @Transactional(readOnly = true)
    public List<AdminNotificationEntity> listUnread() {
        return notificationRepo.findByReadFalseOrderByCreatedAtDesc(
                PageRequest.of(0, MAX_UNREAD_FETCH));
    }

    @Transactional(readOnly = true)
    public long countUnread() {
        return notificationRepo.countByReadFalse();
    }

    @Transactional
    public int markRead(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) return 0;
        return notificationRepo.markReadByIds(ids);
    }

    @Transactional
    public int markAllRead() {
        return notificationRepo.markAllRead();
    }

    private String buildPayload(OrderWsEvent event) {
        return "{\"type\":\"" + event.type() + "\""
                + ",\"orderNumber\":\"" + event.orderNumber() + "\""
                + ",\"status\":\"" + event.status() + "\""
                + ",\"paymentMethod\":\"" + event.paymentMethod() + "\"}";
    }
}
