package com.bigbike.bigbike_backend.service.customer;

import com.bigbike.bigbike_backend.api.customer.dto.CustomerAuthResponse;
import com.bigbike.bigbike_backend.api.customer.dto.CustomerLoginRequest;
import com.bigbike.bigbike_backend.api.customer.dto.CustomerRegisterRequest;
import com.bigbike.bigbike_backend.api.customer.dto.CustomerSummary;
import com.bigbike.bigbike_backend.api.customer.dto.UpdateCustomerProfileRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.UnauthorizedException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerSessionEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CustomerAuthService {

    private static final String STATUS_ACTIVE = "ACTIVE";

    private final CustomerJpaRepository customerRepo;
    private final CustomerSessionService sessionService;
    private final PasswordService passwordService;
    private final EmailVerificationService emailVerificationService;
    private final GuestOrderLinkingService guestOrderLinkingService;

    @Transactional
    public CustomerAuthResult register(CustomerRegisterRequest req, String ipAddress, String userAgent) {
        String normalizedEmail = req.email() != null ? req.email().toLowerCase(Locale.ROOT).trim() : null;
        String normalizedPhone = req.phone() != null ? req.phone().trim() : null;

        if (normalizedEmail == null && normalizedPhone == null) {
            throw ValidationException.fromField("email", "REQUIRED", "Email or phone is required.");
        }
        if (req.password() == null || req.password().length() < 8) {
            throw ValidationException.fromField("password", "TOO_SHORT", "Mật khẩu phải có ít nhất 8 ký tự.");
        }
        // Generic message prevents account enumeration via register endpoint.
        if (normalizedEmail != null && customerRepo.findByEmail(normalizedEmail).isPresent()) {
            throw new ConflictException("Thông tin đăng ký không hợp lệ.");
        }
        if (normalizedPhone != null && customerRepo.findByPhone(normalizedPhone).isPresent()) {
            throw new ConflictException("Thông tin đăng ký không hợp lệ.");
        }

        Instant now = Instant.now();
        CustomerEntity customer = new CustomerEntity();
        customer.setEmail(normalizedEmail);
        customer.setPhone(normalizedPhone);
        customer.setPasswordHash(passwordService.hash(req.password()));
        customer.setDisplayName(req.displayName() != null ? req.displayName() : deriveDisplayName(req));
        customer.setFirstName(req.firstName());
        customer.setLastName(req.lastName());
        customer.setStatus(STATUS_ACTIVE);
        customer.setSynthetic(false);
        customer.setCreatedAt(now);
        customer.setUpdatedAt(now);
        CustomerEntity saved;
        try {
            saved = customerRepo.saveAndFlush(customer);
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("Thông tin đăng ký không hợp lệ.");
        }

        // Fire-and-forget-on-failure email send. Mail outages must not break signup.
        if (saved.getEmail() != null && !saved.getEmail().isBlank()) {
            emailVerificationService.issueAndSend(saved);
        }

        CustomerSessionResult tokens = sessionService.createSession(saved.getId(), ipAddress, userAgent);
        return CustomerAuthResult.of(
                new CustomerAuthResponse(toSummary(saved), tokens.rawCsrfToken()), tokens);
    }

    @Transactional
    public CustomerAuthResult login(CustomerLoginRequest req, String ipAddress, String userAgent) {
        String login = req.login();
        CustomerEntity customer = findByEmailOrPhone(login);

        if (customer == null) {
            passwordService.dummyVerify(req.password());
            throw new UnauthorizedException("Invalid credentials.");
        }
        if (customer.getPasswordHash() == null || !passwordService.verify(req.password(), customer.getPasswordHash())) {
            throw new UnauthorizedException("Invalid credentials.");
        }
        if (!STATUS_ACTIVE.equals(customer.getStatus())) {
            // Use same message as wrong-password to prevent leaking account status (anti-enumeration)
            throw new UnauthorizedException("Invalid credentials.");
        }

        Instant now = Instant.now();
        // Rehash legacy phpass hashes to Argon2id on successful login.
        if (passwordService.isLegacyHash(customer.getPasswordHash())) {
            customer.setPasswordHash(passwordService.hash(req.password()));
        }
        customer.setLastLoginAt(now);
        customer.setUpdatedAt(now);
        customerRepo.save(customer);

        // Link guest orders placed with this email before account existed — only if already verified.
        // Idempotent: already-linked orders are skipped in the repository query.
        if (customer.getEmailVerifiedAt() != null) {
            guestOrderLinkingService.linkVerifiedEmailOrders(customer.getId());
        }

        boolean remember = Boolean.TRUE.equals(req.remember());
        CustomerSessionResult tokens =
                sessionService.createSession(customer.getId(), ipAddress, userAgent, remember);
        return CustomerAuthResult.of(
                new CustomerAuthResponse(toSummary(customer), tokens.rawCsrfToken()), tokens);
    }

    @Transactional
    public CustomerAuthResult refresh(String rawRefreshToken, String ipAddress, String userAgent) {
        CustomerSessionEntity session = sessionService.findByRefreshToken(rawRefreshToken)
                .orElseThrow(() -> new UnauthorizedException("Invalid or expired refresh token."));

        CustomerEntity customer = customerRepo.findById(session.getCustomerId())
                .orElseThrow(() -> new UnauthorizedException("Customer account not found."));

        if (!STATUS_ACTIVE.equals(customer.getStatus())) {
            sessionService.revokeSession(session);
            throw new UnauthorizedException("Account is not active.");
        }

        CustomerSessionResult tokens = sessionService.rotateSession(session);
        return CustomerAuthResult.of(
                new CustomerAuthResponse(toSummary(customer), tokens.rawCsrfToken()), tokens);
    }

    @Transactional
    public void logout(CustomerSessionEntity session) {
        sessionService.revokeSession(session);
    }

    public CustomerSummary getProfile(UUID customerId) {
        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new UnauthorizedException("Customer not found."));
        return toSummary(customer);
    }

    @Transactional
    public CustomerSummary updateProfile(UUID customerId, UpdateCustomerProfileRequest req) {
        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new UnauthorizedException("Customer not found."));

        String newEmail = (req.email() != null && !req.email().isBlank())
                ? req.email().toLowerCase(Locale.ROOT).trim() : null;
        String newPhone = (req.phone() != null && !req.phone().isBlank())
                ? req.phone().trim() : null;

        boolean isSensitiveChange = (req.newPassword() != null && !req.newPassword().isBlank())
                || (newEmail != null && !newEmail.equals(customer.getEmail()))
                || (newPhone != null && !newPhone.equals(customer.getPhone()));

        if (isSensitiveChange) {
            if (req.currentPassword() == null || req.currentPassword().isBlank()) {
                throw ValidationException.fromField("currentPassword", "REQUIRED",
                        "Vui lòng nhập mật khẩu hiện tại để thay đổi thông tin nhạy cảm.");
            }
            if (customer.getPasswordHash() == null
                    || !passwordService.verify(req.currentPassword(), customer.getPasswordHash())) {
                throw ValidationException.fromField("currentPassword", "INVALID", "Mật khẩu hiện tại không đúng.");
            }
        }

        if (newEmail != null && !newEmail.equals(customer.getEmail())) {
            customerRepo.findByEmail(newEmail).ifPresent(c -> {
                throw new ConflictException("Thông tin cập nhật không hợp lệ.");
            });
            customer.setEmail(newEmail);
        }
        if (newPhone != null && !newPhone.equals(customer.getPhone())) {
            customerRepo.findByPhone(newPhone).ifPresent(c -> {
                throw new ConflictException("Thông tin cập nhật không hợp lệ.");
            });
            customer.setPhone(newPhone);
        }
        if (req.displayName() != null && !req.displayName().isBlank()) {
            customer.setDisplayName(req.displayName());
        }
        if (req.newPassword() != null && !req.newPassword().isBlank()) {
            if (req.newPassword().length() < 8) {
                throw ValidationException.fromField("newPassword", "TOO_SHORT", "Mật khẩu phải có ít nhất 8 ký tự.");
            }
            customer.setPasswordHash(passwordService.hash(req.newPassword()));
            // Revoke all other sessions so stolen sessions can't be used after password change.
            sessionService.revokeAllSessions(customerId);
        }
        if (req.gender() != null) {
            customer.setGender(req.gender().isBlank() ? null : req.gender().trim());
        }
        if (req.dob() != null && !req.dob().isBlank()) {
            try {
                customer.setDob(LocalDate.parse(req.dob()));
            } catch (Exception e) {
                throw ValidationException.fromField("dob", "INVALID", "Ngày sinh không hợp lệ. Định dạng: YYYY-MM-DD.");
            }
        }
        if (req.newsletterSubscribed() != null) {
            customer.setNewsletterSubscribed(req.newsletterSubscribed());
        }
        customer.setUpdatedAt(Instant.now());
        try {
            return toSummary(customerRepo.saveAndFlush(customer));
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("Thông tin cập nhật không hợp lệ.");
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private CustomerEntity findByEmailOrPhone(String login) {
        if (login == null) return null;
        if (login.contains("@")) {
            return customerRepo.findByEmail(login.toLowerCase(Locale.ROOT).trim()).orElse(null);
        }
        return customerRepo.findByPhone(login.trim()).orElse(null);
    }

    private String deriveDisplayName(CustomerRegisterRequest req) {
        if (req.firstName() != null && !req.firstName().isBlank()) {
            String full = req.firstName().trim();
            if (req.lastName() != null && !req.lastName().isBlank()) {
                full = req.lastName().trim() + " " + full;
            }
            return full;
        }
        if (req.email() != null) return req.email().split("@")[0];
        return req.phone();
    }

    private CustomerSummary toSummary(CustomerEntity c) {
        return new CustomerSummary(c.getId(), c.getEmail(), c.getPhone(), c.getDisplayName(), c.getStatus(),
                c.getGender(), c.getDob(), c.getEmailVerifiedAt() != null, c.isNewsletterSubscribed());
    }

    public CustomerSessionResult createSessionForCustomer(CustomerEntity customer, String ipAddress, String userAgent) {
        return sessionService.createSession(customer.getId(), ipAddress, userAgent);
    }
}
