package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatAvailabilityResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadDeclineResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatLeadEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatLeadJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.service.chat.ChatToolService.ToolOutcome;
import com.bigbike.bigbike_backend.service.ws.AdminChatWsService;
import com.bigbike.bigbike_backend.service.ws.ChatLeadWsEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
@RequiredArgsConstructor
public class ChatService {

    public static final int MAX_TURNS = 12;
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ChatConversationJpaRepository conversationRepo;
    private final ChatMessageJpaRepository messageRepo;
    private final ChatLeadJpaRepository leadRepo;
    private final ChatAssistantSettings assistantSettings;
    private final ChatToolService toolService;
    private final ChatToolRegistry toolRegistry;
    private final AiChatClient aiClient;
    private final ChatResponseGuard responseGuard;
    private final AdminChatWsService adminChatWsService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional(readOnly = true)
    public ChatAvailabilityResponse availability(String lang) {
        ChatAssistantSettings.Snapshot settings = assistantSettings.load(lang);
        Availability availability = resolveAvailability(settings);
        String greeting = responseGuard.isSafeGreeting(settings.greeting(), lang)
                ? settings.greeting().trim()
                : ChatAssistantSettings.defaultGreeting(lang);
        List<String> quickPrompts = settings.quickPrompts().stream()
                .filter(prompt -> responseGuard.isSafeCustomerText(prompt, lang))
                .limit(4)
                .toList();
        if (quickPrompts.size() < 3) quickPrompts = ChatAssistantSettings.defaultQuickPrompts(lang);
        return new ChatAvailabilityResponse(
                availability.mode(),
                "AI".equals(availability.mode()) ? "AI" : "CONTACT",
                greeting,
                quickPrompts,
                MAX_TURNS,
                settings.contacts());
    }

