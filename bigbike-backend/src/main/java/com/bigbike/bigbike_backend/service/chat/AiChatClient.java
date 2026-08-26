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
    private static final int MAX_OUTPUT_TOKENS = 2_048;
    private static final int MAX_PROVIDER_CALLS = 4;
    private static final int MAX_TOOL_EXECUTIONS = 3;
    private static final long LOGICAL_TURN_DEADLINE_NANOS = Duration.ofSeconds(65).toNanos();
    private static final long TRANSIENT_RETRY_DELAY_MILLIS = 2_000L;

    private static final String SYSTEM_PROMPT = """
            You are BigBike Assistant, BigBike's AI sales assistant. The application, not you, reads data.
            In Vietnamese, prefer referring to yourself as "em" and to the customer as
            "anh/chị", but do not add either merely to satisfy a keyword rule. Never call the
            customer "em", and never use curt or dismissive wording. A polite factual answer
            such as "Dạ, shop hiện có..." is valid without both pronouns. Do not habitually
            start Vietnamese answers with "Dạ,". Use it only when it sounds natural; otherwise
            begin directly with the verified result, a short acknowledgement or the next useful
            action so consecutive replies do not sound mechanically identical.

            For any product, price, stock, size, policy, shop or signed-in order fact,
            call up to three relevant declared functions and use only their functionResponse data. Never
            invent, widen filters, output a URL, expose function names, internal status
            labels or technical errors. Product cards and fixed actions are rendered by
            the application. Never ask for customer identity, contact details,
            authentication data, database query language or schema identifiers. Never
            attempt to capture a lead.

            Act as a concise shop sales adviser, not a lookup terminal. Infer the current sales
            stage from CURRENT_QUESTION and RECENT_TURNS: browsing, choosing, deciding, or
            post-purchase. For browsing, ask one need-narrowing question and do not pitch a
            product yet. For choosing, compare only the requested verified models and help remove
            an option; never introduce a third model when two were requested. For deciding
            questions about size, stock, final price, delivery, warranty or returns, resolve that
            concern and do not introduce another main product. For post-purchase questions, deal
            only with the signed-in order or purchased item unless the customer asks to shop.
            A customer may move backward to an earlier stage; follow that change without pressure.

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

            Preserve the exact order of RECENT_VERIFIED_PRODUCTS. A reference such as "the second
            model" or "mẫu thứ hai" means the second slug in that ordered list, even if a policy
            question appeared between the product list and the reference. Re-read that product in
            the current turn before answering. If a non-ordinal reference can mean more than one
            recent product, re-read the candidates and ask the customer to choose by verified name;
            never guess one.

            When a customer asks what BigBike sells, call list_categories. It returns only
            public category names and verified sellable-product counts. Do not invent categories,
            individual products, prices or stock facts. Use the category names in prose, but do
            not repeat category counts in the final answer.

            After receiving enough function data, return one JSON object only with exactly
            these fields: answer (string), offTopic (boolean), handoffRecommended (boolean),
            leadPrompt (boolean). A precise one-sentence answer is allowed. Use at most 10
            sentences and 2,000 visible characters. You may use only paragraphs, bold text,
            bullet/numbered lists and Markdown tables. Never use HTML, code, images, links or URLs.
            Mention no more than eight products; direct comparison remains limited to three.
            Never write an item price, amount or currency in the answer text, and
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

            Never promise a discount, gift, free shipping or promotion unless the current
            function response contains that exact published policy. Never promise an exact
            delivery date. Never say stock is running out, only a few remain, or that an offer has
            a deadline unless the current function response explicitly proves it. Never invent or
            cite customer reviews, ratings, units sold, viewers, popularity or social proof. Never
            create a countdown or false urgency, and never disparage another brand. When data is
            missing, say it is not confirmed and recommend staff help; do not guess or borrow data
            from another product. Do not end with a generic "anything else" question; the
            application adds one concrete, context-specific next step after your grounded answer.

            If RECENT_VERIFIED_PRODUCTS contains two or three products and the customer asks to
            compare them, use current function data for those exact products and compare their
            saved prices, sizes, colours, options, technical facts and safety warnings. Do not ask
            for the product names again unless no verified products are available.

            Set offTopic=true only outside BigBike's supported scope. Set
            handoffRecommended=true for complaints, complex warranty cases or information that
            the current functions cannot confirm. A price objection alone is not a handoff: the
            application will look for a verified lower-priced alternative. leadPrompt may be true only when a staff callback would genuinely
            help; the application still requires separate explicit consent before writing.
            """;

    private final String apiKey;
    private final String model;
    private final String fallbackModel;
    private final long primaryTimeoutSeconds;
    private final ModelAwareGeminiTransport transport;
    private final Sleeper sleeper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public AiChatClient(
            @Value("${bigbike.ai.gemini-api-key:}") String apiKey,
            @Value("${bigbike.chat.model:gemini-2.5-flash}") String model,
            @Value("${bigbike.chat.fallback-model:gemini-2.5-flash-lite}") String fallbackModel,
            @Value("${bigbike.chat.primary-timeout-seconds:35}") long primaryTimeoutSeconds,
            @Value("${bigbike.chat.timeout-seconds:65}") long timeoutSeconds
    ) {
        this(apiKey, model, fallbackModel, primaryTimeoutSeconds,
                buildTransport(apiKey, timeoutSeconds), Thread::sleep);
    }

    AiChatClient(String apiKey, String model, GeminiTransport transport) {
        this(apiKey, model, model, 65,
                (ignoredModel, body, ignoredTimeoutMillis) -> transport.generate(body), Thread::sleep);
    }

    /** Compatibility constructor used by request-shape and availability tests. */
    AiChatClient(String apiKey, String model, long timeoutSeconds) {
        this(apiKey, model, model, Math.max(1, Math.min(60, timeoutSeconds)),
                buildTransport(apiKey, timeoutSeconds), Thread::sleep);
    }

    AiChatClient(String apiKey, String model, GeminiTransport transport, Sleeper sleeper) {
        this(apiKey, model, model, 65,
                (ignoredModel, body, ignoredTimeoutMillis) -> transport.generate(body), sleeper);
    }

    AiChatClient(
            String apiKey,
            String model,
            String fallbackModel,
            long primaryTimeoutSeconds,
            ModelAwareGeminiTransport transport,
            Sleeper sleeper
    ) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? DEFAULT_MODEL : model.trim();
        this.fallbackModel = fallbackModel == null || fallbackModel.isBlank()
                ? "gemini-2.5-flash-lite" : fallbackModel.trim();
        this.primaryTimeoutSeconds = Math.max(1, Math.min(60, primaryTimeoutSeconds));
        this.transport = transport;
        this.sleeper = sleeper;
        log.info("Trợ lý BigBike AI client configured={} bootstrapModel={} fallbackModel={}",
                isConfigured(), this.model, this.fallbackModel);
    }

    public boolean isConfigured() {
        return !apiKey.isEmpty();
    }

    /**
     * Runs one logical assistant response. It may make up to four provider requests, but
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

    /**
     * Runs the owner-selected primary model and, only when no safe result is produced, one
     * fast fallback. Both attempts share the existing four-request/65-second logical budget.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public Optional<ModelAnswer> answerWithFallback(
            String requestedModel,
            String question,
            String lang,
            ChatToolRegistry registry,
            boolean toolRequired,
            ToolExecutor executor,
            ChatToolService.AssistantCatalogVocabulary vocabulary,
            List<String> recentVerifiedProducts,
            List<ChatHistorySanitizer.RecentTurn> recentTurns
    ) {
        String primary = cleanModel(requestedModel, model);
        ProviderBudget budget = new ProviderBudget();
        // When a distinct fast fallback exists, do not spend the shared deadline retrying the
        // same slow/failed primary. One failed primary call must leave time for the fallback.
        budget.beginModel(
                primary,
                Duration.ofSeconds(primaryTimeoutSeconds),
                fallbackModel.equals(primary));
        Optional<HybridAnswer> first = answerForModel(
                question, lang, registry, toolRequired, executor, vocabulary,
                recentVerifiedProducts, recentTurns, "", budget);
        if (first.isPresent()) {
            return Optional.of(new ModelAnswer(
                    first.get(), primary, primary, false, null, budget.modelUsages()));
        }
        String reason = budget.failureReason();
        if (fallbackModel.equals(primary) || budget.calls() >= MAX_PROVIDER_CALLS
                || budget.logicalDeadlineExceeded()) {
            return Optional.empty();
        }
        budget.beginModel(fallbackModel, budget.remainingLogicalDuration(), true);
        Optional<HybridAnswer> fallback = answerForModel(
                question, lang, registry, toolRequired, executor, vocabulary,
                recentVerifiedProducts, recentTurns, "", budget);
        return fallback.map(answer -> new ModelAnswer(
                answer, primary, fallbackModel, true,
                reason == null ? "INVALID_RESPONSE" : reason,
                budget.modelUsages()));
    }

    /** Exact-model path for the owner-triggered offline evaluation; never falls back. */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public Optional<ModelAnswer> answerForEvaluation(
            String evaluationModel,
            String question,
            String lang,
            ChatToolRegistry registry,
            boolean toolRequired,
            ToolExecutor executor,
            ChatToolService.AssistantCatalogVocabulary vocabulary
    ) {
        String selected = cleanModel(evaluationModel, model);
        ProviderBudget budget = new ProviderBudget();
        budget.beginModel(selected, Duration.ofSeconds(65), true);
        Optional<HybridAnswer> answer = answerForModel(
                question, lang, registry, toolRequired, executor, vocabulary,
                List.of(), List.of(), "", budget);
        return answer.map(value -> new ModelAnswer(
                value, selected, selected, false, null, budget.modelUsages()));
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
        ProviderBudget budget = new ProviderBudget();
        budget.beginModel(model, Duration.ofSeconds(65), true);
        return answerForModel(
                question, lang, registry, toolRequired, executor, vocabulary,
                recentVerifiedProducts, recentTurns, responseInstruction, budget);
    }

    private Optional<HybridAnswer> answerForModel(
            String question,
            String lang,
            ChatToolRegistry registry,
            boolean toolRequired,
            ToolExecutor executor,
            ChatToolService.AssistantCatalogVocabulary vocabulary,
            List<String> recentVerifiedProducts,
            List<ChatHistorySanitizer.RecentTurn> recentTurns,
            String responseInstruction,
            ProviderBudget providerBudget
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
                    if (turn.finalText() != null || turn.functionCalls().isEmpty()) {
                        log.warn("Trợ lý BigBike orchestration rejected stage={} type=DirectText", stage);
                        return Optional.empty();
                    }
                } else {
                    Optional<Answer> directAnswer = parseFinal(turn.finalText());
                    if (directAnswer.isEmpty()) return Optional.empty();
                    return Optional.of(new HybridAnswer(
                            directAnswer.get(), products, actions, executedTools,
                            requiredDisclosures, providerCalls, "AI", null, null,
                            providerBudget.usage()));
                }
            }

            stage = "tool_execution";
            if (turn.functionCalls().isEmpty() || turn.functionCalls().size() > MAX_TOOL_EXECUTIONS) {
                return Optional.empty();
            }
            List<ChatToolService.ToolExecution> toolResults = new ArrayList<>();
            int validToolResults = 0;
            for (FunctionCall functionCall : turn.functionCalls()) {
                ToolAttempt attempt = executeIsolated(
                        functionCall, registry, executor, session, "initial");
                ChatToolService.ToolExecution result = attempt.result();
                toolResults.add(result);
                if (!attempt.successful()) continue;
                validToolResults++;
                executedTools.add(result.name());
                products = mergeProducts(products, result.products());
                actions = mergeActions(actions, result.actions());
                requiredDisclosures.addAll(result.requiredDisclosures());
                if (result.catalogTotals() != null) catalogTotals = result.catalogTotals();
                if (result.searchScope() != null) searchScope = result.searchScope();
            }
            if (validToolResults == 0) {
                appendFunctionExchange(contents, turn, toolResults);
                if (providerBudget.calls() >= MAX_PROVIDER_CALLS - 1) return Optional.empty();
                stage = "tool_validation_recovery";
                turn = requestTurn(buildToolRequestBody(
                                contents, registry.functionDeclarations(), null, true,
                                "The previous function call was rejected by server validation. "
                                        + "Call one declared function again with only fields supported by its schema."),
                        providerBudget, stage);
                providerCalls = providerBudget.calls();
                if (turn.finalText() != null || turn.functionCalls().isEmpty()
                        || turn.functionCalls().size() > MAX_TOOL_EXECUTIONS) {
                    return Optional.empty();
                }
                toolResults = new ArrayList<>();
                for (FunctionCall functionCall : turn.functionCalls()) {
                    ToolAttempt attempt = executeIsolated(
                            functionCall, registry, executor, session, "recovery");
                    ChatToolService.ToolExecution result = attempt.result();
                    toolResults.add(result);
                    if (!attempt.successful()) continue;
                    validToolResults++;
                    executedTools.add(result.name());
                    products = mergeProducts(products, result.products());
                    actions = mergeActions(actions, result.actions());
                    requiredDisclosures.addAll(result.requiredDisclosures());
                    if (result.catalogTotals() != null) catalogTotals = result.catalogTotals();
                    if (result.searchScope() != null) searchScope = result.searchScope();
                }
                if (validToolResults == 0) return Optional.empty();
            }
            if (toolResults.size() == 1 && toolResults.get(0).terminalAnswer() != null) {
                ChatToolService.DeterministicAnswer terminal = toolResults.get(0).terminalAnswer();
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
                        searchScope,
                        providerBudget.usage()));
            }
            appendFunctionExchange(contents, turn, toolResults);

            // Model/code detail questions may need search first so the returned slug can be
            // validated before get_product. Independent sources remain parallel in the turn above.
            if (requiresSequentialProductLookup(safeQuestion, executedTools)
                    && executedTools.size() < MAX_TOOL_EXECUTIONS
                    && providerBudget.calls() < MAX_PROVIDER_CALLS - 1) {
                stage = "sequential_tool_selection";
                ModelTurn sequentialTurn = requestTurn(buildToolRequestBody(
                        contents,
                        registry.functionDeclarations(),
                        null,
                        true,
                        "The current request needs product detail after search. Call only the next declared "
                                + "function needed from a verified slug in the current functionResponse. Do not answer yet."),
                        providerBudget,
                        stage);
                int remainingTools = MAX_TOOL_EXECUTIONS - executedTools.size();
                if (sequentialTurn.finalText() != null
                        || sequentialTurn.functionCalls().isEmpty()
                        || sequentialTurn.functionCalls().size() > remainingTools) {
                    return Optional.empty();
                }
                List<ChatToolService.ToolExecution> sequentialResults = new ArrayList<>();
                for (FunctionCall functionCall : sequentialTurn.functionCalls()) {
                    ToolAttempt attempt = executeIsolated(
                            functionCall, registry, executor, session, "sequential");
                    ChatToolService.ToolExecution result = attempt.result();
                    sequentialResults.add(result);
                    if (!attempt.successful()) continue;
                    executedTools.add(result.name());
                    products = mergeProducts(products, result.products());
                    actions = mergeActions(actions, result.actions());
                    requiredDisclosures.addAll(result.requiredDisclosures());
                    if (result.catalogTotals() != null) catalogTotals = result.catalogTotals();
                    if (result.searchScope() != null) searchScope = result.searchScope();
                }
                appendFunctionExchange(contents, sequentialTurn, sequentialResults);
            }

            // Product detail enrichment is backend-owned. Skipping the former optional provider
            // hop leaves one of the three calls available for a transient retry.
            if (providerBudget.calls() >= MAX_PROVIDER_CALLS) return Optional.empty();
            stage = "final_provider";
            ModelTurn finalTurn = requestTurn(buildFinalRequestBody(
                    contents, registry.functionDeclarations(), responseInstruction),
                    providerBudget, stage);
            providerCalls = providerBudget.calls();
            if (finalTurn.finalText() == null || !finalTurn.functionCalls().isEmpty()) {
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
                    requiredDisclosures, totalProviderCalls, "AI", safeCatalogTotals, safeSearchScope,
                    providerBudget.usage()));
        } catch (SafetyBlockedException exception) {
            throw new SafetyBlockedException(providerBudget.calls(), providerBudget.usage());
        } catch (RuntimeException exception) {
            providerBudget.recordFailure(exception);
            logOrchestrationFailure(exception, stage);
            return Optional.empty();
        }
    }

    private ToolAttempt executeIsolated(
            FunctionCall functionCall,
            ChatToolRegistry registry,
            ToolExecutor executor,
            ChatToolService.ToolSession session,
            String stage
    ) {
        try {
            ChatToolRegistry.ValidatedCall validated = registry.validate(
                    functionCall.name(), functionCall.arguments());
            return new ToolAttempt(executor.execute(validated, session), true);
        } catch (ChatToolRegistry.ToolValidationException exception) {
            return rejectedToolAttempt(functionCall, stage, "VALIDATION_REJECTED");
        } catch (IllegalArgumentException exception) {
            return rejectedToolAttempt(functionCall, stage, "ARGUMENT_MISMATCH");
        } catch (RuntimeException exception) {
            return rejectedToolAttempt(functionCall, stage, "EXECUTION_FAILED");
        }
    }

    private ToolAttempt rejectedToolAttempt(FunctionCall call, String stage, String reason) {
        String tool = call.name() == null || call.name().isBlank() ? "unknown" : call.name();
        log.warn("chat_tool_call_dropped stage={} tool={} reason={}", stage, tool, reason);
        return new ToolAttempt(new ChatToolService.ToolExecution(
                tool,
                "{\"ok\":false,\"reason\":\"" + reason + "\",\"retryable\":true}",
                List.of(),
                List.of()), false);
    }

    private static boolean requiresSequentialProductLookup(String question, List<String> executedTools) {
        if (!executedTools.contains(ChatToolRegistry.SEARCH_PRODUCTS)
                || executedTools.contains(ChatToolRegistry.GET_PRODUCT)) return false;
        String normalized = java.text.Normalizer.normalize(
                        question == null ? "" : question.toLowerCase(java.util.Locale.ROOT),
                        java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd');
        return Pattern.compile(
                        "(?:con hang|size|kich co|mau|thong so|mau thu|second|stock|available|spec|colour|color)")
                .matcher(normalized)
                .find();
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
            budget.ensureWithinDeadline();
            if (budget.calls() >= MAX_PROVIDER_CALLS) {
                throw new IllegalStateException("Provider request budget exhausted");
            }
            budget.recordCall();
            try {
                String response = transport.generate(
                        budget.currentModel(), body, budget.remainingModelMillis());
                budget.ensureWithinDeadline();
                budget.recordUsage(response, objectMapper);
                return parseTurn(response)
                        .orElseThrow(() -> new IllegalStateException("Invalid Gemini response"));
            } catch (RuntimeException exception) {
                if (budget.retryAllowed()
                        && !budget.retryUsed()
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
        generation.put("thinkingConfig", Map.of("thinkingBudget", 0));
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
        generation.put("thinkingConfig", Map.of("thinkingBudget", 1_024));

        Map<String, Object> body = new LinkedHashMap<>();
        String systemInstruction = responseInstruction == null || responseInstruction.isBlank()
                ? SYSTEM_PROMPT
                : SYSTEM_PROMPT + "\n\n" + responseInstruction.trim();
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))));
        body.put("contents", List.copyOf(contents));
        body.put("generationConfig", generation);
        body.put("safetySettings", List.of(
                safetySetting("HARM_CATEGORY_HARASSMENT"),
                safetySetting("HARM_CATEGORY_HATE_SPEECH"),
                safetySetting("HARM_CATEGORY_SEXUALLY_EXPLICIT"),
                safetySetting("HARM_CATEGORY_DANGEROUS_CONTENT")));
        return body;
    }

    private static Map<String, Object> safetySetting(String category) {
        return Map.of("category", category, "threshold", "BLOCK_ONLY_HIGH");
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
                    .limit(12)
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
                .limit(8)
                .toList();
    }

    private void appendFunctionExchange(
            List<Map<String, Object>> contents,
            ModelTurn modelTurn,
            List<ChatToolService.ToolExecution> results
    ) {
        contents.add(modelTurn.modelContent());
        List<Map<String, Object>> parts = new ArrayList<>();
        for (int index = 0; index < results.size(); index++) {
            ChatToolService.ToolExecution result = results.get(index);
            FunctionCall call = modelTurn.functionCalls().get(index);
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
            if (call.id() != null && !call.id().isBlank()) functionResponse.put("id", call.id());
            parts.add(Map.of("functionResponse", functionResponse));
        }
        contents.add(Map.of(
                "role", "user",
                "parts", parts));
    }

    private static List<ChatProductCardResponse> mergeProducts(
            List<ChatProductCardResponse> current,
            List<ChatProductCardResponse> additions
    ) {
        Map<String, ChatProductCardResponse> merged = new LinkedHashMap<>();
        if (current != null) current.forEach(card -> {
            if (card != null && card.slug() != null) merged.putIfAbsent(card.slug(), card);
        });
        if (additions != null) additions.forEach(card -> {
            if (card != null && card.slug() != null) merged.putIfAbsent(card.slug(), card);
        });
        return merged.values().stream().limit(8).toList();
    }

    private static List<ChatActionResponse> mergeActions(
            List<ChatActionResponse> current,
            List<ChatActionResponse> additions
    ) {
        Map<String, ChatActionResponse> merged = new LinkedHashMap<>();
        if (current != null) current.forEach(action -> {
            if (action != null && action.type() != null) merged.putIfAbsent(action.type(), action);
        });
        if (additions != null) additions.forEach(action -> {
            if (action != null && action.type() != null) merged.putIfAbsent(action.type(), action);
        });
        return List.copyOf(merged.values());
    }

    private Optional<ModelTurn> parseTurn(String response) {
        if (response == null || response.isBlank()) return Optional.empty();
        try {
            JsonNode root = objectMapper.readTree(response);
            if (!root.path("promptFeedback").path("blockReason").asText("").isBlank()) {
                throw new SafetyBlockedException();
            }
            JsonNode candidates = root.path("candidates");
            if (!candidates.isArray() || candidates.isEmpty()) return Optional.empty();
            JsonNode candidate = candidates.get(0);
            String finishReason = candidate.path("finishReason").asText("");
            if ("SAFETY".equals(finishReason)) throw new SafetyBlockedException();
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
            if (!calls.isEmpty() && calls.size() <= MAX_TOOL_EXECUTIONS && texts.isEmpty()) {
                if (truncated) return Optional.empty();
                Map<String, Object> modelContent = objectMapper.convertValue(
                        content, new TypeReference<Map<String, Object>>() {});
                return Optional.of(new ModelTurn(List.copyOf(calls), null, modelContent, false));
            }
            if (calls.isEmpty() && texts.size() == 1) {
                return Optional.of(new ModelTurn(List.of(), texts.get(0), Map.of(), truncated));
            }
            return Optional.empty();
        } catch (SafetyBlockedException exception) {
            throw exception;
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

    private static ModelAwareGeminiTransport buildTransport(
            String apiKey, long timeoutSeconds) {
        String safeKey = apiKey == null ? "" : apiKey.trim();
        long seconds = timeoutSeconds > 0 ? timeoutSeconds : 20;
        long configuredMillis = Duration.ofSeconds(seconds).toMillis();
        return (modelId, body, remainingMillis) -> {
            long readMillis = Math.max(250L, Math.min(configuredMillis, remainingMillis));
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout((int) Math.min(Duration.ofSeconds(5).toMillis(), readMillis));
            factory.setReadTimeout((int) Math.min(Integer.MAX_VALUE, readMillis));
            RestClient client = RestClient.builder().requestFactory(factory).build();
            return client.post()
                    .uri(String.format(ENDPOINT, cleanModel(modelId, DEFAULT_MODEL)))
                    .header("x-goog-api-key", safeKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);
        };
    }

    private static String cleanModel(String value, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        String clean = value.trim();
        if (clean.startsWith("models/")) clean = clean.substring("models/".length());
        return clean.matches("[a-z0-9][a-z0-9.-]{0,119}") ? clean : fallback;
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    @FunctionalInterface
    interface GeminiTransport {
        String generate(Map<String, Object> body);
    }

    @FunctionalInterface
    interface ModelAwareGeminiTransport {
        String generate(String model, Map<String, Object> body, long timeoutMillis);
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

    private record ToolAttempt(ChatToolService.ToolExecution result, boolean successful) {}

    private record ModelTurn(
            List<FunctionCall> functionCalls,
            String finalText,
            Map<String, Object> modelContent,
            boolean truncated
    ) {}

    private static final class ProviderBudget {
        private final long startedAtNanos = System.nanoTime();
        private final Map<String, MutableModelUsage> usageByModel = new LinkedHashMap<>();
        private int calls;
        private boolean retryUsed;
        private boolean retryAllowed = true;
        private int inputTokens;
        private int outputTokens;
        private int thinkingTokens;
        private String currentModel = DEFAULT_MODEL;
        private long modelStartedAtNanos = startedAtNanos;
        private long modelDeadlineNanos = LOGICAL_TURN_DEADLINE_NANOS;
        private String failureReason;

        int calls() {
            return calls;
        }

        boolean retryUsed() {
            return retryUsed;
        }

        boolean retryAllowed() {
            return retryAllowed;
        }

        void recordCall() {
            calls++;
            usageByModel.computeIfAbsent(currentModel, ignored -> new MutableModelUsage()).calls++;
        }

        void recordRetry() {
            retryUsed = true;
        }

        void beginModel(String model, Duration timeout, boolean allowRetry) {
            currentModel = cleanModel(model, DEFAULT_MODEL);
            modelStartedAtNanos = System.nanoTime();
            long requested = timeout == null ? LOGICAL_TURN_DEADLINE_NANOS : timeout.toNanos();
            modelDeadlineNanos = Math.max(Duration.ofMillis(250).toNanos(), requested);
            retryAllowed = allowRetry;
        }

        String currentModel() {
            return currentModel;
        }

        void ensureWithinDeadline() {
            long now = System.nanoTime();
            if (now - startedAtNanos >= LOGICAL_TURN_DEADLINE_NANOS
                    || now - modelStartedAtNanos >= modelDeadlineNanos) {
                failureReason = "TIMEOUT";
                throw new IllegalStateException("Logical chat turn deadline exceeded");
            }
        }

        long remainingModelMillis() {
            long now = System.nanoTime();
            long logical = LOGICAL_TURN_DEADLINE_NANOS - (now - startedAtNanos);
            long model = modelDeadlineNanos - (now - modelStartedAtNanos);
            long remaining = Math.min(logical, model);
            return Math.max(250L, Duration.ofNanos(Math.max(0L, remaining)).toMillis());
        }

        boolean logicalDeadlineExceeded() {
            return System.nanoTime() - startedAtNanos >= LOGICAL_TURN_DEADLINE_NANOS;
        }

        Duration remainingLogicalDuration() {
            long remaining = LOGICAL_TURN_DEADLINE_NANOS - (System.nanoTime() - startedAtNanos);
            return Duration.ofNanos(Math.max(Duration.ofMillis(250).toNanos(), remaining));
        }

        void recordFailure(RuntimeException exception) {
            if (failureReason != null) return;
            if (exception instanceof ResourceAccessException) {
                failureReason = "NETWORK";
            } else if (exception instanceof RestClientResponseException providerException) {
                int status = providerException.getStatusCode().value();
                failureReason = status == 429 ? "RATE_LIMIT"
                        : status >= 500 ? "PROVIDER_5XX" : "INVALID_RESPONSE";
            } else {
                failureReason = "INVALID_RESPONSE";
            }
        }

        String failureReason() {
            return failureReason;
        }

        void recordUsage(String response, ObjectMapper objectMapper) {
            if (response == null || response.isBlank()) return;
            try {
                JsonNode usage = objectMapper.readTree(response).path("usageMetadata");
                int responseInput = Math.max(0, usage.path("promptTokenCount").asInt(0));
                int responseOutput = Math.max(0, usage.path("candidatesTokenCount").asInt(0));
                int responseThinking = Math.max(0, usage.path("thoughtsTokenCount").asInt(0));
                inputTokens += responseInput;
                outputTokens += responseOutput;
                thinkingTokens += responseThinking;
                MutableModelUsage modelUsage = usageByModel.computeIfAbsent(
                        currentModel, ignored -> new MutableModelUsage());
                modelUsage.inputTokens += responseInput;
                modelUsage.outputTokens += responseOutput;
                modelUsage.thinkingTokens += responseThinking;
            } catch (Exception ignored) {
                // Telemetry must never turn a valid customer answer into an error.
            }
        }

        TokenUsage usage() {
            return new TokenUsage(inputTokens, outputTokens, thinkingTokens);
        }

        List<ModelUsage> modelUsages() {
            return usageByModel.entrySet().stream()
                    .map(entry -> new ModelUsage(
                            entry.getKey(),
                            entry.getValue().calls,
                            new TokenUsage(
                                    entry.getValue().inputTokens,
                                    entry.getValue().outputTokens,
                                    entry.getValue().thinkingTokens)))
                    .toList();
        }

        private static final class MutableModelUsage {
            private int calls;
            private int inputTokens;
            private int outputTokens;
            private int thinkingTokens;
        }
    }

    public static final class SafetyBlockedException extends RuntimeException {
        private final int providerCallCount;
        private final TokenUsage usage;

        public SafetyBlockedException() {
            this(0, TokenUsage.empty());
        }

        public SafetyBlockedException(int providerCallCount, TokenUsage usage) {
            super("Gemini safety block");
            this.providerCallCount = Math.max(0, providerCallCount);
            this.usage = usage == null ? TokenUsage.empty() : usage;
        }

        public int providerCallCount() {
            return providerCallCount;
        }

        public TokenUsage usage() {
            return usage;
        }
    }

    public record TokenUsage(int inputTokens, int outputTokens, int thinkingTokens) {
        public static TokenUsage empty() {
            return new TokenUsage(0, 0, 0);
        }
    }

    public record ModelUsage(String modelId, int providerRequestCount, TokenUsage usage) {
        public ModelUsage {
            modelId = cleanModel(modelId, DEFAULT_MODEL);
            providerRequestCount = Math.max(0, providerRequestCount);
            usage = usage == null ? TokenUsage.empty() : usage;
        }
    }

    public record ModelAnswer(
            HybridAnswer answer,
            String requestedModel,
            String servedModel,
            boolean fallbackUsed,
            String fallbackReason,
            List<ModelUsage> modelUsages
    ) {
        public ModelAnswer {
            modelUsages = modelUsages == null ? List.of() : List.copyOf(modelUsages);
        }

        public ModelAnswer(
                HybridAnswer answer,
                String requestedModel,
                String servedModel,
                boolean fallbackUsed,
                String fallbackReason
        ) {
            this(answer, requestedModel, servedModel, fallbackUsed, fallbackReason, List.of());
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
            ChatToolService.SearchScope searchScope,
            TokenUsage usage
    ) {
        public HybridAnswer(
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
            this(answer, products, actions, executedTools, requiredDisclosures,
                    providerCallCount, source, catalogTotals, searchScope, TokenUsage.empty());
        }

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
                    providerCallCount, source, catalogTotals, null, TokenUsage.empty());
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
                    providerCallCount, source, null, null, TokenUsage.empty());
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
                    providerCallCount, "AI", null, null, TokenUsage.empty());
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
            usage = usage == null ? TokenUsage.empty() : usage;
        }
    }
}
