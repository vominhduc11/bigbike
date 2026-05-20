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
            default           -> fallback(el);
        };
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