    @Transactional
    public synchronized ChatMessageResponse send(ChatMessageRequest request, UUID customerId) {
        ChatAssistantSettings.Snapshot settings = assistantSettings.load(request.getLang());
        ChatConversationEntity conversation = loadOrCreate(
                request.getConversationId(), customerId, request.getLang());

        if (conversation.getEndedReason() != null || conversation.getTurnCount() >= MAX_TURNS) {
            conversation.setEndedReason(conversation.getEndedReason() == null
                    ? "TURN_LIMIT" : conversation.getEndedReason());
            conversationRepo.save(conversation);
            return contactResponse(conversation, settings, turnLimitText(request.getLang()), List.of());
        }

        Availability availability = resolveAvailability(settings);
        if (!"AI".equals(availability.mode())) {
            conversation.setEndedReason(endedReason(availability.reason()));
            saveCustomerMessage(conversation, request.getMessage());
            String fallback = contactFallbackText(request.getLang(), fallbackCause(availability.reason()));
            log.warn("Bi fallback cause={}", fallbackCause(availability.reason()));
            saveAssistantMessage(conversation, fallback,
                    "CONTACT_FALLBACK", false, List.of(), 0);
            return contactResponse(
                    conversation, settings, fallback, List.of());
        }

        ChatToolService.ConversationContext conversationContext = readConversationContext(conversation);
        saveCustomerMessage(conversation, request.getMessage());
        Optional<ToolOutcome> fastPath;
        try {
            fastPath = toolService.resolveFastPath(
                    request.getMessage(), request.getLang(), customerId, settings, conversationContext);
        } catch (RuntimeException exception) {
            log.warn("Bi fast-path failed type={}", exception.getClass().getSimpleName());
            return recoverableFallback(
                    conversation, settings, request.getLang(), FallbackCause.STAFF_REVIEW, false, 0);
        }

        if (fastPath.isPresent()) {
            ToolOutcome tool = fastPath.get();
            Optional<ChatResponseGuard.CheckedAnswer> checked = responseGuard.check(
                    tool.localAnswer(), tool.products(), request.getLang());
            if (checked.isEmpty()) {
                return recoverableFallback(
                        conversation, settings, request.getLang(), FallbackCause.SAFETY_REVIEW, false, 0);
            }
            ChatResponseGuard.CheckedAnswer safe = checked.get();
            if (tool.leadDeclined() && "OFFERED".equals(conversation.getLeadOfferStatus())) {
                conversation.setLeadOfferStatus("DECLINED");
            }
            boolean handoff = applyConversationSignals(conversation, tool.offTopic(), tool.handoffRecommended());
            saveAssistantMessage(conversation, safe.answer(), tool.source(), false, safe.products(), 0);
            saveConversationContext(conversation, toolService.recordConversationContext(
                    conversationContext,
                    request.getMessage(),
                    request.getLang(),
                    safe.products(),
                    tool.actions()));
            finishTurnIfNeeded(conversation);
            conversationRepo.save(conversation);
            return aiResponse(
                    conversation,
                    settings,
                    safe.answer(),
                    safe.products(),
                    handoff,
                    false,
                    tool.actions());
        }

        ChatToolService.ToolContext toolContext = new ChatToolService.ToolContext(
                request.getMessage(), request.getLang(), customerId, settings, conversationContext);
        Optional<AiChatClient.HybridAnswer> ai;
        try {
            ai = aiClient.answer(
                    request.getMessage(),
                    request.getLang(),
                    toolRegistry,
                    true,
                    (call, session) -> toolService.execute(call, toolContext, session));
        } catch (RuntimeException exception) {
            log.warn("Bi AI invocation failed type={}", exception.getClass().getSimpleName());
            ai = Optional.empty();
        }
        conversation.setAiCallCount(conversation.getAiCallCount() + 1);
        if (ai.isEmpty()) {
            return recoverableFallback(
                    conversation, settings, request.getLang(), FallbackCause.PROVIDER_UNAVAILABLE, true, 0);
        }

        AiChatClient.HybridAnswer hybridAnswer = ai.get();
        Optional<ChatResponseGuard.CheckedAnswer> checked = checkHybridAnswer(
                hybridAnswer, request.getLang(), settings);
        String guardReason = checked.isEmpty()
                ? rejectionReason(hybridAnswer, request.getLang(), settings)
                : "NONE";
        int toneRetryCount = 0;
        if (checked.isEmpty()) {
            // Log which rule closed the gate (a fixed code, never customer text) — without
            // it a guard rejection is indistinguishable from a provider outage in prod.
            log.warn("Bi answer rejected by guard reason={}", guardReason);
            if ("WRONG_TONE".equals(guardReason)
                    && !"TOOL".equals(hybridAnswer.source())
                    && hasToneRetryCapacity(settings)) {
                // A correction orchestration is a second chargeable AI use even though it
                // keeps one customer turn and one assistant message. Persist that fact so the
                // daily cap remains correct after a process restart.
                toneRetryCount = 1;
                conversation.setAiCallCount(conversation.getAiCallCount() + 1);
                try {
                    Optional<AiChatClient.HybridAnswer> retry = aiClient.answerWithToneCorrection(
                            request.getMessage(),
                            request.getLang(),
                            toolRegistry,
                            true,
                            (call, session) -> toolService.execute(call, toolContext, session));
                    if (retry.isPresent()) {
                        hybridAnswer = retry.get();
                        checked = checkHybridAnswer(hybridAnswer, request.getLang(), settings);
                        guardReason = checked.isEmpty()
                                ? rejectionReason(hybridAnswer, request.getLang(), settings)
                                : "NONE";
                        if (checked.isEmpty()) {
                            log.warn("Bi tone-retry rejected by guard reason={}", guardReason);
                        }
                    } else {
                        log.warn("Bi tone-retry returned no usable answer");
                    }
                } catch (RuntimeException exception) {
                    log.warn("Bi tone-retry failed type={}", exception.getClass().getSimpleName());
                }
            } else if ("WRONG_TONE".equals(guardReason)
                    && !"TOOL".equals(hybridAnswer.source())) {
                log.warn("Bi tone-retry skipped cause=daily_limit_reserve");
            }
        }
        if (checked.isEmpty()) {
            return recoverableFallback(
                    conversation, settings, request.getLang(), FallbackCause.SAFETY_REVIEW, true, toneRetryCount);
        }
        ChatResponseGuard.CheckedAnswer safe = checked.get();
        AiChatClient.Answer answer = hybridAnswer.answer();
        boolean handoff = applyConversationSignals(
                conversation, answer.offTopic(), answer.handoffRecommended());
        boolean leadPrompt = answer.leadPrompt()
                && !handoff
                && "NONE".equals(conversation.getLeadOfferStatus());
        if (leadPrompt) conversation.setLeadOfferStatus("OFFERED");
        saveAssistantMessage(
                conversation, safe.answer(), hybridAnswer.source(), true, safe.products(), toneRetryCount);
        saveConversationContext(conversation, toolService.recordConversationContext(
                conversationContext,
                request.getMessage(),
                request.getLang(),
                safe.products(),
                hybridAnswer.actions()));
        finishTurnIfNeeded(conversation);
        conversationRepo.save(conversation);
        return aiResponse(
                conversation,
                settings,
                safe.answer(),
                safe.products(),
                handoff || conversation.getEndedReason() != null,
                leadPrompt,
                hybridAnswer.actions());
    }

