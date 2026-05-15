package com.bigbike.bigbike_backend.service.customer;

import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Links unowned guest orders to a verified customer account.
 *
 * Security invariant: linking only occurs when the customer's emailVerifiedAt
 * is non-null, proving they own the address used during guest checkout.
 * Phone-only matching and unverified-email matching are both prohibited.
 */
@Service
public class GuestOrderLinkingService {

    private static final Logger log = LoggerFactory.getLogger(GuestOrderLinkingService.class);

    private final CustomerJpaRepository customerRepo;
    private final OrderJpaRepository orderRepo;

    public GuestOrderLinkingService(CustomerJpaRepository customerRepo, OrderJpaRepository orderRepo) {
        this.customerRepo = customerRepo;
        this.orderRepo = orderRepo;
    }

    /**
     * Links all guest orders whose customer_email matches this customer's verified
     * email. The method is idempotent: already-linked orders (customer_id IS NOT NULL)
     * are skipped by the repository query. Safe to call multiple times.
     *
     * @return number of orders linked (0 if email not verified or no matches).
     */
    @Transactional
    public int linkVerifiedEmailOrders(UUID customerId) {
        CustomerEntity customer = customerRepo.findById(customerId).orElse(null);
        if (customer == null) {
            log.warn("GuestOrderLinking: customer {} not found — skipping", customerId);
            return 0;
        }

        // Hard guard: never link without verified email.
        if (customer.getEmailVerifiedAt() == null) {
            return 0;
        }
        if (customer.getEmail() == null || customer.getEmail().isBlank()) {
            return 0;
        }

        String normalizedEmail = customer.getEmail().toLowerCase(Locale.ROOT).trim();
        int linked = orderRepo.linkGuestOrdersByEmail(customerId, normalizedEmail, Instant.now());
        if (linked > 0) {
            log.info("GuestOrderLinking: linked {} order(s) to customer {}", linked, customerId);
        }
        return linked;
    }
}
