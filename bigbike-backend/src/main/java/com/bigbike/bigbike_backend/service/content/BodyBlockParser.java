package com.bigbike.bigbike_backend.service.content;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Parses a legacy HTML body string into a list of {@link DescriptionBlock} objects.
 *
 * <p>Mapping rules (top-level nodes only):
 * <ul>
 *   <li>{@code <h2>} / {@code <h3>} → {@link DescriptionBlock.HeadingBlock}</li>
 *   <li>{@code <p>} → {@link DescriptionBlock.ParagraphBlock} (outerHTML stored)</li>
 *   <li>{@code <ul>} → {@link DescriptionBlock.ListBlock} style="bulleted"</li>
 *   <li>{@code <ol>} → {@link DescriptionBlock.ListBlock} style="numbered"</li>
 *   <li>{@code <figure>} with {@code <img>} → {@link DescriptionBlock.ImageBlock}</li>
 *   <li>Standalone {@code <img>} → {@link DescriptionBlock.ImageBlock}</li>
 *   <li>{@code <iframe>} pointing to YouTube / youtu.be → {@link DescriptionBlock.VideoBlock} provider="youtube"</li>
 *   <li>{@code <video>} with {@code <source>} → {@link DescriptionBlock.VideoBlock} provider="upload"</li>
 *   <li>{@code <blockquote>} → {@link DescriptionBlock.CalloutBlock} variant="note"</li>
 *   <li>{@code <hr>} → {@link DescriptionBlock.DividerBlock}</li>
 *   <li>{@code <div class="bb-feature">} → {@link DescriptionBlock.FeatureBlock} (image src/alt,
 *       eyebrow, heading, paragraphs, list decomposed); falls back to opaque HTML only when the
 *       div has neither a real image nor any text content at all</li>
 *   <li>Bare text node → {@link DescriptionBlock.ParagraphBlock}</li>
 *   <li>Any other element → fallback {@link DescriptionBlock.ParagraphBlock} (outerHTML preserved)</li>
 * </ul>
 *
 * <p>Nested {@code <ul>} / {@code <ol>} inside list items are flattened: top-level item text comes
 * first, then each nested item is prefixed with {@code " - "}.
 *
 * <p>This class is intentionally a plain instantiable service so the Flyway Java migration
 * ({@code V141__MigrateContentBodyToBlocks}) can create it with {@code new BodyBlockParser()}
 * without relying on the Spring context.
 */
@Service
public class BodyBlockParser {

    public List<DescriptionBlock> parseHtmlToBlocks(String html) {
        if (html == null || html.isBlank()) return List.of();

        Document doc = Jsoup.parseBodyFragment(html);
        Element body = doc.body();

        List<DescriptionBlock> blocks = new ArrayList<>();
        for (Node node : body.childNodes()) {
            if (node instanceof Element el) {
                DescriptionBlock block = parseElement(el);
                if (block != null) blocks.add(block);
            } else if (node instanceof TextNode tn) {
                String text = tn.text().trim();
                if (!text.isEmpty()) {
                    blocks.add(plainTextParagraph(text));
                }
            }
        }
        return blocks;
    }

    private DescriptionBlock parseElement(Element el) {
        return switch (el.tagName()) {
            case "h2"         -> heading(2, el);
            case "h3"         -> heading(3, el);
            case "p"          -> paragraph(el);
            case "ul"         -> list("bulleted", el);
            case "ol"         -> list("numbered", el);
            case "figure"     -> figure(el);
            case "img"        -> imageFromImg(el);
            case "iframe"     -> videoFromIframe(el);
            case "video"      -> videoFromVideo(el);
            case "blockquote" -> callout(el);
            case "hr"         -> divider();
            case "div"        -> el.hasClass("bb-feature") ? feature(el) : fallback(el);
            default           -> fallback(el);
        };
    }

    /**
     * {@code <div class="bb-feature">} → staggered image+text {@link DescriptionBlock.FeatureBlock}
     * (mirrors {@code DescriptionBlockRenderer.renderFeature}'s output shape, so a round-trip
     * parse→render is stable). No field is individually required (2026-07-05: {@code feature.url}'s
     * {@code @NotBlank} was dropped — see {@code DescriptionBlock.FeatureBlock} javadoc) — a block
     * is only dropped to the generic opaque-HTML {@link #fallback} when it has **neither** a real
     * image URL **nor** any text (subheading/heading/paragraph/list items all blank), mirroring the
     * admin block editor's own save-time filter ({@code hasImage || hasText} in
     * {@code product-detail/constants.js}). A placeholder {@code <img>} with no {@code src} (content
     * drafted before photos are shot) still becomes an editable text-only feature block as long as
     * there's real copy — the web renders it full-width with no image column.
     */
    private DescriptionBlock feature(Element el) {
        Element figure = el.selectFirst("figure");
        Element imgEl = figure != null ? figure.selectFirst("img") : el.selectFirst("> img");

        var block = new DescriptionBlock.FeatureBlock();
        block.setType("feature");
        if (imgEl != null && !imgEl.attr("src").isBlank()) {
            block.setUrl(imgEl.attr("src"));
            block.setAlt(imgEl.attr("alt"));
        }

        Element figcaption = figure != null ? figure.selectFirst("figcaption") : null;
        if (figcaption != null) block.setCaption(figcaption.text());

        Element eyebrow = el.selectFirst("> .bb-feature-eyebrow");
        if (eyebrow != null) block.setSubheading(eyebrow.text());

        Element headingEl = el.selectFirst("> h2, > h3");
        if (headingEl != null) block.setHeading(headingEl.text());

        StringBuilder html = new StringBuilder();
        for (Element child : el.children()) {
            if (child == figure || child == imgEl || child == eyebrow || child == headingEl) continue;
            if (child.tagName().equals("p") || child.tagName().equals("ul") || child.tagName().equals("ol")) {
                html.append(child.outerHtml());
            }
        }
        block.setHtml(html.toString());

        boolean hasImage = block.getUrl() != null && !block.getUrl().isBlank();
        boolean hasText = (block.getSubheading() != null && !block.getSubheading().isBlank())
                || (block.getHeading() != null && !block.getHeading().isBlank())
                || (block.getHtml() != null && !block.getHtml().isBlank());
        if (!hasImage && !hasText) {
            return fallback(el);
        }
        return block;
    }

