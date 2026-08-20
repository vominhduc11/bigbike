package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.repository.content.ContentReadRepository;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import com.bigbike.bigbike_backend.service.order.OrderReadService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ChatArticleToolTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void articleToolReadsAtMostThreePublishedLocaleResultsAndRemovesDynamicFacts() {
        ContentReadRepository content = mock(ContentReadRepository.class);
        when(content.searchPublishedArticleKnowledge(anyList(), eq("vi"), eq(3)))
                .thenReturn(List.of(
                        article("Cách vệ sinh mũ", "Lau nhẹ bằng khăn mềm.",
                                "Giá 2 triệu. Không dùng hóa chất mạnh."),
                        article("Bảo quản mũ", "Đặt ở nơi khô thoáng.", "Hotline 0901234567."),
                        article("Chăm sóc kính", "Dùng khăn sạch.", "Không chà bằng vật cứng."),
                        article("Không được trả", "Nội dung thứ tư.", "Nội dung.")));
        ChatToolService tools = new ChatToolService(
                mock(CatalogReadService.class), mock(OrderReadService.class), content);
        ChatToolRegistry.ValidatedCall call = new ChatToolRegistry().validate(
                ChatToolRegistry.SEARCH_ARTICLES,
                MAPPER.valueToTree(Map.of("query", "vệ sinh mũ", "lang", "vi")));

        ChatToolService.ToolExecution result = tools.execute(
                call,
                new ChatToolService.ToolContext(
                        "Có bài nào hướng dẫn vệ sinh mũ?", "vi", null, settings()),
                new ChatToolService.ToolSession());

        assertThat(result.responseJson())
                .contains("Cách vệ sinh mũ", "Lau nhẹ bằng khăn mềm", "Không dùng hóa chất mạnh")
                .doesNotContain("2 triệu", "0901234567", "Không được trả");
        verify(content).searchPublishedArticleKnowledge(anyList(), eq("vi"), eq(3));
    }

    private static ContentReadRepository.ArticleKnowledge article(
            String title, String excerpt, String body) {
        return new ContentReadRepository.ArticleKnowledge(title, excerpt, body);
    }

    private static ChatAssistantSettings.Snapshot settings() {
        return new ChatAssistantSettings.Snapshot(
                true, 400, "Xin chào", List.of("A", "B", "C"),
                new ChatContactResponse("0900", "", "", "", ""), "", "", "");
    }
}
