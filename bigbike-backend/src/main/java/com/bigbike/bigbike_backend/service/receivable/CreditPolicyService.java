package com.bigbike.bigbike_backend.service.receivable;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.receivable.ReceivableJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Validates customer eligibility for credit sales and enforces credit limits.
 */
@Service
@Transactional(readOnly = true)
public class CreditPolicyService {

    /** Returned by {@link #validateCreditEligibility}. */
    public record EligibilityResult(CustomerEntity customer, boolean limitOverrideExercised) {}

    private final CustomerJpaRepository customerRepo;
    private final ReceivableJpaRepository receivableRepo;

    public CreditPolicyService(CustomerJpaRepository customerRepo, ReceivableJpaRepository receivableRepo) {
        this.customerRepo = customerRepo;
        this.receivableRepo = receivableRepo;
    }

    /**
     * Validates that the customer can receive a credit sale for the given amount.
     * Throws ConflictException if any rule is violated.
     * Returns an {@link EligibilityResult} where {@code limitOverrideExercised} is true only when
     * the order actually exceeded the credit limit AND the caller had override permission.
     *
     * @param customerId    customer receiving credit
     * @param orderAmount   total amount of the new credit order
     * @param overrideLimit whether the requesting user has receivables.override_limit permission
     */
    public EligibilityResult validateCreditEligibility(UUID customerId, BigDecimal orderAmount, boolean overrideLimit) {
        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found: " + customerId));

        if (!customer.isCreditEnabled()) {
            throw new ConflictException("Khách hàng chưa được bật chức năng bán chịu (credit_enabled = false).");
        }

        if (!"ACTIVE".equals(customer.getCreditStatus())) {
            throw new ConflictException("Trạng thái công nợ của khách hàng là " + customer.getCreditStatus()
                    + " — không thể thực hiện bán chịu.");
        }

        boolean limitExceededAndOverridden = false;
        if (customer.getCreditLimit() != null) {
            BigDecimal currentOutstanding = receivableRepo.sumOutstandingByCustomerId(customerId);
            BigDecimal afterOrder = currentOutstanding.add(orderAmount);
            if (afterOrder.compareTo(customer.getCreditLimit()) > 0) {
                if (!overrideLimit) {
                    throw new ConflictException(String.format(
                            "Vượt hạn mức tín dụng. Hạn mức: %,.0f VND, Đang nợ: %,.0f VND, Đơn mới: %,.0f VND.",
                            customer.getCreditLimit(), currentOutstanding, orderAmount));
                }
                limitExceededAndOverridden = true;
            }
        }

        return new EligibilityResult(customer, limitExceededAndOverridden);
    }

    /** Returns current outstanding balance for a customer (sum of non-closed receivables). */
    public BigDecimal getCurrentOutstanding(UUID customerId) {
        return receivableRepo.sumOutstandingByCustomerId(customerId);
    }

    /** Available credit remaining = creditLimit - currentOutstanding. Null if no limit set. */
    public BigDecimal getAvailableCredit(UUID customerId) {
        CustomerEntity c = customerRepo.findById(customerId).orElse(null);
        if (c == null || c.getCreditLimit() == null) return null;
        BigDecimal outstanding = receivableRepo.sumOutstandingByCustomerId(customerId);
        return c.getCreditLimit().subtract(outstanding);
    }
}
