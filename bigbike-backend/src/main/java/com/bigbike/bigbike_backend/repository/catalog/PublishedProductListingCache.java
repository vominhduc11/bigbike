package com.bigbike.bigbike_backend.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.Product;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;

/**
 * In-process snapshot of the published product listing projection, keyed by locale.
 *
 * <p>Storefront search matches and ranks in Java, so every keystroke used to reload the whole
 * catalogue — products, variants, options, brand and categories — straight from PostgreSQL. That
 * was the entire cost of a typeahead round trip (measured 0.50–1.00s on the live stack).
 *
 * <p>The snapshot is held in process rather than in Redis on purpose: the payload is the full
 * domain graph, so a Redis round trip would pay JSON serialisation on every read and defeat the
 * point. Correctness comes from {@link #invalidate()}, called after any committed catalogue write
 * (see {@code CatalogReferenceCacheEvictor}), so an admin edit is visible immediately. The short
 * TTL is only a safety net for anything that mutates the catalogue without going through those
 * services.
 */
@Component
public class PublishedProductListingCache {

    private static final Duration TTL = Duration.ofSeconds(60);
    private static final String DEFAULT_LOCALE = "vi";

    private record Snapshot(List<Product> products, Instant loadedAt) {
        boolean isFresh(Instant now) {
            return Duration.between(loadedAt, now).compareTo(TTL) < 0;
        }
    }

    private final Map<String, Snapshot> snapshots = new ConcurrentHashMap<>();

    /** Returns the cached listing for {@code locale}, loading it through {@code loader} on a miss. */
    public List<Product> get(String locale, Supplier<List<Product>> loader) {
        String key = locale == null || locale.isBlank() ? DEFAULT_LOCALE : locale;
        Instant now = Instant.now();
        Snapshot cached = snapshots.get(key);
        if (cached != null && cached.isFresh(now)) {
            return cached.products();
        }
        List<Product> loaded = List.copyOf(loader.get());
        snapshots.put(key, new Snapshot(loaded, now));
        return loaded;
    }

    /** Drops every locale snapshot. Called after a catalogue write commits. */
    public void invalidate() {
        snapshots.clear();
    }
}
