package com.bigbike.bigbike_backend.service.catalog;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Service;
import java.util.List;

/**
 * Converts a list of {@link DescriptionBlock} objects to a sanitized HTML string
 * suitable for storage in the {@code products.description} column.
 *
 * <p>Rendering rules per block type:
 * <ul>
 *   <li>heading → &lt;h2&gt; or &lt;h3&gt;</li>
 *   <li>paragraph → &lt;p&gt; wrapping the inline HTML</li>
 *   <li>list → &lt;ul&gt; or &lt;ol&gt; with &lt;li&gt; items</li>
 *   <li>image → &lt;figure&gt;&lt;img&gt;&lt;figcaption&gt;</li>
 *   <li>video → &lt;div class="bb-video"&gt; with data attributes (no iframe)</li>
 *   <li>callout → &lt;div class="bb-callout bb-callout-{variant}"&gt;</li>
 *   <li>divider → &lt;hr&gt;</li>
 * </ul>
 *
 * <p>The final HTML is passed through Jsoup's safelist sanitizer to strip any
 * XSS vectors (script tags, on* event handlers, javascript: URIs) that may be
 * present in inline HTML fields (paragraph.html, callout.html).
 */
@Service
public class DescriptionBlockRenderer {

    private static final Safelist SAFELIST = buildSafelist();

    /**
     * Renders {@code blocks} to sanitized HTML. Returns an empty string when
     * {@code blocks} is null or empty.
     */
    public String renderBlocksToHtml(List<DescriptionBlock> blocks) {
        if (blocks == null || blocks.isEmpty()) return "";

        StringBuilder sb = new StringBuilder();
        for (DescriptionBlock block : blocks) {
            sb.append(renderBlock(block));
        }

        return Jsoup.clean(sb.toString(), "", SAFELIST);
    }

    private String renderBlock(DescriptionBlock block) {
        if (block instanceof DescriptionBlock.HeadingBlock b)   return renderHeading(b);
        if (block instanceof DescriptionBlock.ParagraphBlock b) return renderParagraph(b);
        if (block instanceof DescriptionBlock.ListBlock b)      return renderList(b);
        if (block instanceof DescriptionBlock.ImageBlock b)     return renderImage(b);
        if (block instanceof DescriptionBlock.VideoBlock b)     return renderVideo(b);
        if (block instanceof DescriptionBlock.CalloutBlock b)   return renderCallout(b);
        if (block instanceof DescriptionBlock.DividerBlock)     return "<hr>";
        return "";
    }

    private String renderHeading(DescriptionBlock.HeadingBlock b) {
        int level = b.getLevel() != null ? b.getLevel() : 2;
        String tag = "h" + level;
        return "<" + tag + ">" + escapeHtml(b.getText()) + "</" + tag + ">";
    }

    private String renderParagraph(DescriptionBlock.ParagraphBlock b) {
        // html field may already contain <p> — wrap only if it doesn't
        String html = b.getHtml();
        if (html == null) return "";
        String trimmed = html.strip();
        if (trimmed.startsWith("<p") || trimmed.startsWith("<P")) {
            return trimmed;
        }
        return "<p>" + trimmed + "</p>";
    }

    private String renderList(DescriptionBlock.ListBlock b) {
        String tag = "numbered".equals(b.getStyle()) ? "ol" : "ul";
        StringBuilder sb = new StringBuilder("<").append(tag).append(">");
        if (b.getItems() != null) {
            for (String item : b.getItems()) {
                sb.append("<li>").append(escapeHtml(item)).append("</li>");
            }
        }
        sb.append("</").append(tag).append(">");
        return sb.toString();
    }

    private String renderImage(DescriptionBlock.ImageBlock b) {
        StringBuilder sb = new StringBuilder("<figure>");
        sb.append("<img src=\"").append(escapeAttr(b.getUrl())).append("\"");
        if (b.getAlt() != null && !b.getAlt().isBlank()) {
            sb.append(" alt=\"").append(escapeAttr(b.getAlt())).append("\"");
        }
        sb.append(">");
        if (b.getCaption() != null && !b.getCaption().isBlank()) {
            sb.append("<figcaption>").append(escapeHtml(b.getCaption())).append("</figcaption>");
        }
        sb.append("</figure>");
        return sb.toString();
    }

    private String renderVideo(DescriptionBlock.VideoBlock b) {
        // Rendered as a data-attribute div so no script execution risk.
        // Phase 2 web integration replaces this with an actual embed.
        StringBuilder sb = new StringBuilder("<div class=\"bb-video\"");
        sb.append(" data-provider=\"").append(escapeAttr(b.getProvider())).append("\"");
        sb.append(" data-src=\"").append(escapeAttr(b.getUrl())).append("\"");
        sb.append(">");
        if (b.getCaption() != null && !b.getCaption().isBlank()) {
            sb.append("<p class=\"bb-video-caption\">").append(escapeHtml(b.getCaption())).append("</p>");
        }
        sb.append("</div>");
        return sb.toString();
    }

    private String renderCallout(DescriptionBlock.CalloutBlock b) {
        String variant = b.getVariant() != null ? b.getVariant() : "info";
        StringBuilder sb = new StringBuilder("<div class=\"bb-callout bb-callout-").append(variant).append("\">");
        if (b.getHtml() != null) {
            sb.append(b.getHtml());
        }
        sb.append("</div>");
        return sb.toString();
    }

    private static String escapeHtml(String text) {
        if (text == null) return "";
        return text
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private static String escapeAttr(String value) {
        if (value == null) return "";
        return value
                .replace("&", "&amp;")
                .replace("\"", "&quot;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }

    private static Safelist buildSafelist() {
        return new Safelist()
                .addTags("h2", "h3", "p", "ul", "ol", "li", "hr", "br",
                         "b", "i", "strong", "em", "a", "img",
                         "figure", "figcaption", "div")
                .addAttributes("a", "href", "rel", "target")
                .addAttributes("img", "src", "alt", "width", "height")
                .addAttributes("div", "class", "data-provider", "data-src")
                .addAttributes("p", "class")
                .addProtocols("a", "href", "http", "https", "mailto")
                .addProtocols("img", "src", "http", "https");
    }
}