    @Transactional
    public ChatLeadResponse captureLead(ChatLeadRequest request, UUID customerId) {
        ChatConversationEntity conversation = loadExistingForCaller(
                request.getConversationId(), customerId);
        if (!"OFFERED".equals(conversation.getLeadOfferStatus())) {
            throw new ConflictException("Thông tin liên hệ chưa được mời hoặc đã có lựa chọn trước đó.");
        }
        if (leadRepo.existsByConversationId(conversation.getId())) {
            throw new ConflictException("Hội thoại này đã ghi nhận thông tin liên hệ.");
        }

        ChatLeadEntity lead = new ChatLeadEntity();
        lead.setConversationId(conversation.getId());
        lead.setName(trimToNull(request.getName()));
        lead.setPhone(request.getPhone().replaceAll("\\s+", " ").trim());
        lead.setNote(trimToNull(request.getNote()));
        lead.setConsentedAt(Instant.now());
        leadRepo.save(lead);

        conversation.setLeadOfferStatus("ACCEPTED");
        conversationRepo.save(conversation);
        adminChatWsService.pushLead(new ChatLeadWsEvent(
                "CHAT_LEAD",
                conversation.getId(),
                lead.getName(),
                lead.getPhone(),
                lead.getNote(),
                Instant.now()));
        return new ChatLeadResponse(true);
    }

    @Transactional
    public ChatLeadDeclineResponse declineLead(UUID conversationId, UUID customerId) {
        ChatConversationEntity conversation = loadExistingForCaller(conversationId, customerId);
        String status = conversation.getLeadOfferStatus();
        if ("ACCEPTED".equals(status) || leadRepo.existsByConversationId(conversation.getId())) {
            throw new ConflictException("Hội thoại này đã ghi nhận thông tin liên hệ.");
        }
        if (!"DECLINED".equals(status) && !"OFFERED".equals(status)) {
            throw new ConflictException("Hội thoại chưa có lời mời liên hệ.");
        }
        conversation.setLeadOfferStatus("DECLINED");
        conversationRepo.save(conversation);
        return new ChatLeadDeclineResponse(true);
    }

    private ChatConversationEntity loadOrCreate(UUID id, UUID customerId, String lang) {
        if (id != null) {
            ChatConversationEntity existing = loadExistingForCaller(id, customerId);
            if (existing.getCustomerId() == null && customerId != null) {
                existing.setCustomerId(customerId);
            }
            return existing;
        }
        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setCustomerId(customerId);
        conversation.setLocale(lang);
        return conversationRepo.save(conversation);
    }

