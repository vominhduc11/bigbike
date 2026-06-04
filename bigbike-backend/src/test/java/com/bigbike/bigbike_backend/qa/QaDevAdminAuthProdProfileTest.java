package com.bigbike.bigbike_backend.qa;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.error.AuthNotImplementedException;
import com.bigbike.bigbike_backend.api.error.UnauthorizedException;
import com.bigbike.bigbike_backend.service.auth.AdminPermissionService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * QA — Item 18 (🔴): the dev/mock header-auth bypass (DevAdminAuthService) must FAIL-FAST under
 * the production profile, so a misconfigured prod deploy can never fall back to mock admin auth.
 *
 * Oracle: docs/engineering/PERMISSION_MATRIX.md (real admin auth only in prod) + the service's own
 * ensureDevMockProfile() guard. Pure unit test (Mockito) — no Spring context, no DB.
 */
class QaDevAdminAuthProdProfileTest {

    private DevAdminAuthService service(boolean devHeaderEnabled, String... activeProfiles) {
        Environment env = mock(Environment.class);
        when(env.getActiveProfiles()).thenReturn(activeProfiles);
        AdminPermissionService perm = mock(AdminPermissionService.class);
        when(perm.getPermissionsForRole("ADMIN")).thenReturn(List.of("*"));
        DevAdminAuthService svc = new DevAdminAuthService(env, perm);
        ReflectionTestUtils.setField(svc, "devHeaderEnabled", devHeaderEnabled);
        return svc;
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("prod profile + dev-header enabled -> AuthNotImplementedException (mock auth blocked)")
    void prodProfileBlocksDevHeaderAuth() {
        DevAdminAuthService svc = service(true, "prod");
        HttpServletRequest req = mock(HttpServletRequest.class);
        assertThatThrownBy(() -> svc.currentAdminUser(req))
                .isInstanceOf(AuthNotImplementedException.class);
    }

    @Test
    @DisplayName("'production' profile spelling is also blocked")
    void productionProfileSpellingBlocked() {
        DevAdminAuthService svc = service(true, "production");
        assertThatThrownBy(() -> svc.currentAdminUser(mock(HttpServletRequest.class)))
                .isInstanceOf(AuthNotImplementedException.class);
    }

    @Test
    @DisplayName("prod profile mixed with dev is still blocked (explicit prod wins)")
    void prodMixedWithDevStillBlocked() {
        DevAdminAuthService svc = service(true, "dev", "prod");
        assertThatThrownBy(() -> svc.currentAdminUser(mock(HttpServletRequest.class)))
                .isInstanceOf(AuthNotImplementedException.class);
    }

    @Test
    @DisplayName("requirePermission under prod profile (no JWT) also fails fast")
    void requirePermissionUnderProdFailsFast() {
        DevAdminAuthService svc = service(true, "prod");
        assertThatThrownBy(() -> svc.requirePermission(mock(HttpServletRequest.class), "orders.read"))
                .isInstanceOf(AuthNotImplementedException.class);
    }

    @Test
    @DisplayName("dev-header DISABLED (default) -> UnauthorizedException, never mock auth")
    void devHeaderDisabledRejects() {
        DevAdminAuthService svc = service(false, "dev");
        assertThatThrownBy(() -> svc.currentAdminUser(mock(HttpServletRequest.class)))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    @DisplayName("dev profile + enabled -> mock auth allowed (control: guard is prod-specific)")
    void devProfileAllowsMockAuth() {
        DevAdminAuthService svc = service(true, "dev");
        HttpServletRequest req = mock(HttpServletRequest.class);
        // headers null -> defaults role ADMIN, permissions from (mocked) AdminPermissionService
        assertThatCode(() -> svc.currentAdminUser(req)).doesNotThrowAnyException();
    }
}
