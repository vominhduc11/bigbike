package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;

@SpringBootTest(properties = {
        "management.endpoints.web.exposure.include=health,info,prometheus",
        "management.prometheus.metrics.export.enabled=true",
        "management.endpoint.prometheus.access=unrestricted"
})
class PrometheusEndpointTest {

    @Autowired PrometheusMeterRegistry prometheusMeterRegistry;

    @Test
    void internalPrometheusEndpointHasARealRegistryWhenDependencyIsOnClasspath() {
        assertThat(prometheusMeterRegistry.scrape()).contains("jvm_");
    }
}
