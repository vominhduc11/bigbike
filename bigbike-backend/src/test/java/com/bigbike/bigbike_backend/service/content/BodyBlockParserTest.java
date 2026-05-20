package com.bigbike.bigbike_backend.service.content;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BodyBlockParserTest {

    private BodyBlockParser parser;

    @BeforeEach
    void setUp() {
        parser = new BodyBlockParser();
    }

    // ── Headings ──────────────────────────────────────────────────────────────

    @Test
    void h2_parsesToHeadingBlockLevel2() {
        var blocks = parser.parseHtmlToBlocks("<h2>Chất liệu cao cấp</h2>");
        assertThat(blocks).hasSize(1);
        var b = assertHeading(blocks.get(0));
        assertThat(b.getLevel()).isEqualTo(2);
        assertThat(b.getText()).isEqualTo("Chất liệu cao cấp");
        assertThat(b.getType()).isEqualTo("heading");
    }

    @Test
    void h3_parsesToHeadingBlockLevel3() {
        var blocks = parser.parseHtmlToBlocks("<h3>Tính năng nổi bật</h3>");
        var b = assertHeading(blocks.get(0));
        assertThat(b.getLevel()).isEqualTo(3);
        assertThat(b.getText()).isEqualTo("Tính năng nổi bật");
    }

    @Test
    void heading_stripsInlineTagsForText() {
        var blocks = parser.parseHtmlToBlocks("<h2>Sản phẩm <strong>chất lượng</strong> cao</h2>");
        var b = assertHeading(blocks.get(0));
        assertThat(b.getText()).isEqualTo("Sản phẩm chất lượng cao");
    }

    // ── Paragraphs ────────────────────────────────────────────────────────────

    @Test
    void p_parsesToParagraphBlockWithOuterHtml() {
        var blocks = parser.parseHtmlToBlocks("<p>Sản phẩm <b>chính hãng</b> 100%.</p>");
        var b = assertParagraph(blocks.get(0));
        assertThat(b.getHtml()).contains("<b>chính hãng</b>");
        assertThat(b.getHtml()).startsWith("<p>");
        assertThat(b.getType()).isEqualTo("paragraph");
    }

    @Test
    void p_withOnlyInlineContent_keepsInnerMarkup() {
        var blocks = parser.parseHtmlToBlocks("<p><a href=\"/test\">link</a></p>");
        var b = assertParagraph(blocks.get(0));
        assertThat(b.getHtml()).contains("href");
    }

    // ── Lists ─────────────────────────────────────────────────────────────────

    @Test
    void ul_parsesToBulletedListBlock() {
        var blocks = parser.parseHtmlToBlocks("<ul><li>Mũ fullface</li><li>ECE 22.06</li></ul>");
        var b = assertList(blocks.get(0));
        assertThat(b.getStyle()).isEqualTo("bulleted");
        assertThat(b.getItems()).containsExactly("Mũ fullface", "ECE 22.06");
        assertThat(b.getType()).isEqualTo("list");
    }

    @Test
    void ol_parsesToNumberedListBlock() {
        var blocks = parser.parseHtmlToBlocks("<ol><li>Bước 1</li><li>Bước 2</li></ol>");
        var b = assertList(blocks.get(0));
        assertThat(b.getStyle()).isEqualTo("numbered");
        assertThat(b.getItems()).containsExactly("Bước 1", "Bước 2");
    }

    @Test
    void nestedUl_flattensChildItemsWithDashPrefix() {
        String html = "<ul><li>Bảo hộ<ul><li>Tay</li><li>Chân</li></ul></li><li>Mũ</li></ul>";
        var blocks = parser.parseHtmlToBlocks(html);
        var b = assertList(blocks.get(0));
        assertThat(b.getItems()).containsExactly("Bảo hộ", " - Tay", " - Chân", "Mũ");
    }

    @Test
    void emptyLiItems_areSkipped() {
        var blocks = parser.parseHtmlToBlocks("<ul><li>  </li><li>Item</li></ul>");
        var b = assertList(blocks.get(0));
        assertThat(b.getItems()).containsExactly("Item");
    }

    @Test
    void listWithNoNonEmptyItems_returnsPlaceholder() {
        var blocks = parser.parseHtmlToBlocks("<ul><li>  </li></ul>");
        var b = assertList(blocks.get(0));
        assertThat(b.getItems()).containsExactly("");
    }

    // ── Images ────────────────────────────────────────────────────────────────

    @Test
    void figure_withImgAndFigcaption_parsesToImageBlock() {
        String html = "<figure><img src=\"https://cdn.bigbike.vn/helmet.jpg\" alt=\"LS2\">"
                + "<figcaption>LS2 FF800 màu đỏ</figcaption></figure>";
        var blocks = parser.parseHtmlToBlocks(html);
        var b = assertImage(blocks.get(0));
        assertThat(b.getUrl()).isEqualTo("https://cdn.bigbike.vn/helmet.jpg");
        assertThat(b.getAlt()).isEqualTo("LS2");
        assertThat(b.getCaption()).isEqualTo("LS2 FF800 màu đỏ");
        assertThat(b.getType()).isEqualTo("image");
    }

    @Test
    void figure_withoutFigcaption_hasEmptyCaption() {
        String html = "<figure><img src=\"https://cdn.bigbike.vn/img.jpg\"></figure>";
        var b = assertImage(parser.parseHtmlToBlocks(html).get(0));
        assertThat(b.getCaption()).isEmpty();
    }

    @Test
    void topLevelImg_parsesToImageBlock() {
        var blocks = parser.parseHtmlToBlocks("<img src=\"https://cdn.bigbike.vn/img.jpg\" alt=\"Mũ\">");
        var b = assertImage(blocks.get(0));
        assertThat(b.getUrl()).isEqualTo("https://cdn.bigbike.vn/img.jpg");
        assertThat(b.getAlt()).isEqualTo("Mũ");
        assertThat(b.getCaption()).isEmpty();
    }

    @Test
    void img_withBlankSrc_isSkipped() {
        var blocks = parser.parseHtmlToBlocks("<img src=\"\" alt=\"test\">");
        assertThat(blocks).isEmpty();
    }

    @Test
    void figure_withNoImg_becomesFallbackParagraph() {
        var blocks = parser.parseHtmlToBlocks("<figure><p>no image here</p></figure>");
        assertParagraph(blocks.get(0));
    }

    // ── Videos ───────────────────────────────────────────────────────────────

    @Test
    void youtubeIframe_parsesToYouTubeVideoBlock() {
        String html = "<iframe src=\"https://www.youtube.com/embed/abc123\"></iframe>";
        var b = assertVideo(parser.parseHtmlToBlocks(html).get(0));
        assertThat(b.getProvider()).isEqualTo("youtube");
        assertThat(b.getUrl()).contains("youtube.com");
        assertThat(b.getType()).isEqualTo("video");
    }

    @Test
    void youtuBeShortIframe_parsesToYouTubeVideoBlock() {
        String html = "<iframe src=\"https://youtu.be/xyz789\"></iframe>";
        var b = assertVideo(parser.parseHtmlToBlocks(html).get(0));
        assertThat(b.getProvider()).isEqualTo("youtube");
        assertThat(b.getUrl()).contains("youtu.be");
    }

    @Test
    void nonYoutubeIframe_becomesFallbackParagraph() {
        String html = "<iframe src=\"https://vimeo.com/123456\"></iframe>";
        assertParagraph(parser.parseHtmlToBlocks(html).get(0));
    }

    @Test
    void iframeWithBlankSrc_becomesFallbackParagraph() {
        String html = "<iframe src=\"\"></iframe>";
        assertParagraph(parser.parseHtmlToBlocks(html).get(0));
    }

    @Test
    void videoElement_withSource_parsesToUploadVideoBlock() {
        String html = "<video><source src=\"https://cdn.bigbike.vn/vid.mp4\"></video>";
        var b = assertVideo(parser.parseHtmlToBlocks(html).get(0));
        assertThat(b.getProvider()).isEqualTo("upload");
        assertThat(b.getUrl()).isEqualTo("https://cdn.bigbike.vn/vid.mp4");
    }

    @Test
    void videoElement_withSrcAttr_parsesToUploadVideoBlock() {
        String html = "<video src=\"https://cdn.bigbike.vn/vid.mp4\"></video>";
        var b = assertVideo(parser.parseHtmlToBlocks(html).get(0));
        assertThat(b.getProvider()).isEqualTo("upload");
    }

    @Test
    void videoElement_withNoSrc_becomesFallback() {
        String html = "<video></video>";
        assertParagraph(parser.parseHtmlToBlocks(html).get(0));
    }

    // ── Callout / Blockquote ─────────────────────────────────────────────────

    @Test
    void blockquote_parsesToCalloutVariantNote() {
        var blocks = parser.parseHtmlToBlocks("<blockquote><p>Lưu ý quan trọng</p></blockquote>");
        var b = assertCallout(blocks.get(0));
        assertThat(b.getVariant()).isEqualTo("note");
        assertThat(b.getHtml()).contains("Lưu ý quan trọng");
        assertThat(b.getType()).isEqualTo("callout");
    }

    // ── Divider ───────────────────────────────────────────────────────────────

    @Test
    void hr_parsesToDividerBlock() {
        var blocks = parser.parseHtmlToBlocks("<hr>");
        assertThat(blocks).hasSize(1);
        assertThat(blocks.get(0)).isInstanceOf(DescriptionBlock.DividerBlock.class);
        assertThat(blocks.get(0).getType()).isEqualTo("divider");
    }

    // ── Fallback ─────────────────────────────────────────────────────────────

    @Test
    void unknownDiv_becomesFallbackParagraphWithOuterHtml() {
        var blocks = parser.parseHtmlToBlocks("<div class=\"wp-block\">custom content</div>");
        var b = assertParagraph(blocks.get(0));
        assertThat(b.getHtml()).contains("<div");
        assertThat(b.getHtml()).contains("custom content");
    }

    @Test
    void table_becomesFallbackParagraph() {
        var blocks = parser.parseHtmlToBlocks("<table><tr><td>cell</td></tr></table>");
        assertParagraph(blocks.get(0));
    }

    // ── Edge cases ────────────────────────────────────────────────────────────

    @Test
    void nullHtml_returnsEmptyList() {
        assertThat(parser.parseHtmlToBlocks(null)).isEmpty();
    }

    @Test
    void emptyHtml_returnsEmptyList() {
        assertThat(parser.parseHtmlToBlocks("")).isEmpty();
    }

    @Test
    void whitespaceOnlyHtml_returnsEmptyList() {
        assertThat(parser.parseHtmlToBlocks("   \n\t  ")).isEmpty();
    }

    @Test
    void plainTextNode_becomesParagraphBlock() {
        var blocks = parser.parseHtmlToBlocks("Văn bản không có thẻ");
        var b = assertParagraph(blocks.get(0));
        assertThat(b.getHtml()).contains("Văn bản không có thẻ");
        assertThat(b.getHtml()).startsWith("<p>");
    }

    @Test
    void multipleBlocks_parsedInOrder() {
        String html = "<h2>Tiêu đề</h2><p>Đoạn văn.</p><hr><ul><li>A</li></ul>";
        var blocks = parser.parseHtmlToBlocks(html);
        assertThat(blocks).hasSize(4);
        assertThat(blocks.get(0)).isInstanceOf(DescriptionBlock.HeadingBlock.class);
        assertThat(blocks.get(1)).isInstanceOf(DescriptionBlock.ParagraphBlock.class);
        assertThat(blocks.get(2)).isInstanceOf(DescriptionBlock.DividerBlock.class);
        assertThat(blocks.get(3)).isInstanceOf(DescriptionBlock.ListBlock.class);
    }

    // ── Integration — realistic WP HTML samples ───────────────────────────────

    @Test
    void wpArticle_withTypicalStructure_parsesCorrectBlockCount() {
        String html = "<h2>Giới thiệu sản phẩm</h2>"
                + "<p>Mũ bảo hiểm <strong>LS2 FF800</strong> là dòng sản phẩm cao cấp.</p>"
                + "<figure><img src=\"https://cdn.bigbike.vn/ls2.jpg\" alt=\"LS2 FF800\">"
                + "<figcaption>LS2 FF800 màu đỏ carbon</figcaption></figure>"
                + "<h3>Thông số kỹ thuật</h3>"
                + "<ul><li>Vỏ: sợi carbon composite</li><li>Trọng lượng: 1.350g ± 50g</li></ul>"
                + "<blockquote><p>Chứng nhận ECE 22-06 và DOT FMVSS 218.</p></blockquote>"
                + "<hr>"
                + "<iframe src=\"https://www.youtube.com/embed/dQw4w9WgXcQ\"></iframe>";

        List<DescriptionBlock> blocks = parser.parseHtmlToBlocks(html);
        assertThat(blocks).hasSize(8);

        long headings   = countType(blocks, DescriptionBlock.HeadingBlock.class);
        long paragraphs = countType(blocks, DescriptionBlock.ParagraphBlock.class);
        long lists      = countType(blocks, DescriptionBlock.ListBlock.class);
        long images     = countType(blocks, DescriptionBlock.ImageBlock.class);
        long videos     = countType(blocks, DescriptionBlock.VideoBlock.class);
        long callouts   = countType(blocks, DescriptionBlock.CalloutBlock.class);
        long dividers   = countType(blocks, DescriptionBlock.DividerBlock.class);

        assertThat(headings).isEqualTo(2);
        assertThat(paragraphs).isEqualTo(1);
        assertThat(lists).isEqualTo(1);
        assertThat(images).isEqualTo(1);
        assertThat(videos).isEqualTo(1);
        assertThat(callouts).isEqualTo(1);
        assertThat(dividers).isEqualTo(1);
    }

    @Test
    void wpArticle_withFallbackDivs_countsFallbackParagraphs() {
        String html = "<h2>Tổng quan</h2>"
                + "<div class=\"wp-block-group\"><p>nội dung trong div</p></div>"
                + "<p>Đoạn bình thường.</p>";

        List<DescriptionBlock> blocks = parser.parseHtmlToBlocks(html);
        // 1 heading + 1 fallback paragraph (div) + 1 normal paragraph
        assertThat(blocks).hasSize(3);

        long fallbacks = blocks.stream()
                .filter(b -> b instanceof DescriptionBlock.ParagraphBlock pb
                        && pb.getHtml().startsWith("<div"))
                .count();
        assertThat(fallbacks).isEqualTo(1);
    }

    @Test
    void wpArticle_multipleImages_parsesAll() {
        String html = "<figure><img src=\"https://cdn.bigbike.vn/a.jpg\"></figure>"
                + "<figure><img src=\"https://cdn.bigbike.vn/b.jpg\"></figure>"
                + "<figure><img src=\"https://cdn.bigbike.vn/c.jpg\"></figure>";

        List<DescriptionBlock> blocks = parser.parseHtmlToBlocks(html);
        assertThat(blocks).hasSize(3);
        assertThat(countType(blocks, DescriptionBlock.ImageBlock.class)).isEqualTo(3);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static DescriptionBlock.HeadingBlock assertHeading(DescriptionBlock b) {
        assertThat(b).isInstanceOf(DescriptionBlock.HeadingBlock.class);
        return (DescriptionBlock.HeadingBlock) b;
    }

    private static DescriptionBlock.ParagraphBlock assertParagraph(DescriptionBlock b) {
        assertThat(b).isInstanceOf(DescriptionBlock.ParagraphBlock.class);
        return (DescriptionBlock.ParagraphBlock) b;
    }

    private static DescriptionBlock.ListBlock assertList(DescriptionBlock b) {
        assertThat(b).isInstanceOf(DescriptionBlock.ListBlock.class);
        return (DescriptionBlock.ListBlock) b;
    }

    private static DescriptionBlock.ImageBlock assertImage(DescriptionBlock b) {
        assertThat(b).isInstanceOf(DescriptionBlock.ImageBlock.class);
        return (DescriptionBlock.ImageBlock) b;
    }

    private static DescriptionBlock.VideoBlock assertVideo(DescriptionBlock b) {
        assertThat(b).isInstanceOf(DescriptionBlock.VideoBlock.class);
        return (DescriptionBlock.VideoBlock) b;
    }

    private static DescriptionBlock.CalloutBlock assertCallout(DescriptionBlock b) {
        assertThat(b).isInstanceOf(DescriptionBlock.CalloutBlock.class);
        return (DescriptionBlock.CalloutBlock) b;
    }

    private static long countType(List<DescriptionBlock> blocks, Class<?> type) {
        return blocks.stream().filter(type::isInstance).count();
    }
}
