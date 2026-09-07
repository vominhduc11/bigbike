package com.bigbike.bigbike_backend.service.order;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.domain.commerce.PaymentRecordStatus;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.payment.PaymentEntity;
import java.util.List;
import java.util.Objects;

/** PAY_RULE_002: the existing payment row is the sole source of receipt status. */
public final class BankTransferPolicy {
    private BankTransferPolicy() {}

    public static boolean isBankTransfer(OrderEntity order) {
        return "BANK_TRANSFER".equals(order.getPaymentMethod());
    }

    public static boolean isActive(OrderEntity order) {
        return "PENDING".equals(order.getStatus()) || "PROCESSING".equals(order.getStatus());
    }

    public static boolean hasMatchingPayment(OrderEntity order, List<PaymentEntity> payments) {
        if (payments.size() != 1) return false;
        PaymentEntity payment = payments.get(0);
        return "BANK_TRANSFER".equals(payment.getPaymentMethod())
                && payment.getAmount() != null && order.getTotalAmount() != null
                && payment.getAmount().compareTo(order.getTotalAmount()) == 0
                && Objects.equals(payment.getCurrency(), order.getCurrency());
    }

    public static boolean isPaid(OrderEntity order, List<PaymentEntity> payments) {
        return hasMatchingPayment(order, payments)
                && payments.get(0).getStatus() == PaymentRecordStatus.SUCCEEDED;
    }

    public static boolean canConfirm(OrderEntity order, List<PaymentEntity> payments) {
        return isBankTransfer(order) && isActive(order) && hasMatchingPayment(order, payments)
                && payments.get(0).getStatus() == PaymentRecordStatus.PENDING;
    }

    public static PaymentEntity requirePayment(OrderEntity order, List<PaymentEntity> payments) {
        if (!hasMatchingPayment(order, payments)
                || (payments.get(0).getStatus() != PaymentRecordStatus.PENDING
                && payments.get(0).getStatus() != PaymentRecordStatus.SUCCEEDED)) {
            throw new ConflictException("BANK_TRANSFER_PAYMENT_INVALID",
                    "Dữ liệu chuyển khoản cần được kiểm tra trước khi xác nhận nhận tiền.");
        }
        return payments.get(0);
    }
}
