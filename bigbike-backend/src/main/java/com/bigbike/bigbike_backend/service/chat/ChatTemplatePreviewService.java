package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatTemplatePreviewRequest;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatTemplatePreviewResponse;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ChatTemplatePreviewService {
    private final ChatResponseGuard responseGuard;

    public ChatTemplatePreviewService(ChatResponseGuard responseGuard) {
        this.responseGuard = responseGuard;
    }

    public AdminChatTemplatePreviewResponse preview(AdminChatTemplatePreviewRequest request) {
        boolean english = "en".equals(request.locale());
        List<String> triggers = english ? request.triggersEn() : request.triggersVi();
        String answer = english ? request.answerEn() : request.answerVi();
        List<String> violations = new ArrayList<>();
        if (request.triggersVi() == null || request.triggersVi().isEmpty()) {
            violations.add("TRIGGERS_VI_REQUIRED");
        }
        if (request.triggersEn() == null || request.triggersEn().isEmpty()) {
            violations.add("TRIGGERS_EN_REQUIRED");
        }
        if (request.answerVi() == null || request.answerVi().isBlank()) {
            violations.add("ANSWER_VI_REQUIRED");
        } else {
            violations.addAll(ChatTemplatePolicy.violations(request.answerVi()));
        }
        if (request.answerEn() == null || request.answerEn().isBlank()) {
            violations.add("ANSWER_EN_REQUIRED");
        } else {
            violations.addAll(ChatTemplatePolicy.violations(request.answerEn()));
        }
        String normalizedQuestion = ChatTemplatePolicy.normalizeMatchText(request.sampleQuestion());
        boolean matched = triggers != null && triggers.stream()
                .map(ChatTemplatePolicy::normalizeMatchText)
                .filter(value -> !value.isBlank())
                .anyMatch(value -> (" " + normalizedQuestion + " ").contains(" " + value + " "));
        if (matched && answer != null && !answer.isBlank()
                && responseGuard.check(answer, List.of(), request.locale()).isEmpty()) {
            violations.add("CUSTOMER_GUARD_REJECTED");
        }
        List<String> unique = violations.stream().distinct().toList();
        return new AdminChatTemplatePreviewResponse(
                matched,
                matched && unique.isEmpty() ? answer.trim() : null,
                matched && unique.isEmpty() ? "TEMPLATE" : null,
                unique,
                unique.isEmpty());
    }
}
