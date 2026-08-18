package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatAvailabilityResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadDeclineResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.ForbiddenException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatLeadEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatLeadJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.chat.ChatToolService.ToolOutcome;
import com.bigbike.bigbike_backend.service.ws.AdminChatWsService;
import com.bigbike.bigbike_backend.service.ws.ChatLeadWsEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.bigbike.bigbike_backend.util.PhoneNumbers;
import java.time.Instant;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;

@Service
@Slf4j
@RequiredArgsConstructor
public class ChatService {

    public static final int MAX_TURNS = 12;
    private final ChatConversationJpaRepository conversationRepo;
    private final ChatMessageJpaRepository messageRepo;
    private final ChatLeadJpaRepository leadRepo;
    private final CustomerJpaRepository customerRepo;
    private final ChatAssistantSettings assistantSettings;
    private final ChatToolService toolService;
    private final ChatToolRegistry toolRegistry;
    private final AiChatClient aiClient;
    private final ChatResponseGuard responseGuard;
    private final ChatInputGuard inputGuard = new ChatInputGuard();
    private final ChatAiQuotaService chatAiQuotaService;
    private final AdminChatWsService adminChatWsService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${bigbike.chat.input-cost-usd-per-million:0.30}")
    private BigDecimal inputCostUsdPerMillion = new BigDecimal("0.30");

