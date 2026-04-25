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
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerAuthService {

    private static final String STATUS_ACTIVE = "ACTIVE";

    private final CustomerJpaRepository customerRepo;
    private final CustomerSessionService sessionService;
    private final PasswordService passwordService;
    private final EmailVerificationService emailVerificationService;

    public CustomerAuthService(
            CustomerJpaRepository customerRepo,
            CustomerSessionService sessionService,
            PasswordService passwordService,
            EmailVerificationService emailVerificationService) {
        this.customerRepo = customerRepo;
        this.sessionService = sessionService;
        this.passwordService = passwordService;
        this.emailVerificationService = emailVerificationService;
    }

    @Transactional
    public CustomerAuthResult register(CustomerRegisterRequest req, String ipAddress, String userAgent) {
        if (req.email() == null && req.phone() == null) {
            throw ValidationException.fromField("email", "REQUIRED", "Email or phone is required.");
        }
        if (req.password() == null || req.password().length() < 6) {
            throw ValidationException.fromField("password", "TOO_SHORT", "Password must be at least 6 characters.");
        }
        if (req.email() != null && customerRepo.findByEmail(req.email()).isPresent()) {
            throw new ConflictException("Email is already registered.");
        }
        if (req.phone() != null && customerRepo.findByPhone(req.phone()).isPresent()) {
            throw new ConflictException("Phone is already registered.");
        }

        Instant now = Instant.now();
        CustomerEntity customer = new CustomerEntity();
        customer.setEmail(req.email());
        customer.setPhone(req.phone());
        customer.setPasswordHash(passwordService.hash(req.password()));
        customer.setDisplayName(req.displayName() != null ? req.displayName() : deriveDisplayName(req));
        customer.setStatus(STATUS_ACTIVE);
        customer.setSynthetic(false);
        customer.setCreatedAt(now);
        customer.setUpdatedAt(now);
        CustomerEntity saved = customerRepo.save(customer);

        // Fire-and-forget-on-failure email send. Mail outages must not break signup.
        if (saved.getEmail() != null && !saved.getEmail().isBlank()) {
            emailVerificationService.issueAndSend(saved);
        }

        CustomerSessionResult tokens = sessionService.createSession(saved.getId(), ipAddress, userAgent);
        return new CustomerAuthResult(
                new CustomerAuthResponse(toSummary(saved), tokens.rawCsrfToken()),
                tokens.rawSessionToken(), tokens.rawRefreshToken());
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
        customer.setLastLoginAt(now);
        customer.setUpdatedAt(now);
        customerRepo.save(customer);

        CustomerSessionResult tokens = sessionService.createSession(customer.getId(), ipAddress, userAgent);
        return new CustomerAuthResult(
                new CustomerAuthResponse(toSummary(customer), tokens.rawCsrfToken()),
                tokens.rawSessionToken(), tokens.rawRefreshToken());
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
        return new CustomerAuthResult(
                new CustomerAuthResponse(toSummary(customer), tokens.rawCsrfToken()),
                tokens.rawSessionToken(), tokens.rawRefreshToken());
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

        if (req.email() != null && !req.email().isBlank() && !req.email().equals(customer.getEmail())) {
            customerRepo.findByEmail(req.email()).ifPresent(c -> {
                throw new ConflictException("Email đã được đăng ký.");
            });
            customer.setEmail(req.email());
        }
        if (req.phone() != null && !req.phone().isBlank() && !req.phone().equals(customer.getPhone())) {
            customerRepo.findByPhone(req.phone()).ifPresent(c -> {
                throw new ConflictException("Số điện thoại đã được đăng ký.");
            });
            customer.setPhone(req.phone());
        }
        if (req.displayName() != null && !req.displayName().isBlank()) {
            customer.setDisplayName(req.displayName());
        }
        if (req.newPassword() != null && !req.newPassword().isBlank()) {
            if (req.newPassword().length() < 6) {
                throw ValidationException.fromField("newPassword", "TOO_SHORT", "Mật khẩu phải có ít nhất 6 ký tự.");
            }
            customer.setPasswordHash(passwordService.hash(req.newPassword()));
        }
        if (req.gender() != null) {
            customer.setGender(req.gender().isBlank() ? null : req.gender().trim());
        }
        if (req.dob() != null && !req.dob().isBlank()) {
            try {
                customer.setDob(LocalDate.parse(req.dob()));
            } catch (Exception ignored) {}
        }
        customer.setUpdatedAt(Instant.now());
        return toSummary(customerRepo.save(customer));
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private CustomerEntity findByEmailOrPhone(String login) {
        if (login == null) return null;
        if (login.contains("@")) {
            return customerRepo.findByEmail(login).orElse(null);
        }
        return customerRepo.findByPhone(login).orElse(null);
    }

    private String deriveDisplayName(CustomerRegisterRequest req) {
        if (req.email() != null) return req.email().split("@")[0];
        return req.phone();
    }

    private CustomerSummary toSummary(CustomerEntity c) {
        return new CustomerSummary(c.getId(), c.getEmail(), c.getPhone(), c.getDisplayName(), c.getStatus(),
                c.getGender(), c.getDob());
    }

    public CustomerSessionResult createSessionForCustomer(CustomerEntity customer, String ipAddress, String userAgent) {
        return sessionService.createSession(customer.getId(), ipAddress, userAgent);
    }
}
