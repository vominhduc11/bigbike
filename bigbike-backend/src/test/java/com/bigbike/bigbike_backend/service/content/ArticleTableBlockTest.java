package com.bigbike.bigbike_backend.service.content;

import com.bigbike.bigbike_backend.api.admin.dto.UpsertArticleRequest;
import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.service.catalog.DescriptionBlockRenderer;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import java.util.Collections;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class ArticleTableBlockTest {
    @Test
    void convertsAndRendersTableCellsWithoutLosingMergedCellsOrLinks() throws Exception {
        String html = "<table><thead><tr><th>Cỡ</th><th colspan=\"2\">Chi tiết</th></tr></thead><tbody>"
                + "<tr><td rowspan=\"2\">M</td><td><strong>Đỏ</strong></td><td><a href=\"/product/mu/\">Mũ</a></td></tr>"
                + "<tr><td>L</td><td>Đen</td></tr></tbody></table>";
        var blocks = new BodyBlockParser().parseArticleHtmlToBlocks(html);
        assertThat(blocks).hasSize(1);
        assertThat(blocks.get(0)).isInstanceOf(DescriptionBlock.TableBlock.class);
        var mapper = new ObjectMapper();
        var recovered = mapper.readValue(mapper.writeValueAsString(blocks.get(0)), DescriptionBlock.class);
        var rendered = new DescriptionBlockRenderer().renderArticleBlocksToHtml(java.util.List.of(recovered));
        assertThat(Jsoup.parse(rendered).text()).isEqualTo(Jsoup.parse(html).text());
        assertThat(rendered).contains("colspan=\"2\"", "rowspan=\"2\"", "<strong>Đỏ</strong>", "href=\"/product/mu/\"");
    }

    @Test
    void retainsRichListsAndFiltersUnsafeMarkupWhenSaving() {
        String html = "<ul><li><a href=\"/tin-tuc/\">Tin tức</a><ul><li>Chi tiết</li></ul></li></ul>"
                + "<p><a href=\"tel:+84000000000\">Gọi cửa hàng</a></p>"
                + "<table onclick=\"bad()\"><tr><td><script>bad()</script><a href=\"javascript:bad()\">Nội dung</a></td></tr></table>";
        var blocks = new BodyBlockParser().parseArticleHtmlToBlocks(html);
        var rendered = new DescriptionBlockRenderer().renderArticleBlocksToHtml(blocks);
        assertThat(rendered).contains("href=\"/tin-tuc/\"", "href=\"tel:+84000000000\"", "Chi tiết", "Nội dung");
        assertThat(rendered).doesNotContain("<script", "onclick", "javascript:");
    }

    @Test
    void accepts400ArticleBlocksAndRejects401() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var request = new UpsertArticleRequest();
            var block = DescriptionBlock.ParagraphBlock.builder().type("paragraph").html("<p>Text</p>").build();
            request.setBodyBlocks(Collections.nCopies(400, block));
            assertThat(factory.getValidator().validateProperty(request, "bodyBlocks")).isEmpty();
            request.setBodyBlocks(Collections.nCopies(401, block));
            assertThat(factory.getValidator().validateProperty(request, "bodyBlocks")).isNotEmpty();
        }
    }
}
