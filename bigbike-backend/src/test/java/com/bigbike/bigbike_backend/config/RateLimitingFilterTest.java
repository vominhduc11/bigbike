package com.bigbike.bigbike_backend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.bigbike.bigbike_backend.api.common.ApiMetaFactory;
import com.bigbike.bigbike_backend.config.ratelimit.LocalRateLimitStore;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitKeyFactory;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitPolicyCatalog;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitProperties;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitResponseWriter;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitService;
import com.bigbike.bigbike_backend.config.ratelimit.RedisRateLimitStore;
import jakarta.servlet.FilterChain;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import tools.jackson.databind.ObjectMapper;

class RateLimitingFilterTest {

    @Test
    void rejectedRequestUsesStandardEnvelopeAndRetryAfter() throws Exception {
        RateLimitingFilter filter = createFilter("127.0.0.1");

        FilterResult rejected = null;
        for (int index = 0; index < 6; index++) {
            rejected = execute(filter, "POST", "/api/v1/auth/login", "203.0.113.10", null);
        }

        assertThat(rejected).isNotNull();
        assertThat(rejected.chainInvoked()).isFalse();
        assertThat(rejected.response().getStatus()).isEqualTo(429);
        assertThat(rejected.response().getHeader("Retry-After")).isNotBlank();
        assertThat(rejected.response().getHeader("Cache-Control")).isEqualTo("no-store");
        assertThat(rejected.response().getContentAsString())
                .contains("\"code\":\"RATE_LIMIT_EXCEEDED\"")
                .contains("\"requestId\":\"rate-limit-test-request\"")
                .contains("\"timestamp\":");
    }

    @Test
    void chatLeadAndDeclineUseTheSameChatTier() throws Exception {
        RateLimitingFilter filter = createFilter("127.0.0.1");

        for (int index = 0; index < 10; index++) {
            String path = index % 2 == 0 ? "/api/v1/chat/leads" : "/api/v1/chat/leads/decline";
            assertThat(execute(filter, "POST", path, "203.0.113.55", null).chainInvoked()).isTrue();
        }

        FilterResult rejected = execute(filter, "POST", "/api/v1/chat/messages", "203.0.113.55", null);
        assertThat(rejected.chainInvoked()).isFalse();
        assertThat(rejected.response().getStatus()).isEqualTo(429);
    }

    @Test
    void trustedProxyUsesOneCanonicalForwardedIp() throws Exception {
        RateLimitingFilter filter = createFilter("10.0.0.1");
        for (int index = 0; index < 5; index++) {
            assertThat(execute(filter, "POST", "/api/v1/products/product-1/reviews",
                    "10.0.0.1", "198.51.100.10").chainInvoked()).isTrue();
        }
        assertThat(execute(filter, "POST", "/api/v1/products/product-1/reviews",
                "10.0.0.1", "198.51.100.10").response().getStatus()).isEqualTo(429);
        assertThat(execute(filter, "POST", "/api/v1/products/product-1/reviews",
                "10.0.0.1", "198.51.100.11").chainInvoked()).isTrue();
    }

    @Test
    void multiHopForwardedChainDoesNotBypassTrustedProxyBucket() throws Exception {
        RateLimitingFilter filter = createFilter("10.0.0.1");
        FilterResult result = null;
        for (int index = 0; index < 6; index++) {
            result = execute(filter, "POST", "/api/v1/products/product-1/reviews", "10.0.0.1",
                    "198.51.100." + index + ", 10.0.0.1");
        }

        assertThat(result).isNotNull();
        assertThat(result.chainInvoked()).isFalse();
        assertThat(result.response().getStatus()).isEqualTo(429);
    }

    private static RateLimitingFilter createFilter(String trustedProxies) {
        RateLimitProperties properties = new RateLimitProperties();
        properties.setHmacSecret("test-rate-limit-hmac-secret-with-32-characters");
        SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
        LocalRateLimitStore localStore = new LocalRateLimitStore(properties, meterRegistry);
        @SuppressWarnings("unchecked")
        ObjectProvider<RedisRateLimitStore> redisStoreProvider = mock(ObjectProvider.class);
        Environment environment = new MockEnvironment();
        RateLimitService service = new RateLimitService(
                properties,
                new RateLimitKeyFactory(properties, environment),
                localStore,
                redisStoreProvider,
                meterRegistry);
        return new RateLimitingFilter(
                new ClientIpResolver(trustedProxies),
                new RateLimitPolicyCatalog(),
                service,
                new RateLimitResponseWriter(new ApiMetaFactory(), new ObjectMapper()));
    }

    private static FilterResult execute(
            RateLimitingFilter filter,
            String method,
            String path,
            String remoteAddr,
            String forwardedFor
    ) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setServletPath(path);
        request.setRequestURI(path);
        request.setRemoteAddr(remoteAddr);
        if (forwardedFor != null) {
            request.addHeader("X-Forwarded-For", forwardedFor);
        }
        request.setAttribute(ApiMetaFactory.REQUEST_ID_ATTRIBUTE, "rate-limit-test-request");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chainInvoked = new AtomicBoolean();
        FilterChain chain = (ignoredRequest, ignoredResponse) -> chainInvoked.set(true);

        filter.doFilter(request, response, chain);
        return new FilterResult(response, chainInvoked.get());
    }

    private record FilterResult(MockHttpServletResponse response, boolean chainInvoked) {
    }
}
