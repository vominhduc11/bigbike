package com.bigbike.bigbike_backend.service.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminRoleEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminRoleJpaRepository;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class AdminPermissionServiceTest {
    @Test void lateLoaderCannotRestoreRevokedPermissions() throws Exception { race(false); }
    @Test void lateLoaderCannotOverwriteFreshPermissions() throws Exception { race(true); }

    private void race(boolean freshWinsFirst) throws Exception {
        AdminRoleJpaRepository repo = mock(AdminRoleJpaRepository.class);
        AdminPermissionService service = new AdminPermissionService(repo);
        CountDownLatch read = new CountDownLatch(1), release = new CountDownLatch(1);
        AtomicInteger calls = new AtomicInteger();
        when(repo.findById("OPERATIONS")).thenAnswer(invocation -> {
            AdminRoleEntity snapshot = role(calls.incrementAndGet() == 1);
            if (calls.get() == 1) {
                read.countDown();
                if (!release.await(5, TimeUnit.SECONDS)) throw new AssertionError("Loader not released");
            }
            return Optional.of(snapshot);
        });
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<List<String>> old = executor.submit(() -> service.getPermissionsForRole("operations"));
            assertThat(read.await(5, TimeUnit.SECONDS)).isTrue();
            executor.submit(() -> service.evict("operations")).get(5, TimeUnit.SECONDS);
            if (freshWinsFirst) assertThat(service.getPermissionsForRole("OPERATIONS")).containsExactly("products.read");
            release.countDown();
            assertThat(old.get(5, TimeUnit.SECONDS)).contains("products.update");
            assertThat(service.getPermissionsForRole("OPERATIONS")).containsExactly("products.read");
            assertThat(calls.get()).isEqualTo(2);
        } finally {
            release.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test void hotReadsStayNormalizedImmutableAndIndependentOfOtherRoleEviction() {
        AdminRoleJpaRepository repo = mock(AdminRoleJpaRepository.class);
        when(repo.findById("OPERATIONS")).thenReturn(Optional.of(role(true)));
        AdminPermissionService service = new AdminPermissionService(repo);
        List<String> permissions = service.getPermissionsForRole("operations");
        assertThatThrownBy(() -> permissions.add("*")).isInstanceOf(UnsupportedOperationException.class);
        service.evict("OTHER");
        assertThat(service.getPermissionsForRole("OPERATIONS")).isSameAs(permissions);
        verify(repo, times(1)).findById("OPERATIONS");
    }

    @Test void unknownRoleIsNotCachedAndNullDoesNotReadDatabase() {
        AdminRoleJpaRepository repo = mock(AdminRoleJpaRepository.class);
        when(repo.findById("OPERATIONS")).thenReturn(Optional.empty(), Optional.of(role(false)));
        AdminPermissionService service = new AdminPermissionService(repo);
        assertThat(service.getPermissionsForRole(null)).isEmpty();
        assertThat(service.getPermissionsForRole("operations")).isEmpty();
        assertThat(service.getPermissionsForRole("operations")).containsExactly("products.read");
        verify(repo, times(2)).findById("OPERATIONS");
    }

    private static AdminRoleEntity role(boolean beforeRevoke) {
        AdminRoleEntity role = new AdminRoleEntity();
        role.setId("OPERATIONS");
        role.setPermissions(new LinkedHashSet<>(beforeRevoke
                ? List.of("products.read", "products.update") : List.of("products.read")));
        return role;
    }
}
