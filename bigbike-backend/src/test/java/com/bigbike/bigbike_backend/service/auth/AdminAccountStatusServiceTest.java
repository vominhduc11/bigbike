package com.bigbike.bigbike_backend.service.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class AdminAccountStatusServiceTest {
    @Test void lateLoaderCannotRestoreActiveStatusAndOldAccessVersion() throws Exception { race(false); }
    @Test void lateLoaderCannotOverwriteFreshDisabledSnapshot() throws Exception { race(true); }

    private void race(boolean freshWinsFirst) throws Exception {
        AdminUserJpaRepository repo = mock(AdminUserJpaRepository.class);
        AdminAccountStatusService service = new AdminAccountStatusService(repo);
        UUID id = UUID.randomUUID();
        CountDownLatch read = new CountDownLatch(1), release = new CountDownLatch(1);
        AtomicInteger calls = new AtomicInteger();
        when(repo.findById(id)).thenAnswer(invocation -> {
            AdminUserEntity snapshot = account(id, calls.incrementAndGet() == 1);
            if (calls.get() == 1) {
                read.countDown();
                if (!release.await(5, TimeUnit.SECONDS)) throw new AssertionError("Loader not released");
            }
            return Optional.of(snapshot);
        });
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<AdminAccountStatusService.Snapshot> old = executor.submit(() -> service.getSnapshot(id));
            assertThat(read.await(5, TimeUnit.SECONDS)).isTrue();
            executor.submit(() -> service.evict(id)).get(5, TimeUnit.SECONDS);
            if (freshWinsFirst) assertThat(service.getSnapshot(id).status()).isEqualTo("DISABLED");
            release.countDown();
            assertThat(old.get(5, TimeUnit.SECONDS).status()).isEqualTo("ACTIVE");
            assertThat(service.getSnapshot(id)).isEqualTo(new AdminAccountStatusService.Snapshot("OPERATIONS", "DISABLED", 2));
            assertThat(calls.get()).isEqualTo(2);
        } finally {
            release.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test void hotReadsAndOtherAccountsRemainCached() {
        AdminUserJpaRepository repo = mock(AdminUserJpaRepository.class);
        UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(account(id, true)));
        AdminAccountStatusService service = new AdminAccountStatusService(repo);
        AdminAccountStatusService.Snapshot cached = service.getSnapshot(id);
        service.evict(UUID.randomUUID());
        assertThat(service.getSnapshot(id)).isSameAs(cached);
        verify(repo, times(1)).findById(id);
    }

    @Test void unknownAccountIsNotNegativelyCached() {
        AdminUserJpaRepository repo = mock(AdminUserJpaRepository.class);
        UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.empty(), Optional.of(account(id, false)));
        AdminAccountStatusService service = new AdminAccountStatusService(repo);
        assertThat(service.getSnapshot(id)).isNull();
        assertThat(service.getSnapshot(id).accessVersion()).isEqualTo(2);
        verify(repo, times(2)).findById(id);
    }

    private static AdminUserEntity account(UUID id, boolean beforeDisable) {
        AdminUserEntity user = new AdminUserEntity();
        user.setId(id);
        user.setRole("OPERATIONS");
        user.setStatus(beforeDisable ? "ACTIVE" : "DISABLED");
        user.setAccessVersion(beforeDisable ? 1 : 2);
        return user;
    }
}
