package com.bigbike.bigbike_backend.service.analytics;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class Ga4MeasurementClient {

    private static final String MEASUREMENT_ID_PATTERN = "^G-[A-Z0-9]{4,}$";
    private final RestClient restClient;
    private final URI collectUri;
    private final boolean enabled;

    public Ga4MeasurementClient(
            @Value("${bigbike.analytics.ga4.measurement-id:}") String measurementId,
            @Value("${bigbike.analytics.ga4.api-secret:}") String apiSecret,
            @Value("${bigbike.analytics.ga4.collect-base-url:https://www.google-analytics.com}")
            String collectBaseUrl
    ) {
        String normalizedMeasurementId = trim(measurementId);
        String normalizedApiSecret = trim(apiSecret);
        this.enabled = normalizedMeasurementId.matches(MEASUREMENT_ID_PATTERN)
                && !normalizedApiSecret.isBlank();
        String baseUrl = trim(collectBaseUrl);
        if (baseUrl.isBlank()) baseUrl = "https://www.google-analytics.com";
        while (baseUrl.endsWith("/")) baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        this.collectUri = UriComponentsBuilder.fromUriString(baseUrl)
                .path("/mp/collect")
                .queryParam("measurement_id", normalizedMeasurementId)
                .queryParam("api_secret", normalizedApiSecret)
                .build()
                .encode()
                .toUri();
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5_000);
        requestFactory.setReadTimeout(8_000);
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void send(String payloadJson) {
        if (!enabled) return;
        try {
            restClient.post()
                    .uri(collectUri)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payloadJson)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException exception) {
            int status = exception.getStatusCode().value();
            throw new DeliveryException("HTTP_" + status);
        } catch (ResourceAccessException exception) {
            // Do not retain the exception message: it can include the URI query containing the
            // server-only API secret.
            throw new DeliveryException("NETWORK");
        }
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    public static final class DeliveryException extends RuntimeException {
        private final String code;

        DeliveryException(String code) {
            super(code, null, false, false);
            this.code = code;
        }

        public String code() {
            return code;
        }
    }
}
