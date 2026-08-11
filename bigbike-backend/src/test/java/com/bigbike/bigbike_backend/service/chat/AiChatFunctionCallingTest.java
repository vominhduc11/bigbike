package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;

class AiChatFunctionCallingTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final ChatToolRegistry REGISTRY = new ChatToolRegistry();
    private static final String PRODUCT_SLUG = "mu-bao-hiem-tanami";

    @Test
    void validSearchFunctionIsValidatedExecutedAndReturnedToGemini() {
        ScriptedTransport transport = new ScriptedTransport(
                functionCall("search_products", Map.of("query", "mũ tanami", "lang", "vi"), "call-1"),
                finalAnswer(safeAnswer("Em đã kiểm tra danh mục đang bán. Em chưa thấy sản phẩm phù hợp với yêu cầu này. Anh/chị có thể bấm Gặp nhân viên để được hỗ trợ thêm.")));
        AiChatClient client = client(transport);
        AtomicInteger executions = new AtomicInteger();

        Optional<AiChatClient.HybridAnswer> result = client.answer(
                "Tìm mũ tanami", "vi", REGISTRY, true,
                (call, session) -> {
                    executions.incrementAndGet();
                    assertThat(call.name()).isEqualTo(ChatToolRegistry.SEARCH_PRODUCTS);
                    return execution(
                            call.name(),
                            "{\"results\":[]}",
                            List.of(),
                            Set.of(ChatToolService.RequiredDisclosure.PRICE_RANGE_MISS));
                });

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().providerCallCount()).isEqualTo(2);
        assertThat(result.orElseThrow().executedTools()).containsExactly("search_products");
        assertThat(result.orElseThrow().requiredDisclosures())
                .containsExactly(ChatToolService.RequiredDisclosure.PRICE_RANGE_MISS);
        assertThat(executions).hasValue(1);
        assertThat(MAPPER.valueToTree(transport.requests().get(0))
                .path("toolConfig").path("functionCallingConfig").path("mode").asText())
                .isEqualTo("ANY");
        assertThat(MAPPER.valueToTree(transport.requests().get(1)).toString())
                .contains("functionResponse", "call-1", "search_products")
                .doesNotContain("customerId", "SELECT");
    }

    @Test
    void verifiedTerminalToolResultDoesNotNeedAFinalProviderParaphrase() {
        ScriptedTransport transport = new ScriptedTransport(
                functionCall("search_products", Map.of("query", "xqz", "lang", "vi"), "call-1"));
        AiChatClient client = client(transport);

        Optional<AiChatClient.HybridAnswer> result = client.answer(
                "Tìm mũ xqz", "vi", REGISTRY, true,
                (call, session) -> new ChatToolService.ToolExecution(
                        call.name(),
                        "{\"results\":[]}",
                        List.of(),
                        List.of(),
                        Set.of(),
                        new ChatToolService.DeterministicAnswer(
                                "Dạ, em chưa tìm thấy đúng mẫu anh/chị hỏi. Em không đổi sang sản phẩm khác. Anh/chị có thể bấm Gặp nhân viên để được hỗ trợ thêm.",
                                false,
                                false,
                                false)));

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().source()).isEqualTo("TOOL");
        assertThat(result.orElseThrow().providerCallCount()).isEqualTo(1);
        assertThat(result.orElseThrow().answer().answer()).contains("đúng mẫu");
        assertThat(transport.requests()).hasSize(1);
    }

    @Test
    void toneCorrectionUsesOneFreshToolGroundedOrchestrationWithoutTheRejectedDraft() {
        ScriptedTransport transport = new ScriptedTransport(
                functionCall("search_products", Map.of("query", "tanami", "lang", "vi"), "retry-1"),
                finalAnswer(safeAnswer(
                        "Dạ, em đã kiểm tra dữ liệu phù hợp. Anh/chị mở thẻ sản phẩm để xem thêm nhé.")));
        AiChatClient client = client(transport);

        Optional<AiChatClient.HybridAnswer> result = client.answerWithToneCorrection(
                "Tìm mũ Tanami", "vi", REGISTRY, true,
                (call, session) -> execution(call.name(), "{\"results\":[]}", List.of()));

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().providerCallCount()).isEqualTo(2);
        assertThat(transport.requests()).hasSize(2);
        String requestJson = MAPPER.valueToTree(transport.requests().get(0)).toString();
        assertThat(requestJson)
                .contains("prior draft failed only the Vietnamese form-of-address check", "Tìm mũ Tanami")
                .doesNotContain("REJECTED-DRAFT-MUST-NOT-LEAK");
    }

    @Test
    void searchMayBeFollowedByOneVerifiedGetProductCall() {
        ScriptedTransport transport = new ScriptedTransport(
                functionCall("search_products", Map.of("query", "tanami", "lang", "vi"), "search-1"),
                functionCall("get_product", Map.of("slug", PRODUCT_SLUG), "detail-1"),
                finalAnswer(safeAnswer("Em đã kiểm tra sản phẩm Tanami đang bán. Thông tin chi tiết em dùng chỉ đến từ dữ liệu BigBike vừa xác nhận. Anh/chị mở thẻ sản phẩm bên dưới để xem thêm.")));
        AiChatClient client = client(transport);
        AtomicInteger executions = new AtomicInteger();

        Optional<AiChatClient.HybridAnswer> result = client.answer(
                "Cho tôi chi tiết tanami", "vi", REGISTRY, true,
                (call, session) -> {
                    int index = executions.getAndIncrement();
                    if (index == 0) {
                        assertThat(call.name()).isEqualTo("search_products");
                        return execution(call.name(),
                                "{\"results\":[{\"slug\":\"" + PRODUCT_SLUG + "\"}]}",
                                List.of(card()));
                    }
                    assertThat(call.name()).isEqualTo("get_product");
                    return execution(call.name(),
                            "{\"result\":{\"slug\":\"" + PRODUCT_SLUG + "\"}}",
                            List.of(card()));
                });

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().providerCallCount()).isEqualTo(3);
        assertThat(result.orElseThrow().executedTools())
                .containsExactly("search_products", "get_product");
        assertThat(result.orElseThrow().products()).extracting(ChatProductCardResponse::slug)
                .containsExactly(PRODUCT_SLUG);
        assertThat(executions).hasValue(2);
        String finalRequest = MAPPER.valueToTree(transport.requests().get(2)).toString();
        assertThat(finalRequest).contains("functionResponse", "detail-1")
                .contains("functionDeclarations", "\"mode\":\"NONE\"")
                // The final turn calls no function, so it pins the four-field contract with
                // provider structured output; without it the model replies in prose.
                .contains("responseSchema", "\"responseMimeType\":\"application/json\"",
                        "propertyOrdering");
        Map<String, Object> detailBody = transport.requests().get(1);
        assertThat(MAPPER.valueToTree(detailBody).path("toolConfig").path("functionCallingConfig")
                .path("mode").asText()).isEqualTo("ANY");
        assertThat(MAPPER.valueToTree(detailBody).path("toolConfig").path("functionCallingConfig")
                .path("allowedFunctionNames").toString()).isEqualTo("[\"get_product\"]");
        assertThat(MAPPER.valueToTree(detailBody).path("tools").path(0)
                .path("functionDeclarations").findValuesAsText("name"))
                .containsExactly("get_product");
    }

    @Test
    void unusableDetailTurnSkipsTheDetailHopInsteadOfDroppingTheAnswer() {
        // The optional detail hop is where the model most often emits several parallel
        // get_product calls. Nothing unvalidated may execute, but the grounded search
        // results still answer the question, so the turn must not fall back to CONTACT.
        ScriptedTransport transport = new ScriptedTransport(
                functionCall("search_products", Map.of("query", "tanami", "lang", "vi"), "search-1"),
                parallelGetProductCalls(),
                finalAnswer(safeAnswer("Em đã kiểm tra sản phẩm Tanami đang bán. Thông tin em dùng chỉ đến từ dữ liệu BigBike vừa xác nhận. Anh/chị mở thẻ sản phẩm bên dưới để xem thêm.")));
        AiChatClient client = client(transport);
        AtomicInteger executions = new AtomicInteger();

        Optional<AiChatClient.HybridAnswer> result = client.answer(
                "Tìm mũ tanami", "vi", REGISTRY, true,
                (call, session) -> {
                    executions.incrementAndGet();
                    assertThat(call.name()).isEqualTo("search_products");
                    return execution(call.name(),
                            "{\"results\":[{\"slug\":\"" + PRODUCT_SLUG + "\"}]}",
                            List.of(card()));
                });

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().executedTools()).containsExactly("search_products");
        assertThat(result.orElseThrow().products()).extracting(ChatProductCardResponse::slug)
                .containsExactly(PRODUCT_SLUG);
        assertThat(executions).as("no unvalidated detail call may run").hasValue(1);
    }

    @Test
    void proseOnTheDetailHopFallsThroughToTheSchemaPinnedFinalRequest() {
        // The detail hop pins no response schema, so the model often replies in prose
        // there. That must not lose the turn: the final request pins the contract.
        ScriptedTransport transport = new ScriptedTransport(
                functionCall("search_products", Map.of("query", "tanami", "lang", "vi"), "search-1"),
                finalText("Bên em có mẫu Tanami Carbon đang bán ạ."),
                finalAnswer(safeAnswer("Em đã kiểm tra sản phẩm Tanami đang bán. Anh/chị mở thẻ sản phẩm bên dưới để xem thêm nhé?")));
        AiChatClient client = client(transport);

        Optional<AiChatClient.HybridAnswer> result = client.answer(
                "Tìm mũ tanami", "vi", REGISTRY, true,
                (call, session) -> execution(call.name(),
                        "{\"results\":[{\"slug\":\"" + PRODUCT_SLUG + "\"}]}",
                        List.of(card())));

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().executedTools()).containsExactly("search_products");
        assertThat(result.orElseThrow().providerCallCount()).isEqualTo(3);
    }

    @Test
    void geminiSelectsTheIntentToolBeforeBackendValidationAndExecution() {
        ScriptedTransport transport = new ScriptedTransport(
                functionCall("get_policy", Map.of("topic", "warranty"), "policy-1"),
                finalAnswer(safeAnswer("Em đã kiểm tra chính sách bảo hành đã công bố. Thời hạn cụ thể phụ thuộc từng sản phẩm và thương hiệu. Anh/chị xem trang sản phẩm hoặc bấm Gặp nhân viên nếu cần kiểm tra trường hợp cụ thể.")));
        AiChatClient client = client(transport);
        AtomicInteger executions = new AtomicInteger();

        Optional<AiChatClient.HybridAnswer> result = client.answer(
                "Chính sách bảo hành thế nào?", "vi", REGISTRY, true,
                (call, session) -> {
                    executions.incrementAndGet();
                    assertThat(call.name()).isEqualTo(ChatToolRegistry.GET_POLICY);
                    assertThat(call.arguments()).containsEntry("topic", "warranty");
                    return execution(call.name(), "{\"policy\":\"verified\"}", List.of());
                });

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().executedTools()).containsExactly(ChatToolRegistry.GET_POLICY);
        assertThat(executions).hasValue(1);
        assertThat(MAPPER.valueToTree(transport.requests().get(1)).toString())
                .contains("functionResponse", "policy-1", "get_policy");
    }

    @Test
    void rejectsUnknownParallelMalformedAndIdentityBearingCallsBeforeExecution() {
        List<String> responses = List.of(
                functionCall("read_database", Map.of(), null),
                parallelCalls(),
                functionCall("get_my_orders", Map.of("scope", "latest", "customerId", "123"), null),
                functionCall("search_products", Map.of("query", List.of("mũ"), "lang", "vi"), null),
                functionCall("search_products", Map.of("query", "SELECT * FROM products", "lang", "vi"), null),
                functionCall("search_products", Map.of("query", "mũ", "table", "products", "lang", "vi"), null));

        for (String response : responses) {
            AtomicInteger executions = new AtomicInteger();
            Optional<AiChatClient.HybridAnswer> result = client(new ScriptedTransport(response)).answer(
                    "Tìm mũ", "vi", REGISTRY, true,
                    (call, session) -> {
                        executions.incrementAndGet();
                        return execution(call.name(), "{}", List.of());
                    });
            assertThat(result).as(response).isEmpty();
            assertThat(executions).as(response).hasValue(0);
        }
    }

    @Test
    void factualProductAnswerWithoutToolEvidenceIsRejected() {
        AiChatClient client = client(new ScriptedTransport(finalAnswer(safeAnswer(
                "Em có một sản phẩm phù hợp. Sản phẩm này đang còn hàng. Anh/chị có thể mua ngay."))));

        Optional<AiChatClient.HybridAnswer> result = client.answer(
                "Mũ nào đang còn hàng?", "vi", REGISTRY, true,
                (call, session) -> { throw new AssertionError("must not execute"); });

        assertThat(result).isEmpty();
    }

    @Test
    void thirdToolAttemptAndWrongSecondToolAreRejected() {
        ScriptedTransport thirdAttempt = new ScriptedTransport(
                functionCall("search_products", Map.of("query", "tanami", "lang", "vi"), null),
                functionCall("get_product", Map.of("slug", PRODUCT_SLUG), null),
                functionCall("get_product", Map.of("slug", PRODUCT_SLUG), null));
        AtomicInteger executions = new AtomicInteger();
        Optional<AiChatClient.HybridAnswer> tooMany = client(thirdAttempt).answer(
                "Chi tiết tanami", "vi", REGISTRY, true,
                (call, session) -> {
                    executions.incrementAndGet();
                    return execution(call.name(), "{\"ok\":true}", List.of(card()));
                });
        assertThat(tooMany).isEmpty();
        assertThat(executions).hasValue(2);

        ScriptedTransport wrongSecond = new ScriptedTransport(
                functionCall("search_products", Map.of("query", "tanami", "lang", "vi"), null),
                functionCall("search_products", Map.of("query", "tanami", "lang", "vi"), null));
        AtomicInteger wrongExecutions = new AtomicInteger();
        Optional<AiChatClient.HybridAnswer> wrong = client(wrongSecond).answer(
                "Chi tiết tanami", "vi", REGISTRY, true,
                (call, session) -> {
                    wrongExecutions.incrementAndGet();
                    return execution(call.name(), "{\"ok\":true}", List.of(card()));
                });
        assertThat(wrong).isEmpty();
        assertThat(wrongExecutions).hasValue(1);
    }

    @Test
    void toolProviderAndFinalPayloadFailuresAllFailClosed() {
        AiChatClient.ToolExecutor failingTool = (call, session) -> {
            throw new IllegalStateException("database timeout");
        };
        assertThat(client(new ScriptedTransport(functionCall(
                "search_products", Map.of("query", "mũ", "lang", "vi"), null))).answer(
                "Tìm mũ", "vi", REGISTRY, true, failingTool)).isEmpty();

        assertThat(client(new ScriptedTransport(new IllegalStateException("provider timeout"))).answer(
                "Tìm mũ", "vi", REGISTRY, true,
                (call, session) -> execution(call.name(), "{}", List.of()))).isEmpty();

        assertThat(client(new ScriptedTransport("not-json")).answer(
                "Tìm mũ", "vi", REGISTRY, true,
                (call, session) -> execution(call.name(), "{}", List.of()))).isEmpty();

        ScriptedTransport invalidFinal = new ScriptedTransport(
                functionCall("search_products", Map.of("query", "mũ", "lang", "vi"), null),
                finalText("{\"answer\":\"Thiếu các trường bắt buộc.\"}"));
        assertThat(client(invalidFinal).answer(
                "Tìm mũ", "vi", REGISTRY, true,
                (call, session) -> execution(call.name(), "{\"results\":[]}", List.of()))).isEmpty();
    }

    @Test
    void http400FailsClosedAndLogsOnlyTheSafeStatus() {
        Logger logger = (Logger) LoggerFactory.getLogger(AiChatClient.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            HttpClientErrorException badRequest = HttpClientErrorException.create(
                    HttpStatus.BAD_REQUEST,
                    "Bad Request",
                    HttpHeaders.EMPTY,
                    new byte[0],
                    StandardCharsets.UTF_8);

            Optional<AiChatClient.HybridAnswer> result = client(
                    new ScriptedTransport(badRequest)).answer(
                            "Tìm mũ", "vi", REGISTRY, true,
                            (call, session) -> execution(call.name(), "{}", List.of()));

            assertThat(result).isEmpty();
            String logs = appender.list.stream()
                    .map(ILoggingEvent::getFormattedMessage)
                    .reduce("", (left, right) -> left + "\n" + right);
            assertThat(logs).contains("status=400")
                    .doesNotContain("Bad Request", "Tìm mũ", "functionResponse");
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    @Test
    void failureLogsNeverContainQuestionToolPayloadOrSensitiveValues() {
        Logger logger = (Logger) LoggerFactory.getLogger(AiChatClient.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            AiChatClient client = client(new ScriptedTransport(functionCall(
                    "search_products", Map.of("query", "mũ", "lang", "vi"), null)));
            client.answer(
                    "Tìm mũ cho khach@example.com, 0900 123 456, access-token-secret",
                    "vi", REGISTRY, true,
                    (call, session) -> {
                        throw new IllegalStateException(
                                "payload SELECT * FROM products khach@example.com 0900 123 456");
                    });

            String logs = appender.list.stream()
                    .map(ILoggingEvent::getFormattedMessage)
                    .reduce("", (left, right) -> left + "\n" + right);
            assertThat(logs)
                    .doesNotContain("khach@example.com", "0900 123 456", "access-token-secret")
                    .doesNotContain("SELECT * FROM products", "payload");
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    private static AiChatClient client(ScriptedTransport transport) {
        return new AiChatClient("test-key", "gemini-2.5-flash", transport);
    }

    private static ChatToolService.ToolExecution execution(
            String name, String response, List<ChatProductCardResponse> products) {
        return new ChatToolService.ToolExecution(name, response, products, List.of());
    }

    private static ChatToolService.ToolExecution execution(
            String name,
            String response,
            List<ChatProductCardResponse> products,
            Set<ChatToolService.RequiredDisclosure> requiredDisclosures
    ) {
        return new ChatToolService.ToolExecution(
                name, response, products, List.of(), requiredDisclosures);
    }

    private static ChatProductCardResponse card() {
        return new ChatProductCardResponse(
                PRODUCT_SLUG, "Mũ bảo hiểm Tanami", null,
                BigDecimal.valueOf(12_000_000), null, "VND", "IN_STOCK");
    }

    private static Map<String, Object> safeAnswer(String answer) {
        return Map.of(
                "answer", answer,
                "offTopic", false,
                "handoffRecommended", false,
                "leadPrompt", false);
    }

    private static String functionCall(String name, Map<String, ?> args, String id) {
        Map<String, Object> call = new java.util.LinkedHashMap<>();
        call.put("name", name);
        call.put("args", args);
        if (id != null) call.put("id", id);
        return response(List.of(Map.of("functionCall", call)));
    }

    private static String parallelCalls() {
        return response(List.of(
                Map.of("functionCall", Map.of(
                        "name", "search_products", "args", Map.of("query", "mũ", "lang", "vi"))),
                Map.of("functionCall", Map.of(
                        "name", "get_shop_info", "args", Map.of()))));
    }

    private static String parallelGetProductCalls() {
        return response(List.of(
                Map.of("functionCall", Map.of(
                        "name", "get_product", "args", Map.of("slug", PRODUCT_SLUG))),
                Map.of("functionCall", Map.of(
                        "name", "get_product", "args", Map.of("slug", "mu-bao-hiem-agv-k3")))));
    }

    private static String finalAnswer(Map<String, Object> answer) {
        return finalText(json(answer));
    }

    private static String finalText(String text) {
        return response(List.of(Map.of("text", text)));
    }

    private static String response(List<Map<String, Object>> parts) {
        return json(Map.of("candidates", List.of(Map.of(
                "finishReason", "STOP",
                "content", Map.of("role", "model", "parts", parts)))));
    }

    private static String json(Object value) {
        try {
            return MAPPER.writeValueAsString(value);
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }

    private static final class ScriptedTransport implements AiChatClient.GeminiTransport {
        private final List<Object> scripted;
        private final List<Map<String, Object>> requests = new ArrayList<>();
        private int index;

        private ScriptedTransport(Object... scripted) {
            this.scripted = List.of(scripted);
        }

        @Override
        public String generate(Map<String, Object> body) {
            requests.add(body);
            if (index >= scripted.size()) throw new AssertionError("Unexpected provider request");
            Object next = scripted.get(index++);
            if (next instanceof RuntimeException exception) throw exception;
            return (String) next;
        }

        private List<Map<String, Object>> requests() {
            return requests;
        }
    }
}
