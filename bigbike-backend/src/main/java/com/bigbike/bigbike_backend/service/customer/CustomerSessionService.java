package com.bigbike.bigbike_backend.service.customer;

import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerSessionEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerSessionJpaRepository;
import com.bigbike.bigbike_backend.service.auth.JwtService;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerSessionService {

    public static final long SESSION_TTL_SECONDS = 604800L;   // 7 days
    public static final long REFRESH_TTL_SECONDS = 2592000L;  // 30 days
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_REVOKED = "REVOKED";

    private final CustomerSessionJpaRepository sessionRepo;
    private final JwtService jwtService;

    public CustomerSessionService(CustomerSessionJpaRepository sessionRepo, JwtService jwtService) {
        this.sessionRepo = sessionRepo;
        this.jwtService = jwtService;
    }

    @Transactional
    public CustomerSessionResult createSession(UUID customerId, String ipAddress, String userAgent) {
        String rawSession = jwtService.generateRawRefreshToken();
        String rawRefresh = jwtService.generateRawRefreshToken();
        String rawCsrf = jwtService.generateRawRefreshToken();

        Instant now = Instant.now();
        CustomerSessionEntity session = new CustomerSessionEntity();
        session.setCustomerId(customerId);
        session.setSessionTokenHash(jwtService.hashToken(rawSession));
        session.setRefreshTokenHash(jwtService.hashToken(rawRefresh));
        session.setCsrfTokenHash(jwtService.hashToken(rawCsrf));
        session.setStatus(STATUS_ACTIVE);
        session.setIpAddress(ipAddress);
        session.setUserAgent(userAgent);
        session.setSessionExpiresAt(now.plusSeconds(SESSION_TTL_SECONDS));
        session.setRefreshExpiresAt(now.plusSeconds(REFRESH_TTL_SECONDS));
        session.setLastActiveAt(now);
        session.setCreatedAt(now);
        session.setUpdatedAt(now);

        CustomerSessionEntity saved = sessionRepo.save(session);
        return new CustomerSessionResult(saved.getId(), customerId, rawSession, rawRefresh, rawCsrf);
    }

    @Transactional
    public Optional<CustomerSessionEntity> findBySessionToken(String rawToken) {
        return sessionRepo.findBySessionTokenHash(jwtService.hashToken(rawToken))
                .filter(s -> STATUS_ACTIVE.equals(s.getStatus()))
                .filter(s -> s.getSessionExpiresAt().isAfter(Instant.now()));
    }

    @Transactional
    public Optional<CustomerSessionEntity> findByRefreshToken(String rawToken) {
        return sessionRepo.findByRefreshTokenHash(jwtService.hashToken(rawToken))
                .filter(s -> STATUS_ACTIVE.equals(s.getStatus()))
                .filter(s -> s.getRefreshExpiresAt() != null && s.getRefreshExpiresAt().isAfter(Instant.now()));
    }

    @Transactional
    public CustomerSessionResult rotateSession(CustomerSessionEntity session) {
        String rawNewSession = jwtService.generateRawRefreshToken();
        String rawNewRefresh = jwtService.generateRawRefreshToken();
        String rawNewCsrf = jwtService.generateRawRefreshToken();

        Instant now = Instant.now();
        session.setSessionTokenHash(jwtService.hashToken(rawNewSession));
        session.setRefreshTokenHash(jwtService.hashToken(rawNewRefresh));
        session.setCsrfTokenHash(jwtService.hashToken(rawNewCsrf));
        session.setSessionExpiresAt(now.plusSeconds(SESSION_TTL_SECONDS));
        session.setRefreshExpiresAt(now.plusSeconds(REFRESH_TTL_SECONDS));
        session.setLastActiveAt(now);
        session.setUpdatedAt(now);
        sessionRepo.save(session);

        return new CustomerSessionResult(session.getId(), session.getCustomerId(), rawNewSession, rawNewRefresh, rawNewCsrf);
    }

    @Transactional
    public void revokeSession(CustomerSessionEntity session) {
        session.setStatus(STATUS_REVOKED);
        session.setRevokedAt(Instant.now());
        session.setUpdatedAt(Instant.now());
        sessionRepo.save(session);
    }

    @Transactional
    public void revokeAllSessions(UUID customerId) {
        Instant now = Instant.now();
        sessionRepo.findByCustomerIdAndStatus(customerId, STATUS_ACTIVE).forEach(s -> {
            s.setStatus(STATUS_REVOKED);
            s.setRevokedAt(now);
            s.setUpdatedAt(now);
            sessionRepo.save(s);
        });
    }
}