    @Value("${bigbike.chat.output-cost-usd-per-million:2.50}")
    private BigDecimal outputCostUsdPerMillion = new BigDecimal("2.50");

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
    public ChatMessageResponse send(ChatMessageRequest request, UUID customerId) {
        long startedNanos = System.nanoTime();
        ChatAssistantSettings.Snapshot settings = assistantSettings.load(request.getLang());
        if (request.getRequestId() != null) {
            Optional<ChatMessageResponse> replay = replayStoredResponse(
                    request.getRequestId(), customerId, settings);
            if (replay.isPresent()) return replay.get();
        }
        ChatConversationEntity conversation = loadOrCreate(
                request.getConversationId(), customerId, request.getLang());

        if (conversation.getEndedReason() != null || conversation.getTurnCount() >= MAX_TURNS) {
            conversation.setEndedReason(conversation.getEndedReason() == null
                    ? "TURN_LIMIT" : conversation.getEndedReason());
            conversationRepo.save(conversation);
            return contactResponse(conversation, settings, turnLimitText(request.getLang()), List.of());
        }

        Optional<ChatInputGuard.Decision> inputDecision = inputGuard.evaluate(
                request.getMessage(), request.getLang());
        if (inputDecision.isPresent()) {
            ChatInputGuard.Decision decision = inputDecision.get();
            saveCustomerMessage(conversation, request.getMessage(), request.getRequestId());
            finishTurnIfNeeded(conversation);
            boolean ended = conversation.getEndedReason() != null;
            saveAssistantMessage(
                    conversation, decision.answer(), decision.source(), false, List.of(), 0,
                    request.getRequestId(), "PLAIN_TEXT", "REFUSAL", List.of(),
                    ended, false, Telemetry.local(startedNanos));
            conversationRepo.save(conversation);
            return refusalResponse(conversation, settings, decision.answer());
        }

        Availability availability = resolveAvailability(settings);
        if (!"AI".equals(availability.mode())) {
            conversation.setEndedReason(endedReason(availability.reason()));
            saveCustomerMessage(conversation, request.getMessage(), request.getRequestId());
            String fallback = contactFallbackText(request.getLang(), fallbackCause(availability.reason()));
            logFallback(availabilityFallbackReason(availability.reason()), FallbackFlow.CONTACT_GATE,
                    "NONE", 0, false);
            saveAssistantMessage(conversation, fallback,
                    "CONTACT_FALLBACK", false, List.of(), 0,
                    request.getRequestId(), "PLAIN_TEXT", "CONTACT", List.of(),
                    true, false, Telemetry.local(startedNanos));
            return contactResponse(
                    conversation, settings, fallback, List.of());
        }

        ChatToolService.ConversationContext conversationContext = readConversationContext(conversation);
        List<ChatMessageEntity> existingMessages = messageRepo
                .findByConversationIdOrderByCreatedAtAsc(conversation.getId());
        ChatToolService.ConversationContext referenceContext = contextForImmediatePreviousCards(
                conversationContext, existingMessages);
        List<ChatHistorySanitizer.RecentTurn> recentTurns = settings.recentTurnPairs() == 0
                ? List.of()
                : ChatHistorySanitizer.recentTurns(existingMessages, settings.recentTurnPairs());
        saveCustomerMessage(conversation, request.getMessage(), request.getRequestId());
        Optional<ToolOutcome> fastPath;
        try {
            fastPath = toolService.resolveFastPath(
                    request.getMessage(), request.getLang(), customerId, settings, referenceContext);
        } catch (RuntimeException exception) {
            return recoverableClarification(
                    conversation, settings, request.getLang(), false,
                    request.getRequestId(), startedNanos,
                    ChatFallbackReason.FAST_PATH_EXCEPTION, "NONE", 0);
        }

        if (fastPath.isPresent()) {
            ToolOutcome tool = fastPath.get();
            Optional<ChatResponseGuard.CheckedAnswer> checked = responseGuard.check(
                    tool.localAnswer(), tool.products(), request.getLang());
            if (checked.isEmpty()) {
                String reason = responseGuard.rejectionReason(
                        tool.localAnswer(), tool.products(), request.getLang(), List.of(),
                        tool.requiredDisclosures(), tool.catalogTotals());
                return recoverableClarification(
                        conversation, settings, request.getLang(), false,
                        request.getRequestId(), startedNanos,
                        ChatFallbackReason.FAST_PATH_GUARD_REJECTED, reason, tool.products().size());
            }
            ChatResponseGuard.CheckedAnswer safe = checked.get();
            Optional<ChatResponseGuard.CheckedAnswer> duplicateClarification = clarifyNearDuplicate(
                    conversation, safe, request.getLang());
            boolean clarifiedDuplicate = duplicateClarification.isPresent();
            if (clarifiedDuplicate) safe = duplicateClarification.get();
            if (tool.leadDeclined() && "OFFERED".equals(conversation.getLeadOfferStatus())) {
                conversation.setLeadOfferStatus("DECLINED");
            }
            boolean handoff = applyConversationSignals(
                    conversation,
                    clarifiedDuplicate ? false : tool.offTopic(),
                    clarifiedDuplicate ? false : tool.handoffRecommended());
            boolean leadPrompt = offerLeadIfEligible(
                    conversation,
                    !handoff && ChatToolService.shouldOfferLeadPrompt(
                            request.getMessage(), safe.products(), false));
            saveAssistantMessage(conversation, safe.answer(), clarifiedDuplicate ? "TOOL" : tool.source(),
                    false, safe.products(), 0,
                    request.getRequestId(), answerFormat(safe.answer()), resultKind(safe.products(), handoff),
                    tool.actions(), handoff, leadPrompt, Telemetry.local(startedNanos));
            saveConversationContext(conversation, toolService.recordConversationContext(
                    conversationContext,
                    request.getMessage(),
                    request.getLang(),
                    safe.products(),
                    tool.actions(),
                    tool.effectiveSearchScope()));
            finishTurnIfNeeded(conversation);
            conversationRepo.save(conversation);
            return aiResponse(
                    conversation,
                    settings,
                    safe.answer(),
                    safe.products(),
                    handoff,
                    leadPrompt,
                    tool.actions());
        }

        if (!chatAiQuotaService.tryReserve(settings.dailyLimit())) {
            conversation.setEndedReason("DAILY_LIMIT_REACHED");
            String fallback = contactFallbackText(request.getLang(), FallbackCause.DAILY_LIMIT);
            saveAssistantMessage(conversation, fallback, "CONTACT_FALLBACK", false, List.of(), 0,
                    request.getRequestId(), "PLAIN_TEXT", "CONTACT", List.of(),
                    true, false, Telemetry.local(startedNanos));
            logFallback(ChatFallbackReason.DAILY_LIMIT_REACHED, FallbackFlow.QUOTA_GATE,
                    "NONE", 0, false);
            conversationRepo.save(conversation);
            return contactResponse(conversation, settings, fallback, List.of());
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
            Telemetry safetyTelemetry = telemetry(
                    startedNanos, exception.usage(), exception.providerCallCount());
            finishTurnIfNeeded(conversation);
            boolean ended = conversation.getEndedReason() != null;
            saveAssistantMessage(
                    conversation, refusal, "CONTENT_REFUSAL", true, List.of(), 0,
                    request.getRequestId(), "PLAIN_TEXT", "REFUSAL", List.of(),
                    ended, false, safetyTelemetry);
            conversationRepo.save(conversation);
            return refusalResponse(conversation, settings, refusal);
        } catch (RuntimeException exception) {
            ai = Optional.empty();
        }
        if (ai.isEmpty()) {
            return recoverableClarification(
                    conversation, settings, request.getLang(), true,
                    request.getRequestId(), startedNanos,
                    ChatFallbackReason.AI_NO_SAFE_RESULT, "NONE", 0);
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
                    request.getRequestId(), startedNanos,
                    productsFiltered
                            ? ChatFallbackReason.UNSAFE_PRODUCT_FILTERED
                            : ChatFallbackReason.AI_GUARD_REJECTED,
                    guardReason,
                    guardDiagnostic == null ? 0 : guardDiagnostic.productCount());
        }
        ChatResponseGuard.CheckedAnswer safe = checked.get();
        Optional<ChatResponseGuard.CheckedAnswer> duplicateClarification = clarifyNearDuplicate(
                conversation, safe, request.getLang());
        boolean clarifiedDuplicate = duplicateClarification.isPresent();
        if (clarifiedDuplicate) safe = duplicateClarification.get();
        boolean interestLead = ChatToolService.shouldOfferLeadPrompt(
                request.getMessage(), safe.products(), recoveredFromGuard);
        AiChatClient.Answer answer = recoveredFromGuard || clarifiedDuplicate
                ? new AiChatClient.Answer(
                        safe.answer(), false, false,
                        hybridAnswer.answer().leadPrompt() || interestLead)
                : hybridAnswer.answer();
        boolean handoff = applyConversationSignals(
                conversation, answer.offTopic(), answer.handoffRecommended());
        boolean leadPrompt = offerLeadIfEligible(
                conversation, !handoff && (answer.leadPrompt() || interestLead));
        saveAssistantMessage(
                conversation, safe.answer(), recoveredFromGuard || clarifiedDuplicate ? "TOOL" : hybridAnswer.source(),
                true, safe.products(), 0,
                request.getRequestId(), answerFormat(safe.answer()), resultKind(safe.products(), handoff),
                recoveredFromGuard || clarifiedDuplicate ? List.of() : hybridAnswer.actions(),
                handoff, leadPrompt, telemetry(startedNanos, hybridAnswer));
        saveConversationContext(conversation, toolService.recordConversationContext(
                conversationContext,
                request.getMessage(),
                request.getLang(),
                safe.products(),
                recoveredFromGuard || clarifiedDuplicate ? List.of() : hybridAnswer.actions(),
                hybridAnswer.searchScope()));
        finishTurnIfNeeded(conversation);
        conversationRepo.save(conversation);
        return aiResponse(
                conversation,
                settings,
                safe.answer(),
                safe.products(),
                handoff || conversation.getEndedReason() != null,
                leadPrompt,
                recoveredFromGuard || clarifiedDuplicate ? List.of() : hybridAnswer.actions());
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
        if ("ACCOUNT".equals(request.getContactSource())) {
            AccountContact accountContact = resolveAccountContact(customerId);
            lead.setName(accountContact.name());
            lead.setPhone(accountContact.phone());
            lead.setNote(null);
            lead.setSource("ACCOUNT");
        } else {
            lead.setName(trimToNull(request.getName()));
            lead.setPhone(request.getPhone().replaceAll("\\s+", " ").trim());
            lead.setNote(trimToNull(request.getNote()));
            lead.setSource("FORM");
        }
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

