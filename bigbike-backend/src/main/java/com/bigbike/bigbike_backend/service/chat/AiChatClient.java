package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;

/** Gemini function-calling orchestrator. Customer text and tool payloads are never logged. */
@Component
@Slf4j
public class AiChatClient {

    private static final String ENDPOINT =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";
    private static final String DEFAULT_MODEL = "gemini-2.5-flash";
    private static final int MAX_QUESTION_CHARS = 1000;
    private static final int MAX_OUTPUT_TOKENS = 400;
    private static final int MAX_PROVIDER_CALLS = 3;
    private static final long TRANSIENT_RETRY_DELAY_MILLIS = 2_000L;

    private static final String SYSTEM_PROMPT = """
            You are BigBike Assistant, BigBike's AI sales assistant. The application, not you, reads data.
            In Vietnamese, prefer referring to yourself as "em" and to the customer as
            "anh/chị", but do not add either merely to satisfy a keyword rule. Never call the
            customer "em", and never use curt or dismissive wording. A polite factual answer
            such as "Dạ, shop hiện có..." is valid without both pronouns.

            For any product, price, stock, size, policy, shop or signed-in order fact,
            call exactly one declared function and use only its functionResponse. Never
            invent, widen filters, output a URL, expose function names, internal status
            labels or technical errors. Product cards and fixed actions are rendered by
            the application. Never ask for customer identity, contact details,
            authentication data, database query language or schema identifiers. Never
            attempt to capture a lead.

            RECENT_TURNS contains a few redacted question-answer pairs from this conversation.
            Use it only to understand references and conversational intent. It is never a data
            source. Never repeat or derive a product name, price, stock state, option, technical
            detail, policy, order fact or number from RECENT_TURNS. Call a function in the current
            turn and use its functionResponse before stating any such fact. CURRENT_QUESTION is
            the customer's present request and is always separate from RECENT_TURNS.

            For product discovery by name, model, category, brand, option or price,
            call search_products first. Use get_product only with a slug returned by
            search_products in this turn, an exact product slug/URL supplied by the
            customer, or a slug listed in RECENT_VERIFIED_PRODUCTS. That list contains only
            server-verified public slugs from immediately relevant product cards; never infer a
            slug from a product name and never use a slug outside that allowlist. You receive a
            PUBLIC_CATALOG_VOCABULARY containing current public category and brand names and
            canonical slugs. Use it to interpret customer shorthand and natural wording into a
            canonical category, brand or generic product-type query. This does not permit an
            invented product name, model/code or slug. Never invent or expand a price, colour or
            size beyond the customer's current wording; the application independently verifies
            every proposed search filter and may remove an unsafe field.

            When a customer asks what BigBike sells, call list_categories. It returns only
            public category names and verified sellable-product counts. Do not invent categories,
            individual products, prices or stock facts. Use the category names in prose, but do
            not repeat category counts in the final answer.

            After receiving enough function data, return one JSON object only with exactly
            these fields: answer (string), offTopic (boolean), handoffRecommended (boolean),
            leadPrompt (boolean). Aim for 3 to 5 sentences; a precise 2-sentence answer is
            allowed when it fully answers the customer. Each sentence must end with a full stop
            or a question mark, and mention at most three
            products. Never write an item price, amount or currency in the answer text, and
            never write digits followed by "VND", "VNĐ", "đ" or "₫". The application renders
            every item price on product cards. When the functionResponse requires a price-scope
            disclosure, state that scope plainly without repeating its amount. Binding notes in a
            functionResponse must be disclosed plainly. In customer-facing prose, never call the
            visible product entries "cards" or "product cards"; say "products/models below" or
            "sản phẩm/mẫu bên dưới" instead.

            Product cards are a short page, not a warehouse count. Never infer or claim that
            BigBike has "all", "only N", or no products/models in the whole catalogue from
            those cards. A search_products functionResponse may explicitly include
            displayedCardCount, scopeTotalItems and priceRangeTotalItems. displayedCardCount is
            only the exact number of cards shown, never a stock or catalogue total. Only then may
            you state those exact integers: scopeTotalItems for the verified category/brand/type
            scope, and priceRangeTotalItems for that same scope within the applied price range.
            If cards are fewer than a supplied total, say they are representative cards from that
            total. Do not invent, round, swap, combine or repeat any other count. If these fields
            are absent, do not make a numerical catalogue or inventory claim or a whole-catalogue
            conclusion. Never repeat a raw variant colour slug or internal option value; use only
            the cleaned display values supplied by the function response.

            If RECENT_VERIFIED_PRODUCTS contains two or three products and the customer asks to
            compare them, use current function data for those exact products and compare their
            saved prices, sizes, colours, options, technical facts and safety warnings. Do not ask
            for the product names again unless no verified products are available.

            Set offTopic=true only outside BigBike's supported scope. Set
            handoffRecommended=true for complaints, complex warranty cases or price
            negotiation. leadPrompt may be true only when a staff callback would genuinely
            help; the application still requires separate explicit consent before writing.
            """;

