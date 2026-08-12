package com.bigbike.bigbike_backend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.net.InetAddress;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class ClientIpResolverTest {

    @Test
    void trustedExactProxyUsesCanonicalIpv4ForwardedAddress() {
        ClientIpResolver resolver = new ClientIpResolver("10.10.10.10");
        MockHttpServletRequest request = request("10.10.10.10", "198.51.100.42");

        assertThat(resolver.resolve(request)).isEqualTo("198.51.100.42");
    }

    @Test
    void trustedNarrowCidrUsesForwardedAddress() {
        ClientIpResolver resolver = new ClientIpResolver("10.10.20.0/24");
        MockHttpServletRequest request = request("10.10.20.99", "198.51.100.42");

        assertThat(resolver.resolve(request)).isEqualTo("198.51.100.42");
    }

    @Test
    void untrustedForwardedAddressIsIgnored() {
        ClientIpResolver resolver = new ClientIpResolver("10.10.10.10");
        MockHttpServletRequest request = request("203.0.113.1", "198.51.100.42");

        assertThat(resolver.resolve(request)).isEqualTo("203.0.113.1");
    }

    @Test
    void multiHopForwardedAddressIsIgnoredEvenFromTrustedProxy() {
        ClientIpResolver resolver = new ClientIpResolver("10.10.10.10");
        MockHttpServletRequest request = request("10.10.10.10", "198.51.100.42, 10.10.10.10");

        assertThat(resolver.resolve(request)).isEqualTo("10.10.10.10");
    }

    @Test
    void canonicalizesIpv6() throws Exception {
        ClientIpResolver resolver = new ClientIpResolver("::1");
        MockHttpServletRequest request = request("0:0:0:0:0:0:0:1", "2001:db8::42");

        assertThat(resolver.resolve(request)).isEqualTo(InetAddress.getByName("2001:db8::42").getHostAddress());
    }

    @Test
    void rejectsBroadOrPublicTrustedProxyCidrs() {
        assertThatIllegalArgumentException().isThrownBy(() -> new ClientIpResolver("172.16.0.0/12"));
        assertThatIllegalArgumentException().isThrownBy(() -> new ClientIpResolver("203.0.113.0/24"));
    }

    private static MockHttpServletRequest request(String remoteAddress, String forwardedFor) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(remoteAddress);
        request.addHeader("X-Forwarded-For", forwardedFor);
        return request;
    }
}
