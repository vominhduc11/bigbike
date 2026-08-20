package com.bigbike.bigbike_backend.util;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;

/**
 * Shared plain-text normalization for SEO metadata and migration backfills.
 * Rich descriptions remain HTML in their own fields; this class is only for
 * values that are written to or emitted as SEO title/description metadata.
 */
public final class SeoTextNormalizer {

    private SeoTextNormalizer() {
    }

    /**
     * Converts rich HTML to readable text and removes the known chat-widget
     * fragments that were accidentally imported into legacy descriptions.
     */
    public static String toPlainText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        Document document = Jsoup.parseBodyFragment(value);
        document.select(
                "#messageView, #messageViewContainer, #messageViewScroll, "
                        + ".message-view, .message-view__scroll, .message-view__scroll__inner, "
                        + ".chat-item, .chat-message, [data-component='bubble-message'], "
                        + "[data-component='message-view']"
        ).remove();

        String text = document.text()
                .replace('\u00a0', ' ')
                .replaceAll("\\s+", " ")
                .trim();
        return text.isEmpty() ? null : text;
    }

    /**
     * Converts a value to plain text and truncates it at a word boundary.
     * A null return means the input has no usable visible text.
     */
    public static String toDescription(String value, int maxLength) {
        String text = toPlainText(value);
        if (text == null || maxLength <= 0 || text.length() <= maxLength) {
            return text;
        }

        String cut = text.substring(0, maxLength + 1).trim();
        int boundary = cut.lastIndexOf(' ');
        if (boundary >= Math.max(1, maxLength / 2)) {
            cut = cut.substring(0, boundary).trim();
        } else {
            cut = text.substring(0, maxLength).trim();
        }
        return cut.isEmpty() ? null : cut;
    }
}
