package com.bigbike.bigbike_backend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.servlet.FilterChain;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class IngressBoundaryFilterTest {

    private final IngressBoundaryFilter filter = new IngressBoundaryFilter(validProperties());

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/v1/admin",
            "/api/v1/admin/orders",
            "/API/V1/ADMIN/ORDERS",
            "/api/v1/Admin/orders",
            "/api/v1/admin;nhom=1/orders",
            "/api/v1/auth",
            "/api/v1/Auth/admin/invite",
            "/api/v1/auth;x=1/admin/invite",
            "/api/v1/auth%3Bx=1/admin/invite",
            "/api/v1/auth%253Bx=1/admin/invite",
            "/api/v1//admin/orders",
            "/ws",
            "/ws/websocket"
    })
    void cuaKhachCheGiauMoiDuongNhanVien(String path) throws Exception {
        FilterResult result = execute("api.bigbike.vn", path, true, null);

        assertHidden(result);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/v1/products",
            "/api/v1/customer/auth/login",
            "/api/v1/authentic",
            "/api/v1/settings/public",
            "/api/internal/redirect?path=/san-pham-cu"
    })
    void cuaKhachVanPhucVuDuongKhachVaDuongNoiBo(String path) throws Exception {
        assertThat(execute("api.bigbike.vn", path, false, null).chainInvoked()).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/v1/admin/dashboard",
            "/api/v1/auth/login",
            "/api/v1/articles",
            "/api/v1/articles/tin-moi",
            "/api/v1/catalog/facets",
            "/api/v1/settings/public",
            "/ws",
            "/ws/websocket"
    })
    void cuaNhanVienChiMoNamNhomVaChuongBao(String path) throws Exception {
        assertThat(execute("admin.bigbike.vn", path, false, null).chainInvoked()).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api",
            "/api/v1/products",
            "/api/v1/categories",
            "/api/v1/cart",
            "/api/v1/checkout",
            "/api/v1/customer/auth/login",
            "/api/v1/search-suggest",
            "/api/v1/catalog/facets/extra",
            "/api/v1/settings/public/extra",
            "/api/internal/redirect",
            "/actuator/health"
    })
    void cuaNhanVienCheGiauMoiDuongNgoaiDanhSach(String path) throws Exception {
        assertHidden(execute("admin.bigbike.vn", path, false, null));
    }

    @ParameterizedTest
    @ValueSource(strings = {"bigbike-backend", "BIGBIKE-BACKEND."})
    void tenDockerPhucVuStorefrontNhungKhongMoDuongNhanVien(String host) throws Exception {
        assertThat(execute(host, "/api/v1/products", false, null).chainInvoked()).isTrue();
        assertHidden(execute(host, "/api/v1/admin/orders", true, null));
    }

    @ParameterizedTest
    @ValueSource(strings = {"localhost", "127.0.0.1", "::1", "[::1]:8080"})
    void hostPhatTrienDungChungKhongLamHongKiemThu(String host) throws Exception {
        assertThat(execute(host, "/api/v1/products", false, null).chainInvoked()).isTrue();
        assertThat(execute(host, "/api/v1/admin/orders", true, null).chainInvoked()).isTrue();
        assertThat(execute(host, "/ws", true, null).chainInvoked()).isTrue();
    }

    @Test
    void hostKhongBietDongMacDinhVaKhongTinForwardedHost() throws Exception {
        assertHidden(execute("backend.example.net", "/api/v1/products", false, "admin.bigbike.vn"));
    }

    @Test
    void hostKhongPhanBietHoaThuongCongVaDauChamCuoi() throws Exception {
        assertThat(execute("ADMIN.BIGBIKE.VN.", "/api/v1/admin/dashboard", true, null)
                .chainInvoked()).isTrue();
        assertHidden(execute("API.BIGBIKE.VN:443", "/api/v1/auth/me", true, null));
    }

    @Test
    void phienNhanVienHopLeVanBiChanNeuDiSaiCua() throws Exception {
        FilterResult result = execute(
                "api.bigbike.vn",
                "/api/v1/admin/orders",
                true,
                null);

        assertHidden(result);
    }

    @Test
    void cauHinhKhongChoTatChotChan() {
        IngressBoundaryProperties properties = new IngressBoundaryProperties();
        properties.setEnabled(false);

        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Không được tắt");
    }

    @Test
    void cauHinhTuChoiHostBiXepVaoHaiCua() {
        IngressBoundaryProperties properties = new IngressBoundaryProperties();
        properties.setAdminHosts(List.of("admin.bigbike.vn"));
        properties.setPublicHosts(List.of("ADMIN.BIGBIKE.VN."));

        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("đồng thời");
    }

    @Test
    void cauHinhChuanHoaCongChuHoaVaDauCham() {
        IngressBoundaryProperties properties = new IngressBoundaryProperties();
        properties.setAdminHosts(List.of(" ADMIN.BIGBIKE.VN.:443 "));
        properties.setPublicHosts(List.of("API.BIGBIKE.VN", "bigbike-backend"));
        properties.setSharedHosts(List.of("LOCALHOST:8080", "[::1]:8080"));
        properties.validate();

        assertThat(properties.getAdminHosts()).containsExactly("admin.bigbike.vn");
        assertThat(properties.getSharedHosts()).containsExactly("localhost", "::1");
    }

    private FilterResult execute(
            String host,
            String path,
            boolean withAdminToken,
            String forwardedHost
    ) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setRequestURI(path);
        request.setServletPath(path);
        request.setServerName(host);
        if (withAdminToken) {
            request.addHeader("Authorization", "Bearer token-nhan-vien-hop-le-cho-bai-kiem");
        }
        if (forwardedHost != null) {
            request.addHeader("X-Forwarded-Host", forwardedHost);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chainInvoked = new AtomicBoolean();
        FilterChain chain = (ignoredRequest, ignoredResponse) -> chainInvoked.set(true);

        filter.doFilter(request, response, chain);
        return new FilterResult(response, chainInvoked.get());
    }

    private static void assertHidden(FilterResult result) {
        assertThat(result.chainInvoked()).isFalse();
        assertThat(result.response().getStatus()).isEqualTo(404);
        assertThat(result.response().getHeader("Cache-Control")).isEqualTo("no-store");
        assertThat(result.response().getContentAsByteArray()).isEmpty();
    }

    private static IngressBoundaryProperties validProperties() {
        IngressBoundaryProperties properties = new IngressBoundaryProperties();
        properties.validate();
        return properties;
    }

    private record FilterResult(MockHttpServletResponse response, boolean chainInvoked) {
    }
}
