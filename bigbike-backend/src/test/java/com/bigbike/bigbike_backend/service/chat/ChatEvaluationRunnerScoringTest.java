package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ChatEvaluationRunnerScoringTest {

    @Test
    void scoresOnlyApplicableNumericAndNonFabricationCasesWithoutAnAiJudge() {
        ChatEvaluationDatasetService.EvaluationCase expected =
                new ChatEvaluationDatasetService.EvaluationCase(
                        "verified-price", "vi", "Mẫu này giá bao nhiêu?", "VERIFIED_REAL",
                        List.of("search_products"), false, false, false,
                        List.of("1590000"), List.of("chắc chắn còn hàng"));
        AiChatClient.HybridAnswer answer = new AiChatClient.HybridAnswer(
                new AiChatClient.Answer(
                        "Giá đang lưu là 1.590.000 đồng; anh/chị xem thẻ sản phẩm để đối chiếu.",
                        false, false, false),
                List.of(), List.of(), List.of("search_products"), 1);

        ChatEvaluationRunner.CaseScore score = ChatEvaluationRunner.score(
                expected, Optional.of(new AiChatClient.ModelAnswer(
                        answer, "gemini-a", "gemini-a", false, null)));

        assertThat(score.numericApplicable()).isTrue();
        assertThat(score.numeric()).isTrue();
        assertThat(score.nonFabricationApplicable()).isTrue();
        assertThat(score.nonFabrication()).isTrue();
        assertThat(score.intent()).isTrue();
        assertThat(score.passed()).isTrue();
    }

    @Test
    void unavailableAnswerFailsInsteadOfCreatingPerfectRatesForEmptyCriteria() {
        ChatEvaluationDatasetService.EvaluationCase expected =
                new ChatEvaluationDatasetService.EvaluationCase(
                        "ambiguous", "en", "Which one is good?", "CANONICAL_ACCEPTANCE",
                        List.of(), false, false, false, List.of(), List.of());

        ChatEvaluationRunner.CaseScore score =
                ChatEvaluationRunner.score(expected, Optional.empty());

        assertThat(score.numericApplicable()).isFalse();
        assertThat(score.nonFabricationApplicable()).isFalse();
        assertThat(score.intent()).isFalse();
        assertThat(score.giveUp()).isTrue();
        assertThat(score.passed()).isFalse();
    }

    @Test
    void verifiedProductAndAnswerFactsMustMatchTheHumanGroundTruth() {
        ChatEvaluationDatasetService.EvaluationCase expected =
                new ChatEvaluationDatasetService.EvaluationCase(
                        "verified-product", "vi", "Mẫu đã chọn có gì?", "VERIFIED_REAL",
                        "VERIFIED_BY_OWNER", List.of("get_product"), false, false, true,
                        List.of(), List.of("vỏ sợi thủy tinh"), List.of("mu-dung"),
                        List.of("bảo hành trọn đời"),
                        "Owner đã đối chiếu snapshot sản phẩm mu-dung tại ngày lập bộ đề.");
        AiChatClient.HybridAnswer wrongProduct = new AiChatClient.HybridAnswer(
                new AiChatClient.Answer(
                        "Mẫu này có vỏ sợi thủy tinh.", false, false, false),
                List.of(new com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse(
                        "mu-khac", "Mũ khác", null, null, null, "VND", "IN_STOCK")),
                List.of(), List.of("get_product"), 1);

        ChatEvaluationRunner.CaseScore score = ChatEvaluationRunner.score(
                expected, Optional.of(new AiChatClient.ModelAnswer(
                        wrongProduct, "gemini-a", "gemini-a", false, null)));

        assertThat(expected.verified()).isTrue();
        assertThat(score.intent()).isFalse();
        assertThat(score.passed()).isFalse();
    }
}