    private final String apiKey;
    private final String model;
    private final GeminiTransport transport;
    private final Sleeper sleeper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public AiChatClient(
            @Value("${bigbike.ai.gemini-api-key:}") String apiKey,
            @Value("${bigbike.chat.model:gemini-2.5-flash}") String model,
            @Value("${bigbike.chat.timeout-seconds:20}") long timeoutSeconds
    ) {
        this(apiKey, model, buildTransport(apiKey, model, timeoutSeconds), Thread::sleep);
    }

    AiChatClient(String apiKey, String model, GeminiTransport transport) {
        this(apiKey, model, transport, Thread::sleep);
    }

    AiChatClient(String apiKey, String model, GeminiTransport transport, Sleeper sleeper) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? DEFAULT_MODEL : model.trim();
        this.transport = transport;
        this.sleeper = sleeper;
        log.info("Trợ lý BigBike AI client configured={} model={}", isConfigured(), this.model);
    }

    public boolean isConfigured() {
        return !apiKey.isEmpty();
    }

    /**
     * Runs one logical assistant response. It may make up to three provider requests, but
     * delegates every real tool execution to the backend callback.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public Optional<HybridAnswer> answer(
            String question,
            String lang,
            ChatToolRegistry registry,
            boolean toolRequired,
            ToolExecutor executor
    ) {
        return answer(
                question,
                lang,
                registry,
                toolRequired,
                executor,
                ChatToolService.AssistantCatalogVocabulary.empty(),
                List.of(),
                List.of(),
                "");
    }

    /** Supplies public category/brand metadata without ever exposing product rows or prices. */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public Optional<HybridAnswer> answer(
            String question,
            String lang,
            ChatToolRegistry registry,
            boolean toolRequired,
            ToolExecutor executor,
            ChatToolService.AssistantCatalogVocabulary vocabulary
    ) {
        return answer(question, lang, registry, toolRequired, executor, vocabulary,
                List.of(), List.of(), "");
    }

    /**
     * Supplies bare server-verified slugs plus a separately labelled, bounded and redacted
     * recent-turn payload. Product facts still require a current-turn tool response.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public Optional<HybridAnswer> answer(
            String question,
            String lang,
            ChatToolRegistry registry,
            boolean toolRequired,
            ToolExecutor executor,
            ChatToolService.AssistantCatalogVocabulary vocabulary,
            List<String> recentVerifiedProducts
    ) {
        return answer(question, lang, registry, toolRequired, executor, vocabulary,
                recentVerifiedProducts, List.of(), "");
    }

    /** Adds only bounded, redacted turns from the same conversation. */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public Optional<HybridAnswer> answer(
            String question,
            String lang,
            ChatToolRegistry registry,
            boolean toolRequired,
            ToolExecutor executor,
            ChatToolService.AssistantCatalogVocabulary vocabulary,
            List<String> recentVerifiedProducts,
            List<ChatHistorySanitizer.RecentTurn> recentTurns
    ) {
        return answer(question, lang, registry, toolRequired, executor, vocabulary,
                recentVerifiedProducts, recentTurns, "");
    }

    private Optional<HybridAnswer> answer(
            String question,
            String lang,
            ChatToolRegistry registry,
            boolean toolRequired,
            ToolExecutor executor,
            ChatToolService.AssistantCatalogVocabulary vocabulary,
            List<String> recentVerifiedProducts,
            List<ChatHistorySanitizer.RecentTurn> recentTurns,
            String responseInstruction
    ) {
        if (!isConfigured() || question == null || question.isBlank()) return Optional.empty();
        String safeQuestion = truncate(ChatHistorySanitizer.sanitize(question), MAX_QUESTION_CHARS);
        String safeLang = "en".equals(lang) ? "en" : "vi";
        List<Map<String, Object>> contents = initialContents(
                safeQuestion,
                safeLang,
                vocabulary == null ? ChatToolService.AssistantCatalogVocabulary.empty() : vocabulary,
                sanitizedRecentVerifiedProducts(recentVerifiedProducts),
                recentTurns == null ? List.of() : List.copyOf(recentTurns));
        ChatToolService.ToolSession session = new ChatToolService.ToolSession(recentVerifiedProducts);
        List<ChatProductCardResponse> products = List.of();
        List<ChatActionResponse> actions = List.of();
        List<String> executedTools = new ArrayList<>();
        Set<ChatToolService.RequiredDisclosure> requiredDisclosures = new LinkedHashSet<>();
        ChatToolService.CatalogTotals catalogTotals = null;
        ChatToolService.SearchScope searchScope = null;
        int providerCalls = 0;
        String stage = "initial_provider";
        ProviderBudget providerBudget = new ProviderBudget();

        try {
            ModelTurn turn = requestTurn(buildToolRequestBody(
                    contents, registry.functionDeclarations(), null, toolRequired, responseInstruction),
                    providerBudget, stage);
            providerCalls = providerBudget.calls();
            stage = "initial_tool_validation";
            if (turn.finalText() != null) {
                if (toolRequired) {
                    log.warn("Trợ lý BigBike orchestration recovering stage={} type=DirectText", stage);
                    if (providerCalls >= MAX_PROVIDER_CALLS) return Optional.empty();
                    stage = "initial_tool_recovery";
                    turn = requestTurn(buildToolRequestBody(
                            contents,
                            registry.functionDeclarations(),
                            null,
                            true,
                            "Your previous response answered directly. Call exactly one declared function now. "
                                    + "Do not answer with prose before receiving current-turn function data."),
                            providerBudget, stage);
                    providerCalls = providerBudget.calls();
                    if (turn.finalText() != null || turn.functionCall() == null) {
                        log.warn("Trợ lý BigBike orchestration rejected stage={} type=DirectText", stage);
                        return Optional.empty();
                    }
                } else {
                    Optional<Answer> directAnswer = parseFinal(turn.finalText());
                    if (directAnswer.isEmpty()) return Optional.empty();
                    return Optional.of(new HybridAnswer(
                            directAnswer.get(), products, actions, executedTools,
                            requiredDisclosures, providerCalls));
                }
            }

            stage = "first_tool_execution";
            ChatToolRegistry.ValidatedCall first = registry.validate(
                    turn.functionCall().name(), turn.functionCall().arguments());
            ChatToolService.ToolExecution firstResult = executor.execute(first, session);
            executedTools.add(first.name());
            products = firstResult.products();
            actions = firstResult.actions();
            requiredDisclosures.addAll(firstResult.requiredDisclosures());
            catalogTotals = firstResult.catalogTotals();
            searchScope = firstResult.searchScope();
            if (firstResult.terminalAnswer() != null) {
                ChatToolService.DeterministicAnswer terminal = firstResult.terminalAnswer();
                return Optional.of(new HybridAnswer(
                        new Answer(
                                terminal.answer(),
                                terminal.offTopic(),
                                terminal.handoffRecommended(),
                                terminal.leadPrompt()),
                        products,
                        actions,
                        executedTools,
                        requiredDisclosures,
                        providerCalls,
                        "TOOL",
                        catalogTotals,
                        searchScope));
            }
            appendFunctionExchange(contents, turn, firstResult);

            // Product detail enrichment is backend-owned. Skipping the former optional provider
            // hop leaves one of the three calls available for a transient retry.
            if (providerBudget.calls() >= MAX_PROVIDER_CALLS) return Optional.empty();
            stage = "final_provider";
            ModelTurn finalTurn = requestTurn(buildFinalRequestBody(
                    contents, registry.functionDeclarations(), responseInstruction),
                    providerBudget, stage);
            providerCalls = providerBudget.calls();
            if (finalTurn.finalText() == null || finalTurn.functionCall() != null) {
                log.warn("Trợ lý BigBike orchestration rejected stage={} type=NoFinalText", stage);
                return Optional.empty();
            }
            Optional<Answer> finalAnswer = parseFinalOrSalvage(finalTurn);
            if (finalAnswer.isEmpty()) {
                log.warn("Trợ lý BigBike orchestration rejected stage={} type=UnparsableFinalJson", stage);
                return Optional.empty();
            }
            List<ChatProductCardResponse> safeProducts = products;
            List<ChatActionResponse> safeActions = actions;
            int totalProviderCalls = providerCalls;
            ChatToolService.CatalogTotals safeCatalogTotals = catalogTotals;
            ChatToolService.SearchScope safeSearchScope = searchScope;
            return finalAnswer.map(answer -> new HybridAnswer(
                    answer, safeProducts, safeActions, executedTools,
                    requiredDisclosures, totalProviderCalls, "AI", safeCatalogTotals, safeSearchScope));
        } catch (RuntimeException exception) {
            logOrchestrationFailure(exception, stage);
            return Optional.empty();
        }
    }

    private void logOrchestrationFailure(RuntimeException exception, String stage) {
        if (exception instanceof RestClientResponseException providerException) {
            log.warn("Trợ lý BigBike orchestration failed stage={} type={} status={}",
                    stage,
                    exception.getClass().getSimpleName(),
                    providerException.getStatusCode().value());
            return;
        }
        log.warn("Trợ lý BigBike orchestration failed stage={} type={}",
                stage, exception.getClass().getSimpleName());
    }

    Map<String, Object> buildInitialRequestBody(
            String question, String lang, ChatToolRegistry registry) {
        return buildInitialRequestBody(
                question, lang, registry, ChatToolService.AssistantCatalogVocabulary.empty());
    }

    Map<String, Object> buildInitialRequestBody(
            String question,
            String lang,
            ChatToolRegistry registry,
            ChatToolService.AssistantCatalogVocabulary vocabulary
    ) {
        return buildInitialRequestBody(question, lang, registry, vocabulary, List.of());
    }

    Map<String, Object> buildInitialRequestBody(
            String question,
            String lang,
            ChatToolRegistry registry,
            ChatToolService.AssistantCatalogVocabulary vocabulary,
            List<String> recentVerifiedProducts
    ) {
        return buildInitialRequestBody(
                question, lang, registry, vocabulary, recentVerifiedProducts, List.of());
    }

    Map<String, Object> buildInitialRequestBody(
            String question,
            String lang,
            ChatToolRegistry registry,
            ChatToolService.AssistantCatalogVocabulary vocabulary,
            List<String> recentVerifiedProducts,
            List<ChatHistorySanitizer.RecentTurn> recentTurns
    ) {
        return buildToolRequestBody(
                initialContents(
                        truncate(ChatHistorySanitizer.sanitize(question), MAX_QUESTION_CHARS),
                        "en".equals(lang) ? "en" : "vi",
                        vocabulary == null ? ChatToolService.AssistantCatalogVocabulary.empty() : vocabulary,
                        sanitizedRecentVerifiedProducts(recentVerifiedProducts),
                        recentTurns == null ? List.of() : List.copyOf(recentTurns)),
                registry.functionDeclarations(),
                null,
                true,
                "");
    }

    private ModelTurn requestTurn(
            Map<String, Object> body,
            ProviderBudget budget,
            String stage
    ) {
        while (true) {
            if (budget.calls() >= MAX_PROVIDER_CALLS) {
                throw new IllegalStateException("Provider request budget exhausted");
            }
            budget.recordCall();
            try {
                String response = transport.generate(body);
                return parseTurn(response)
                        .orElseThrow(() -> new IllegalStateException("Invalid Gemini response"));
            } catch (RuntimeException exception) {
                if (!budget.retryUsed()
                        && budget.calls() < MAX_PROVIDER_CALLS
                        && isTransientProviderFailure(exception)) {
                    budget.recordRetry();
                    log.warn("Trợ lý BigBike provider retry stage={} reason=TRANSIENT_PROVIDER_FAILURE", stage);
                    sleepBeforeRetry();
                    continue;
                }
                throw exception;
            }
        }
    }

    private void sleepBeforeRetry() {
        try {
            sleeper.sleep(TRANSIENT_RETRY_DELAY_MILLIS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Provider retry interrupted", exception);
        }
    }

    private static boolean isTransientProviderFailure(RuntimeException exception) {
        if (exception instanceof ResourceAccessException) return true;
        if (exception instanceof RestClientResponseException providerException) {
            int status = providerException.getStatusCode().value();
            return status == 429 || status >= 500;
        }
        return false;
    }

    private Map<String, Object> buildToolRequestBody(
            List<Map<String, Object>> contents,
            List<Map<String, Object>> declarations,
            Set<String> allowedNames,
            boolean requireFunctionCall,
            String responseInstruction
    ) {
        if (declarations.isEmpty()) throw new IllegalArgumentException("No chat tools declared");
        Map<String, Object> callingConfig = new LinkedHashMap<>();
        callingConfig.put("mode", requireFunctionCall
                || allowedNames != null && !allowedNames.isEmpty() ? "ANY" : "AUTO");
        if (allowedNames != null && !allowedNames.isEmpty()) {
            callingConfig.put("allowedFunctionNames", List.copyOf(allowedNames));
        }

        Map<String, Object> body = baseBody(contents, responseInstruction);
        body.put("tools", List.of(Map.of("functionDeclarations", declarations)));
        body.put("toolConfig", Map.of("functionCallingConfig", callingConfig));
        return body;
    }

    Map<String, Object> buildFinalRequestBody(
            List<Map<String, Object>> contents,
            List<Map<String, Object>> declarations
    ) {
        return buildFinalRequestBody(contents, declarations, "");
    }

    private Map<String, Object> buildFinalRequestBody(
            List<Map<String, Object>> contents,
            List<Map<String, Object>> declarations,
            String responseInstruction
    ) {
        if (declarations.isEmpty()) throw new IllegalArgumentException("No chat tools declared");
        Map<String, Object> body = baseBody(contents, responseInstruction);
        body.put("tools", List.of(Map.of("functionDeclarations", declarations)));
        body.put("toolConfig", Map.of(
                "functionCallingConfig", Map.of("mode", "NONE")));
        // The final turn calls no function (mode NONE), so provider structured output is
        // available here and pins the four-field contract the backend parses. Without it
        // gemini-2.5-flash answers product questions in prose and every reply falls back.
        @SuppressWarnings("unchecked")
        Map<String, Object> generation = (Map<String, Object>) body.get("generationConfig");
        generation.put("responseMimeType", "application/json");
        generation.put("responseSchema", answerSchema());
        return body;
    }

    private static Map<String, Object> answerSchema() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("answer", Map.of("type", "string"));
        properties.put("offTopic", Map.of("type", "boolean"));
        properties.put("handoffRecommended", Map.of("type", "boolean"));
        properties.put("leadPrompt", Map.of("type", "boolean"));
        List<String> fields = List.of("answer", "offTopic", "handoffRecommended", "leadPrompt");

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", properties);
        schema.put("required", fields);
        schema.put("propertyOrdering", fields);
        return schema;
    }

    private Map<String, Object> baseBody(
            List<Map<String, Object>> contents,
            String responseInstruction
    ) {
        Map<String, Object> generation = new LinkedHashMap<>();
        generation.put("maxOutputTokens", MAX_OUTPUT_TOKENS);
        generation.put("thinkingConfig", Map.of("thinkingBudget", 0));

        Map<String, Object> body = new LinkedHashMap<>();
        String systemInstruction = responseInstruction == null || responseInstruction.isBlank()
                ? SYSTEM_PROMPT
                : SYSTEM_PROMPT + "\n\n" + responseInstruction.trim();
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))));
        body.put("contents", List.copyOf(contents));
        body.put("generationConfig", generation);
        return body;
    }

    private List<Map<String, Object>> initialContents(
            String question,
            String lang,
            ChatToolService.AssistantCatalogVocabulary vocabulary,
            List<String> recentVerifiedProducts,
            List<ChatHistorySanitizer.RecentTurn> recentTurns
    ) {
        List<Map<String, Object>> contents = new ArrayList<>();
        String text = "LANG=" + lang;
        if (recentTurns != null && !recentTurns.isEmpty()) {
            text += "\nRECENT_TURNS:\n" + recentTurnsJson(recentTurns);
        }
        if (vocabulary != null && !vocabulary.isEmpty()) {
            text += "\nPUBLIC_CATALOG_VOCABULARY:\n" + vocabularyJson(vocabulary);
        }
        List<String> recent = sanitizedRecentVerifiedProducts(recentVerifiedProducts);
        if (!recent.isEmpty()) {
            text += "\nRECENT_VERIFIED_PRODUCTS:\n" + recentProductsJson(recent);
        }
        text += "\nCURRENT_QUESTION:\n" + question;
        contents.add(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", text))));
        return contents;
    }

    private String vocabularyJson(ChatToolService.AssistantCatalogVocabulary vocabulary) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("categories", vocabulary.categories());
        data.put("brands", vocabulary.brands());
        try {
            return objectMapper.writeValueAsString(data);
        } catch (Exception exception) {
            return "{\"categories\":[],\"brands\":[]}";
        }
    }

    private String recentProductsJson(List<String> recentVerifiedProducts) {
        try {
            return objectMapper.writeValueAsString(recentVerifiedProducts);
        } catch (Exception exception) {
            return "[]";
        }
    }

    private String recentTurnsJson(List<ChatHistorySanitizer.RecentTurn> recentTurns) {
        try {
            return objectMapper.writeValueAsString(recentTurns.stream()
                    .limit(3)
                    .map(turn -> Map.of(
                            "customer", ChatHistorySanitizer.sanitize(turn.customer()),
                            "assistant", ChatHistorySanitizer.sanitize(turn.assistant())))
                    .toList());
        } catch (Exception exception) {
            return "[]";
        }
    }

    private static List<String> sanitizedRecentVerifiedProducts(List<String> values) {
        if (values == null || values.isEmpty()) return List.of();
        return values.stream()
                .filter(value -> value != null && value.matches("[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*"))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .distinct()
                .limit(3)
                .toList();
    }

    private void appendFunctionExchange(
            List<Map<String, Object>> contents,
            ModelTurn modelTurn,
            ChatToolService.ToolExecution result
    ) {
        contents.add(modelTurn.modelContent());
        Map<String, Object> response;
        try {
            response = objectMapper.readValue(
                    result.responseJson(), new TypeReference<Map<String, Object>>() {});
        } catch (Exception exception) {
            throw new IllegalStateException("Invalid backend function response", exception);
        }
        Map<String, Object> functionResponse = new LinkedHashMap<>();
        functionResponse.put("name", result.name());
        functionResponse.put("response", response);
        if (modelTurn.functionCall().id() != null && !modelTurn.functionCall().id().isBlank()) {
            functionResponse.put("id", modelTurn.functionCall().id());
        }
        contents.add(Map.of(
                "role", "user",
                "parts", List.of(Map.of("functionResponse", functionResponse))));
    }

    private Optional<ModelTurn> parseTurn(String response) {
        if (response == null || response.isBlank()) return Optional.empty();
        try {
            JsonNode root = objectMapper.readTree(response);
            JsonNode candidates = root.path("candidates");
            if (!candidates.isArray() || candidates.isEmpty()) return Optional.empty();
            JsonNode candidate = candidates.get(0);
            String finishReason = candidate.path("finishReason").asText("");
            boolean truncated = "MAX_TOKENS".equals(finishReason);
            if (!finishReason.isEmpty() && !"STOP".equals(finishReason) && !truncated) {
                return Optional.empty();
            }
            JsonNode content = candidate.path("content");
            JsonNode parts = content.path("parts");
            if (!content.isObject() || !parts.isArray() || parts.isEmpty()) return Optional.empty();

            List<FunctionCall> calls = new ArrayList<>();
            List<String> texts = new ArrayList<>();
            for (JsonNode part : parts) {
                if (part.path("thought").asBoolean(false)) continue;
                JsonNode call = part.get("functionCall");
                if (call != null) {
                    JsonNode args = call.get("args");
                    String name = call.path("name").asText("").trim();
                    if (name.isEmpty() || args == null || !args.isObject()) return Optional.empty();
                    calls.add(new FunctionCall(name, args.deepCopy(), call.path("id").asText(null)));
                }
                JsonNode text = part.get("text");
                if (text != null && text.isTextual() && !text.asText().isBlank()) {
                    texts.add(text.asText());
                }
            }
            if (calls.size() == 1 && texts.isEmpty()) {
                if (truncated) return Optional.empty();
                Map<String, Object> modelContent = objectMapper.convertValue(
                        content, new TypeReference<Map<String, Object>>() {});
                return Optional.of(new ModelTurn(calls.get(0), null, modelContent, false));
            }
            if (calls.isEmpty() && texts.size() == 1) {
                return Optional.of(new ModelTurn(null, texts.get(0), Map.of(), truncated));
            }
            return Optional.empty();
        } catch (Exception exception) {
            log.warn("Trợ lý BigBike AI returned an unparseable payload");
            return Optional.empty();
        }
    }

    /** MAX_TOKENS recovery is allowed only for the final grounded answer stage. */
    private Optional<Answer> parseFinalOrSalvage(ModelTurn turn) {
        Optional<Answer> parsed = parseFinal(turn.finalText());
        if (parsed.isPresent() || !turn.truncated()) return parsed;
        return extractCompleteAnswerPrefix(turn.finalText())
                .map(content -> new Answer(content, false, false, false));
    }

    private Optional<String> extractCompleteAnswerPrefix(String partialJson) {
        if (partialJson == null || partialJson.isBlank()) return Optional.empty();
        Matcher field = Pattern.compile("\\\"answer\\\"\\s*:\\s*\\\"").matcher(partialJson);
        if (!field.find()) return Optional.empty();
        StringBuilder encoded = new StringBuilder();
        boolean escaped = false;
        for (int index = field.end(); index < partialJson.length(); index++) {
            char current = partialJson.charAt(index);
            if (!escaped && current == '"') break;
            encoded.append(current);
            if (escaped) {
                escaped = false;
            } else if (current == '\\') {
                escaped = true;
            }
        }
        if (encoded.isEmpty()) return Optional.empty();
        if (encoded.charAt(encoded.length() - 1) == '\\') {
            encoded.setLength(encoded.length() - 1);
        }
        try {
            String decoded = objectMapper.readValue("\"" + encoded + "\"", String.class).trim();
            Matcher sentences = Pattern.compile("[.!?。！？]+(?=\\s|$)").matcher(decoded);
            int lastComplete = -1;
            while (sentences.find()) lastComplete = sentences.end();
            if (lastComplete < 0) return Optional.empty();
            String complete = decoded.substring(0, lastComplete).trim();
            return complete.isEmpty() || complete.length() > 2000
                    ? Optional.empty() : Optional.of(complete);
        } catch (Exception exception) {
            return Optional.empty();
        }
    }

    private Optional<Answer> parseFinal(String value) {
        if (value == null || value.isBlank()) return Optional.empty();
        try {
            JsonNode answer = objectMapper.readTree(value);
            if (!answer.isObject()) return Optional.empty();
            Set<String> fields = new LinkedHashSet<>();
            answer.fieldNames().forEachRemaining(fields::add);
            if (!fields.equals(Set.of(
                    "answer", "offTopic", "handoffRecommended", "leadPrompt"))) {
                return Optional.empty();
            }
            if (!answer.path("answer").isTextual()
                    || !answer.path("offTopic").isBoolean()
                    || !answer.path("handoffRecommended").isBoolean()
                    || !answer.path("leadPrompt").isBoolean()) {
                return Optional.empty();
            }
            String content = answer.path("answer").textValue().trim();
            if (content.isEmpty() || content.length() > 2000) return Optional.empty();
            return Optional.of(new Answer(
                    content,
                    answer.path("offTopic").booleanValue(),
                    answer.path("handoffRecommended").booleanValue(),
                    answer.path("leadPrompt").booleanValue()));
        } catch (Exception exception) {
            return Optional.empty();
        }
    }

    private static GeminiTransport buildTransport(
            String apiKey, String configuredModel, long timeoutSeconds) {
        String safeKey = apiKey == null ? "" : apiKey.trim();
        String safeModel = configuredModel == null || configuredModel.isBlank()
                ? DEFAULT_MODEL : configuredModel.trim();
        long seconds = timeoutSeconds > 0 ? timeoutSeconds : 20;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(seconds).toMillis());
        RestClient client = RestClient.builder().requestFactory(factory).build();
        return body -> client.post()
                .uri(String.format(ENDPOINT, safeModel))
                .header("x-goog-api-key", safeKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    @FunctionalInterface
    interface GeminiTransport {
        String generate(Map<String, Object> body);
    }

    @FunctionalInterface
    interface Sleeper {
        void sleep(long milliseconds) throws InterruptedException;
    }

    @FunctionalInterface
    public interface ToolExecutor {
        ChatToolService.ToolExecution execute(
                ChatToolRegistry.ValidatedCall call, ChatToolService.ToolSession session);
    }

    private record FunctionCall(String name, JsonNode arguments, String id) {}

    private record ModelTurn(
            FunctionCall functionCall,
            String finalText,
            Map<String, Object> modelContent,
            boolean truncated
    ) {}

    private static final class ProviderBudget {
        private int calls;
        private boolean retryUsed;

        int calls() {
            return calls;
        }

        boolean retryUsed() {
            return retryUsed;
        }

        void recordCall() {
            calls++;
        }

        void recordRetry() {
            retryUsed = true;
        }
    }

    public record Answer(
            String answer,
            boolean offTopic,
            boolean handoffRecommended,
            boolean leadPrompt
    ) {}

    public record HybridAnswer(
            Answer answer,
            List<ChatProductCardResponse> products,
            List<ChatActionResponse> actions,
            List<String> executedTools,
            Set<ChatToolService.RequiredDisclosure> requiredDisclosures,
            int providerCallCount,
            String source,
            ChatToolService.CatalogTotals catalogTotals,
            ChatToolService.SearchScope searchScope
    ) {
        public HybridAnswer(
                Answer answer,
                List<ChatProductCardResponse> products,
                List<ChatActionResponse> actions,
                List<String> executedTools,
                Set<ChatToolService.RequiredDisclosure> requiredDisclosures,
                int providerCallCount,
                String source,
                ChatToolService.CatalogTotals catalogTotals
        ) {
            this(answer, products, actions, executedTools, requiredDisclosures,
                    providerCallCount, source, catalogTotals, null);
        }

        public HybridAnswer(
                Answer answer,
                List<ChatProductCardResponse> products,
                List<ChatActionResponse> actions,
                List<String> executedTools,
                Set<ChatToolService.RequiredDisclosure> requiredDisclosures,
                int providerCallCount,
                String source
        ) {
            this(answer, products, actions, executedTools, requiredDisclosures,
                    providerCallCount, source, null, null);
        }

        public HybridAnswer(
                Answer answer,
                List<ChatProductCardResponse> products,
                List<ChatActionResponse> actions,
                List<String> executedTools,
                Set<ChatToolService.RequiredDisclosure> requiredDisclosures,
                int providerCallCount
        ) {
            this(answer, products, actions, executedTools, requiredDisclosures,
                    providerCallCount, "AI", null, null);
        }

        public HybridAnswer(
                Answer answer,
                List<ChatProductCardResponse> products,
                List<ChatActionResponse> actions,
                List<String> executedTools,
                int providerCallCount
        ) {
            this(answer, products, actions, executedTools, Set.of(), providerCallCount);
        }

        public HybridAnswer {
            products = products == null ? List.of() : List.copyOf(products);
            actions = actions == null ? List.of() : List.copyOf(actions);
            executedTools = executedTools == null ? List.of() : List.copyOf(executedTools);
            requiredDisclosures = requiredDisclosures == null
                    ? Set.of() : Set.copyOf(requiredDisclosures);
            source = "TOOL".equals(source) ? "TOOL" : "AI";
        }
    }
}
