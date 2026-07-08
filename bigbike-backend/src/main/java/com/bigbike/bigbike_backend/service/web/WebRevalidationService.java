package com.bigbike.bigbike_backend.service.web;

import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestClient;

@Service
@Slf4j
public class WebRevalidationService {

    private final boolean enabled;
    private final List<String> revalidateUrls;
    private final String secret;
    private final RestClient restClient;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final ProductJpaRepository productRepo;

    public WebRevalidationService(
            @Value("${bigbike.web.revalidate-url:}") String revalidateUrl,
            @Value("${bigbike.web.revalidate-secret:}") String secret,
            OrderLineItemJpaRepository lineItemRepo,
            ProductJpaRepository productRepo) {
        this.revalidateUrls = Arrays.stream(revalidateUrl.split(","))
                .map(String::trim)
                .filter(u -> !u.isBlank())
                .toList();
        this.secret = secret.trim();
        this.enabled = !this.revalidateUrls.isEmpty() && !this.secret.isBlank();
        log.info("WebRevalidationService enabled={} urls={}", this.enabled, this.revalidateUrls);
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3_000);
        factory.setReadTimeout(5_000);
        this.restClient = RestClient.builder().requestFactory(factory).build();
        this.lineItemRepo = lineItemRepo;
        this.productRepo = productRepo;
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

    /**
     * Resolves all product slugs touched by the given order and revalidates their ISR cache.
     * Always fires after transaction commit so it sees the committed stock state.
     * Safe to call inside or outside a transaction.
     */
    public void revalidateProductsForOrder(UUID orderId) {
        if (!enabled) return;

        List<String> productPks = lineItemRepo.findByOrderId(orderId).stream()
                .map(li -> li.getProductPk())
                .filter(pk -> pk != null && !pk.isBlank())
                .distinct()
                .toList();

        revalidateProductsByIds(productPks);
    }

    /**
     * Revalidates ISR cache for the given product PKs.
     * Used by scheduled jobs that restore stock outside the order context.
     */
    public void revalidateProductsByIds(List<String> productPks) {
        if (!enabled || productPks == null || productPks.isEmpty()) return;

        List<String> slugs = productRepo.findSlugsByIds(productPks);
        if (slugs.isEmpty()) return;

        List<String> tags = new ArrayList<>();
        tags.add("products");
        for (String slug : slugs) {
            tags.add("product:" + slug);
        }

        revalidate(tags.toArray(String[]::new));
    }

    private void dispatch(List<String> tagList) {
        for (String url : revalidateUrls) {
            CompletableFuture.runAsync(() -> dispatchToUrl(url, tagList));
        }
    }

    private void dispatchToUrl(String url, List<String> tagList) {
        int[] delaysMs = {1_000, 3_000};
        for (int attempt = 0; attempt <= delaysMs.length; attempt++) {
            try {
                restClient.post()
                        .uri(url)
                        .header("x-revalidate-secret", secret)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(new RevalidateBody(tagList))
                        .retrieve()
                        .toBodilessEntity();
                log.info("Web revalidation succeeded url={} tags={} (attempt {})", url, tagList, attempt + 1);
                return;
            } catch (Exception e) {
                if (attempt < delaysMs.length) {
                    log.warn("Web revalidation attempt {}/{} failed url={} tags={}: {} — retrying in {}ms",
                            attempt + 1, delaysMs.length + 1, url, tagList, e.getMessage(), delaysMs[attempt]);
                    try {
                        Thread.sleep(delaysMs[attempt]);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                } else {
                    log.error("Web revalidation failed after {} attempts url={} tags={}: {}",
                            delaysMs.length + 1, url, tagList, e.getMessage());
                }
            }
        }
    }

    public void revalidateProduct(String slug, String previousSlug) {
        revalidateEntityTags("products", "product:", previousSlug, slug, "home-highlights");
    }

    public void revalidateCategory(String slug, String previousSlug) {
        revalidateEntityTags("categories", "category:", previousSlug, slug, "products", "menus", "home-highlights");
    }

    public void revalidateBrand(String slug, String previousSlug) {
        revalidateEntityTags("brands", "brand:", previousSlug, slug, "products");
    }

    private void revalidateEntityTags(
            String listTag,
            String itemTagPrefix,
            String previousSlug,
            String currentSlug,
            String... relatedTags
    ) {
        LinkedHashSet<String> tags = new LinkedHashSet<>();
        addTag(tags, listTag);
        addSlugTag(tags, itemTagPrefix, previousSlug);
        addSlugTag(tags, itemTagPrefix, currentSlug);
        for (String relatedTag : relatedTags) {
            addTag(tags, relatedTag);
        }
        revalidate(tags.toArray(String[]::new));
    }

    private static void addSlugTag(LinkedHashSet<String> tags, String prefix, String slug) {
        String normalized = trimToNull(slug);
        if (normalized != null) {
            tags.add(prefix + normalized);
        }
    }

    private static void addTag(LinkedHashSet<String> tags, String tag) {
        String normalized = trimToNull(tag);
        if (normalized != null) {
            tags.add(normalized);
        }
    }

    private static String trimToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private record RevalidateBody(List<String> tags) {}
}
