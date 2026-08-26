package com.bigbike.bigbike_backend.service.maintenance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.maintenance.MaintenanceStateEntity;
import com.bigbike.bigbike_backend.persistence.repository.maintenance.MaintenanceStateJpaRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class MaintenanceServiceTest {

    private final MaintenanceStateJpaRepository stateRepo = mock(MaintenanceStateJpaRepository.class);
    private final MaintenanceService service =
            new MaintenanceService(stateRepo, mock(SimpMessagingTemplate.class));

    private static MaintenanceStateEntity row(String state) {
        MaintenanceStateEntity entity = new MaintenanceStateEntity();
        entity.setId(MaintenanceStateEntity.SINGLETON_ID);
        entity.setState(state);
        entity.setUpdatedAt(Instant.now());
        return entity;
    }

    @Test
    void acceptsOnlyTheTwoOperationalStates() {
        assertThat(MaintenanceService.normalizedState("ACTIVE")).isEqualTo("ACTIVE");
        assertThat(MaintenanceService.normalizedState("normal")).isEqualTo("NORMAL");
    }

    @Test
    void rejectsUnknownOperationalState() {
        assertThatThrownBy(() -> MaintenanceService.normalizedState("LOCKED"))
                .isInstanceOfSatisfying(ValidationException.class, exception -> {
                    assertThat(exception.code()).isEqualTo("VALIDATION_ERROR");
                    assertThat(exception.details()).singleElement().satisfies(detail ->
                            assertThat(detail.message()).contains("NORMAL hoặc ACTIVE"));
                });
    }

    /**
     * Tests run on H2 with Flyway disabled, so V374's seed row does not exist. "No row" must read
     * as NORMAL — and fail-open is the right bias anyway for a lock that would otherwise brick the
     * admin panel after a bad deploy.
     */
    @Test
    void missingRowReadsAsNormalAndUnlocked() {
        when(stateRepo.findById(any())).thenReturn(Optional.empty());

        assertThat(service.getStatus().state()).isEqualTo(MaintenanceService.STATE_NORMAL);
        assertThat(service.isLocked()).isFalse();
    }

    @Test
    void onlyActiveCountsAsLocked() {
        when(stateRepo.findById(any())).thenReturn(Optional.of(row(MaintenanceService.STATE_NORMAL)));
        assertThat(service.isLocked()).isFalse();

        service.invalidateCache();
        when(stateRepo.findById(any())).thenReturn(Optional.of(row(MaintenanceService.STATE_ACTIVE)));
        assertThat(service.isLocked()).isTrue();
    }

    /**
     * The write-lock filter calls {@code isLocked()} on every admin mutation, so the answer is
     * cached. Anything that changes state must therefore drop the cache — otherwise an unlock
     * would appear to do nothing for up to the TTL.
     */
    @Test
    void cachedAnswerIsServedUntilInvalidated() {
        when(stateRepo.findById(any())).thenReturn(Optional.of(row(MaintenanceService.STATE_ACTIVE)));
        assertThat(service.isLocked()).isTrue();

        when(stateRepo.findById(any())).thenReturn(Optional.of(row(MaintenanceService.STATE_NORMAL)));
        assertThat(service.isLocked()).as("still cached").isTrue();

        service.invalidateCache();
        assertThat(service.isLocked()).as("re-read after invalidation").isFalse();
    }
}
