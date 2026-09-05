package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatHistorySanitizerTest {

    @Test
    @DisplayName("CHAT_RULE_005: the owner setting caps completed pairs, with PII redacted and text capped")
    void keepsRequestedCompletedPairsAndRemovesPii() {
        List<ChatMessageEntity> messages = new ArrayList<>();
        messages.add(message("CUSTOMER", "lượt cũ phải bị bỏ"));
        messages.add(message("ASSISTANT", "câu trả lời cũ phải bị bỏ"));
        messages.add(message("CUSTOMER",
                "Gọi 0912 345 678, email khach@example.com, mã đơn BB-20260812-ABC123"));
        messages.add(message("ASSISTANT", "Em sẽ chỉ dùng nội dung đã che để hiểu câu hỏi."));
        messages.add(message("CUSTOMER", "Giao đến 12 đường Nguyễn Trãi, quận 1."));
        messages.add(message("ASSISTANT", "Địa chỉ: 55 phố Huế, phường Ngô Thì Nhậm."));
        messages.add(message("CUSTOMER", "x".repeat(700)));
        messages.add(message("ASSISTANT", "y".repeat(700)));
        messages.add(message("CUSTOMER", "lượt chưa có trả lời không được gửi"));

        // CHAT_RULE_005: the ceiling is ai_assistant_recent_turn_pairs, not a hidden 3. A silent
        // cap of three is what made the assistant lose track of "cái mũ đó" a few turns later.
        List<ChatHistorySanitizer.RecentTurn> turns =
                ChatHistorySanitizer.recentTurns(messages, 99);

        assertThat(turns).hasSize(4);
        assertThat(ChatHistorySanitizer.recentTurns(messages, 2)).hasSize(2);
        assertThat(turns).allSatisfy(turn -> {
            assertThat(turn.customer()).hasSizeLessThanOrEqualTo(ChatHistorySanitizer.MAX_MESSAGE_CHARS);
            assertThat(turn.assistant()).hasSizeLessThanOrEqualTo(ChatHistorySanitizer.MAX_MESSAGE_CHARS);
        });
        String payload = turns.toString();
        assertThat(payload)
                .contains("[SỐ ĐIỆN THOẠI ĐÃ CHE]", "[EMAIL ĐÃ CHE]", "[MÃ ĐƠN ĐÃ CHE]",
                        "[ĐỊA CHỈ ĐÃ CHE]")
                .doesNotContain("0912 345 678", "khach@example.com", "BB-20260812-ABC123",
                        "Nguyễn Trãi", "phố Huế", "lượt chưa có trả lời");
    }

    @Test
    @DisplayName("CHAT_RULE_005: setting zero restores the no-history behaviour")
    void zeroDisablesHistoryCompletely() {
        assertThat(ChatHistorySanitizer.recentTurns(
                List.of(message("CUSTOMER", "câu hỏi"), message("ASSISTANT", "câu trả lời")), 0))
                .isEmpty();
    }

    private static ChatMessageEntity message(String role, String content) {
        ChatMessageEntity message = new ChatMessageEntity();
        message.setRole(role);
        message.setContent(content);
        return message;
    }
}
