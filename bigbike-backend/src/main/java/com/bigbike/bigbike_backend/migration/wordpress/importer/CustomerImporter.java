package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressCustomerMapper.MappedCustomer;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Idempotent customer importer.
 * IMPORTANT: phpass password hashes are stored without conversion and are NEVER logged.
 * Login via legacy hash is deferred to Phase 2F (phpass verifier).
 */
@Component
@RequiredArgsConstructor
public class CustomerImporter implements DomainImporter {

    private final CustomerJpaRepository customerRepo;
    private final CustomerAddressJpaRepository addressRepo;

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.CUSTOMERS;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedCustomer> items, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedCustomer mc : items) {
            try {
                Optional<CustomerEntity> existing = customerRepo.findByLegacyId(mc.sourceId());
                CustomerEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new CustomerEntity();
                    entity.setCreatedAt(Instant.now());
                    isNew = true;
                }
                entity.setLegacyId(mc.sourceId());
                entity.setEmail(truncate(mc.email(), 255));
                entity.setPhone(truncate(mc.phone(), 50));
                entity.setDisplayName(truncate(graphemeSafeTruncate(mc.displayName(), 255), 255));
                entity.setFirstName(truncate(graphemeSafeTruncate(mc.firstName(), 127), 127));
                entity.setLastName(truncate(graphemeSafeTruncate(mc.lastName(), 127), 127));
                entity.setSynthetic(mc.isSynthetic());
                entity.setStatus(mc.status() != null ? mc.status() : "ACTIVE");
                // Preserve legacy phpass hash — Phase 2F handles verifier. DO NOT log hash value.
                if (mc.legacyPasswordHash() != null && !mc.legacyPasswordHash().isBlank()) {
                    entity.setPasswordHash(mc.legacyPasswordHash());
                }
                // Preserve WP registration date; mark WP customers as verified (they proved email by placing orders).
                if (isNew) {
                    if (mc.registeredAt() != null) {
                        entity.setCreatedAt(mc.registeredAt());
                    }
                    if (!mc.isSynthetic()) {
                        entity.setEmailVerifiedAt(mc.registeredAt() != null ? mc.registeredAt() : Instant.now());
                    }
                }
                entity.setUpdatedAt(Instant.now());
                warnings.addAll(mc.warnings());

                if (!options.dryRun()) {
                    entity = customerRepo.save(entity);
                    importAddresses(entity, mc);
                }
                if (isNew) inserted++; else updated++;
            } catch (Exception e) {
                failed++;
                // Do NOT include PII details in error messages
                errors.add("Customer legacyId=" + mc.sourceId() + ": " + e.getMessage());
                if (options.failFast()) throw new RuntimeException(errors.get(errors.size() - 1), e);
            }
        }
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.CUSTOMERS, inserted, updated, skipped, failed, warnings, errors);
    }

    private void importAddresses(CustomerEntity customer, MappedCustomer mc) {
        List<CustomerAddressEntity> existing = addressRepo.findByCustomerId(customer.getId());

        if (mc.billingAddress1() != null && !mc.billingAddress1().isBlank()) {
            CustomerAddressEntity billing = findByType(existing, "BILLING");
            if (billing == null) {
                billing = new CustomerAddressEntity();
                billing.setCreatedAt(Instant.now());
            }
            billing.setCustomer(customer);
            billing.setType("BILLING");
            billing.setFullName(join(mc.billingFirstName(), mc.billingLastName()));
            billing.setPhone(mc.billingPhone());
            billing.setAddressLine1(mc.billingAddress1());
            billing.setAddressLine2(mc.billingAddress2());
            billing.setDistrict(mc.billingCity());
            billing.setProvince(mc.billingState());
            billing.setCountry(mc.billingCountry() != null && !mc.billingCountry().isBlank()
                    ? mc.billingCountry() : "VN");
            billing.setDefault(true);
            billing.setUpdatedAt(Instant.now());
            addressRepo.save(billing);
        }

        if (mc.shippingAddress1() != null && !mc.shippingAddress1().isBlank()) {
            CustomerAddressEntity shipping = findByType(existing, "SHIPPING");
            if (shipping == null) {
                shipping = new CustomerAddressEntity();
                shipping.setCreatedAt(Instant.now());
            }
            shipping.setCustomer(customer);
            shipping.setType("SHIPPING");
            shipping.setFullName(join(mc.shippingFirstName(), mc.shippingLastName()));
            // WooCommerce stores only billing_phone; shipping address inherits it (no separate shipping phone in WC).
            shipping.setPhone(mc.billingPhone());
            shipping.setAddressLine1(mc.shippingAddress1());
            shipping.setAddressLine2(mc.shippingAddress2());
            shipping.setDistrict(mc.shippingCity());
            shipping.setProvince(mc.shippingState());
            shipping.setCountry(mc.shippingCountry() != null && !mc.shippingCountry().isBlank()
                    ? mc.shippingCountry() : "VN");
            shipping.setDefault(false);
            shipping.setUpdatedAt(Instant.now());
            addressRepo.save(shipping);
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    /** Truncates at grapheme-cluster boundaries to avoid splitting Vietnamese combining marks. */
    private static String graphemeSafeTruncate(String s, int maxCodePoints) {
        if (s == null) return null;
        if (s.codePointCount(0, s.length()) <= maxCodePoints) return s;
        int offset = s.offsetByCodePoints(0, maxCodePoints);
        return s.substring(0, offset);
    }

    private CustomerAddressEntity findByType(List<CustomerAddressEntity> list, String type) {
        return list.stream().filter(a -> type.equals(a.getType())).findFirst().orElse(null);
    }

    private String join(String first, String last) {
        if (first == null && last == null) return "";
        if (first == null) return last;
        if (last == null) return first;
        return (first + " " + last).trim();
    }
}
