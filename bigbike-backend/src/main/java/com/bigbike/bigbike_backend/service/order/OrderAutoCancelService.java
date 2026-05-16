package com.bigbike.bigbike_backend.service.order;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderNoteJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.inventory.OrderStockRestoreService;
import com.bigbike.bigbike_backend.service.inventory.SerialLifecycleService;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Auto-cancels BACS orders that have been ON_HOLD with status UNPAID for longer
 * than the configured threshold. Reuses the same cancel side-effects as a
 * customer cancel: release serial reservation + restore non-serial stock + system note.
 *
 * Threshold is read from {@code site_settings.bacs_unpaid_auto_cancel_hours}
 * (default 72h). Set to 0 to disable.
 */
@Service
@Slf4j
public class OrderAutoCancelService {

    private static final String SETTING_KEY = "bacs_unpaid_auto_cancel_hours";
    private static final long DEFAULT_HOURS = 72L;

    private final OrderJpaRepository orderRepo;
    private final OrderNoteJpaRepository noteRepo;
    private final SiteSettingJpaRepository settingRepo;
    private final SerialLifecycleService serialLifecycleService;
    private final OrderStockRestoreService orderStockRestoreService;
    private final WebRevalidationService webRevalidationService;
    private final TransactionTemplate txTemplate;

    public OrderAutoCancelService(
            OrderJpaRepository orderRepo,
            OrderNoteJpaRepository noteRepo,
            SiteSettingJpaRepository settingRepo,
            SerialLifecycleService serialLifecycleService,
            OrderStockRestoreService orderStockRestoreService,
            WebRevalidationService webRevalidationService,
            PlatformTransactionManager txManager
    ) {
        this.orderRepo = orderRepo;
        this.noteRepo = noteRepo;
        this.settingRepo = settingRepo;
        this.serialLifecycleService = serialLifecycleService;
        this.orderStockRestoreService = orderStockRestoreService;
        this.webRevalidationService = webRevalidationService;
        this.txTemplate = new TransactionTemplate(txManager);
    }

    /**
     * Scans for expired BACS unpaid orders and cancels each. Returns the count
     * actually cancelled. Each order runs in its own transaction so that one
     * failure does not roll back the rest of the batch.
     */
    public int autoCancelExpiredBacsUnpaidOrders() {
        long hours = readThresholdHours();
        if (hours <= 0) {
            return 0;
        }
        Instant cutoff = Instant.now().minus(Duration.ofHours(hours));
        List<OrderEntity> candidates = orderRepo.findBacsUnpaidOnHoldOlderThan(cutoff);
        int cancelled = 0;
        for (OrderEntity candidate : candidates) {
            try {
                Boolean done = txTemplate.execute(status -> cancelOne(candidate.getId(), hours));
                if (Boolean.TRUE.equals(done)) {
                    cancelled++;
                    webRevalidationService.revalidateProductsForOrder(candidate.getId());
                }
            } catch (Exception e) {
                log.warn("[OrderAutoCancel] Failed to cancel order {}: {}",
                        candidate.getOrderNumber(), e.getMessage(), e);
            }
        }
        return cancelled;
    }

    private boolean cancelOne(UUID orderId, long hours) {
        OrderEntity order = orderRepo.findById(orderId).orElse(null);
        if (order == null) {
            return false;
        }
        // Re-check after re-loading to avoid racing with a manual admin action
        // or a payment confirmation that landed since the candidate query ran.
        if (!"ON_HOLD".equals(order.getStatus()) || !"UNPAID".equals(order.getPaymentStatus())
                || !"BACS".equals(order.getPaymentMethod())) {
            return false;
        }

        Instant now = Instant.now();
        order.setStatus("CANCELLED");
        order.setCancelledAt(now);
        order.setUpdatedAt(now);
        if ("DELIVERY".equalsIgnoreCase(order.getFulfillmentType())) {
            order.setFulfillmentStatus("CANCELLED");
        }
        orderRepo.save(order);

        serialLifecycleService.releaseReservationForOrder(orderId, "ORDER_BACS_UNPAID_AUTO_CANCELLED");
        orderStockRestoreService.restoreForCancel(orderId);

        OrderNoteEntity note = new OrderNoteEntity();
        note.setOrder(order);
        note.setAuthorType("SYSTEM");
        note.setNoteType("SYSTEM");
        note.setContent("Đơn hàng tự động huỷ do quá thời hạn thanh toán chuyển khoản ("
                + hours + " giờ).");
        note.setCustomerVisible(false);
        note.setCreatedAt(now);
        noteRepo.save(note);
        return true;
    }

    private long readThresholdHours() {
        return settingRepo.findBySettingKey(SETTING_KEY)
                .map(s -> {
                    try {
                        return Long.parseLong(s.getSettingValue().trim());
                    } catch (NumberFormatException | NullPointerException e) {
                        return DEFAULT_HOURS;
                    }
                })
                .orElse(DEFAULT_HOURS);
    }
}
