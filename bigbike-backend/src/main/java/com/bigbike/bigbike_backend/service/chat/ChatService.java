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
import java.util.Set;
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
        List<ChatHistorySanitizer.RecentTurn> recentTurns = settings.recentTurnPairs() == 0
                ? List.of()
                : ChatHistorySanitizer.recentTurns(
                        messageRepo.findByConversationIdOrderByCreatedAtAsc(conversation.getId()),
                        settings.recentTurnPairs());
        saveCustomerMessage(conversation, request.getMessage());
        Optional<ToolOutcome> fastPath;
        try {
            fastPath = toolService.resolveFastPath(
                    request.getMessage(), request.getLang(), customerId, settings, conversationContext);
        } catch (RuntimeException exception) {
            log.warn("Bi fast-path failed type={}", exception.getClass().getSimpleName());
            return recoverableClarification(conversation, settings, request.getLang(), false);
        }

        if (fastPath.isPresent()) {
            ToolOutcome tool = fastPath.get();
            Optional<ChatResponseGuard.CheckedAnswer> checked = responseGuard.check(
                    tool.localAnswer(), tool.products(), request.getLang());
            if (checked.isEmpty()) {
                return recoverableClarification(conversation, settings, request.getLang(), false);
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
            saveAssistantMessage(conversation, safe.answer(), clarifiedDuplicate ? "TOOL" : tool.source(),
                    false, safe.products(), 0);
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
                    false,
                    tool.actions());
        }

        ChatToolService.ToolContext toolContext = new ChatToolService.ToolContext(
                request.getMessage(), request.getLang(), customerId, settings, conversationContext);
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
                    conversationContext.productSlugs(),
                    recentTurns);
        } catch (RuntimeException exception) {
            log.warn("Bi AI invocation failed type={}", exception.getClass().getSimpleName());
            ai = Optional.empty();
        }
        conversation.setAiCallCount(conversation.getAiCallCount() + 1);
        if (ai.isEmpty()) {
            return recoverableClarification(conversation, settings, request.getLang(), true);
        }

        AiChatClient.HybridAnswer hybridAnswer = ai.get();
        Optional<ChatResponseGuard.CheckedAnswer> checked = checkHybridAnswer(
                hybridAnswer, request.getLang(), settings);
        ChatResponseGuard.GuardDiagnostic guardDiagnostic = checked.isEmpty()
                ? rejectionDiagnostic(hybridAnswer, request.getLang(), settings)
                : null;
        String guardReason = guardDiagnostic == null ? "NONE" : guardDiagnostic.reason();
        boolean recoveredFromGuard = false;
        if (checked.isEmpty()) {
            if ("UNSUPPORTED_CATALOG_CLAIM".equals(guardReason)) {
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
            if (checked.isEmpty()) {
                checked = verifiedSearchRecovery(hybridAnswer, request.getLang());
                recoveredFromGuard = checked.isPresent();
            }
            if (checked.isEmpty()) {
                checked = groundedCardRecovery(hybridAnswer, request.getLang());
                recoveredFromGuard = checked.isPresent();
            }
            if (recoveredFromGuard) {
                log.info("Bi answer recovered conversationId={} turn={} reason={} products={} scopeTotal={} priceRangeTotal={} disclosures={}",
                        conversation.getId(), conversation.getTurnCount(), guardReason,
                        guardDiagnostic.productCount(), guardDiagnostic.hasScopeTotal(),
                        guardDiagnostic.hasPriceRangeTotal(), guardDiagnostic.requiredDisclosureCount());
            } else {
                // Fixed structural diagnostics and conversation correlation only; never log
                // customer/assistant text, product identifiers, prices or PII.
                log.warn("Bi answer rejected conversationId={} turn={} reason={} products={} scopeTotal={} priceRangeTotal={} disclosures={}",
                        conversation.getId(), conversation.getTurnCount(), guardReason,
                        guardDiagnostic.productCount(), guardDiagnostic.hasScopeTotal(),
                        guardDiagnostic.hasPriceRangeTotal(), guardDiagnostic.requiredDisclosureCount());
            }
        }
        if (checked.isEmpty()) {
            return recoverableClarification(conversation, settings, request.getLang(), true);
        }
        ChatResponseGuard.CheckedAnswer safe = checked.get();
        Optional<ChatResponseGuard.CheckedAnswer> duplicateClarification = clarifyNearDuplicate(
                conversation, safe, request.getLang());
        boolean clarifiedDuplicate = duplicateClarification.isPresent();
        if (clarifiedDuplicate) safe = duplicateClarification.get();
        AiChatClient.Answer answer = recoveredFromGuard || clarifiedDuplicate
                ? new AiChatClient.Answer(safe.answer(), false, false, false)
                : hybridAnswer.answer();
        boolean handoff = applyConversationSignals(
                conversation, answer.offTopic(), answer.handoffRecommended());
        boolean leadPrompt = answer.leadPrompt()
                && !handoff
                && "NONE".equals(conversation.getLeadOfferStatus());
        if (leadPrompt) conversation.setLeadOfferStatus("OFFERED");
        saveAssistantMessage(
                conversation, safe.answer(), recoveredFromGuard || clarifiedDuplicate ? "TOOL" : hybridAnswer.source(),
                true, safe.products(), 0);
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
                || products.size() != Math.min(totals.currentTotalItems(), 3)
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

    /** Technical orchestration failures stay in chat and become a useful next question. */
    private ChatMessageResponse recoverableClarification(
            ChatConversationEntity conversation,
            ChatAssistantSettings.Snapshot settings,
            String lang,
            boolean aiCalled
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
                ? "I could not complete that lookup yet, but you can keep chatting here. "
                + "Please tell me the product name, product type or exact detail you want checked, and I will try again."
                : "Dạ, em chưa hoàn tất được lần tra này nhưng anh/chị vẫn có thể hỏi tiếp ngay tại đây. "
                + "Anh/chị cho em tên mẫu, loại hàng hoặc đúng chi tiết cần kiểm tra, em sẽ tra lại nhé.");
        log.warn("Bi recovered with clarification conversationId={} turn={}",
                conversation.getId(), conversation.getTurnCount());
        saveAssistantMessage(conversation, answer, "TOOL", aiCalled, List.of(), 0);
        conversationRepo.save(conversation);
        return aiResponse(conversation, settings, answer, List.of(), false, false, List.of());
    }

    private static boolean isRecoverableClarificationText(String value) {
        String normalized = ChatToolService.normalize(value == null ? "" : value);
        return normalized.contains("chua hoan tat duoc lan tra nay")
                || normalized.contains("could not complete that lookup yet");
    }

    private static String repeatedFallbackText(String lang) {
        return "en".equals(lang)
                ? "I still need a little more detail to help with this. Please tell me the product type, model or price range you want to check, and I will look at the products currently sold by BigBike."
                : "Dạ, em cần anh/chị cho em biết rõ loại hàng, tên mẫu hoặc tầm giá để kiểm tra đúng dữ liệu đang bán. Anh/chị nói thêm một chi tiết, em sẽ lọc lại mà không đoán thông tin nhé.";
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
                case PROVIDER_UNAVAILABLE -> "That lookup did not finish, but you can keep chatting here. Please send the product name or detail to check again; Talk to staff remains available if you need immediate help.";
                case SAFETY_REVIEW -> "I do not have enough confirmed detail to answer this part clearly, so I do not want to guess. Please choose Talk to staff; Hotline, Zalo and Messenger below can help you directly.";
                case STAFF_REVIEW -> "This request needs a BigBike staff review so no unsupported promise is made. Please choose Talk to staff; Hotline, Zalo and Messenger are available below for direct help.";
            };
        }
        return switch (cause) {
            case SERVICE_PAUSED -> "Dạ, em là Bi và kênh tư vấn tự động đang tạm nghỉ. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
            case DAILY_LIMIT -> "Dạ, em là Bi và đã dùng hết lượt tư vấn tự động trong hôm nay. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
            case SERVICE_NOT_READY -> "Dạ, em là Bi và kênh tư vấn tự động hiện chưa sẵn sàng. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.";
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
