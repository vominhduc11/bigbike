package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatEvaluationDatasetResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatEvaluationDraftResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatEvaluationModelResultResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatEvaluationRunRequest;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatEvaluationRunResponse;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatEvaluationModelResultEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatEvaluationRunEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatEvaluationModelResultJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatEvaluationRunJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@RequiredArgsConstructor
public class ChatEvaluationService {

    private final ChatEvaluationDatasetService datasetService;
    private final GeminiModelCatalogService modelCatalogService;
    private final ChatEvaluationRunJpaRepository runRepository;
    private final ChatEvaluationModelResultJpaRepository resultRepository;
    private final ChatMessageJpaRepository messageRepository;
    private final ChatEvaluationRunner runner;
    private final ObjectMapper objectMapper;

    @Value("${bigbike.chat.evaluation-max-cost-usd:2.00}")
    private BigDecimal configuredMaxCost = new BigDecimal("2.00");

    public List<AdminChatEvaluationDatasetResponse> datasets() {
        return datasetService.datasets().stream().map(dataset -> {
            boolean fullCoverage = coverageComplete(dataset.acceptanceCoverage());
            int verifiedCaseCount = Math.toIntExact(dataset.cases().stream()
                    .filter(ChatEvaluationDatasetService.EvaluationCase::verified)
                    .count());
            return new AdminChatEvaluationDatasetResponse(
                    dataset.version(), dataset.checksum(), verifiedCaseCount,
                    dataset.acceptanceCoverage().size(),
                    dataset.realConversationCaseCount(), dataset.sourceSummary(),
                    dataset.descriptionVi(), dataset.descriptionEn(), dataset.acceptanceCoverage(),
                    fullCoverage, dataset.realConversationCaseCount() == 0);
        }).toList();
    }

    @Transactional
    public AdminChatEvaluationRunResponse start(
            AdminChatEvaluationRunRequest request,
            UUID adminId
    ) {
        ChatEvaluationDatasetService.Dataset dataset;
        try {
            dataset = datasetService.require(request.datasetVersion());
        } catch (IllegalArgumentException exception) {
            throw ValidationException.fromField(
                    "datasetVersion", "UNKNOWN_DATASET", "Không tìm thấy phiên bản bộ đề.");
        }
        List<String> models = new LinkedHashSet<>(request.modelIds().stream()
                .map(String::trim).toList()).stream().toList();
        if (models.isEmpty() || models.size() != request.modelIds().size()) {
            throw ValidationException.fromField(
                    "modelIds", "DUPLICATE_OR_EMPTY", "Danh sách model không được trống hoặc trùng.");
        }
        for (String model : models) {
            if (!modelCatalogService.isSelectable(model, true)) {
                throw ValidationException.fromField(
                        "modelIds", "MODEL_NOT_SELECTABLE",
                        "Có model không còn dùng được với tài khoản hoặc chưa có giá xác minh.");
            }
        }
        BigDecimal requestedCap = request.maxCostUsd() == null
                ? configuredMaxCost : request.maxCostUsd();
        BigDecimal hardCap = requestedCap.min(configuredMaxCost).min(new BigDecimal("2.00"));
        if (hardCap.signum() <= 0) {
            throw ValidationException.fromField(
                    "maxCostUsd", "INVALID_COST_CAP", "Trần chi phí phải lớn hơn 0.");
        }
        try {
            ChatEvaluationRunEntity run = new ChatEvaluationRunEntity();
            run.setDatasetVersion(dataset.version());
            run.setDatasetChecksum(dataset.checksum());
            run.setModelIds(objectMapper.writeValueAsString(models));
            run.setMaxCostUsd(hardCap);
            run.setActualCostUsd(BigDecimal.ZERO);
            run.setStatus("PENDING");
            run.setCreatedBy(adminId);
            run = runRepository.save(run);
            UUID runId = run.getId();
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    runner.run(runId);
                }
            });
            return toResponse(run, List.of());
        } catch (JacksonException exception) {
            throw new IllegalStateException("Cannot create evaluation run", exception);
        }
    }

    @Transactional(readOnly = true)
    public List<AdminChatEvaluationRunResponse> runs() {
        return runRepository.findTop50ByOrderByCreatedAtDesc().stream()
                .map(run -> toResponse(run, resultRepository.findByRunIdOrderByModelIdAsc(run.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AdminChatEvaluationRunResponse> compare(List<UUID> runIds) {
        if (runIds == null || runIds.isEmpty() || runIds.size() > 10) {
            throw ValidationException.fromField(
                    "runIds", "INVALID_RUN_IDS", "Chọn từ 1 đến 10 lần chạy để so sánh.");
        }
        return runRepository.findAllById(runIds).stream()
                .map(run -> toResponse(run, resultRepository.findByRunIdOrderByModelIdAsc(run.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public AdminChatEvaluationDraftResponse sanitizedDraft() {
        List<String> questions = messageRepository.findTop500ByRoleOrderByCreatedAtDesc("CUSTOMER")
                .stream().map(item -> item.getContent()).toList();
        String draft = datasetService.draftFromQuestions(questions);
        return new AdminChatEvaluationDraftResponse(
                questions.size(), draft,
                "Bản nháp đã che PII tự động nhưng bắt buộc owner kiểm tra lại và điền đáp án từ dữ liệu thật trước khi dùng.");
    }

    private AdminChatEvaluationRunResponse toResponse(
            ChatEvaluationRunEntity run,
            List<ChatEvaluationModelResultEntity> results
    ) {
        List<String> models;
        try {
            models = objectMapper.readValue(run.getModelIds(), new TypeReference<>() {});
        } catch (Exception ignored) {
            models = List.of();
        }
        return new AdminChatEvaluationRunResponse(
                run.getId(), run.getDatasetVersion(), run.getDatasetChecksum(), models,
                run.getMaxCostUsd(), run.getActualCostUsd(), run.getStatus(), run.getFailureCode(),
                run.getStartedAt(), run.getCompletedAt(), results.stream().map(this::toResult).toList());
    }

    private AdminChatEvaluationModelResultResponse toResult(ChatEvaluationModelResultEntity item) {
        BigDecimal average = item.getTotalCases() == 0 ? BigDecimal.ZERO
                : item.getEstimatedCostUsd().divide(
                        BigDecimal.valueOf(item.getTotalCases()), 8, RoundingMode.HALF_UP);
        return new AdminChatEvaluationModelResultResponse(
                item.getModelId(), item.getTotalCases(), item.getPassedCases(),
                item.getNumericCaseCount(), item.getNumericAccuracy(), item.getIntentAccuracy(),
                item.getNonFabricationCaseCount(), item.getNonFabricationRate(),
                item.getGiveUpRate(), item.getP50LatencyMs(), item.getP95LatencyMs(),
                item.getInputTokens(), item.getOutputTokens(), item.getThinkingTokens(),
                item.getFallbackCount(), item.getEstimatedCostUsd(), average);
    }

    private static boolean coverageComplete(List<String> coverage) {
        return coverage != null && coverage.size() == 85
                && coverage.contains("PHASE1-01") && coverage.contains("PHASE1-10")
                && coverage.contains("PHASE2-01") && coverage.contains("PHASE2-26")
                && coverage.contains("PHASE3-01") && coverage.contains("PHASE3-27")
                && coverage.contains("PHASE4-01") && coverage.contains("PHASE4-22");
    }
}
