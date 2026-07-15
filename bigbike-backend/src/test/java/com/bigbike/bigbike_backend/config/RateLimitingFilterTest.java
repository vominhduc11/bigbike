package com.bigbike.bigbike_backend.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.common.ApiMetaFactory;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.ObjectMapper;

class RateLimitingFilterTest {

    @Test
    void rejectedRequestUsesStandardErrorEnvelope() throws Exception {
        RateLimitingFilter filter = new RateLimitingFilter(
                "127.0.0.1",
                new ApiMetaFactory(),
                new ObjectMapper());
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
}