    private AccountContact resolveAccountContact(UUID customerId) {
        if (customerId == null) {
            throw new ForbiddenException("Cần đăng nhập để dùng thông tin liên hệ trong tài khoản.");
        }
        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new ForbiddenException("Không thể xác nhận tài khoản hiện tại."));
        String name = trimToNull(customer.getDisplayName());
        if (name == null) {
            name = trimToNull(String.join(" ",
                    java.util.stream.Stream.of(customer.getFirstName(), customer.getLastName())
                            .filter(value -> value != null && !value.isBlank())
                            .map(String::trim)
                            .toList()));
        }
        String phone = PhoneNumbers.normalize(customer.getPhone());
        if (name == null || !isUsableAccountPhone(phone)) {
            throw new ConflictException("Tài khoản chưa có thông tin liên hệ dùng được.");
        }
        return new AccountContact(name, phone);
    }

    private static boolean isUsableAccountPhone(String phone) {
        return phone != null && phone.matches("[0-9]{8,32}");
    }

    private record AccountContact(String name, String phone) {}

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

    private Optional<ChatMessageResponse> replayStoredResponse(
            UUID requestId,
            UUID customerId,
            ChatAssistantSettings.Snapshot settings
    ) {
        Optional<ChatMessageEntity> stored = messageRepo.findFirstByRequestIdAndRole(
                requestId, "ASSISTANT");
        if (stored.isEmpty()) return Optional.empty();
        ChatMessageEntity message = stored.get();
        ChatConversationEntity conversation = loadExistingForCaller(
                message.getConversationId(), customerId);
        List<ChatProductCardResponse> products = readStoredProducts(message.getProductsJson());
        StoredResponseMetadata metadata = readStoredMetadata(message.getActionMetadata());
        String mode = metadata == null ? "AI" : metadata.mode();
        String reason = metadata == null ? mode : metadata.reason();
        boolean handoff = metadata != null && metadata.handoff();
        boolean leadPrompt = metadata != null && metadata.leadPrompt();
        List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> actions = metadata == null
                ? List.of() : metadata.actions();
        return Optional.of(new ChatMessageResponse(
                conversation.getId(), mode, reason, message.getContent(),
                message.getAnswerFormat(), message.getResultKind(),
                conversation.getTurnCount(), MAX_TURNS,
                Math.max(0, MAX_TURNS - conversation.getTurnCount()),
                products, handoff, leadPrompt, actions, settings.contacts()));
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
        ChatConversationEntity conversation = conversationRepo.findByIdForUpdate(id)
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
                source.searchScope(),
                source.usage());
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
                    : "Dạ, tầm giá đã nêu ở lượt trước không có kết quả phù hợp nên em đã bỏ riêng bộ lọc cũ và tìm lại yêu cầu này. "
                    + "Các sản phẩm bên dưới là kết quả đang bán sau khi em tìm lại. "
                    + "Anh/chị cho em tầm giá mới nếu muốn em lọc hẹp lại nhé.";
        } else if (hybridAnswer.requiredDisclosures()
                .contains(ChatToolService.RequiredDisclosure.PRICE_RANGE_MISS)) {
            answer = english
                    ? "I could not find a currently sold product in the price range you requested. "
                    + "The " + cards + " products below are the closest available options."
                    : "Dạ, em chưa tìm thấy sản phẩm đang bán trong tầm giá anh/chị hỏi. "
                    + cards + " sản phẩm bên dưới là phương án gần nhất đang có.";
        } else if (hybridAnswer.requiredDisclosures()
                .contains(ChatToolService.RequiredDisclosure.INHERITED_PRICE_RANGE)) {
            answer = english
                    ? "I am filtering by the price range from your previous product request. "
                    + "I am showing " + cards + " matching product"
                    + (cards == 1 ? " below." : "s below.")
                    : "Dạ, em đang lọc theo tầm giá anh/chị đã nêu trước đó. "
                    + "Em đang hiển thị " + cards + " sản phẩm phù hợp bên dưới.";
        } else if (hybridAnswer.requiredDisclosures()
                .contains(ChatToolService.RequiredDisclosure.BROADENED_SEARCH)) {
            answer = english
                    ? "The products below come from a broader search than your original request. "
                    + "Please tell me a more specific name, category or budget so I can narrow the results."
                    : "Dạ, các sản phẩm bên dưới đến từ tìm kiếm rộng hơn yêu cầu ban đầu của anh/chị. "
                    + "Anh/chị cho em tên mẫu, loại hàng hoặc tầm giá cụ thể hơn để em lọc lại nhé.";
        } else {
            answer = english
                    ? "I am showing " + cards + " matching product"
                    + (cards == 1 ? " below." : "s below.")
                    + " Please open a product or tell me a different budget if you want me to filter again."
                    : "Dạ, em đang hiển thị " + cards + " sản phẩm phù hợp bên dưới. "
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
                : "Dạ, trong tầm giá anh/chị hỏi, shop có " + total + " mẫu " + group + ". "
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
                : "Dạ, để em kiểm tra đúng ý anh/chị hơn, anh/chị muốn xem size, màu, thông số hay một tầm giá khác ạ? "
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
                slugs, context.awaitingOrderLogin());
    }

    private void saveConversationContext(
            ChatConversationEntity conversation,
            ChatToolService.ConversationContext context
    ) {
        conversation.setContextJson(writeJson(context));
    }

    private void saveCustomerMessage(ChatConversationEntity conversation, String content) {
        saveCustomerMessage(conversation, content, null);
    }

    private void saveCustomerMessage(
            ChatConversationEntity conversation,
            String content,
            UUID requestId
    ) {
        conversation.setTurnCount(conversation.getTurnCount() + 1);
        conversation.setLastMessageAt(Instant.now());
        ChatMessageEntity message = new ChatMessageEntity();
        message.setConversationId(conversation.getId());
        message.setRole("CUSTOMER");
        message.setContent(content.trim());
        message.setSource("TOOL");
        message.setRequestId(requestId);
        messageRepo.save(message);
    }

    /** Technical orchestration failures stay in chat and become a useful next question. */
    private ChatMessageResponse recoverableClarification(
            ChatConversationEntity conversation,
            ChatAssistantSettings.Snapshot settings,
            String lang,
            boolean aiCalled,
            UUID requestId,
            long startedNanos,
            ChatFallbackReason reason,
            String guardReason,
            int productCount
    ) {
        conversation.setTurnCount(Math.max(0, conversation.getTurnCount() - 1));
        boolean repeated = messageRepo.findFirstByConversationIdAndRoleOrderByCreatedAtDesc(
                        conversation.getId(), "ASSISTANT")
                .map(message -> "CONTACT_FALLBACK".equals(message.getSource())
                        || isRecoverableClarificationText(message.getContent()))
                .orElse(false);
        String answer = repeated
                ? repeatedFallbackText(lang)
                : ("en".equals(lang)
                ? "I could not complete that lookup yet. Please send the product name, product type or exact detail you want checked, and I will try again from the current BigBike catalogue."
                : "Dạ, em chưa lấy được thông tin phù hợp cho câu hỏi này nhưng anh/chị vẫn có thể hỏi tiếp. Anh/chị gửi tên mẫu, loại hàng hoặc chi tiết cần kiểm tra, em sẽ tra lại theo dữ liệu BigBike đang bán nhé.");
        logFallback(reason, aiCalled ? FallbackFlow.AI : FallbackFlow.FAST_PATH,
                guardReason, productCount, false);
        saveAssistantMessage(conversation, answer, "CONTACT_FALLBACK", aiCalled, List.of(), 0,
                requestId, "PLAIN_TEXT", "CLARIFICATION", List.of(),
                false, false, Telemetry.local(startedNanos));
        conversationRepo.save(conversation);
        return aiResponse(
                conversation, settings, answer, List.of(), false,
                offerLeadIfEligible(conversation, true), List.of());
    }

    private static boolean isRecoverableClarificationText(String value) {
        String normalized = ChatToolService.normalize(value == null ? "" : value);
        return normalized.contains("chua lay duoc thong tin phu hop cho cau hoi nay")
                || normalized.contains("could not complete that lookup yet")
                || normalized.contains("chua hoan tat duoc lan tra nay");
    }

    private static String repeatedFallbackText(String lang) {
        return "en".equals(lang)
                ? "I still need a little more detail to help with this. Please tell me the product type, model or price range, and I will filter the products currently sold by BigBike."
                : "Dạ, em cần anh/chị nói thêm loại hàng, tên mẫu hoặc tầm giá để lọc đúng dữ liệu BigBike đang bán. Anh/chị cho em biết rõ thêm một chi tiết giúp em nhé.";
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
                false, false, Telemetry.empty());
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
            boolean leadPrompt,
            Telemetry telemetry
    ) {
        ChatMessageEntity message = new ChatMessageEntity();
        message.setConversationId(conversation.getId());
        message.setRole("ASSISTANT");
        message.setContent(content);
        message.setSource(source);
        message.setRequestId(requestId);
        message.setAnswerFormat(answerFormat);
        message.setResultKind(resultKind);
        message.setActionMetadata(writeJson(new StoredResponseMetadata(
                handoff ? "CONTACT" : "AI",
                handoff ? "CONTACT" : "AI",
                handoff,
                leadPrompt,
                actions == null ? List.of() : List.copyOf(actions))));
        message.setAiCalled(aiCalled);
        message.setAiRetryCount(Math.max(0, aiRetryCount));
        message.setProductsJson(products.isEmpty() ? null : writeJson(products));
        Telemetry safeTelemetry = telemetry == null ? Telemetry.empty() : telemetry;
        message.setInputTokens(safeTelemetry.inputTokens());
        message.setOutputTokens(safeTelemetry.outputTokens());
        message.setThinkingTokens(safeTelemetry.thinkingTokens());
        message.setProviderRequestCount(safeTelemetry.providerRequests());
        message.setLatencyMs(safeTelemetry.latencyMs());
        message.setEstimatedCostUsd(safeTelemetry.estimatedCostUsd());
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

    private boolean offerLeadIfEligible(ChatConversationEntity conversation, boolean eligible) {
        if (!eligible || !"NONE".equals(conversation.getLeadOfferStatus())) return false;
        conversation.setLeadOfferStatus("OFFERED");
        return true;
    }

    private void finishTurnIfNeeded(ChatConversationEntity conversation) {
        if (conversation.getTurnCount() >= MAX_TURNS && conversation.getEndedReason() == null) {
            conversation.setEndedReason("TURN_LIMIT");
        }
    }

    private Availability resolveAvailability(ChatAssistantSettings.Snapshot settings) {
        if (!settings.enabled()) return new Availability("CONTACT", "DISABLED");
        if (!aiClient.isConfigured()) return new Availability("CONTACT", "NOT_CONFIGURED");
        if (settings.dailyLimit() <= 0 || chatAiQuotaService.usedToday() >= settings.dailyLimit()) {
            return new Availability("CONTACT", "DAILY_LIMIT_REACHED");
        }
        return new Availability("AI", "AVAILABLE");
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
                answerFormat(answer),
                resultKind(products, handoff || conversation.getEndedReason() != null),
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
                "PLAIN_TEXT",
                "CONTACT",
                conversation.getTurnCount(),
                MAX_TURNS,
                Math.max(0, MAX_TURNS - conversation.getTurnCount()),
                List.of(),
                true,
                false,
                List.copyOf(actions),
                settings.contacts());
    }

    private static ChatMessageResponse refusalResponse(
            ChatConversationEntity conversation,
            ChatAssistantSettings.Snapshot settings,
            String answer
    ) {
        boolean ended = conversation.getEndedReason() != null;
        return new ChatMessageResponse(
                conversation.getId(), ended ? "CONTACT" : "AI", ended ? "CONTACT" : "AI",
                answer, "PLAIN_TEXT", "REFUSAL",
                conversation.getTurnCount(), MAX_TURNS,
                Math.max(0, MAX_TURNS - conversation.getTurnCount()),
                List.of(), ended, false, List.of(), settings.contacts());
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
        if (contact) return "CONTACT";
        return products != null && !products.isEmpty() ? "PRODUCT_RESULTS" : "ANSWER";
    }

    private Telemetry telemetry(long startedNanos, AiChatClient.HybridAnswer answer) {
        AiChatClient.TokenUsage usage = answer == null
                ? AiChatClient.TokenUsage.empty() : answer.usage();
        return telemetry(startedNanos, usage, answer == null ? 0 : answer.providerCallCount());
    }

    private Telemetry telemetry(
            long startedNanos,
            AiChatClient.TokenUsage usage,
            int providerRequestCount
    ) {
        int latency = elapsedMillis(startedNanos);
        BigDecimal input = inputCostUsdPerMillion.multiply(BigDecimal.valueOf(usage.inputTokens()));
        long billedOutputTokens = (long) usage.outputTokens() + usage.thinkingTokens();
        BigDecimal output = outputCostUsdPerMillion.multiply(BigDecimal.valueOf(billedOutputTokens));
        BigDecimal cost = input.add(output)
                .divide(BigDecimal.valueOf(1_000_000L), 8, RoundingMode.HALF_UP);
        return new Telemetry(
                usage.inputTokens(), usage.outputTokens(), usage.thinkingTokens(),
                providerRequestCount, latency, cost);
    }

    private static int elapsedMillis(long startedNanos) {
        long millis = Math.max(0L, (System.nanoTime() - startedNanos) / 1_000_000L);
        return (int) Math.min(Integer.MAX_VALUE, millis);
    }

    private record StoredResponseMetadata(
            String mode,
            String reason,
            boolean handoff,
            boolean leadPrompt,
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse> actions
    ) {}

    private record Telemetry(
            Integer inputTokens,
            Integer outputTokens,
            Integer thinkingTokens,
            Integer providerRequests,
            Integer latencyMs,
            BigDecimal estimatedCostUsd
    ) {
        static Telemetry empty() {
            return new Telemetry(null, null, null, null, null, null);
        }

        static Telemetry local(long startedNanos) {
            return new Telemetry(0, 0, 0, 0, elapsedMillis(startedNanos), BigDecimal.ZERO);
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
            case SERVICE_PAUSED -> "Dạ, Trợ lý BigBike đang tạm nghỉ. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
            case DAILY_LIMIT -> "Dạ, Trợ lý BigBike đã dùng hết lượt tư vấn tự động trong hôm nay. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
            case SERVICE_NOT_READY -> "Dạ, Trợ lý BigBike hiện chưa sẵn sàng. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
            case PROVIDER_UNAVAILABLE -> "Dạ, lần tra này chưa hoàn tất nhưng anh/chị vẫn có thể hỏi tiếp trong khung chat. Anh/chị thử gửi tên mẫu hoặc chi tiết cần kiểm tra; nếu cần hỗ trợ ngay, nút Gặp nhân viên vẫn luôn có sẵn ạ.";
            case SAFETY_REVIEW -> "Dạ, em cần anh/chị nói rõ thêm để kiểm tra đúng dữ liệu và không đoán. Anh/chị gửi tên mẫu hoặc chi tiết cần xem; nút Gặp nhân viên vẫn luôn có sẵn nếu mình cần hỗ trợ trực tiếp ạ.";
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
