package com.bigbike.bigbike_backend.service.catalog;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Set;
import static org.assertj.core.api.Assertions.assertThat;

class DescriptionBlockRendererTest {

    private DescriptionBlockRenderer renderer;
    private Validator validator;

    @BeforeEach
    void setUp() {
        renderer = new DescriptionBlockRenderer();
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    // ── Render correctness ────────────────────────────────────────────────────

    @Test
    void heading2_rendersH2Tag() {
        var block = new DescriptionBlock.HeadingBlock();
        block.setLevel(2);
        block.setText("Chất liệu cao cấp");
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).contains("<h2>Chất liệu cao cấp</h2>");
    }

    @Test
    void heading3_rendersH3Tag() {
        var block = new DescriptionBlock.HeadingBlock();
        block.setLevel(3);
        block.setText("Tính năng nổi bật");
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).contains("<h3>Tính năng nổi bật</h3>");
    }

    @Test
    void paragraph_wrapsPInTag() {
        var block = new DescriptionBlock.ParagraphBlock();
        block.setHtml("Sản phẩm <b>chính hãng</b> 100%.");
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).contains("<p>");
        assertThat(html).contains("<b>chính hãng</b>");
    }

    @Test
    void paragraph_doesNotDoubleWrapExistingP() {
        var block = new DescriptionBlock.ParagraphBlock();
        block.setHtml("<p>Đã có thẻ P rồi.</p>");
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).doesNotContain("<p><p>");
    }

    @Test
    void bulletedList_rendersUlAndLi() {
        var block = new DescriptionBlock.ListBlock();
        block.setStyle("bulleted");
        block.setItems(List.of("Mũ fullface", "ECE 22.06"));
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).contains("<ul>");
        assertThat(html).contains("<li>Mũ fullface</li>");
        assertThat(html).contains("<li>ECE 22.06</li>");
    }

    @Test
    void numberedList_rendersOl() {
        var block = new DescriptionBlock.ListBlock();
        block.setStyle("numbered");
        block.setItems(List.of("Bước 1", "Bước 2"));
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).contains("<ol>");
        assertThat(html).contains("<li>Bước 1</li>");
    }

    @Test
    void image_rendersFigureAndImg() {
        var block = new DescriptionBlock.ImageBlock();
        block.setUrl("https://cdn.bigbike.vn/img/helmet.jpg");
        block.setAlt("Mũ bảo hiểm LS2");
        block.setCaption("LS2 FF800 màu đỏ");
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).contains("<figure>");
        assertThat(html).contains("<img");
        assertThat(html).contains("https://cdn.bigbike.vn/img/helmet.jpg");
        assertThat(html).contains("Mũ bảo hiểm LS2");
        assertThat(html).contains("<figcaption>");
        assertThat(html).contains("LS2 FF800 màu đỏ");
    }

    @Test
    void image_noCaption_omitsFigcaption() {
        var block = new DescriptionBlock.ImageBlock();
        block.setUrl("https://cdn.bigbike.vn/img/helmet.jpg");
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).doesNotContain("<figcaption>");
    }

    @Test
    void video_rendersBbVideoDiv() {
        var block = new DescriptionBlock.VideoBlock();
        block.setProvider("youtube");
        block.setUrl("https://www.youtube.com/watch?v=abc123");
        block.setCaption("Review sản phẩm");
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).contains("class=\"bb-video\"");
        assertThat(html).contains("data-provider=\"youtube\"");
        assertThat(html).contains("data-src=\"https://www.youtube.com/watch?v=abc123\"");
        assertThat(html).contains("Review sản phẩm");
    }

    @Test
    void callout_rendersVariantClass() {
        var block = new DescriptionBlock.CalloutBlock();
        block.setVariant("warning");
        block.setHtml("<p>Lưu ý quan trọng</p>");
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).contains("bb-callout-warning");
        assertThat(html).contains("Lưu ý quan trọng");
    }

    @Test
    void divider_rendersHr() {
        var block = new DescriptionBlock.DividerBlock();
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).contains("<hr>");
    }

    @Test
    void emptyList_returnsEmptyString() {
        assertThat(renderer.renderBlocksToHtml(List.of())).isEmpty();
        assertThat(renderer.renderBlocksToHtml(null)).isEmpty();
    }

    @Test
    void multipleBlocks_concatenated() {
        var h = new DescriptionBlock.HeadingBlock();
        h.setLevel(2); h.setText("Tiêu đề");
        var p = new DescriptionBlock.ParagraphBlock();
        p.setHtml("Nội dung.");
        var d = new DescriptionBlock.DividerBlock();
        String html = renderer.renderBlocksToHtml(List.of(h, p, d));
        assertThat(html).contains("<h2>");
        assertThat(html).contains("<p>");
        assertThat(html).contains("<hr>");
    }

    // ── Sanitizer — XSS prevention ────────────────────────────────────────────

    @Test
    void sanitizer_stripsScriptTags() {
        var block = new DescriptionBlock.ParagraphBlock();
        block.setHtml("<p>Text <script>alert(1)</script></p>");
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).doesNotContain("<script>");
        assertThat(html).doesNotContain("alert(1)");
    }

    @Test
    void sanitizer_stripsOnClickHandlers() {
        var block = new DescriptionBlock.ParagraphBlock();
        block.setHtml("<p onclick=\"alert(1)\">text</p>");
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).doesNotContain("onclick");
    }

    @Test
    void sanitizer_stripsJavascriptHref() {
        var block = new DescriptionBlock.ParagraphBlock();
        block.setHtml("<a href=\"javascript:alert(1)\">click</a>");
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).doesNotContain("javascript:");
    }

    @Test
    void sanitizer_stripsIframeInCallout() {
        var block = new DescriptionBlock.CalloutBlock();
        block.setVariant("info");
        block.setHtml("<iframe src=\"https://evil.com\"></iframe><p>safe</p>");
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).doesNotContain("<iframe");
        assertThat(html).contains("safe");
    }

    @Test
    void sanitizer_stripsOnerrorOnImg() {
        var block = new DescriptionBlock.ParagraphBlock();
        block.setHtml("<img src=\"x\" onerror=\"alert(1)\">");
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).doesNotContain("onerror");
    }

    @Test
    void heading_htmlSpecialCharsEscaped() {
        var block = new DescriptionBlock.HeadingBlock();
        block.setLevel(2);
        block.setText("<script>xss</script>");
        String html = renderer.renderBlocksToHtml(List.of(block));
        assertThat(html).doesNotContain("<script>");
        assertThat(html).contains("&lt;script&gt;");
    }

    // ── Bean Validation — required fields ─────────────────────────────────────

    @Test
    void headingBlock_nullLevel_failsValidation() {
        var block = new DescriptionBlock.HeadingBlock();
        block.setText("Title");
        Set<ConstraintViolation<DescriptionBlock.HeadingBlock>> v = validator.validate(block);
        assertThat(v).anyMatch(cv -> cv.getPropertyPath().toString().equals("level"));
    }

    @Test
    void headingBlock_blankText_failsValidation() {
        var block = new DescriptionBlock.HeadingBlock();
        block.setLevel(2);
        block.setText("");
        Set<ConstraintViolation<DescriptionBlock.HeadingBlock>> v = validator.validate(block);
        assertThat(v).anyMatch(cv -> cv.getPropertyPath().toString().equals("text"));
    }

    @Test
    void headingBlock_levelOutOfRange_failsValidation() {
        var block = new DescriptionBlock.HeadingBlock();
        block.setLevel(4);
        block.setText("Title");
        Set<ConstraintViolation<DescriptionBlock.HeadingBlock>> v = validator.validate(block);
        assertThat(v).anyMatch(cv -> cv.getPropertyPath().toString().equals("level"));
    }

    @Test
    void paragraphBlock_nullHtml_failsValidation() {
        var block = new DescriptionBlock.ParagraphBlock();
        Set<ConstraintViolation<DescriptionBlock.ParagraphBlock>> v = validator.validate(block);
        assertThat(v).anyMatch(cv -> cv.getPropertyPath().toString().equals("html"));
    }

    @Test
    void listBlock_invalidStyle_failsValidation() {
        var block = new DescriptionBlock.ListBlock();
        block.setStyle("unordered");
        block.setItems(List.of("item"));
        Set<ConstraintViolation<DescriptionBlock.ListBlock>> v = validator.validate(block);
        assertThat(v).anyMatch(cv -> cv.getPropertyPath().toString().equals("style"));
    }

    @Test
    void listBlock_emptyItems_failsValidation() {
        var block = new DescriptionBlock.ListBlock();
        block.setStyle("bulleted");
        block.setItems(List.of());
        Set<ConstraintViolation<DescriptionBlock.ListBlock>> v = validator.validate(block);
        assertThat(v).anyMatch(cv -> cv.getPropertyPath().toString().equals("items"));
    }

    @Test
    void imageBlock_blankUrl_failsValidation() {
        var block = new DescriptionBlock.ImageBlock();
        block.setUrl("");
        Set<ConstraintViolation<DescriptionBlock.ImageBlock>> v = validator.validate(block);
        assertThat(v).anyMatch(cv -> cv.getPropertyPath().toString().equals("url"));
    }

    @Test
    void videoBlock_invalidProvider_failsValidation() {
        var block = new DescriptionBlock.VideoBlock();
        block.setProvider("vimeo");
        block.setUrl("https://vimeo.com/123");
        Set<ConstraintViolation<DescriptionBlock.VideoBlock>> v = validator.validate(block);
        assertThat(v).anyMatch(cv -> cv.getPropertyPath().toString().equals("provider"));
    }

    @Test
    void calloutBlock_invalidVariant_failsValidation() {
        var block = new DescriptionBlock.CalloutBlock();
        block.setVariant("danger");
        block.setHtml("<p>text</p>");
        Set<ConstraintViolation<DescriptionBlock.CalloutBlock>> v = validator.validate(block);
        assertThat(v).anyMatch(cv -> cv.getPropertyPath().toString().equals("variant"));
    }

    @Test
    void validBlocks_passValidation() {
        var heading = new DescriptionBlock.HeadingBlock();
        heading.setLevel(2); heading.setText("Title");
        assertThat(validator.validate(heading)).isEmpty();

        var para = new DescriptionBlock.ParagraphBlock();
        para.setHtml("<p>Ok</p>");
        assertThat(validator.validate(para)).isEmpty();

        var list = new DescriptionBlock.ListBlock();
        list.setStyle("bulleted"); list.setItems(List.of("A"));
        assertThat(validator.validate(list)).isEmpty();

        var img = new DescriptionBlock.ImageBlock();
        img.setUrl("https://cdn.bigbike.vn/img.jpg");
        assertThat(validator.validate(img)).isEmpty();

        var video = new DescriptionBlock.VideoBlock();
        video.setProvider("youtube"); video.setUrl("https://youtu.be/abc");
        assertThat(validator.validate(video)).isEmpty();

        var callout = new DescriptionBlock.CalloutBlock();
        callout.setVariant("info"); callout.setHtml("<p>note</p>");
        assertThat(validator.validate(callout)).isEmpty();

        assertThat(validator.validate(new DescriptionBlock.DividerBlock())).isEmpty();
    }
}