    private ChatConversationEntity loadExistingForCaller(UUID id, UUID customerId) {
        ChatConversationEntity conversation = conversationRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hội thoại."));
        UUID owner = conversation.getCustomerId();
        if ((owner != null && customerId == null)
                || (owner != null && !owner.equals(customerId))) {
            throw new NotFoundException("Không tìm thấy hội thoại.");
        }
        return conversation;
    }

    private Optional<ChatResponseGuard.CheckedAnswer> checkHybridAnswer(
            AiChatClient.HybridAnswer hybridAnswer,
            String lang,
            ChatAssistantSettings.Snapshot settings
    ) {
        AiChatClient.Answer answer = hybridAnswer.answer();
        if ("TOOL".equals(hybridAnswer.source())) {
            return responseGuard.check(answer.answer(), hybridAnswer.products(), lang);
        }
        return responseGuard.checkModel(
                answer.answer(),
                hybridAnswer.products(),
                lang,
                publicShopPhoneSources(hybridAnswer, settings),
                hybridAnswer.requiredDisclosures());
    }

    private String rejectionReason(
            AiChatClient.HybridAnswer hybridAnswer,
            String lang,
            ChatAssistantSettings.Snapshot settings
    ) {
        AiChatClient.Answer answer = hybridAnswer.answer();
        return responseGuard.rejectionReason(
                answer.answer(),
                hybridAnswer.products(),
                lang,
                publicShopPhoneSources(hybridAnswer, settings),
                hybridAnswer.requiredDisclosures());
    }

