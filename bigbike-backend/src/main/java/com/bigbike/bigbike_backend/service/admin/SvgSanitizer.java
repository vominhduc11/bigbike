package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Attribute;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.parser.Parser;

/**
 * Sanitizes admin-uploaded SVG so it is safe to store and serve. Strips every known SVG XSS
 * vector — {@code <script>}, event-handler attributes ({@code on*}), {@code javascript:} URIs,
 * external/non-fragment references, {@code <foreignObject>} and CSS-based vectors — keeping only
 * the static drawing primitives an icon needs.
 *
 * <p>The category menu/filter icon renders via CSS {@code mask-image}, which never executes SVG
 * script; this sanitizer additionally protects the case where the stored file is opened directly
 * at its {@code /media/...} URL.
 *
 * <p>Also acts as the <b>content gate</b> for the {@code image/svg+xml} declared MIME type: a
 * payload that does not parse to a valid {@code <svg>} root is rejected with a
 * {@link ValidationException}. Tika magic-byte detection is unreliable for XML, so structural
 * validation here replaces it for SVG.
 */
public final class SvgSanitizer {

    private SvgSanitizer() {}

    /** Elements that can run script, fetch/embed external content, or animate attrs to danger. */
    private static final Set<String> FORBIDDEN_ELEMENTS = Set.of(
            "script", "foreignobject", "iframe", "embed", "object", "a",
            "animate", "animatetransform", "animatemotion", "set",
            "handler", "listener", "audio", "video", "style", "image");

    /** URL-bearing attributes — only local fragment ({@code #id}) references survive. */
    private static final Set<String> URL_ATTRIBUTES = Set.of("href", "xlink:href", "src");

    /**
     * Returns a cleaned SVG document as UTF-8 bytes.
     *
     * @throws ValidationException if {@code raw} is empty or not a structurally valid SVG.
     */
    public static byte[] sanitize(byte[] raw) {
        if (raw == null || raw.length == 0) {
            throw ValidationException.fromField("file", "EMPTY_FILE", "File must not be empty.");
        }

        Document doc = Jsoup.parse(new String(raw, StandardCharsets.UTF_8), "", Parser.xmlParser());
        doc.outputSettings()
                .syntax(Document.OutputSettings.Syntax.xml)
                .prettyPrint(false)
                .charset(StandardCharsets.UTF_8);

        Element root = findSvgRoot(doc);
        if (root == null) {
            throw ValidationException.fromField("file", "INVALID_SVG", "File is not a valid SVG image.");
        }

        // Drop forbidden elements anywhere under the root.
        for (Element el : root.getAllElements()) {
            if (el != root && FORBIDDEN_ELEMENTS.contains(localName(el))) {
                el.remove();
            }
        }
        // Strip dangerous attributes from every surviving element (root included).
        for (Element el : root.getAllElements()) {
            sanitizeAttributes(el);
        }

        // Emit only the root subtree — discards any DOCTYPE / entity decls / comments / PIs.
        return root.outerHtml().getBytes(StandardCharsets.UTF_8);
    }

    private static Element findSvgRoot(Document doc) {
        for (Element el : doc.getAllElements()) {
            if ("svg".equals(localName(el))) {
                return el;
            }
        }
        return null;
    }

    private static void sanitizeAttributes(Element el) {
        // asList() is a snapshot — safe to remove from the live attribute set while iterating.
        for (Attribute attr : el.attributes().asList()) {
            String key = attr.getKey();
            String keyLower = key.toLowerCase(Locale.ROOT);
            String value = attr.getValue() == null ? "" : attr.getValue();
            String valLower = value.trim().toLowerCase(Locale.ROOT);

            boolean drop;
            if (keyLower.startsWith("on")) {
                drop = true; // inline event handlers
            } else if (URL_ATTRIBUTES.contains(keyLower)) {
                drop = !value.trim().startsWith("#"); // keep only local fragment refs
            } else if (keyLower.equals("style")) {
                drop = valLower.contains("url(") || valLower.contains("javascript:")
                        || valLower.contains("expression(") || valLower.contains("@import");
            } else {
                drop = valLower.contains("javascript:");
            }

            if (drop) {
                el.removeAttr(key);
            }
        }
    }

    private static String localName(Element el) {
        String tag = el.tagName();
        int colon = tag.indexOf(':');
        return (colon >= 0 ? tag.substring(colon + 1) : tag).toLowerCase(Locale.ROOT);
    }
}
