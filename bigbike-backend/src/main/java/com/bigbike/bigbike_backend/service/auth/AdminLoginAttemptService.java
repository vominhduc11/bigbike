package com.bigbike.bigbike_backend.service.auth;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Records failed admin-login attempts and applies a temporary account lockout.
 *
 * <p>The failure counter MUST survive the login transaction rolling back (login() throws on a
 * bad password). This service therefore writes in its own {@code REQUIRES_NEW} transaction, so
 * the increment commits independently of the caller's doomed transaction. It is a separate bean
 * (not a self-invoked method) so the Spring proxy actually applies the new propagation.
 */
@Service
@RequiredArgsConstructor
public class AdminLoginAttemptService {

    /** Consecutive failures before the account is locked. */
    static final int MAX_FAILED_ATTEMPTS = 5;
    /** How long an account stays locked once the threshold is hit. */
    static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    private final AdminUserJpaRepository adminUserRepo;

    /**
     * Increment the failed-attempt counter for the given user. When the threshold is reached the
     * account is locked for {@link #LOCK_DURATION} and the counter is reset.
     *
     * @return {@code true} if this failure just locked the account, {@code false} otherwise.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean recordFailure(UUID userId) {
        AdminUserEntity user = adminUserRepo.findById(userId).orElse(null);
        if (user == null) {
            return false;
        }
        int attempts = user.getFailedLoginAttempts() + 1;
        boolean lockedNow = false;
        if (attempts >= MAX_FAILED_ATTEMPTS) {
            user.setLockedUntil(Instant.now().plus(LOCK_DURATION));
            user.setFailedLoginAttempts(0);
            lockedNow = true;
        } else {
            user.setFailedLoginAttempts(attempts);
        }
        user.setUpdatedAt(Instant.now());
        adminUserRepo.save(user);
        return lockedNow;
    }
}
