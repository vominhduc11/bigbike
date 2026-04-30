package com.bigbike.bigbike_backend.service.web;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestClient;

@Service
public class WebRevalidationService {

    private static final Logger log = LoggerFactory.getLogger(WebRevalidationService.class);

    private final boolean enabled;
    private final String revalidateUrl;
    private final String secret;
    private final RestClient restClient;

    public WebRevalidationService(
            @Value("${bigbike.web.revalidate-url:}") String revalidateUrl,
            @Value("${bigbike.web.revalidate-secret:}") String secret) {
        this.revalidateUrl = revalidateUrl.trim();
        this.secret = secret.trim();
        this.enabled = !this.revalidateUrl.isBlank() && !this.secret.isBlank();
        log.info("WebRevalidationService enabled={} url={}", this.enabled, this.revalidateUrl);
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3_000);
        factory.setReadTimeout(5_000);
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public void revalidate(String... tags) {
        if (!enabled || tags.length == 0) return;

        List<String> tagList = Arrays.stream(tags)
                .filter(tag -> tag != null && !tag.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new))
                .stream()
                .toList();
        if (tagList.isEmpty()) return;

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    dispatch(tagList);
                }
            });
            return;
        }

        dispatch(tagList);
    }

    private void dispatch(List<String> tagList) {
        CompletableFuture.runAsync(() -> {
            try {
                restClient.post()
                        .uri(revalidateUrl)
                        .header("x-revalidate-secret", secret)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(new RevalidateBody(tagList))
                        .retrieve()
                        .toBodilessEntity();
                log.info("Web revalidation succeeded for tags {}", tagList);
            } catch (Exception e) {
                log.warn("Web revalidation failed for tags {}: {}", tagList, e.getMessage());
            }
        });
    }

    private record RevalidateBody(List<String> tags) {}
}