    private static List<String> publicShopPhoneSources(
            AiChatClient.HybridAnswer hybridAnswer,
            ChatAssistantSettings.Snapshot settings
    ) {
        if (!hybridAnswer.executedTools().contains(ChatToolRegistry.GET_SHOP_INFO)) return List.of();
        return java.util.stream.Stream.of(
                        settings.contacts().hotline(),
                        settings.contacts().zaloDisplay(),
                        settings.contacts().messengerDisplay())
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    /**
     * A tone correction consumes a second daily slot, so reserve capacity for both the already
     * running orchestration and its single permitted correction before starting the latter.
     */
    private boolean hasToneRetryCapacity(ChatAssistantSettings.Snapshot settings) {
        return settings.dailyLimit() > 1 && aiCallsToday() + 1 < settings.dailyLimit();
    }

    private ChatToolService.ConversationContext readConversationContext(
            ChatConversationEntity conversation
    ) {
        String raw = conversation.getContextJson();
        if (raw == null || raw.isBlank()) return ChatToolService.ConversationContext.empty();
        try {
            return objectMapper.readValue(raw, ChatToolService.ConversationContext.class);
        } catch (JsonProcessingException exception) {
            log.warn("Bi conversation context ignored type={}", exception.getClass().getSimpleName());
            return ChatToolService.ConversationContext.empty();
        }
    }

    private void saveConversationContext(
            ChatConversationEntity conversation,
            ChatToolService.ConversationContext context
    ) {
        conversation.setContextJson(writeJson(context));
    }

    private void saveCustomerMessage(ChatConversationEntity conversation, String content) {
        conversation.setTurnCount(conversation.getTurnCount() + 1);
        conversation.setLastMessageAt(Instant.now());
        ChatMessageEntity message = new ChatMessageEntity();
        message.setConversationId(conversation.getId());
        message.setRole("CUSTOMER");
        message.setContent(content.trim());
        message.setSource("TOOL");
        messageRepo.save(message);
    }

    private ChatMessageResponse recoverableFallback(
            ChatConversationEntity conversation,
            ChatAssistantSettings.Snapshot settings,
            String lang,
            FallbackCause cause,
            boolean aiCalled,
            int aiRetryCount
    ) {
        conversation.setTurnCount(Math.max(0, conversation.getTurnCount() - 1));
        String fallback = contactFallbackText(lang, cause);
        log.warn("Bi fallback cause={}", cause);
        saveAssistantMessage(conversation, fallback, "CONTACT_FALLBACK", aiCalled, List.of(), aiRetryCount);
        conversationRepo.save(conversation);
        return aiResponse(conversation, settings, fallback, List.of(), false, false, List.of());
    }

    private void saveAssistantMessage(
            ChatConversationEntity conversation,
            String content,
            String source,
            boolean aiCalled,
            List<ChatProductCardResponse> products,
            int aiRetryCount
    ) {
        ChatMessageEntity message = new ChatMessageEntity();
        message.setConversationId(conversation.getId());
        message.setRole("ASSISTANT");
        message.setContent(content);
        message.setSource(source);
        message.setAiCalled(aiCalled);
        message.setAiRetryCount(Math.max(0, aiRetryCount));
        message.setProductsJson(products.isEmpty() ? null : writeJson(products));
        messageRepo.save(message);
    }

    private boolean applyConversationSignals(
            ChatConversationEntity conversation, boolean offTopic, boolean handoffRecommended) {
        if (offTopic) {
            conversation.setConsecutiveOffTopic(conversation.getConsecutiveOffTopic() + 1);
            if (conversation.getConsecutiveOffTopic() >= 2) {
                conversation.setEndedReason("OFF_TOPIC");
                return true;
            }
        } else {
            conversation.setConsecutiveOffTopic(0);
        }
        if (handoffRecommended) {
            conversation.setEndedReason("HANDOFF");
            return true;
        }
        return false;
    }

    private void finishTurnIfNeeded(ChatConversationEntity conversation) {
        if (conversation.getTurnCount() >= MAX_TURNS && conversation.getEndedReason() == null) {
            conversation.setEndedReason("TURN_LIMIT");
        }
    }

    private Availability resolveAvailability(ChatAssistantSettings.Snapshot settings) {
        if (!settings.enabled()) return new Availability("CONTACT", "DISABLED");
        if (!aiClient.isConfigured()) return new Availability("CONTACT", "NOT_CONFIGURED");
        if (settings.dailyLimit() <= 0 || aiCallsToday() >= settings.dailyLimit()) {
            return new Availability("CONTACT", "DAILY_LIMIT_REACHED");
        }
        return new Availability("AI", "AVAILABLE");
    }

    private long aiCallsToday() {
        Instant from = LocalDate.now(VN_ZONE).atStartOfDay(VN_ZONE).toInstant();
        Instant to = LocalDate.now(VN_ZONE).plusDays(1).atStartOfDay(VN_ZONE).toInstant();
        return messageRepo.countAiUsesBetween(from, to);
    }

    private static ChatMessageResponse aiResponse(
            ChatConversationEntity conversation,
            ChatAssistantSettings.Snapshot settings,
            String answer,
            List<ChatProductCardResponse> products,
            boolean handoff,
            boolean leadPrompt,
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> actions
    ) {
        return new ChatMessageResponse(
                conversation.getId(),
                handoff || conversation.getEndedReason() != null ? "CONTACT" : "AI",
                handoff || conversation.getEndedReason() != null ? "CONTACT" : "AI",
                answer,
                conversation.getTurnCount(),
                MAX_TURNS,
                Math.max(0, MAX_TURNS - conversation.getTurnCount()),
                List.copyOf(products),
                handoff,
                leadPrompt,
                List.copyOf(actions),
                settings.contacts());
    }

    private static ChatMessageResponse contactResponse(
            ChatConversationEntity conversation,
            ChatAssistantSettings.Snapshot settings,
            String answer,
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> actions
    ) {
        return new ChatMessageResponse(
                conversation.getId(),
                "CONTACT",
                "CONTACT",
                answer,
                conversation.getTurnCount(),
                MAX_TURNS,
                Math.max(0, MAX_TURNS - conversation.getTurnCount()),
                List.of(),
                true,
                false,
                List.copyOf(actions),
                settings.contacts());
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            return null;
        }
    }

