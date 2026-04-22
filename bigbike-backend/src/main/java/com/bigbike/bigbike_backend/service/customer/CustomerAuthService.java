package com.bigbike.bigbike_backend.service.customer;

import com.bigbike.bigbike_backend.api.customer.dto.CustomerAuthResponse;
import com.bigbike.bigbike_backend.api.customer.dto.CustomerLoginRequest;
import com.bigbike.bigbike_backend.api.customer.dto.CustomerRegisterRequest;
import com.bigbike.bigbike_backend.api.customer.dto.CustomerSummary;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.UnauthorizedException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerSessionEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerAuthService {

    private static final String STATUS_ACTIVE = "ACTIVE";

    private final CustomerJpaRepository customerRepo;
    private final CustomerSessionService sessionService;
    private final PasswordService passwordService;

    public CustomerAuthService(
            CustomerJpaRepository customerRepo,
            CustomerSessionService sessionService,
            PasswordService passwordService) {
        this.customerRepo = customerRepo;
        this.sessionService = sessionService;
        this.passwordService = passwordService;
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
        return new CustomerSummary(c.getId(), c.getEmail(), c.getPhone(), c.getDisplayName(), c.getStatus());
    }

    public CustomerSessionResult createSessionForCustomer(CustomerEntity customer, String ipAddress, String userAgent) {
        return sessionService.createSession(customer.getId(), ipAddress, userAgent);
    }
}
