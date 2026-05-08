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
            int[] delaysMs = {1_000, 3_000};
            for (int attempt = 0; attempt <= delaysMs.length; attempt++) {
                try {
                    restClient.post()
                            .uri(revalidateUrl)
                            .header("x-revalidate-secret", secret)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(new RevalidateBody(tagList))
                            .retrieve()
                            .toBodilessEntity();
                    log.info("Web revalidation succeeded for tags {} (attempt {})", tagList, attempt + 1);
                    return;
                } catch (Exception e) {
                    if (attempt < delaysMs.length) {
                        log.warn("Web revalidation attempt {}/{} failed for tags {}: {} — retrying in {}ms",
                                attempt + 1, delaysMs.length + 1, tagList, e.getMessage(), delaysMs[attempt]);
                        try {
                            Thread.sleep(delaysMs[attempt]);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            return;
                        }
                    } else {
                        log.error("Web revalidation failed after {} attempts for tags {}: {}",
                                delaysMs.length + 1, tagList, e.getMessage());
                    }
                }
            }
        });
    }

    private record RevalidateBody(List<String> tags) {}
}