    private static String endedReason(String reason) {
        return switch (reason) {
            case "DISABLED" -> "DISABLED";
            case "DAILY_LIMIT_REACHED" -> "DAILY_LIMIT_REACHED";
            default -> "AI_UNAVAILABLE";
        };
    }

    private static FallbackCause fallbackCause(String availabilityReason) {
        return switch (availabilityReason) {
            case "DISABLED" -> FallbackCause.SERVICE_PAUSED;
            case "DAILY_LIMIT_REACHED" -> FallbackCause.DAILY_LIMIT;
            case "NOT_CONFIGURED" -> FallbackCause.SERVICE_NOT_READY;
            default -> FallbackCause.PROVIDER_UNAVAILABLE;
        };
    }

    private static String contactFallbackText(String lang, FallbackCause cause) {
        if ("en".equals(lang)) {
            return switch (cause) {
                case SERVICE_PAUSED -> "Bi’s automated chat is temporarily paused. Please choose Talk to staff; Hotline, Zalo and Messenger are available below for direct help.";
                case DAILY_LIMIT -> "Bi has reached today’s automated-chat limit. Please choose Talk to staff; Hotline, Zalo and Messenger are available below for direct help.";
                case SERVICE_NOT_READY -> "Bi’s automated chat is not ready at the moment. Please choose Talk to staff; Hotline, Zalo and Messenger are available below for direct help.";
                case PROVIDER_UNAVAILABLE -> "I did not receive a verified result for this question, so I will not guess. Please choose Talk to staff; Hotline, Zalo and Messenger are available below for direct help.";
                case SAFETY_REVIEW -> "I could not confirm that a safe response is ready for this question, so I will not guess. Please choose Talk to staff; Hotline, Zalo and Messenger are available below for direct help.";
                case STAFF_REVIEW -> "This request needs a BigBike staff review so no unsupported promise is made. Please choose Talk to staff; Hotline, Zalo and Messenger are available below for direct help.";
            };
        }
        return switch (cause) {
            case SERVICE_PAUSED -> "Dạ, em là Bi và kênh tư vấn tự động đang tạm nghỉ. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
            case DAILY_LIMIT -> "Dạ, em là Bi và đã dùng hết lượt tư vấn tự động trong hôm nay. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
            case SERVICE_NOT_READY -> "Dạ, em là Bi và kênh tư vấn tự động hiện chưa sẵn sàng. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
            case PROVIDER_UNAVAILABLE -> "Dạ, em chưa nhận được kết quả đã xác minh cho câu hỏi này nên không đoán thông tin. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
            case SAFETY_REVIEW -> "Dạ, em chưa xác nhận được nội dung trả lời an toàn cho câu hỏi này nên không đoán thông tin. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
            case STAFF_REVIEW -> "Dạ, em cần nhân viên BigBike kiểm tra trực tiếp để không đưa ra cam kết ngoài chính sách. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
        };
    }

    private static String turnLimitText(String lang) {
        return "en".equals(lang)
                ? "This conversation has reached its 12-question limit. Please choose Talk to staff to continue with BigBike. Your contact options remain available."
                : "Dạ, em đã nhận đủ 12 lượt hỏi trong hội thoại này. Anh/chị bấm Gặp nhân viên để BigBike hỗ trợ tiếp nhé. Các kênh liên hệ vẫn luôn có sẵn.";
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record Availability(String mode, String reason) {}

    private enum FallbackCause {
        SERVICE_PAUSED,
        DAILY_LIMIT,
        SERVICE_NOT_READY,
        PROVIDER_UNAVAILABLE,
        SAFETY_REVIEW,
        STAFF_REVIEW
    }
}
