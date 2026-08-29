package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatAvailabilityResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatClarificationResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatHandoffStatusResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatNextStepResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatImageAvailabilityResponse;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.service.chat.ChatToolService.ToolOutcome;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.locks.ReentrantLock;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
@RequiredArgsConstructor
public class ChatService {

    public static final int STANDARD_MAX_TURNS = 40;
    public static final int PRODUCT_PAGE_MAX_TURNS = 40;
    /** Compatibility alias for availability and older tests. */
    public static final int MAX_TURNS = STANDARD_MAX_TURNS;
    private final ChatConversationJpaRepository conversationRepo;
    private final ChatMessageJpaRepository messageRepo;
    private final ChatAssistantSettings assistantSettings;
    private final ChatToolService toolService;
    private final ChatToolRegistry toolRegistry;
    private final AiChatClient aiClient;
    private final ChatResponseGuard responseGuard;
    private final ChatInputGuard inputGuard = new ChatInputGuard();
    private final ChatAiQuotaService chatAiQuotaService;
    private final ChatSalesAdvisorService salesAdvisorService;
    private final ChatHandoffService handoffService;
    private final ChatPhase3Settings phase3Settings;
    private final ChatVisitorService visitorService;
    private final ChatImageService chatImageService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ConcurrentMap<UUID, ReentrantLock> conversationLocks = new ConcurrentHashMap<>();

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
        int conversationLimit = currentTurnLimit();
        ChatAssistantSettings.ImageSettings imageSettings = assistantSettings.imageSettings();
        if (imageSettings == null) {
            // Keep availability safe for older adapters/tests that predate image settings.
            // Production settings always return a value; the compatibility default is off.
            imageSettings = new ChatAssistantSettings.ImageSettings(false, 20, 3);
        }
        boolean imagesEnabled = imageSettings.enabled() && aiClient.isConfigured();
        String imageDisclosure = "en".equals(lang)
                ? "Your image is stored privately by BigBike for up to 90 days and sent to Google's AI service for recognition. Do not upload sensitive documents unless needed."
                : "Ảnh được BigBike lưu riêng tối đa 90 ngày và gửi tới dịch vụ AI của Google để nhận diện. Anh/chị không nên gửi giấy tờ nhạy cảm khi không cần thiết.";
        return new ChatAvailabilityResponse(
                availability.mode(),
                "AI".equals(availability.mode()) ? "AI" : "CONTACT",
                greeting,
                quickPrompts,
                conversationLimit,
                settings.contacts(),
                phase3Settings == null ? 30 : phase3Settings.memoryDays(),
                new ChatImageAvailabilityResponse(
                        imagesEnabled, ChatImageStorageService.MAX_UPLOAD_BYTES, 1,
                        imageSettings.conversationLimit(), imageSettings.dailyLimit(),
                        imageDisclosure));
    }

    public ChatMessageResponse send(ChatMessageRequest request, UUID customerId) {
        UUID lockKey = request.getConversationId() != null
                ? request.getConversationId()
                : request.getRequestId() != null ? request.getRequestId() : UUID.randomUUID();
        ReentrantLock lock = conversationLocks.computeIfAbsent(lockKey, ignored -> new ReentrantLock());
        lock.lock();
        try {
            return sendUnlocked(request, customerId);
        } finally {
            lock.unlock();
            if (!lock.hasQueuedThreads()) conversationLocks.remove(lockKey, lock);
        }
    }

    /** Provider waits must never keep a database transaction or connection open. */
    private ChatMessageResponse sendUnlocked(ChatMessageRequest request, UUID customerId) {
        long startedNanos = System.nanoTime();
        ChatAssistantSettings.Snapshot settings = assistantSettings.load(request.getLang());
        UUID visitorId = visitorService == null ? null
                : visitorService.resolveVisitorId(request.getVisitorToken());
        if (request.getRequestId() != null) {
            Optional<ChatMessageResponse> replay = replayStoredResponse(
                    request.getRequestId(), customerId, visitorId, settings, resolveMaxTurns(request));
            if (replay.isPresent()) return replay.get();
        }
        ChatConversationEntity conversation = loadOrCreate(
                request.getConversationId(), customerId, visitorId, request.getLang());
        int maxTurns = resolveMaxTurns(request);
        if ("TURN_LIMIT".equals(conversation.getEndedReason())) {
            conversation.setEndedReason(null);
        }
        if (conversation.getEndedReason() == null && conversation.getCountedTurns() >= maxTurns) {
            conversation = continueConversation(conversation);
        }
        if (conversation.getEndedReason() != null) {
            return contactResponse(
                    conversation, settings,
                    endedConversationText(request.getLang(), conversation.getEndedReason(), maxTurns),
                    List.of(), maxTurns);
        }

        ChatHandoffStatusResponse liveHandoff = handoffService == null
                ? null : handoffService.liveForConversation(conversation.getId());
        boolean countCustomerTurn = !isClarificationReply(conversation, request);
        if (request.getImageIds() != null && !request.getImageIds().isEmpty()) {
            if (chatImageService == null) {
                throw ValidationException.fromField(
                        "imageIds", "CHAT_IMAGE_DISABLED", "Tính năng đọc ảnh chưa sẵn sàng.");
            }
            String customerContent = request.getMessage() == null || request.getMessage().isBlank()
                    ? ("en".equals(request.getLang()) ? "Sent an image." : "Đã gửi một ảnh.")
                    : request.getMessage();
            ChatMessageEntity customerMessage = saveCustomerMessage(
                    conversation, customerContent, request.getRequestId(),
                    countCustomerTurn);
            if (liveHandoff != null && "ACTIVE".equals(liveHandoff.status())) {
                chatImageService.attachForStaff(
                        conversation, customerMessage.getId(), request.getImageIds());
                conversationRepo.save(conversation);
                handoffService.customerMessageAdded(conversation.getId());
                return staffActiveResponse(conversation, settings, liveHandoff, maxTurns);
            }
            ChatImageService.ImageTurnResult imageResult = chatImageService.processTurn(
                    conversation, customerMessage.getId(), request.getImageIds(),
                    customerContent, request.getLang());
            boolean handoff = imageResult.handoff();
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> imageActions =
                    ChatActionCatalog.choose(
                            customerContent, imageResult.resultKind(), imageResult.products(),
                            List.of(), settings.contacts());
            ChatHandoffStatusResponse imageHandoff = createHandoffIfNeeded(
                    conversation, customerContent, imageResult.products(), handoff);
            saveAssistantMessage(
                    conversation, imageResult.answer(), imageResult.source(), false,
                    imageResult.products(), 0, request.getRequestId(), "PLAIN_TEXT",
                    imageResult.resultKind(), imageActions, handoff,
                    null, null, imageHandoff);
            finishTurnIfNeeded(conversation, maxTurns);
            conversationRepo.save(conversation);
            return aiResponse(
                    conversation, settings, imageResult.answer(), imageResult.products(),
                    imageResult.resultKind(), handoff, imageActions, maxTurns,
                    null, null, imageHandoff);
        }
        if (liveHandoff != null && "ACTIVE".equals(liveHandoff.status())) {
            saveCustomerMessage(
                    conversation, request.getMessage(), request.getRequestId(),
                    false);
            conversationRepo.save(conversation);
            handoffService.customerMessageAdded(conversation.getId());
            return staffActiveResponse(conversation, settings, liveHandoff, maxTurns);
        }
        Optional<ChatInputGuard.Decision> inputDecision = inputGuard.evaluate(
                request.getMessage(), request.getLang());
        if (inputDecision.isPresent()) {
            ChatInputGuard.Decision decision = inputDecision.get();
            saveCustomerMessage(
                    conversation, request.getMessage(), request.getRequestId(),
                    countCustomerTurn);
            if ("CONTACT_FALLBACK".equals(decision.source())) {
                List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> contactActions =
                        ChatActionCatalog.choose(
                                request.getMessage(), "CONTACT", List.of(), List.of(), settings.contacts());
                ChatSalesAdvisorService.Advice advice = salesAdvice(
                        conversation, request, settings,
                        ChatToolService.ConversationContext.empty(), decision.answer(), List.of(),
                        "CONTACT_FALLBACK", "CONTACT", null, true, contactActions);
                ChatHandoffStatusResponse handoffStatus = createHandoffIfNeeded(
                        conversation, request.getMessage(), advice.products(), true);
                saveAssistantMessage(
                        conversation, advice.answer(), "CONTACT_FALLBACK", false, List.of(), 0,
                        request.getRequestId(), "PLAIN_TEXT", "CONTACT", advice.actions(),
                        true, null,
                        advice, handoffStatus);
                conversationRepo.save(conversation);
                return aiResponse(
                        conversation, settings, advice.answer(), List.of(), "CONTACT", true,
                        advice.actions(), maxTurns, null, advice, handoffStatus);
            }
            finishTurnIfNeeded(conversation, maxTurns);
            boolean ended = conversation.getEndedReason() != null;
            String refusalKind = "OUT_OF_SCOPE".equals(decision.source())
                    ? "OUT_OF_SCOPE" : "REFUSAL";
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> refusalActions =
                    ChatActionCatalog.choose(
                            request.getMessage(), refusalKind, List.of(), List.of(), settings.contacts());
            saveAssistantMessage(
                    conversation, decision.answer(), decision.source(), false, List.of(), 0,
                    request.getRequestId(), "PLAIN_TEXT", refusalKind, refusalActions,
                    ended, null, null, null);
            conversationRepo.save(conversation);
            return refusalResponse(
                    conversation, settings, decision.answer(), refusalKind, refusalActions, maxTurns);
        }

        Availability availability = resolveAvailability(settings);
        if (!"AI".equals(availability.mode())) {
            conversation.setEndedReason(endedReason(availability.reason()));
            saveCustomerMessage(
                    conversation, request.getMessage(), request.getRequestId(),
                    countCustomerTurn);
            String fallback = contactFallbackText(request.getLang(), fallbackCause(availability.reason()));
            logFallback(availabilityFallbackReason(availability.reason()), FallbackFlow.CONTACT_GATE,
                    "NONE", 0, false);
            saveAssistantMessage(conversation, fallback,
                    "CONTACT_FALLBACK", false, List.of(), 0,
                    request.getRequestId(), "PLAIN_TEXT", "CONTACT", List.of(),
                    true, null, null, null);
            return contactResponse(
                    conversation, settings, fallback,
                    ChatActionCatalog.choose(
                            request.getMessage(), "CONTACT", List.of(), List.of(), settings.contacts()),
                    maxTurns);
        }

        ChatToolService.ConversationContext conversationContext = readConversationContext(conversation);
        List<ChatMessageEntity> existingMessages = messageRepo
                .findByConversationIdOrderByCreatedAtAsc(conversation.getId());
        ChatToolService.ConversationContext referenceContext = contextForImmediatePreviousCards(
                conversationContext, existingMessages);
        List<ChatHistorySanitizer.RecentTurn> recentTurns = settings.recentTurnPairs() == 0
                ? List.of()
                : ChatHistorySanitizer.recentTurns(existingMessages, settings.recentTurnPairs());
        saveCustomerMessage(
                conversation, request.getMessage(), request.getRequestId(),
                countCustomerTurn);
        Optional<ToolOutcome> fastPath;
        try {
            fastPath = request.getClarificationSelection() == null
                    ? toolService.resolveFastPath(
                            request.getMessage(), request.getLang(), customerId, settings,
                            referenceContext)
                    : toolService.resolveFastPath(
                            request.getMessage(), request.getLang(), customerId, settings,
                            referenceContext, request.getClarificationSelection());
        } catch (RuntimeException exception) {
            return recoverableClarification(
                    conversation, settings, request.getLang(), false,
                    request.getRequestId(), startedNanos, maxTurns,
                    ChatFallbackReason.FAST_PATH_EXCEPTION, "NONE", 0,
                    countCustomerTurn);
        }

        if (fastPath.isPresent()) {
            ToolOutcome tool = fastPath.get();
            Optional<ChatResponseGuard.CheckedAnswer> checked = responseGuard.check(
                    tool.localAnswer(), tool.products(), request.getLang(),
                    tool.requiredDisclosures(), tool.catalogTotals());
            if (checked.isEmpty()) {
                String reason = responseGuard.rejectionReason(
                        tool.localAnswer(), tool.products(), request.getLang(), List.of(),
                        tool.requiredDisclosures(), tool.catalogTotals());
                return recoverableClarification(
                        conversation, settings, request.getLang(), false,
                        request.getRequestId(), startedNanos, maxTurns,
                        ChatFallbackReason.FAST_PATH_GUARD_REJECTED, reason, tool.products().size(),
                        countCustomerTurn);
            }
            ChatResponseGuard.CheckedAnswer safe = checked.get();
            if (tool.clarification() != null && countCustomerTurn) {
                conversation.setCountedTurns(Math.max(0, conversation.getCountedTurns() - 1));
            }
            Optional<ChatResponseGuard.CheckedAnswer> duplicateClarification = tool.clarification() == null
                    ? clarifyNearDuplicate(conversation, safe, request.getLang())
                    : Optional.empty();
            boolean clarifiedDuplicate = duplicateClarification.isPresent();
            if (clarifiedDuplicate) safe = duplicateClarification.get();
            boolean handoff = applyConversationSignals(
                    conversation,
                    clarifiedDuplicate ? false : tool.offTopic(),
                    clarifiedDuplicate ? false : tool.handoffRecommended());
            String responseKind = resultKind(safe.products(), handoff, tool.clarification());
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> responseActions =
                    tool.clarification() == null ? ChatActionCatalog.choose(
                            request.getMessage(), responseKind, safe.products(), tool.actions(), settings.contacts())
                            : List.of();
            String responseSource = clarifiedDuplicate ? "TOOL" : tool.source();
            ChatSalesAdvisorService.Advice advice = salesAdvice(
                    conversation, request, settings, referenceContext,
                    safe.answer(), safe.products(), responseSource, responseKind,
                    tool.clarification(), handoff, responseActions);
            handoff = advice.handoffRecommended();
            ChatHandoffStatusResponse handoffStatus = createHandoffIfNeeded(
                    conversation, request.getMessage(), advice.products(), handoff);
            responseKind = resultKind(advice.products(), handoff, tool.clarification());
            saveAssistantMessage(conversation, advice.answer(), responseSource,
                    false, advice.products(), 0,
                    request.getRequestId(), answerFormat(advice.answer()), responseKind,
                    advice.actions(), handoff,
                    tool.clarification(), advice, handoffStatus);
            saveConversationContext(conversation, toolService.recordConversationContext(
                    conversationContext,
                    request.getMessage(),
                    request.getLang(),
                    advice.products(),
                    advice.actions(),
                    tool.effectiveSearchScope(),
                    tool.nextProductDecision()));
            finishTurnIfNeeded(conversation, maxTurns);
            conversationRepo.save(conversation);
            return aiResponse(
                    conversation,
                    settings,
                    advice.answer(),
                    advice.products(),
                    responseKind,
                    handoff,
                    advice.actions(),
                    maxTurns,
                    tool.clarification(),
                    advice,
                    handoffStatus);
        }

        if (!chatAiQuotaService.tryReserve(settings.dailyLimit())) {
            conversation.setEndedReason("DAILY_LIMIT_REACHED");
            String fallback = contactFallbackText(request.getLang(), FallbackCause.DAILY_LIMIT);
            saveAssistantMessage(conversation, fallback, "CONTACT_FALLBACK", false, List.of(), 0,
                    request.getRequestId(), "PLAIN_TEXT", "CONTACT", List.of(),
                    true, null, null, null);
            logFallback(ChatFallbackReason.DAILY_LIMIT_REACHED, FallbackFlow.QUOTA_GATE,
                    "NONE", 0, false);
            conversationRepo.save(conversation);
            return contactResponse(
                    conversation, settings, fallback,
                    ChatActionCatalog.choose(
                            request.getMessage(), "CONTACT", List.of(), List.of(), settings.contacts()),
                    maxTurns);
        }
        conversation.setAiCallCount(conversation.getAiCallCount() + 1);

        ChatToolService.ToolContext toolContext = new ChatToolService.ToolContext(
                request.getMessage(), request.getLang(), customerId, settings, referenceContext);
        ChatToolService.AssistantCatalogVocabulary vocabulary = toolService.assistantCatalogVocabulary();
        if (vocabulary == null) vocabulary = ChatToolService.AssistantCatalogVocabulary.empty();
        Optional<AiChatClient.HybridAnswer> ai;
        try {
            ai = aiClient.answer(
                    request.getMessage(),
                    request.getLang(),
                    toolRegistry,
                    true,
                    (call, session) -> toolService.execute(call, toolContext, session),
                    vocabulary,
                    referenceContext.productSlugs(),
                    recentTurns);
        } catch (AiChatClient.SafetyBlockedException exception) {
            String refusal = safetyRefusalText(request.getLang());
            finishTurnIfNeeded(conversation, maxTurns);
            boolean ended = conversation.getEndedReason() != null;
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> safetyActions =
                    ChatActionCatalog.choose(
                            request.getMessage(), "REFUSAL", List.of(), List.of(), settings.contacts());
            saveAssistantMessage(
                    conversation, refusal, "CONTENT_REFUSAL", true, List.of(), 0,
                    request.getRequestId(), "PLAIN_TEXT", "REFUSAL", safetyActions,
                    ended, null, null, null);
            conversationRepo.save(conversation);
            return refusalResponse(
                    conversation, settings, refusal, "REFUSAL", safetyActions, maxTurns);
        } catch (RuntimeException exception) {
            log.warn("chat_assistant_provider_failed reason=UNEXPECTED_PROVIDER_ERROR type={}",
                    exception.getClass().getSimpleName());
            ai = Optional.empty();
        }
        if (ai.isEmpty()) {
            String apology = providerUnavailableText(request.getLang());
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> actions =
                    List.of(new com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse("CONTACT_STAFF"));
            saveAssistantMessage(
                    conversation, apology, "PROVIDER_UNAVAILABLE", true, List.of(), 0,
                    request.getRequestId(), "PLAIN_TEXT", "CONTACT", actions,
                    false, null, null, null);
            logFallback(ChatFallbackReason.AI_NO_SAFE_RESULT, FallbackFlow.AI, "NONE", 0, false);
            conversationRepo.save(conversation);
            return aiResponse(
                    conversation, settings, apology, List.of(), "CONTACT", false, actions, maxTurns);
        }

        AiChatClient.HybridAnswer hybridAnswer = ai.get();
        List<ChatProductCardResponse> originalProducts = hybridAnswer.products() == null
                ? List.of() : hybridAnswer.products();
        List<ChatProductCardResponse> safeProducts = responseGuard.retainSafeProducts(originalProducts);
        boolean productsFiltered = safeProducts.size() != originalProducts.size();
        if (productsFiltered) {
            hybridAnswer = withSafeProducts(hybridAnswer, safeProducts);
        }
        Optional<ChatResponseGuard.CheckedAnswer> checked = productsFiltered
                ? groundedCardRecovery(hybridAnswer, request.getLang())
                : checkHybridAnswer(hybridAnswer, request.getLang(), settings);
        ChatResponseGuard.GuardDiagnostic guardDiagnostic = productsFiltered
                ? new ChatResponseGuard.GuardDiagnostic(
                        "UNSAFE_PRODUCT", originalProducts.size(), false, false,
                        hybridAnswer.requiredDisclosures().size())
                : (checked.isEmpty()
                ? rejectionDiagnostic(hybridAnswer, request.getLang(), settings)
                : null);
        String guardReason = guardDiagnostic == null ? "NONE" : guardDiagnostic.reason();
        boolean recoveredFromGuard = productsFiltered && checked.isPresent();
        if (checked.isEmpty()) {
            if (!productsFiltered && "UNSUPPORTED_CATALOG_CLAIM".equals(guardReason)) {
                checked = verifiedSearchRecovery(hybridAnswer, request.getLang());
                if (checked.isEmpty()) {
                    checked = responseGuard.repairUnsupportedCountClauses(
                            hybridAnswer.answer().answer(),
                            hybridAnswer.products(),
                            request.getLang(),
                            hybridAnswer.requiredDisclosures(),
                            hybridAnswer.catalogTotals());
                }
                recoveredFromGuard = checked.isPresent();
            }
            if (!productsFiltered && checked.isEmpty()) {
                checked = verifiedSearchRecovery(hybridAnswer, request.getLang());
                recoveredFromGuard = checked.isPresent();
            }
            if (!productsFiltered && checked.isEmpty()) {
                checked = groundedCardRecovery(hybridAnswer, request.getLang());
                recoveredFromGuard = checked.isPresent();
            }
            if (recoveredFromGuard) {
                logFallback(productsFiltered
                                ? ChatFallbackReason.UNSAFE_PRODUCT_FILTERED
                                : ChatFallbackReason.AI_GUARD_REJECTED,
                        FallbackFlow.AI_GUARD, guardReason,
                        guardDiagnostic.productCount(), true);
            }
        }
        if (checked.isEmpty()) {
            return recoverableClarification(
                    conversation, settings, request.getLang(), true,
                    request.getRequestId(), startedNanos, maxTurns,
                    productsFiltered
                            ? ChatFallbackReason.UNSAFE_PRODUCT_FILTERED
                            : ChatFallbackReason.AI_GUARD_REJECTED,
                    guardReason,
                    guardDiagnostic == null ? 0 : guardDiagnostic.productCount(),
                    countCustomerTurn);
        }
        ChatResponseGuard.CheckedAnswer safe = checked.get();
        Optional<ChatResponseGuard.CheckedAnswer> duplicateClarification = clarifyNearDuplicate(
                conversation, safe, request.getLang());
        boolean clarifiedDuplicate = duplicateClarification.isPresent();
        if (clarifiedDuplicate) safe = duplicateClarification.get();
        AiChatClient.Answer answer = recoveredFromGuard || clarifiedDuplicate
                ? new AiChatClient.Answer(
                        safe.answer(), false, false)
                : hybridAnswer.answer();
        boolean handoff = applyConversationSignals(
                conversation, answer.offTopic(), answer.handoffRecommended());
        String responseKind = resultKind(safe.products(), handoff);
        List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> proposedActions =
                recoveredFromGuard || clarifiedDuplicate ? List.of() : hybridAnswer.actions();
        List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> responseActions =
                ChatActionCatalog.choose(
                        request.getMessage(), responseKind, safe.products(), proposedActions, settings.contacts());
        String responseSource = recoveredFromGuard || clarifiedDuplicate ? "TOOL" : hybridAnswer.source();
        ChatSalesAdvisorService.Advice advice = salesAdvice(
                conversation, request, settings, referenceContext,
                safe.answer(), safe.products(), responseSource, responseKind,
                null, handoff, responseActions);
        handoff = advice.handoffRecommended();
        ChatHandoffStatusResponse handoffStatus = createHandoffIfNeeded(
                conversation, request.getMessage(), advice.products(), handoff);
        responseKind = resultKind(advice.products(), handoff);
        saveAssistantMessage(
                conversation, advice.answer(), responseSource,
                true, advice.products(), 0,
                request.getRequestId(), answerFormat(advice.answer()), responseKind,
                advice.actions(), handoff,
                null, advice, handoffStatus);
        saveConversationContext(conversation, toolService.recordConversationContext(
                conversationContext,
                request.getMessage(),
                request.getLang(),
                advice.products(),
                advice.actions(),
                hybridAnswer.searchScope()));
        finishTurnIfNeeded(conversation, maxTurns);
        conversationRepo.save(conversation);
        return aiResponse(
                conversation,
                settings,
                advice.answer(),
                advice.products(),
                responseKind,
                handoff || conversation.getEndedReason() != null,
                advice.actions(),
                maxTurns,
                null,
                advice,
                handoffStatus);
    }

    private ChatConversationEntity loadOrCreate(
            UUID id, UUID customerId, UUID visitorId, String lang) {
        if (id != null) {
            ChatConversationEntity existing = loadExistingForCaller(id, customerId, visitorId);
            if (existing.getCustomerId() == null && customerId != null) {
                existing.setCustomerId(customerId);
            }
            return existing;
        }
        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setCustomerId(customerId);
        conversation.setVisitorId(visitorId);
        conversation.setLocale(lang);
        return conversationRepo.save(conversation);
    }

    private Optional<ChatMessageResponse> replayStoredResponse(
            UUID requestId,
            UUID customerId,
            UUID visitorId,
            ChatAssistantSettings.Snapshot settings,
            int maxTurns
    ) {
        Optional<ChatMessageEntity> stored = messageRepo.findFirstByRequestIdAndRole(
                requestId, "ASSISTANT");
        if (stored.isEmpty()) return Optional.empty();
        ChatMessageEntity message = stored.get();
        ChatConversationEntity conversation = loadExistingForCaller(
                message.getConversationId(), customerId, visitorId);
        List<ChatProductCardResponse> products = readStoredProducts(message.getProductsJson());
        StoredResponseMetadata metadata = readStoredMetadata(message.getActionMetadata());
        String mode = metadata == null ? "AI" : metadata.mode();
        String reason = metadata == null ? mode : metadata.reason();
        boolean handoff = metadata != null && metadata.handoff();
        List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> actions = metadata == null
                ? List.of() : metadata.actions() == null ? List.of() : metadata.actions();
        ChatClarificationResponse clarification = metadata == null ? null : metadata.clarification();
        List<ChatProductCardResponse> crossSell = metadata == null
                ? readStoredProducts(message.getCrossSellProductsJson())
                : metadata.crossSellProducts() == null ? List.of() : metadata.crossSellProducts();
        String salesStage = metadata != null && metadata.salesStage() != null
                ? metadata.salesStage()
                : message.getSalesStage() != null ? message.getSalesStage() : conversation.getSalesStage();
        ChatNextStepResponse nextStep = metadata == null ? null : metadata.nextStep();
        ChatHandoffStatusResponse handoffStatus = metadata == null ? null : metadata.handoffStatus();
        return Optional.of(new ChatMessageResponse(
                conversation.getId(), message.getId(), mode, reason, message.getContent(),
                message.getAnswerFormat(), message.getResultKind(),
                conversation.getTurnCount(), maxTurns,
                remainingTurns(conversation, maxTurns),
                products, clarification, handoff, actions,
                settings.contacts(), crossSell, salesStage, nextStep, handoffStatus,
                channelState(handoffStatus, conversation), conversation.getCountedTurns(), maxTurns,
                remainingTurns(conversation, maxTurns), continuation(conversation, maxTurns)));
    }

    private List<ChatProductCardResponse> readStoredProducts(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        try {
            return objectMapper.readValue(raw, new TypeReference<>() {});
        } catch (JsonProcessingException exception) {
            return List.of();
        }
    }

    private StoredResponseMetadata readStoredMetadata(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return objectMapper.readValue(raw, StoredResponseMetadata.class);
        } catch (JsonProcessingException exception) {
            return null;
        }
    }

    private ChatConversationEntity loadExistingForCaller(UUID id, UUID customerId) {
        return loadExistingForCaller(id, customerId, null);
    }

    private ChatConversationEntity loadExistingForCaller(
            UUID id, UUID customerId, UUID visitorId) {
        ChatConversationEntity conversation = conversationRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hội thoại."));
        return verifyCaller(conversation, customerId, visitorId);
    }

    private ChatConversationEntity loadExistingForCallerForUpdate(UUID id, UUID customerId) {
        return loadExistingForCallerForUpdate(id, customerId, null);
    }

    private ChatConversationEntity loadExistingForCallerForUpdate(
            UUID id, UUID customerId, UUID visitorId) {
        ChatConversationEntity conversation = conversationRepo.findByIdForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hội thoại."));
        return verifyCaller(conversation, customerId, visitorId);
    }

    private ChatConversationEntity verifyCaller(
            ChatConversationEntity conversation,
            UUID customerId
    ) {
        return verifyCaller(conversation, customerId, null);
    }

    private ChatConversationEntity verifyCaller(
            ChatConversationEntity conversation,
            UUID customerId,
            UUID visitorId
    ) {
        UUID owner = conversation.getCustomerId();
        if ((owner != null && customerId == null)
                || (owner != null && !owner.equals(customerId))) {
            throw new NotFoundException("Không tìm thấy hội thoại.");
        }
        if (owner == null && conversation.getVisitorId() != null
                && !conversation.getVisitorId().equals(visitorId)) {
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
            return responseGuard.check(
                    answer.answer(),
                    hybridAnswer.products(),
                    lang,
                    hybridAnswer.requiredDisclosures(),
                    hybridAnswer.catalogTotals());
        }
        return responseGuard.checkModel(
                answer.answer(),
                hybridAnswer.products(),
                lang,
                publicShopPhoneSources(hybridAnswer, settings),
                hybridAnswer.requiredDisclosures(),
                hybridAnswer.catalogTotals(),
                hybridAnswer.executedTools());
    }

    private static AiChatClient.HybridAnswer withSafeProducts(
            AiChatClient.HybridAnswer source,
            List<ChatProductCardResponse> products
    ) {
        return new AiChatClient.HybridAnswer(
                source.answer(),
                List.copyOf(products),
                source.actions(),
                source.executedTools(),
                source.requiredDisclosures(),
                source.providerCallCount(),
                source.source(),
                null,
                source.searchScope());
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
                hybridAnswer.requiredDisclosures(),
                hybridAnswer.catalogTotals());
    }

    private ChatResponseGuard.GuardDiagnostic rejectionDiagnostic(
            AiChatClient.HybridAnswer hybridAnswer,
            String lang,
            ChatAssistantSettings.Snapshot settings
    ) {
        AiChatClient.Answer answer = hybridAnswer.answer();
        return responseGuard.rejectionDiagnostic(
                answer.answer(),
                hybridAnswer.products(),
                lang,
                publicShopPhoneSources(hybridAnswer, settings),
                hybridAnswer.requiredDisclosures(),
                hybridAnswer.catalogTotals());
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

    /** Uses only safe cards and server-controlled disclosures after model prose is rejected. */
    private Optional<ChatResponseGuard.CheckedAnswer> groundedCardRecovery(
            AiChatClient.HybridAnswer hybridAnswer,
            String lang
    ) {
        List<ChatProductCardResponse> products = hybridAnswer.products();
        if (products == null || products.isEmpty()) return Optional.empty();
        boolean english = "en".equals(lang);
        int cards = products.size();
        String answer;
        if (hybridAnswer.requiredDisclosures()
                .contains(ChatToolService.RequiredDisclosure.INHERITED_FILTER_DROPPED)) {
            answer = english
                    ? "The price filter from your previous product request returned no matches, so I removed only that older filter and searched this request again. "
                    + "The products below are the currently available results after that retry. "
                    + "Tell me a new budget if you would like me to narrow the list again."
                    : "Tầm giá đã nêu ở lượt trước không có kết quả phù hợp nên em đã bỏ riêng bộ lọc cũ và tìm lại yêu cầu này. "
                    + "Các sản phẩm bên dưới là kết quả đang bán sau khi em tìm lại. "
                    + "Anh/chị cho em tầm giá mới nếu muốn em lọc hẹp lại nhé.";
        } else if (hybridAnswer.requiredDisclosures()
                .contains(ChatToolService.RequiredDisclosure.PRICE_RANGE_MISS)) {
            answer = english
                    ? "I could not find a currently sold product in the price range you requested. "
                    + "The " + cards + " products below are the closest available options."
                    : "Em chưa tìm thấy sản phẩm đang bán trong tầm giá anh/chị hỏi. "
                    + cards + " sản phẩm bên dưới là phương án gần nhất đang có.";
        } else if (hybridAnswer.requiredDisclosures()
                .contains(ChatToolService.RequiredDisclosure.INHERITED_PRICE_RANGE)) {
            answer = english
                    ? "I am filtering by the price range from your previous product request. "
                    + "I am showing " + cards + " matching product"
                    + (cards == 1 ? " below." : "s below.")
                    : "Em đang lọc theo tầm giá anh/chị đã nêu trước đó. "
                    + "Em đang hiển thị " + cards + " sản phẩm phù hợp bên dưới.";
        } else if (hybridAnswer.requiredDisclosures()
                .contains(ChatToolService.RequiredDisclosure.BROADENED_SEARCH)) {
            answer = english
                    ? "The products below come from a broader search than your original request. "
                    + "Please tell me a more specific name, category or budget so I can narrow the results."
                    : "Các sản phẩm bên dưới đến từ tìm kiếm rộng hơn yêu cầu ban đầu của anh/chị. "
                    + "Anh/chị cho em tên mẫu, loại hàng hoặc tầm giá cụ thể hơn để em lọc lại nhé.";
        } else {
            answer = english
                    ? "I am showing " + cards + " matching product"
                    + (cards == 1 ? " below." : "s below.")
                    + " Please open a product or tell me a different budget if you want me to filter again."
                    : "Em đang hiển thị " + cards + " sản phẩm phù hợp bên dưới. "
                    + "Anh/chị có thể mở từng sản phẩm hoặc cho em biết tầm giá khác để em lọc lại nhé.";
        }
        return responseGuard.check(
                answer, products, lang, hybridAnswer.requiredDisclosures(), hybridAnswer.catalogTotals());
    }

    /**
     * A verified current-search total is stronger evidence than an arbitrary model count. Use it
     * before the generic card-only recovery so a valid one-sided range such as “trên 3tr” keeps
     * its precise, backend-calculated result.
     */
    private Optional<ChatResponseGuard.CheckedAnswer> verifiedSearchRecovery(
            AiChatClient.HybridAnswer hybridAnswer,
            String lang
    ) {
        ChatToolService.CatalogTotals totals = hybridAnswer.catalogTotals();
        List<ChatProductCardResponse> products = hybridAnswer.products();
        if (totals == null
                || totals.priceRangeTotalItems() == null
                || products == null
                || products.isEmpty()
                || products.size() != Math.min(totals.currentTotalItems(), 8)
                || hybridAnswer.requiredDisclosures() == null
                || !hybridAnswer.requiredDisclosures().isEmpty()) {
            return Optional.empty();
        }
        boolean english = "en".equals(lang);
        String group = recoveryCatalogGroup(english);
        long total = totals.currentTotalItems();
        String answer = english
                ? "In the price range you asked about, BigBike has " + total + " matching " + group + ". "
                + "I am showing " + products.size() + " representative products below from those " + total + " matches. "
                + "Open a product to review its current details and options."
                : "Trong tầm giá anh/chị hỏi, shop có " + total + " mẫu " + group + ". "
                + "Em đang hiển thị " + products.size() + " sản phẩm tiêu biểu bên dưới trong tổng " + total + " mẫu phù hợp. "
                + "Anh/chị mở từng sản phẩm để xem thông tin và lựa chọn hiện có nhé.";
        return responseGuard.check(answer, products, lang, Set.of(), totals);
    }

    private static String recoveryCatalogGroup(boolean english) {
        // This emergency recovery has no category repository at hand. A neutral noun is safer
        // than reviving the former two-item hard-coded label map or borrowing an old topic.
        return english ? "products" : "sản phẩm";
    }

    /** Do not send the customer the same substantive answer twice in a row. */
    private Optional<ChatResponseGuard.CheckedAnswer> clarifyNearDuplicate(
            ChatConversationEntity conversation,
            ChatResponseGuard.CheckedAnswer candidate,
            String lang
    ) {
        if (candidate == null || candidate.answer() == null) return Optional.empty();
        boolean repeated = messageRepo.findFirstByConversationIdAndRoleOrderByCreatedAtDesc(
                        conversation.getId(), "ASSISTANT")
                .map(previous -> nearDuplicate(previous.getContent(), candidate.answer()))
                .orElse(false);
        if (!repeated) return Optional.empty();
        String clarification = "en".equals(lang)
                ? "To make sure I check the right next detail, would you like size, colour, specifications or a different budget? "
                + "Tell me which one matters most and I will continue from that point instead of repeating the previous answer."
                : "Để em kiểm tra đúng ý hơn, anh/chị muốn xem size, màu, thông số hay một tầm giá khác ạ? "
                + "Anh/chị cho em biết phần cần xem nhất, em sẽ tra tiếp từ đó thay vì lặp lại câu trả lời trước nhé.";
        return responseGuard.check(clarification, candidate.products(), lang);
    }

    private static boolean nearDuplicate(String previous, String candidate) {
        String first = normalizedAnswerTokens(previous);
        String second = normalizedAnswerTokens(candidate);
        if (first.isBlank() || second.isBlank()) return false;
        // A newly verified catalogue count or model code is substantive information, even when
        // the surrounding customer-facing wording is intentionally standardised. Do not turn a
        // new filtered result (for example 12 then 8 matches) into a clarification merely
        // because most of its sentence is the same as the previous result.
        if (hasDifferentNumericClaims(first, second)) return false;
        if (first.equals(second)) return true;
        // A prior sales CTA is appended after this check. Compare the repeated grounded body
        // too, otherwise that CTA can hide an exact phase-1 duplicate on the next turn.
        if (first.startsWith(second + " ") || second.startsWith(first + " ")) return true;
        Set<String> left = new java.util.LinkedHashSet<>(List.of(first.split("\\s+")));
        Set<String> right = new java.util.LinkedHashSet<>(List.of(second.split("\\s+")));
        if (Math.min(left.size(), right.size()) < 6) return false;
        Set<String> intersection = new java.util.LinkedHashSet<>(left);
        intersection.retainAll(right);
        Set<String> union = new java.util.LinkedHashSet<>(left);
        union.addAll(right);
        return !union.isEmpty() && (double) intersection.size() / union.size() >= 0.86d;
    }

    private static boolean hasDifferentNumericClaims(String first, String second) {
        Set<String> leftNumbers = numericTokens(first);
        Set<String> rightNumbers = numericTokens(second);
        return !leftNumbers.isEmpty() && !rightNumbers.isEmpty() && !leftNumbers.equals(rightNumbers);
    }

    private static Set<String> numericTokens(String value) {
        Set<String> numbers = new java.util.LinkedHashSet<>();
        for (String token : value.split("\\s+")) {
            if (token.matches("\\d+")) numbers.add(token);
        }
        return numbers;
    }

    private static String normalizedAnswerTokens(String value) {
        return ChatToolService.normalize(value == null ? "" : value)
                .replaceAll("[^\\p{Alnum}]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private ChatToolService.ConversationContext readConversationContext(
            ChatConversationEntity conversation
    ) {
        String raw = conversation.getContextJson();
        if (raw == null || raw.isBlank()) return ChatToolService.ConversationContext.empty();
        try {
            ChatToolService.ConversationContext context = objectMapper.readValue(
                    raw, ChatToolService.ConversationContext.class);
            return context == null ? ChatToolService.ConversationContext.empty() : context;
        } catch (JsonProcessingException exception) {
            log.warn("chat_assistant_context reason=INVALID_CONTEXT_JSON");
            return ChatToolService.ConversationContext.empty();
        }
    }

    /** Keep the most recent verified product group through policy and other non-product turns. */
    private ChatToolService.ConversationContext contextForImmediatePreviousCards(
            ChatToolService.ConversationContext persisted,
            List<ChatMessageEntity> messages
    ) {
        ChatToolService.ConversationContext context = persisted == null
                ? ChatToolService.ConversationContext.empty() : persisted;
        List<String> slugs = context.productSlugs();
        if (messages != null && !messages.isEmpty()) {
            ChatMessageEntity latest = messages.get(messages.size() - 1);
            if ("ASSISTANT".equals(latest.getRole())
                    && latest.getProductsJson() != null
                    && !latest.getProductsJson().isBlank()) {
                try {
                    List<ChatProductCardResponse> cards = objectMapper.readValue(
                            latest.getProductsJson(), new TypeReference<>() {});
                    slugs = cards.stream()
                            .filter(card -> card != null && card.slug() != null && !card.slug().isBlank())
                            .map(ChatProductCardResponse::slug)
                            .distinct()
                            .limit(8)
                            .toList();
                } catch (JsonProcessingException exception) {
                    log.warn("Trợ lý BigBike previous-card context ignored reason=INVALID_PRODUCTS_JSON");
                }
            }
        }
        return new ChatToolService.ConversationContext(
                context.category(), context.brand(), context.minPrice(), context.maxPrice(),
                slugs, context.awaitingOrderLogin(), context.productDecision());
    }

    private void saveConversationContext(
            ChatConversationEntity conversation,
            ChatToolService.ConversationContext context
    ) {
        conversation.setContextJson(writeJson(context));
    }

    private ChatMessageEntity saveCustomerMessage(ChatConversationEntity conversation, String content) {
        return saveCustomerMessage(conversation, content, null, true);
    }

    private ChatMessageEntity saveCustomerMessage(
            ChatConversationEntity conversation,
            String content,
            UUID requestId,
            boolean countAsSubstantiveTurn
    ) {
        conversation.setTurnCount(conversation.getTurnCount() + 1);
        if (countAsSubstantiveTurn) {
            conversation.setCountedTurns(conversation.getCountedTurns() + 1);
        }
        conversation.setLastMessageAt(Instant.now());
        ChatMessageEntity message = new ChatMessageEntity();
        message.setConversationId(conversation.getId());
        message.setSequenceNo(nextMessageSequence(conversation.getId()));
        message.setRole("CUSTOMER");
        message.setContent(content.trim());
        message.setSource("TOOL");
        message.setRequestId(requestId);
        return messageRepo.save(message);
    }

    /** Technical orchestration failures stay in chat and become a useful next question. */
    private ChatMessageResponse recoverableClarification(
            ChatConversationEntity conversation,
            ChatAssistantSettings.Snapshot settings,
            String lang,
            boolean aiCalled,
            UUID requestId,
            long startedNanos,
            int maxTurns,
            ChatFallbackReason reason,
            String guardReason,
            int productCount,
            boolean countedAsSubstantiveTurn
    ) {
        conversation.setTurnCount(Math.max(0, conversation.getTurnCount() - 1));
        if (countedAsSubstantiveTurn) {
            conversation.setCountedTurns(Math.max(0, conversation.getCountedTurns() - 1));
        }
        boolean repeated = messageRepo.findFirstByConversationIdAndRoleOrderByCreatedAtDesc(
                        conversation.getId(), "ASSISTANT")
                .map(message -> "CONTACT_FALLBACK".equals(message.getSource())
                        || isRecoverableClarificationText(message.getContent()))
                .orElse(false);
        String answer = repeated
                ? repeatedFallbackText(lang)
                : ("en".equals(lang)
                ? "BigBike Assistant is busy and could not finish that lookup. Please try the same question again, or choose Talk to staff for immediate help."
                : "Trợ lý BigBike đang bận nên chưa hoàn tất lần tra này. Anh/chị vui lòng hỏi lại đúng câu vừa rồi, hoặc bấm Gặp nhân viên nếu cần hỗ trợ ngay nhé.");
        logFallback(reason, aiCalled ? FallbackFlow.AI : FallbackFlow.FAST_PATH,
                guardReason, productCount, false);
        List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> actions =
                ChatActionCatalog.choose("", "CLARIFICATION", List.of(), List.of(), settings.contacts());
        saveAssistantMessage(conversation, answer, "CONTACT_FALLBACK", aiCalled, List.of(), 0,
                requestId, "PLAIN_TEXT", "CLARIFICATION", actions,
                false, null, null, null);
        conversationRepo.save(conversation);
        return aiResponse(
                conversation, settings, answer, List.of(), "CLARIFICATION", false,
                actions, maxTurns);
    }

    private static boolean isRecoverableClarificationText(String value) {
        String normalized = ChatToolService.normalize(value == null ? "" : value);
        return normalized.contains("chua lay duoc thong tin phu hop cho cau hoi nay")
                || normalized.contains("could not complete that lookup yet")
                || normalized.contains("chua hoan tat duoc lan tra nay")
                || normalized.contains("bigbike assistant is busy");
    }

    private ChatSalesAdvisorService.Advice salesAdvice(
            ChatConversationEntity conversation,
            ChatMessageRequest request,
            ChatAssistantSettings.Snapshot settings,
            ChatToolService.ConversationContext context,
            String answer,
            List<ChatProductCardResponse> products,
            String source,
            String resultKind,
            ChatClarificationResponse clarification,
            boolean handoff,
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> actions
    ) {
        if (salesAdvisorService == null) {
            return new ChatSalesAdvisorService.Advice(
                    answer, products, List.of(), conversation.getSalesStage(),
                    "ANSWERED", null, actions, handoff);
        }
        return salesAdvisorService.advise(
                conversation, request.getMessage(), request.getLang(), settings,
                context, answer, products, source, resultKind, clarification, handoff, actions);
    }

    private ChatHandoffStatusResponse createHandoffIfNeeded(
            ChatConversationEntity conversation,
            String question,
            List<ChatProductCardResponse> products,
            boolean handoff
    ) {
        if (!handoff || handoffService == null) return null;
        return handoffService.requestFromMessage(conversation, question, products);
    }

    private static String repeatedFallbackText(String lang) {
        return "en".equals(lang)
                ? "The lookup is still busy. Please try again shortly or choose Talk to staff so BigBike can check it directly."
                : "Lần tra vẫn đang bận. Anh/chị vui lòng thử lại sau ít phút hoặc bấm Gặp nhân viên để BigBike kiểm tra trực tiếp nhé.";
    }

    private void saveAssistantMessage(
            ChatConversationEntity conversation,
            String content,
            String source,
            boolean aiCalled,
            List<ChatProductCardResponse> products,
            int aiRetryCount
    ) {
        saveAssistantMessage(
                conversation, content, source, aiCalled, products, aiRetryCount,
                null, answerFormat(content), resultKind(products, false), List.of(),
                false, null, null, null);
    }

    private static String providerUnavailableText(String lang) {
        return "en".equals(lang)
                ? "Sorry, BigBike Assistant could not complete this check right now. Please choose Talk to staff and the team will help you directly."
                : "Em xin lỗi, Trợ lý BigBike chưa hoàn tất được lần kiểm tra này. Anh/chị bấm Gặp nhân viên để BigBike hỗ trợ trực tiếp nhé.";
    }

    private void saveAssistantMessage(
            ChatConversationEntity conversation,
            String content,
            String source,
            boolean aiCalled,
            List<ChatProductCardResponse> products,
            int aiRetryCount,
            UUID requestId,
            String answerFormat,
            String resultKind,
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> actions,
            boolean handoff,
            ChatClarificationResponse clarification,
            ChatSalesAdvisorService.Advice salesAdvice,
            ChatHandoffStatusResponse handoffStatus
    ) {
        ChatMessageEntity message = new ChatMessageEntity();
        message.setConversationId(conversation.getId());
        message.setSequenceNo(nextMessageSequence(conversation.getId()));
        message.setRole("ASSISTANT");
        message.setContent(content);
        message.setSource(source);
        message.setRequestId(requestId);
        message.setAnswerFormat(answerFormat);
        message.setResultKind(resultKind);
        String mode = conversation.getEndedReason() == null ? "AI" : "CONTACT";
        message.setActionMetadata(writeJson(new StoredResponseMetadata(
                mode,
                mode,
                handoff,
                actions == null ? List.of() : List.copyOf(actions),
                clarification,
                salesAdvice == null ? List.of() : salesAdvice.crossSellProducts(),
                salesAdvice == null ? conversation.getSalesStage() : salesAdvice.salesStage(),
                salesAdvice == null ? null : salesAdvice.nextStep(),
                handoffStatus)));
        message.setAiCalled(aiCalled);
        message.setAiRetryCount(Math.max(0, aiRetryCount));
        message.setProductsJson(products.isEmpty() ? null : writeJson(products));
        if (salesAdvice != null) {
            message.setSalesStage(salesAdvice.salesStage());
            message.setOutcomeCode(salesAdvice.outcomeCode());
            message.setNextStepType(salesAdvice.nextStep() == null
                    ? null : salesAdvice.nextStep().type());
            message.setCrossSellProductsJson(salesAdvice.crossSellProducts().isEmpty()
                    ? null : writeJson(salesAdvice.crossSellProducts()));
        }
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
            return true;
        }
        return false;
    }

    private void finishTurnIfNeeded(ChatConversationEntity conversation, int maxTurns) {
        // Phase 3 never hard-closes at the cap. The next customer turn moves to a linked
        // successor conversation before processing, preserving the verified context.
    }

    private int resolveMaxTurns(ChatMessageRequest request) {
        return currentTurnLimit();
    }

    private int currentTurnLimit() {
        return phase3Settings == null ? MAX_TURNS : phase3Settings.conversationTurnLimit();
    }

    private long nextMessageSequence(UUID conversationId) {
        return messageRepo.nextSequence();
    }

    private boolean isClarificationReply(
            ChatConversationEntity conversation, ChatMessageRequest request) {
        if (request.getClarificationSelection() != null) return true;
        return messageRepo.findFirstByConversationIdAndRoleOrderByCreatedAtDesc(
                        conversation.getId(), "ASSISTANT")
                .map(message -> "CLARIFICATION".equals(message.getResultKind()))
                .orElse(false);
    }

    private ChatConversationEntity continueConversation(ChatConversationEntity previous) {
        previous.setEndedReason("CONTINUED");
        conversationRepo.save(previous);
        ChatConversationEntity successor = new ChatConversationEntity();
        successor.setCustomerId(previous.getCustomerId());
        successor.setVisitorId(previous.getVisitorId());
        successor.setThreadId(previous.getThreadId() == null ? previous.getId() : previous.getThreadId());
        successor.setContinuedFromId(previous.getId());
        successor.setLocale(previous.getLocale());
        successor.setContextJson(previous.getContextJson());
        successor.setSalesStage(previous.getSalesStage());
        successor.setLastNextStepType(previous.getLastNextStepType());
        return conversationRepo.save(successor);
    }

    private static int remainingTurns(ChatConversationEntity conversation, int maxTurns) {
        return Math.max(0, maxTurns - conversation.getCountedTurns());
    }

    private static String channelState(
            ChatHandoffStatusResponse handoff, ChatConversationEntity conversation) {
        if (handoff != null) {
            return switch (handoff.status()) {
                case "WAITING" -> "WAITING_FOR_STAFF";
                case "ACTIVE" -> "STAFF_ACTIVE";
                case "RETURNED_TO_AI" -> "AI_RESUMED";
                case "CLOSED" -> "CLOSED";
                default -> "AI_ACTIVE";
            };
        }
        return "CLOSED".equals(conversation.getEndedReason()) ? "CLOSED" : "AI_ACTIVE";
    }

    private static com.bigbike.bigbike_backend.api.chat.dto.ChatContinuationResponse continuation(
            ChatConversationEntity conversation, int maxTurns) {
        int remaining = remainingTurns(conversation, maxTurns);
        boolean continued = conversation.getContinuedFromId() != null;
        if (remaining > 3 && !continued) return null;
        boolean english = "en".equals(conversation.getLocale());
        String message = continued
                ? (english
                    ? "I continued this chat with the needs and products already discussed. You do not need to repeat them."
                    : "Em đã nối tiếp hội thoại cùng nhu cầu và sản phẩm mình vừa trao đổi; anh/chị không cần kể lại.")
                : (english
                    ? "We can continue in a linked chat or bring in BigBike staff without losing what you have shared."
                    : "Mình có thể nối tiếp hội thoại hoặc gặp nhân viên BigBike mà không mất những gì anh/chị đã chia sẻ.");
        return new com.bigbike.bigbike_backend.api.chat.dto.ChatContinuationResponse(
                true, conversation.getThreadId(), continued ? conversation.getId() : null, message);
    }

    private Availability resolveAvailability(ChatAssistantSettings.Snapshot settings) {
        if (!settings.enabled()) return new Availability("CONTACT", "DISABLED");
        if (!aiClient.isConfigured()) return new Availability("CONTACT", "NOT_CONFIGURED");
        if (settings.dailyLimit() <= 0 || chatAiQuotaService.usedToday() >= settings.dailyLimit()) {
            return new Availability("CONTACT", "DAILY_LIMIT_REACHED");
        }
        return new Availability("AI", "AVAILABLE");
    }

    private ChatMessageResponse aiResponse(
            ChatConversationEntity conversation,
            ChatAssistantSettings.Snapshot settings,
            String answer,
            List<ChatProductCardResponse> products,
            String responseKind,
            boolean handoff,
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> actions,
            int maxTurns
    ) {
        return aiResponse(
                conversation, settings, answer, products, responseKind, handoff,
                actions, maxTurns, null);
    }

    private ChatMessageResponse aiResponse(
            ChatConversationEntity conversation,
            ChatAssistantSettings.Snapshot settings,
            String answer,
            List<ChatProductCardResponse> products,
            String responseKind,
            boolean handoff,
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> actions,
            int maxTurns,
            ChatClarificationResponse clarification
    ) {
        return aiResponse(
                conversation, settings, answer, products, responseKind, handoff,
                actions, maxTurns, clarification, null, null);
    }

    private ChatMessageResponse aiResponse(
            ChatConversationEntity conversation,
            ChatAssistantSettings.Snapshot settings,
            String answer,
            List<ChatProductCardResponse> products,
            String responseKind,
            boolean handoff,
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> actions,
            int maxTurns,
            ChatClarificationResponse clarification,
            ChatSalesAdvisorService.Advice salesAdvice,
            ChatHandoffStatusResponse handoffStatus
    ) {
        return new ChatMessageResponse(
                conversation.getId(),
                latestAssistantMessageId(conversation.getId()),
                conversation.getEndedReason() != null ? "CONTACT" : "AI",
                conversation.getEndedReason() != null ? "CONTACT" : "AI",
                answer,
                answerFormat(answer),
                responseKind,
                conversation.getTurnCount(),
                maxTurns,
                remainingTurns(conversation, maxTurns),
                List.copyOf(products),
                clarification,
                handoff,
                List.copyOf(actions),
                settings.contacts(),
                salesAdvice == null ? List.of() : salesAdvice.crossSellProducts(),
                salesAdvice == null ? conversation.getSalesStage() : salesAdvice.salesStage(),
                salesAdvice == null ? null : salesAdvice.nextStep(),
                handoffStatus,
                channelState(handoffStatus, conversation), conversation.getCountedTurns(), maxTurns,
                remainingTurns(conversation, maxTurns), continuation(conversation, maxTurns));
    }

    private ChatMessageResponse contactResponse(
            ChatConversationEntity conversation,
            ChatAssistantSettings.Snapshot settings,
            String answer,
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> actions,
            int maxTurns
    ) {
        return new ChatMessageResponse(
                conversation.getId(),
                latestAssistantMessageId(conversation.getId()),
                "CONTACT",
                "CONTACT",
                answer,
                "PLAIN_TEXT",
                "CONTACT",
                conversation.getTurnCount(),
                maxTurns,
                remainingTurns(conversation, maxTurns),
                List.of(),
                null,
                true,
                List.copyOf(actions),
                settings.contacts(), List.of(), conversation.getSalesStage(), null, null,
                channelState(null, conversation), conversation.getCountedTurns(), maxTurns,
                remainingTurns(conversation, maxTurns), continuation(conversation, maxTurns));
    }

    private ChatMessageResponse refusalResponse(
            ChatConversationEntity conversation,
            ChatAssistantSettings.Snapshot settings,
            String answer,
            String responseKind,
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> actions,
            int maxTurns
    ) {
        boolean ended = conversation.getEndedReason() != null;
        return new ChatMessageResponse(
                conversation.getId(), latestAssistantMessageId(conversation.getId()),
                ended ? "CONTACT" : "AI", ended ? "CONTACT" : "AI",
                answer, "PLAIN_TEXT", responseKind,
                conversation.getTurnCount(), maxTurns,
                remainingTurns(conversation, maxTurns),
                List.of(), null, ended, List.copyOf(actions), settings.contacts(),
                List.of(), conversation.getSalesStage(), null, null,
                channelState(null, conversation), conversation.getCountedTurns(), maxTurns,
                remainingTurns(conversation, maxTurns), continuation(conversation, maxTurns));
    }

    private ChatMessageResponse staffActiveResponse(
            ChatConversationEntity conversation,
            ChatAssistantSettings.Snapshot settings,
            ChatHandoffStatusResponse handoff,
            int maxTurns
    ) {
        String answer = "en".equals(conversation.getLocale())
                ? "A BigBike staff member is handling this chat and will reply here."
                : "Nhân viên BigBike đang tiếp nhận và sẽ trả lời anh/chị ngay trong khung chat này.";
        return new ChatMessageResponse(
                conversation.getId(), null, "CONTACT", "STAFF_ACTIVE", answer, "PLAIN_TEXT",
                "CONTACT", conversation.getTurnCount(), maxTurns,
                remainingTurns(conversation, maxTurns), List.of(), null, true,
                List.of(), settings.contacts(), List.of(), conversation.getSalesStage(), null,
                handoff, "STAFF_ACTIVE", conversation.getCountedTurns(), maxTurns,
                remainingTurns(conversation, maxTurns), continuation(conversation, maxTurns));
    }

    private UUID latestAssistantMessageId(UUID conversationId) {
        return messageRepo.findFirstByConversationIdAndRoleOrderByCreatedAtDesc(
                        conversationId, "ASSISTANT")
                .map(ChatMessageEntity::getId)
                .orElse(null);
    }

    private static String safetyRefusalText(String lang) {
        return "en".equals(lang)
                ? "I cannot help with that content. I can still assist with BigBike products, protective gear and store policies."
                : "Em không thể hỗ trợ nội dung này. Em vẫn có thể tư vấn sản phẩm, đồ bảo hộ và chính sách của BigBike.";
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            return null;
        }
    }

    private static String answerFormat(String answer) {
        if (answer == null) return "PLAIN_TEXT";
        return answer.contains("**")
                || answer.matches("(?s).*(?:^|\\R)\\s*(?:[-*]|\\d+\\.)\\s+.*")
                || answer.matches("(?s).*\\|[^\\r\\n]+\\|.*")
                ? "MARKDOWN" : "PLAIN_TEXT";
    }

    private static String resultKind(List<ChatProductCardResponse> products, boolean contact) {
        return resultKind(products, contact, null);
    }

    private static String resultKind(
            List<ChatProductCardResponse> products,
            boolean contact,
            ChatClarificationResponse clarification
    ) {
        if (products != null && !products.isEmpty()) return "PRODUCT_RESULTS";
        if (clarification != null) return "CLARIFICATION";
        return contact ? "CONTACT" : "ANSWER";
    }

    private record StoredResponseMetadata(
            String mode,
            String reason,
            boolean handoff,
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> actions,
            ChatClarificationResponse clarification,
            List<ChatProductCardResponse> crossSellProducts,
            String salesStage,
            ChatNextStepResponse nextStep,
            ChatHandoffStatusResponse handoffStatus
    ) {}

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

    private static ChatFallbackReason availabilityFallbackReason(String availabilityReason) {
        return switch (availabilityReason) {
            case "DISABLED" -> ChatFallbackReason.SERVICE_DISABLED;
            case "DAILY_LIMIT_REACHED" -> ChatFallbackReason.DAILY_LIMIT_REACHED;
            default -> ChatFallbackReason.SERVICE_NOT_CONFIGURED;
        };
    }

    private void logFallback(
            ChatFallbackReason reason,
            FallbackFlow flow,
            String guardReason,
            int productCount,
            boolean recovered
    ) {
        String safeGuardReason = guardReason == null || guardReason.isBlank() ? "NONE" : guardReason;
        if (recovered) {
            log.info("chat_assistant_outcome flow={} reason={} guard={} products={} recovered=true",
                    flow, reason, safeGuardReason, Math.max(0, productCount));
        } else {
            log.warn("chat_assistant_outcome flow={} reason={} guard={} products={} recovered=false",
                    flow, reason, safeGuardReason, Math.max(0, productCount));
        }
    }

    private enum FallbackFlow {
        CONTACT_GATE,
        QUOTA_GATE,
        FAST_PATH,
        AI,
        AI_GUARD
    }

    private static String contactFallbackText(String lang, FallbackCause cause) {
        if ("en".equals(lang)) {
            return switch (cause) {
                case SERVICE_PAUSED -> "BigBike Assistant is temporarily paused. Please choose Talk to staff; Hotline, Zalo and Messenger are available below for direct help.";
                case DAILY_LIMIT -> "BigBike Assistant has reached today’s automated-chat limit. Please choose Talk to staff; Hotline, Zalo and Messenger are available below for direct help.";
                case SERVICE_NOT_READY -> "BigBike Assistant is not ready at the moment. Please choose Talk to staff; Hotline, Zalo and Messenger are available below for direct help.";
                case PROVIDER_UNAVAILABLE -> "That lookup did not finish, but you can keep chatting here. Please send the product name or detail to check again; Talk to staff remains available if you need immediate help.";
                case SAFETY_REVIEW -> "I do not have enough confirmed detail to answer this part clearly, so I do not want to guess. Please choose Talk to staff; Hotline, Zalo and Messenger below can help you directly.";
                case STAFF_REVIEW -> "This request needs a BigBike staff review so no unsupported promise is made. Please choose Talk to staff; Hotline, Zalo and Messenger are available below for direct help.";
            };
        }
        return switch (cause) {
            case SERVICE_PAUSED -> "Trợ lý BigBike đang tạm nghỉ. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
            case DAILY_LIMIT -> "Trợ lý BigBike đã dùng hết lượt tư vấn tự động trong hôm nay. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
            case SERVICE_NOT_READY -> "Trợ lý BigBike hiện chưa sẵn sàng. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
            case PROVIDER_UNAVAILABLE -> "Lần tra này chưa hoàn tất nhưng anh/chị vẫn có thể hỏi tiếp trong khung chat. Anh/chị thử gửi tên mẫu hoặc chi tiết cần kiểm tra; nếu cần hỗ trợ ngay, nút Gặp nhân viên vẫn luôn có sẵn ạ.";
            case SAFETY_REVIEW -> "Em cần anh/chị nói rõ thêm để kiểm tra đúng thông tin và không đoán. Anh/chị gửi tên mẫu hoặc chi tiết cần xem; nút Gặp nhân viên vẫn luôn có sẵn nếu mình cần hỗ trợ trực tiếp ạ.";
            case STAFF_REVIEW -> "Trường hợp này cần nhân viên BigBike kiểm tra trực tiếp để không đưa ra cam kết ngoài chính sách. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
        };
    }

    private static String endedConversationText(String lang, String reason, int maxTurns) {
        boolean english = "en".equals(lang);
        return switch (reason == null ? "TURN_LIMIT" : reason) {
            case "OFF_TOPIC" -> english
                    ? "BigBike Assistant only supports BigBike products and services. Please choose Talk to staff if you need other help."
                    : "Trợ lý BigBike chỉ hỗ trợ sản phẩm và dịch vụ của shop. Anh/chị bấm Gặp nhân viên để được hỗ trợ thêm nhé.";
            case "AI_UNAVAILABLE", "DAILY_LIMIT_REACHED", "DISABLED" -> english
                    ? "BigBike Assistant is busy at the moment. Please try again later or choose Talk to staff for immediate help."
                    : "Trợ lý BigBike đang bận. Anh/chị vui lòng thử lại sau hoặc bấm Gặp nhân viên để được hỗ trợ ngay nhé.";
            case "HANDOFF" -> english
                    ? "This conversation has been passed to BigBike staff. Please use the contact options below to continue."
                    : "Hội thoại đã được chuyển sang nhân viên BigBike. Anh/chị dùng các kênh liên hệ bên dưới để được hỗ trợ tiếp nhé.";
            default -> english
                    ? "This conversation has reached its " + maxTurns
                    + "-question limit. Please choose Talk to staff to continue."
                    : "Hội thoại này đã nhận đủ " + maxTurns
                    + " lượt hỏi. Anh/chị bấm Gặp nhân viên để BigBike hỗ trợ tiếp nhé.";
        };
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
