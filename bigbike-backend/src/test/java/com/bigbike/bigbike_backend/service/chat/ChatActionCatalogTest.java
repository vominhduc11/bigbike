package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import java.util.List;
import org.junit.jupiter.api.Test;

class ChatActionCatalogTest {

    private static final ChatContactResponse CONTACTS =
            new ChatContactResponse("0900000000", "", "", "", "");

    /**
     * Measured 2026-09-07: an order question came back offering "Đổi nhu cầu" and "Đổi ngân sách",
     * because order wording matched none of the branches and fell into the shopping default.
     */
    @Test
    void anOrderQuestionOffersOrderActionsRatherThanNeedsAndBudget() {
        List<String> types = choose("Em muốn tra cứu đơn hàng của em", "ANSWER");

        assertThat(types).containsExactly("ORDER_HISTORY", "ORDER_LOOKUP", "LOGIN");
    }

    @Test
    void aReplyWithNoProductsNeverAsksTheCustomerToChangeABudgetTheyNeverSet() {
        List<String> types = choose("Chào shop", "ANSWER");

        assertThat(types).doesNotContain("CHANGE_NEEDS", "CHANGE_BUDGET");
        assertThat(types).startsWith("FIND_PRODUCTS");
    }

    @Test
    void repliesCarryingProductsKeepTheirComparisonActions() {
        List<ChatActionResponse> actions = ChatActionCatalog.choose(
                "Mẫu nào tốt hơn?", "PRODUCT_RESULTS",
                List.of(card("mu-a"), card("mu-b")), List.of(), CONTACTS);

        assertThat(actions).extracting(ChatActionResponse::type)
                .containsExactly("COMPARE_PRODUCTS", "CHECK_SIZE", "CHANGE_BUDGET");
    }

    private static List<String> choose(String question, String resultKind) {
        return ChatActionCatalog.choose(question, resultKind, List.of(), List.of(), CONTACTS)
                .stream().map(ChatActionResponse::type).toList();
    }

    private static com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse card(String slug) {
        return new com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse(
                slug, "Mũ " + slug, "/media/helmet.png",
                java.math.BigDecimal.valueOf(2_000_000), null, "VND", "IN_STOCK");
    }
}
