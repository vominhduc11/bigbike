package com.bigbike.bigbike_backend.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.common.ApiMetaFactory;
import jakarta.servlet.FilterChain;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.ObjectMapper;

class CustomerCsrfFilterTest {

    private final CustomerCsrfFilter filter =
            new CustomerCsrfFilter(new ObjectMapper(), new ApiMetaFactory());

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/v1/products/product-1/reviews",
            "/api/v1/products/product-1/reviews/photos"
    })
    void postReviewMutationsAreTheOnlyProductCsrfExemptions(String path) throws Exception {
        FilterResult result = execute("POST", path);

        assertThat(result.chainInvoked()).isTrue();
        assertThat(result.response().getStatus()).isEqualTo(200);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/v1/products/product-1/preview",
            "/api/v1/products/product-1/reviews/photos/extra"
    })
    void neighboringProductMutationsStillRequireCsrf(String path) throws Exception {
        FilterResult result = execute("POST", path);

        assertThat(result.chainInvoked()).isFalse();
        assertThat(result.response().getStatus()).isEqualTo(403);
        assertThat(result.response().getContentAsString()).contains("\"code\":\"CSRF_INVALID\"");
    }

    @Test
    void nonPostReviewMutationStillRequiresCsrf() throws Exception {
        FilterResult result = execute("PATCH", "/api/v1/products/product-1/reviews");

        assertThat(result.chainInvoked()).isFalse();
        assertThat(result.response().getStatus()).isEqualTo(403);
    }

    private FilterResult execute(String method, String path) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRequestURI(path);
        request.setServletPath(path);
        request.setAttribute(ApiMetaFactory.REQUEST_ID_ATTRIBUTE, "csrf-test-request");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chainInvoked = new AtomicBoolean();
        FilterChain chain = (ignoredRequest, ignoredResponse) -> chainInvoked.set(true);

        filter.doFilter(request, response, chain);

        return new FilterResult(response, chainInvoked.get());
    }

    private record FilterResult(MockHttpServletResponse response, boolean chainInvoked) {}
}
