package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatEvaluationModelResultEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatEvaluationRunEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatEvaluationModelResultJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatEvaluationRunJpaRepository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/** Paid evaluation runner; never writes a customer conversation or consumes customer quota. */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatEvaluationRunner {

    private static final BigDecimal MILLION = BigDecimal.valueOf(1_000_000L);
    private static final long PROJECTED_MAX_INPUT_TOKENS_PER_CASE = 100_000L;
    private static final long PROJECTED_MAX_OUTPUT_TOKENS_PER_CASE = 8_192L;
    private static final Pattern NUMBER_TOKEN = Pattern.compile("\\d(?:[\\d.,\\s]*\\d)?|\\d");

    private final ChatEvaluationRunJpaRepository runRepository;
    private final ChatEvaluationModelResultJpaRepository resultRepository;
    private final ChatEvaluationDatasetService datasetService;
    private final GeminiModelCatalogService modelCatalogService;
    private final ChatAssistantSettings assistantSettings;
    private final ChatToolRegistry toolRegistry;
    private final ChatToolService toolService;
    private final AiChatClient aiClient;
    private final ChatAiUsageService usageService;
    private final ObjectMapper objectMapper;

    @Async
    public void run(UUID runId) {
        ChatEvaluationRunEntity run = runRepository.findById(runId).orElse(null);
        if (run == null || !"PENDING".equals(run.getStatus())) return;
        run.setStatus("RUNNING");
        runRepository.save(run);
        BigDecimal totalCost = BigDecimal.ZERO;
        boolean costLimitReached = false;
        try {
            ChatEvaluationDatasetService.Dataset dataset =
                    datasetService.require(run.getDatasetVersion());
            List<String> modelIds = objectMapper.readValue(
                    run.getModelIds(), new TypeReference<>() {});
            ChatToolService.AssistantCatalogVocabulary vocabulary =
                    toolService.assistantCatalogVocabulary();
            if (vocabulary == null) vocabulary = ChatToolService.AssistantCatalogVocabulary.empty();

            Map<String, ChatModelRegistry.ModelPrice> prices = new LinkedHashMap<>();
            Map<String, ModelAccumulator> accumulators = new LinkedHashMap<>();
            for (String modelId : modelIds) {
                prices.put(modelId, modelCatalogService.requirePrice(modelId, Instant.now()));
                accumulators.put(modelId, new ModelAccumulator(modelId));
            }
            BigDecimal projectedBatchCost = prices.values().stream()
                    .map(ChatEvaluationRunner::projectedCaseCost)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            for (ChatEvaluationDatasetService.EvaluationCase evaluationCase : dataset.cases()) {
                if (!evaluationCase.verified()) continue;
                // Run the same case for every selected model before moving to the next case. If
                // the cap stops a run, the comparison remains side-by-side instead of favoring
                // whichever model happened to be first in the request.
                if (totalCost.add(projectedBatchCost).compareTo(run.getMaxCostUsd()) > 0) {
                    costLimitReached = true;
                    break;
                }
                for (String modelId : modelIds) {
                    ChatModelRegistry.ModelPrice price = prices.get(modelId);
                    ModelAccumulator accumulator = accumulators.get(modelId);
                    long startedNanos = System.nanoTime();
                    Optional<AiChatClient.ModelAnswer> result;
                    AiChatClient.TokenUsage safetyUsage = AiChatClient.TokenUsage.empty();
                    int providerCalls = 0;
                    try {
                        ChatAssistantSettings.Snapshot settings =
                                assistantSettings.load(evaluationCase.locale());
                        ChatToolService.ToolContext context = new ChatToolService.ToolContext(
                                evaluationCase.question(), evaluationCase.locale(), null, settings,
                                ChatToolService.ConversationContext.empty());
                        result = aiClient.answerForEvaluation(
                                modelId,
                                evaluationCase.question(),
                                evaluationCase.locale(),
                                toolRegistry,
                                !evaluationCase.requiredTools().isEmpty(),
                                (call, session) -> toolService.execute(call, context, session),
                                vocabulary);
                    } catch (AiChatClient.SafetyBlockedException exception) {
                        result = Optional.empty();
                        safetyUsage = exception.usage();
                        providerCalls = exception.providerCallCount();
                    }
                    int latencyMs = elapsedMillis(startedNanos);
                    AiChatClient.TokenUsage usage = result
                            .map(item -> item.answer().usage()).orElse(safetyUsage);
                    if (result.isPresent()) providerCalls = result.get().answer().providerCallCount();
                    BigDecimal caseCost = cost(price, usage);
                    totalCost = totalCost.add(caseCost);
                    accumulator.add(
                            score(evaluationCase, result), usage, latencyMs, caseCost);
                    usageService.record(
                            "EVALUATION", null, null, runId, modelId, modelId,
                            providerCalls, usage.inputTokens(), usage.outputTokens(),
                            usage.thinkingTokens(), 0, caseCost, price.effectiveFrom(),
                            false, result.isPresent(), latencyMs);
                }
            }
            accumulators.values().forEach(accumulator -> saveResult(runId, accumulator));
            run.setActualCostUsd(totalCost.setScale(8, RoundingMode.HALF_UP));
            run.setStatus(costLimitReached ? "COST_LIMIT_REACHED" : "COMPLETED");
            run.setCompletedAt(Instant.now());
            runRepository.save(run);
        } catch (Exception exception) {
            log.warn("chat_evaluation_failed runId={} type={}",
                    runId, exception.getClass().getSimpleName());
            run.setActualCostUsd(totalCost.setScale(8, RoundingMode.HALF_UP));
            run.setStatus("FAILED");
            run.setFailureCode("RUNNER_ERROR");
            run.setCompletedAt(Instant.now());
            runRepository.save(run);
        }
    }

    private void saveResult(UUID runId, ModelAccumulator accumulator) {
        if (accumulator.total == 0
                || resultRepository.findByRunIdOrderByModelIdAsc(runId).stream()
                .anyMatch(item -> item.getModelId().equals(accumulator.modelId))) return;
        ChatEvaluationModelResultEntity entity = new ChatEvaluationModelResultEntity();
        entity.setRunId(runId);
        entity.setModelId(accumulator.modelId);
        entity.setTotalCases(accumulator.total);
        entity.setPassedCases(accumulator.passed);
        entity.setNumericCaseCount(accumulator.numericCases);
        entity.setNumericAccuracy(rate(accumulator.numericPass, accumulator.numericCases));
        entity.setIntentAccuracy(rate(accumulator.intentPass, accumulator.total));
        entity.setNonFabricationCaseCount(accumulator.nonFabricationCases);
        entity.setNonFabricationRate(rate(
                accumulator.nonFabricationPass, accumulator.nonFabricationCases));
        entity.setGiveUpRate(rate(accumulator.giveUps, accumulator.total));
        entity.setP50LatencyMs(percentile(accumulator.latencies, 0.50));
        entity.setP95LatencyMs(percentile(accumulator.latencies, 0.95));
        entity.setInputTokens(accumulator.inputTokens);
        entity.setOutputTokens(accumulator.outputTokens);
        entity.setThinkingTokens(accumulator.thinkingTokens);
        entity.setFallbackCount(0);
        entity.setEstimatedCostUsd(accumulator.cost.setScale(8, RoundingMode.HALF_UP));
        resultRepository.save(entity);
    }

    static CaseScore score(
            ChatEvaluationDatasetService.EvaluationCase expected,
            Optional<AiChatClient.ModelAnswer> result
    ) {
        if (result.isEmpty()) return new CaseScore(
                !expected.expectedNumbers().isEmpty(), false, false,
                !expected.forbiddenTerms().isEmpty(), false, true, false);
        AiChatClient.HybridAnswer actual = result.get().answer();
        String answer = actual.answer().answer().toLowerCase(Locale.ROOT);
        boolean numericApplicable = !expected.expectedNumbers().isEmpty();
        boolean numeric = expected.expectedNumbers().stream()
                .allMatch(number -> containsExpectedNumber(answer, number));
        boolean tools = actual.executedTools().containsAll(expected.requiredTools());
        List<String> actualProductSlugs = actual.products().stream()
                .map(item -> item.slug().toLowerCase(Locale.ROOT))
                .toList();
        boolean products = (!expected.requireProducts() || !actual.products().isEmpty())
                && expected.expectedProductSlugs().stream()
                .map(item -> item.toLowerCase(Locale.ROOT))
                .allMatch(actualProductSlugs::contains);
        boolean expectedTerms = expected.expectedAnswerTerms().stream()
                .allMatch(term -> answer.contains(term.toLowerCase(Locale.ROOT)));
        boolean intent = tools && products && expectedTerms
                && actual.answer().offTopic() == expected.expectedOffTopic()
                && actual.answer().handoffRecommended() == expected.expectedHandoff();
        boolean nonFabricationApplicable = !expected.forbiddenTerms().isEmpty();
        boolean nonFabrication = expected.forbiddenTerms().stream()
                .noneMatch(term -> answer.contains(term.toLowerCase(Locale.ROOT)));
        boolean giveUp = actual.answer().handoffRecommended() && !expected.expectedHandoff();
        boolean passed = numeric && intent && nonFabrication && !giveUp;
        return new CaseScore(
                numericApplicable, numeric, intent,
                nonFabricationApplicable, nonFabrication, giveUp, passed);
    }

    private static BigDecimal projectedCaseCost(ChatModelRegistry.ModelPrice price) {
        BigDecimal input = price.inputUsdPerMillion()
                .multiply(BigDecimal.valueOf(PROJECTED_MAX_INPUT_TOKENS_PER_CASE));
        BigDecimal output = price.outputUsdPerMillion()
                .multiply(BigDecimal.valueOf(PROJECTED_MAX_OUTPUT_TOKENS_PER_CASE));
        return input.add(output).divide(MILLION, 8, RoundingMode.CEILING);
    }

    private static boolean containsExpectedNumber(String answer, String expected) {
        String expectedDigits = expected == null ? "" : expected.replaceAll("\\D", "");
        if (expectedDigits.isBlank()) {
            return expected != null && answer.contains(expected.toLowerCase(Locale.ROOT));
        }
        Matcher matcher = NUMBER_TOKEN.matcher(answer);
        while (matcher.find()) {
            if (expectedDigits.equals(matcher.group().replaceAll("\\D", ""))) return true;
        }
        return false;
    }

    private static BigDecimal cost(
            ChatModelRegistry.ModelPrice price,
            AiChatClient.TokenUsage usage
    ) {
        BigDecimal input = price.inputUsdPerMillion()
                .multiply(BigDecimal.valueOf(usage.inputTokens()));
        long billedOutput = (long) usage.outputTokens() + usage.thinkingTokens();
        BigDecimal output = price.outputUsdPerMillion()
                .multiply(BigDecimal.valueOf(billedOutput));
        return input.add(output).divide(MILLION, 8, RoundingMode.HALF_UP);
    }

    private static BigDecimal rate(int numerator, int denominator) {
        return denominator == 0 ? BigDecimal.ZERO
                : BigDecimal.valueOf(numerator)
                .divide(BigDecimal.valueOf(denominator), 6, RoundingMode.HALF_UP);
    }

    private static Integer percentile(List<Integer> values, double percentile) {
        if (values.isEmpty()) return null;
        List<Integer> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int index = (int) Math.ceil(percentile * sorted.size()) - 1;
        return sorted.get(Math.max(0, Math.min(index, sorted.size() - 1)));
    }

    private static int elapsedMillis(long startedNanos) {
        return (int) Math.min(Integer.MAX_VALUE,
                Math.max(0L, (System.nanoTime() - startedNanos) / 1_000_000L));
    }

    record CaseScore(
            boolean numericApplicable,
            boolean numeric,
            boolean intent,
            boolean nonFabricationApplicable,
            boolean nonFabrication,
            boolean giveUp,
            boolean passed
    ) {}

    private static final class ModelAccumulator {
        private final String modelId;
        private final List<Integer> latencies = new ArrayList<>();
        private int total;
        private int passed;
        private int numericCases;
        private int numericPass;
        private int intentPass;
        private int nonFabricationCases;
        private int nonFabricationPass;
        private int giveUps;
        private long inputTokens;
        private long outputTokens;
        private long thinkingTokens;
        private BigDecimal cost = BigDecimal.ZERO;

        private ModelAccumulator(String modelId) {
            this.modelId = modelId;
        }

        private void add(
                CaseScore score,
                AiChatClient.TokenUsage usage,
                int latency,
                BigDecimal caseCost
        ) {
            total++;
            if (score.passed()) passed++;
            if (score.numericApplicable()) {
                numericCases++;
                if (score.numeric()) numericPass++;
            }
            if (score.intent()) intentPass++;
            if (score.nonFabricationApplicable()) {
                nonFabricationCases++;
                if (score.nonFabrication()) nonFabricationPass++;
            }
            if (score.giveUp()) giveUps++;
            inputTokens += usage.inputTokens();
            outputTokens += usage.outputTokens();
            thinkingTokens += usage.thinkingTokens();
            latencies.add(latency);
            cost = cost.add(caseCost);
        }
    }
}