    private DescriptionBlock.HeadingBlock heading(int level, Element el) {
        var block = new DescriptionBlock.HeadingBlock();
        block.setType("heading");
        block.setLevel(level);
        block.setText(el.text());
        return block;
    }

    private DescriptionBlock.ParagraphBlock paragraph(Element el) {
        var block = new DescriptionBlock.ParagraphBlock();
        block.setType("paragraph");
        block.setHtml(el.outerHtml());
        return block;
    }

    private DescriptionBlock.ListBlock list(String style, Element el) {
        var block = new DescriptionBlock.ListBlock();
        block.setType("list");
        block.setStyle(style);

        List<String> items = new ArrayList<>();
        for (Element li : el.select("> li")) {
            // Flatten nested lists: top-level text first, then nested items prefixed with " - "
            List<Element> nestedLists = li.select("> ul, > ol");
            if (!nestedLists.isEmpty()) {
                String mainText = li.ownText().trim();
                if (!mainText.isEmpty()) items.add(mainText);
                for (Element nested : nestedLists) {
                    for (Element nestedLi : nested.select("> li")) {
                        String nestedText = nestedLi.text().trim();
                        if (!nestedText.isEmpty()) items.add(" - " + nestedText);
                    }
                }
            } else {
                String text = li.text().trim();
                if (!text.isEmpty()) items.add(text);
            }
        }
        block.setItems(items.isEmpty() ? List.of("") : items);
        return block;
    }

    private DescriptionBlock figure(Element el) {
        Element img = el.selectFirst("img");
        if (img == null) return fallback(el);

        String src = img.attr("src");
        if (src.isBlank()) return fallback(el);

        var block = new DescriptionBlock.ImageBlock();
        block.setType("image");
        block.setUrl(src);
        block.setAlt(img.attr("alt"));
        Element figcaption = el.selectFirst("figcaption");
        block.setCaption(figcaption != null ? figcaption.text() : "");
        return block;
    }

    private DescriptionBlock imageFromImg(Element el) {
        String src = el.attr("src");
        if (src.isBlank()) return null;

        var block = new DescriptionBlock.ImageBlock();
        block.setType("image");
        block.setUrl(src);
        block.setAlt(el.attr("alt"));
        block.setCaption("");
        return block;
    }

    private DescriptionBlock videoFromIframe(Element el) {
        String src = el.attr("src");
        if (src.isBlank()) src = el.attr("data-src");
        if (src.isBlank()) return fallback(el);

        if (src.contains("youtube") || src.contains("youtu.be")) {
            var block = new DescriptionBlock.VideoBlock();
            block.setType("video");
            block.setProvider("youtube");
            block.setUrl(src);
            block.setCaption("");
            return block;
        }
        return fallback(el);
    }

    private DescriptionBlock videoFromVideo(Element el) {
        Element source = el.selectFirst("source");
        String url = source != null ? source.attr("src") : el.attr("src");
        if (url == null || url.isBlank()) return fallback(el);

        var block = new DescriptionBlock.VideoBlock();
        block.setType("video");
        block.setProvider("upload");
        block.setUrl(url);
        block.setCaption("");
        return block;
    }

    private DescriptionBlock.CalloutBlock callout(Element el) {
        var block = new DescriptionBlock.CalloutBlock();
        block.setType("callout");
        block.setVariant("note");
        block.setHtml(el.html());
        return block;
    }

    private DescriptionBlock.DividerBlock divider() {
        var block = new DescriptionBlock.DividerBlock();
        block.setType("divider");
        return block;
    }

    private DescriptionBlock.ParagraphBlock fallback(Element el) {
        var block = new DescriptionBlock.ParagraphBlock();
        block.setType("paragraph");
        block.setHtml(el.outerHtml());
        return block;
    }

    private DescriptionBlock.ParagraphBlock plainTextParagraph(String text) {
        var block = new DescriptionBlock.ParagraphBlock();
        block.setType("paragraph");
        block.setHtml("<p>" + escapeHtml(text) + "</p>");
        return block;
    }

    private static String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
