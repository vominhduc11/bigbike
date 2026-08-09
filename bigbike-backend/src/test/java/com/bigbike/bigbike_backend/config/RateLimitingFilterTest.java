package com.bigbike.bigbike_backend.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.common.ApiMetaFactory;
import jakarta.servlet.FilterChain;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.ObjectMapper;

class RateLimitingFilterTest {

    @Test
    void rejectedRequestUsesStandardErrorEnvelope() throws Exception {
        RateLimitingFilter filter = createFilter("127.0.0.1");
        FilterChain chain = (request, response) -> { };

        MockHttpServletResponse rejected = null;
        for (int i = 0; i < 6; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
            request.setServletPath("/api/v1/auth/login");
            request.setRemoteAddr("203.0.113.10");
            request.setAttribute(ApiMetaFactory.REQUEST_ID_ATTRIBUTE, "rate-limit-request");
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, chain);
            rejected = response;
        }

        assertThat(rejected).isNotNull();
        assertThat(rejected.getStatus()).isEqualTo(429);
        assertThat(rejected.getContentAsString())
                .contains("\"code\":\"RATE_LIMIT_EXCEEDED\"")
                .contains("\"details\":[]")
                .contains("\"requestId\":\"rate-limit-request\"")
                .contains("\"timestamp\":");
    }

    @Test
    void reviewSubmitAllowsFiveRequestsPerClientIpPerMinute() throws Exception {
        RateLimitingFilter filter = createFilter("127.0.0.1");

        for (int i = 0; i < 5; i++) {
            FilterResult allowed = execute(
                    filter,
                    "/api/v1/products/product-1/reviews",
                    "203.0.113.10",
                    null);
            assertThat(allowed.chainInvoked()).isTrue();
        }

        FilterResult rejected = execute(
                filter,
                "/api/v1/products/product-1/reviews",
                "203.0.113.10",
                null);
        assertThat(rejected.chainInvoked()).isFalse();
        assertThat(rejected.response().getStatus()).isEqualTo(429);
    }

    @Test
    void reviewPhotoUploadAllowsThirtyRequestsPerClientIpPerMinute() throws Exception {
        RateLimitingFilter filter = createFilter("127.0.0.1");

        for (int i = 0; i < 30; i++) {
            FilterResult allowed = execute(
                    filter,
                    "/api/v1/products/product-1/reviews/photos",
                    "203.0.113.20",
                    null);
            assertThat(allowed.chainInvoked()).isTrue();
        }

        FilterResult rejected = execute(
                filter,
                "/api/v1/products/product-1/reviews/photos",
                "203.0.113.20",
                null);
        assertThat(rejected.chainInvoked()).isFalse();
        assertThat(rejected.response().getStatus()).isEqualTo(429);
    }

    @Test
    void chatAllowsTenMessagesPerClientIpPerMinute() throws Exception {
        RateLimitingFilter filter = createFilter("127.0.0.1");

        for (int i = 0; i < 10; i++) {
            assertThat(execute(
                    filter,
                    "/api/v1/chat/messages",
                    "203.0.113.55",
                    null).chainInvoked()).isTrue();
        }

        FilterResult rejected = execute(
                filter,
                "/api/v1/chat/messages",
                "203.0.113.55",
                null);
        assertThat(rejected.chainInvoked()).isFalse();
        assertThat(rejected.response().getStatus()).isEqualTo(429);
    }

    @Test
    void untrustedCallerCannotSpoofReviewBucketWithForwardedHeader() throws Exception {
        RateLimitingFilter filter = createFilter("127.0.0.1");

        FilterResult last = null;
        for (int i = 0; i < 6; i++) {
            last = execute(
                    filter,
                    "/api/v1/products/product-1/reviews",
                    "203.0.113.30",
                    "198.51.100." + (i + 1));
        }

        assertThat(last).isNotNull();
        assertThat(last.chainInvoked()).isFalse();
        assertThat(last.response().getStatus()).isEqualTo(429);
    }

    @ParameterizedTest
    @CsvSource({
            "10.0.0.1,10.0.0.1",
            "10.0.0.0/24,10.0.0.42"
    })
    void trustedExactOrCidrProxyUsesForwardedClientIp(
            String trustedProxyConfig,
            String remoteAddr
    ) throws Exception {
        RateLimitingFilter filter = createFilter(trustedProxyConfig);
        String firstClient = "198.51.100.10";

        for (int i = 0; i < 5; i++) {
            assertThat(execute(
                    filter,
                    "/api/v1/products/product-1/reviews",
                    remoteAddr,
                    firstClient).chainInvoked()).isTrue();
        }
        assertThat(execute(
                filter,
                "/api/v1/products/product-1/reviews",
                remoteAddr,
                firstClient).response().getStatus()).isEqualTo(429);

        FilterResult differentClient = execute(
                filter,
                "/api/v1/products/product-1/reviews",
                remoteAddr,
                "198.51.100.11");
        assertThat(differentClient.chainInvoked()).isTrue();
    }

    private static RateLimitingFilter createFilter(String trustedProxies) {
        return new RateLimitingFilter(
                trustedProxies,
                new ApiMetaFactory(),
                new ObjectMapper());
    }

    private static FilterResult execute(
            RateLimitingFilter filter,
            String path,
            String remoteAddr,
            String forwardedFor
    ) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
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

    private record FilterResult(MockHttpServletResponse response, boolean chainInvoked) {}
}
