package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatImageResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatImageUploadResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatImageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatImageJpaRepository;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatImageService {

    private static final Set<String> TERMINAL_WITHOUT_CONTENT =
            Set.of("REJECTED_UNSAFE", "DELETING", "DELETED");
    private static final int GROUP_SUGGESTION_LIMIT = 3;

    private final ChatImageJpaRepository imageRepo;
    @org.springframework.beans.factory.annotation.Autowired
    private com.bigbike.bigbike_backend.persistence.repository.chat.ChatVideoJpaRepository videoRepo;

    private final ChatConversationJpaRepository conversationRepo;
    private final ChatAssistantSettings assistantSettings;
    private final ChatImageStorageService storageService;
    private final ChatImageDailyQuotaService quotaService;
    private final ChatImageAnalysisClient analysisClient;
    private final CatalogReadService catalogReadService;
    private final ChatProductImageFingerprintService fingerprintService;
    @org.springframework.beans.factory.annotation.Autowired
    private ChatReceiptNotificationService receiptNotifications;
    private final tools.jackson.databind.ObjectMapper imageMapper = new tools.jackson.databind.ObjectMapper();

    @Transactional
    public ChatImageUploadResponse upload(
            UUID requestId,
            UUID conversationId,
            String lang,
            MultipartFile file,
            UUID customerId,
            UUID visitorId
    ) {
        if (requestId == null) {
            throw ValidationException.fromField(
                    "requestId", "CHAT_IMAGE_INVALID", "en".equals(lang) ? "Please try attaching the image again." : "Anh/chị chọn lại ảnh để gửi nhé.");
        }
        if (videoRepo != null && videoRepo.findByRequestId(requestId).isPresent()) {
            throw ChatVideoErrors.invalid("CHAT_MEDIA_EXCLUSIVE", lang);
        }
        Optional<ChatImageEntity> replay = imageRepo.findByRequestId(requestId);
        if (replay.isPresent()) {
            ChatImageEntity existing = replay.get();
            requireOwner(existing.getConversationId(), customerId, visitorId);
            return new ChatImageUploadResponse(existing.getConversationId(), toResponse(existing));
        }
        ChatConversationEntity conversation = conversationId == null
                ? createConversation(customerId, visitorId, lang)
                : requireOwnerForUpdate(conversationId, customerId, visitorId);
        int conversationLimit = assistantSettings.imageSettings().conversationLimit();
        if (imageRepo.countByConversationIdAndStatusNot(conversation.getId(), "DELETED")
                >= conversationLimit) {
            throw ValidationException.fromField(
                    "file", "CHAT_IMAGE_CONVERSATION_LIMIT",
                    ("en".equals(lang) ? "This conversation has reached its limit of " + conversationLimit + " images. You can keep describing the item in text." : "Hội thoại này đã đủ " + conversationLimit + " ảnh. Anh/chị vẫn có thể mô tả thêm bằng chữ nhé."));
        }

        ChatImageEntity image = new ChatImageEntity();
        // Leave the identifier to @GeneratedValue. Assigning it here made Spring Data treat a brand
        // new row as detached and call merge(); Hibernate then found no row and threw a stale-state
        // error, so every customer image upload failed with 409 CONCURRENT_MODIFICATION.
        image.setRequestId(requestId);
        image.setConversationId(conversation.getId());
        image.setStatus("PENDING");
        image.setExpiresAt(conversation.getExpiresAt());
        // requestId is unique per upload, so it is a stable object key without needing the row id.
        ChatImageStorageService.StoredImage stored = storageService.store(
                conversation.getId(), requestId, file);
        registerRollbackCleanup(stored);
        try {
            image.setStorageBucket(stored.bucket());
            image.setStorageObjectKey(stored.objectKey());
            image.setMimeType(stored.mimeType());
            image.setWidth(stored.width());
            image.setHeight(stored.height());
            image.setSizeBytes(stored.sizeBytes());
            image.setSha256(stored.sha256());
            image = imageRepo.saveAndFlush(image);
            return new ChatImageUploadResponse(conversation.getId(), toResponse(image));
        } catch (RuntimeException exception) {
            storageService.delete(stored.bucket(), stored.objectKey());
            throw exception;
        }
    }

    public Instant deadline(List<UUID> ids, UUID conversationId, UUID customerId, UUID visitorId,
            UUID existingMessageId) {
        var conversation = requireOwner(conversationId, customerId, visitorId);
        return requireTurnImages(conversation, existingMessageId, ids).stream()
                .map(ChatImageEntity::getAnalysisDeadlineAt).filter(java.util.Objects::nonNull)
                .min(Instant::compareTo).orElse(Instant.now().plusSeconds(65));
    }

    public void validateTurn(ChatConversationEntity conversation, UUID existingMessageId, List<UUID> ids) {
        requireTurnImages(conversation, existingMessageId, ids);
    }

    @Transactional
    public void moveToContinuation(List<UUID> ids, UUID previousId, UUID successorId) {
        for (UUID id : ids) {
            var image = imageRepo.findById(id).orElseThrow(() -> new NotFoundException("Image not found"));
            if (!previousId.equals(image.getConversationId()) || image.getCustomerMessageId() != null)
                throw new NotFoundException("Image not found");
            image.setConversationId(successorId);
            imageRepo.save(image);
        }
    }

    public ImageTurnResult processTurn(
            ChatConversationEntity conversation, UUID customerMessageId, List<UUID> imageIds,
            String caption, String lang) {
        List<ChatImageEntity> images = requireTurnImages(conversation, customerMessageId, imageIds);
        Instant deadline = images.stream().map(ChatImageEntity::getAnalysisDeadlineAt)
                .filter(java.util.Objects::nonNull).min(Instant::compareTo).orElse(ChatTurnBudget.deadlineOr(Instant.now().plusSeconds(65)));
        for (int i = 0; i < images.size(); i++) {
            ChatImageEntity image = images.get(i);
            image.setCustomerMessageId(customerMessageId);
            image.setAttachmentPosition(i);
            image.setAnalysisDeadlineAt(deadline);
            if (image.getAnalysisJson() == null) image.setStatus("ATTACHED");
            imageRepo.saveAndFlush(image);
        }
        var reservation = quotaService.reserveImages(imageIds, assistantSettings.imageSettings().dailyLimit());
        List<ChatImageEntity> accepted = images.stream().filter(image -> reservation.imageIds().contains(image.getId())).toList();
        for (var image : images) {
            if (accepted.contains(image)) {
                // The reservation transaction already wrote this; keep detached JPA state in sync.
                if (image.getQuotaReservedOn() == null) image.setQuotaReservedOn(reservation.date());
            } else image.setStatus("LIMIT_SKIPPED");
            imageRepo.save(image);
        }
        if (accepted.isEmpty()) return limitResult(lang, "DAILY_LIMIT");
        List<Product> catalog = catalogReadService.listAssistantDecisionProducts(lang);
        CatalogContext context = catalogContext(catalog);
        List<ChatImageEntity> fresh = accepted.stream().filter(image -> image.getAnalysisJson() == null).toList();
        Map<UUID, ChatImageStorageService.StoredContent> contents = new LinkedHashMap<>();
        for (var image : fresh) {
            image.setStatus("PROCESSING");
            imageRepo.saveAndFlush(image);
            try {
                contents.put(image.getId(), readForAnalysis(image));
            } catch (RuntimeException failure) {
                markFailed(fresh);
                return partialResult(technicalFailure(lang), accepted.size(), images.size(), lang);
            }
        }
        List<ChatImageAnalysisClient.ImageAnalysis> analyzed = List.of();
        if (!fresh.isEmpty()) {
            if (!deadline.isAfter(Instant.now())) { markFailed(fresh); return partialResult(technicalFailure(lang), accepted.size(), images.size(), lang); }
            Optional<List<ChatImageAnalysisClient.ImageAnalysis>> result;
            if (fresh.size() == 1) {
                var content = contents.get(fresh.get(0).getId());
                result = analysisClient.analyze(content.bytes(), content.mimeType(), caption,
                        context.candidates(), context.groups()).analysis().map(List::of);
            } else {
                result = analysisClient.analyzeBatch(fresh.stream().map(image -> {
                    var content = contents.get(image.getId());
                    return new ChatImageAnalysisClient.ImageInput(content.bytes(), content.mimeType());
                }).toList(), caption, context.candidates(), context.groups()).analyses();
            }
            if (result.isEmpty()) { markFailed(fresh); return partialResult(technicalFailure(lang), accepted.size(), images.size(), lang); }
            analyzed = result.get();
            for (int i = 0; i < fresh.size(); i++) {
                var image = fresh.get(i);
                var observation = analyzed.get(i);
                if (!"PRODUCT_SEARCH".equals(observation.intent()) || observation.unsafe()) {
                    observation = new ChatImageAnalysisClient.ImageAnalysis(observation.intent(), "UNKNOWN", "LOW", List.of(), observation.unsafe());
                } else {
                    String canonicalGroup = context.canonicalGroup(observation.group());
                    observation = new ChatImageAnalysisClient.ImageAnalysis(observation.intent(),
                            canonicalGroup == null ? "UNKNOWN" : canonicalGroup, observation.confidence(),
                            observation.candidateSlugs().stream().filter(context.productsBySlug()::containsKey).toList(),
                            false, observation.brand(), observation.brandRole(), observation.brandConfidence());
                }
                image.setAnalysisJson(imageMapper.writeValueAsString(observation));
                imageRepo.save(image);
            }
        }
        List<ImageTurnResult> outcomes = new ArrayList<>();
        List<ChatImageEvidence.Choice> choices = new ArrayList<>();
        boolean unsafe = false;
        boolean receipt = false;
        for (var image : accepted) {
            var analysis = imageMapper.readValue(image.getAnalysisJson(), ChatImageAnalysisClient.ImageAnalysis.class);
            if (analysis.unsafe()) {
                image.setStatus("REJECTED_UNSAFE");
                image.setSafetyCode("PROVIDER_SAFETY");
                image.setAnalysisJson(null);
                imageRepo.saveAndFlush(image);
                try { storageService.delete(image.getStorageBucket(), image.getStorageObjectKey()); image.setDeletedAt(Instant.now()); }
                catch (RuntimeException failure) { log.warn("chat_image_unsafe_delete_failed type={}", failure.getClass().getSimpleName()); }
                imageRepo.save(image);
                unsafe = true;
                continue;
            }
            var comparison = ChatProductImageFingerprintService.VisualComparison.empty();
            if ("PRODUCT_SEARCH".equals(analysis.intent()) || "UNKNOWN".equals(analysis.intent())) {
                try {
                    var content = contents.get(image.getId());
                    if (content == null) content = readForAnalysis(image);
                    comparison = fingerprintService.compare(content.bytes(), image.getSha256(), context.products());
                } catch (RuntimeException failure) { log.warn("chat_product_fingerprint_match_failed type={}", failure.getClass().getSimpleName()); }
            }
            String intent = "BANK_TRANSFER_RECEIPT".equals(analysis.intent()) ? analysis.intent()
                    : resolveIntent(analysis.intent(), caption, comparison.strictMatch().isPresent());
            analysis = evidenceBoundAnalysis(analysis, comparison.strictMatch(), context);
            // Group and manufacturer confidence are independent. A guess must not become a claim.
            if ("LOW".equals(analysis.confidence())) analysis = new ChatImageAnalysisClient.ImageAnalysis(
                    analysis.intent(), "UNKNOWN", analysis.confidence(), analysis.candidateSlugs(), analysis.unsafe(),
                    analysis.brand(), analysis.brandRole(), analysis.brandConfidence());
            image.setIntentCode(intent);
            image.setStatus("UNKNOWN".equals(intent) ? "UNRECOGNIZED" : "READY");
            imageRepo.save(image);
            if ("BANK_TRANSFER_RECEIPT".equals(intent)) { receipt = true; continue; }
            ImageTurnResult outcome = imageWording(resultFor(intent, analysis, context, comparison.rankedSlugs(), lang), intent, analysis, lang);
            if ("PRODUCT_SEARCH".equals(intent)) {
                ChatImageEvidence evidence = imageEvidence(analysis, context);
                String question = ChatToolService.normalize(caption == null ? "" : caption);
                if (evidence.brandName() != null && containsAny(question, "thuong hieu", "hang nay", "this brand", "brand products"))
                    evidence = new ChatImageEvidence(null, evidence.brand(), evidence.brandName(), evidence.matchedSlugs());
                if (evidence.brandName() != null) outcome = brandResult(evidence, context, lang);
                outcome = outcome.withEvidence(evidence);
                choices.add(new ChatImageEvidence.Choice(image.getAttachmentPosition() + 1, evidence.group(),
                        evidence.brand(), evidence.brandName(), evidence.matchedSlugs()));
            }
            outcomes.add(outcome);
        }
        if (unsafe) return partialResult(unsafeResult(lang), accepted.size(), images.size(), lang);
        if (receipt) {
            try {
                receiptNotifications.receive(conversation.getId(), customerMessageId);
                return partialResult(new ImageTurnResult("en".equals(lang)
                        ? "I’ve sent your transfer receipt to the shop for checking. The shop will confirm the payment after checking its bank records."
                        : "Em đã chuyển ảnh biên lai cho shop kiểm tra. Shop sẽ xác nhận thanh toán sau khi đối chiếu tài khoản ngân hàng.",
                        ChatMessageSource.TOOL, "ANSWER", List.of(), true, false), accepted.size(), images.size(), lang);
            } catch (RuntimeException failure) {
                return partialResult(new ImageTurnResult("en".equals(lang)
                        ? "I couldn’t notify the shop this time. Please contact BigBike through the options below so the team can check your transfer."
                        : "Em chưa báo được cho shop lần này. Anh/chị liên hệ qua các kênh bên dưới để shop kiểm tra khoản chuyển giúp mình nhé.",
                        ChatMessageSource.CONTACT_FALLBACK, "CONTACT", List.of(), true, false), accepted.size(), images.size(), lang);
            }
        }
        var terminal = outcomes.stream().filter(outcome -> !outcome.continuesToText()).findFirst();
        if (terminal.isPresent()) return partialResult(terminal.get(), accepted.size(), images.size(), lang);
        List<String> brands = choices.stream().map(ChatImageEvidence.Choice::brandName).filter(java.util.Objects::nonNull).distinct().toList();
        List<String> groups = choices.stream().map(ChatImageEvidence.Choice::group).filter(java.util.Objects::nonNull).distinct().toList();
        List<String> matches = choices.stream().flatMap(choice -> choice.matchedSlugs().stream()).distinct().toList();
        if (brands.size() > 1 || groups.size() > 1 || matches.size() > 1) {
            return partialResult(new ImageTurnResult("en".equals(lang) ? "These images show different items. Which image would you like help with?"
                    : "Các ảnh đang chỉ tới những món khác nhau. Anh/chị muốn em tư vấn món ở ảnh nào?",
                    ChatMessageSource.TOOL, "CLARIFICATION", List.of(), true, false,
                    new ChatImageEvidence(null, null, null, List.of(), choices, UUID.randomUUID())), accepted.size(), images.size(), lang);
        }
        ImageTurnResult best = outcomes.stream().filter(outcome -> outcome.evidence() != null && outcome.evidence().brandName() != null)
                .findFirst().orElseGet(() -> outcomes.stream().filter(outcome -> !outcome.products().isEmpty()).findFirst()
                        .orElseGet(() -> outcomes.isEmpty() ? imageWording(unknownResult(lang, true), "UNKNOWN", null, lang) : outcomes.get(0)));
        if (!choices.isEmpty()) {
            ChatImageEvidence merged = new ChatImageEvidence(groups.isEmpty() ? null : groups.get(0),
                    choices.stream().map(ChatImageEvidence.Choice::brand).filter(java.util.Objects::nonNull).findFirst().orElse(null),
                    brands.isEmpty() ? null : brands.get(0), matches);
            if (merged.brandName() != null) best = brandResult(merged, context, lang);
            best = best.withEvidence(merged);
        }
        return partialResult(best, accepted.size(), images.size(), lang);
    }

    private static ImageTurnResult partialResult(ImageTurnResult result, int read, int sent, String lang) {
        if (read >= sent) return result;
        String notice = "en".equals(lang) ? "Today’s remaining allowance covered " + read + " of your " + sent + " images; the rest have not been read. "
                : "Hôm nay chỉ còn đủ lượt xem " + read + "/" + sent + " ảnh; các ảnh còn lại chưa được đọc. ";
        return new ImageTurnResult(notice + result.answer(), result.source(), result.resultKind(), result.products(),
                result.analyzed(), result.continuesToText(), result.evidence());
    }

    private List<ChatImageEntity> requireTurnImages(ChatConversationEntity conversation, UUID messageId, List<UUID> ids) {
        if (ids == null || ids.isEmpty() || ids.size() > ChatAssistantSettings.IMAGE_TURN_LIMIT
                || ids.stream().anyMatch(java.util.Objects::isNull) || new LinkedHashSet<>(ids).size() != ids.size()) {
            throw ValidationException.fromField("imageIds", "CHAT_IMAGE_TURN_LIMIT", "Mỗi lượt gửi tối đa 3 ảnh khác nhau. / Send up to 3 different images.");
        }
        List<ChatImageEntity> images = new ArrayList<>();
        for (UUID id : ids) {
            var image = imageRepo.findById(id).filter(item -> item.getConversationId().equals(conversation.getId()))
                    .filter(item -> !TERMINAL_WITHOUT_CONTENT.contains(item.getStatus()) && item.getDeletedAt() == null)
                    .filter(item -> item.getExpiresAt() == null || item.getExpiresAt().isAfter(Instant.now()))
                    .filter(item -> item.getCustomerMessageId() == null || item.getCustomerMessageId().equals(messageId))
                    .orElseThrow(() -> new NotFoundException("Image not found"));
            if (image.getCustomerMessageId() != null && image.getAttachmentPosition() != images.size()) {
                throw ValidationException.fromField("imageIds", "CHAT_IMAGE_INVALID", "Giữ nguyên thứ tự ảnh khi gửi lại. / Keep the image order when retrying.");
            }
            images.add(image);
        }
        return images;
    }

    private static ImageTurnResult imageWording(ImageTurnResult value, String intent,
            ChatImageAnalysisClient.ImageAnalysis analysis, String lang) {
        boolean en = "en".equals(lang);
        String answer = switch (intent) {
            case "DAMAGED_PRODUCT" -> en
                    ? "I’ve received the photo. The shop needs to check the item before deciding on warranty cover. Please contact the team through the options below."
                    : "Em đã nhận ảnh. Shop cần kiểm tra món hàng trước khi xác nhận bảo hành. Anh/chị liên hệ qua các kênh bên dưới để được hỗ trợ nhé.";
            case "SIZE_FROM_PERSON" -> en
                    ? "A photo cannot tell me your helmet size. Please measure around the widest part of your head with a tape, then check the model’s size chart. I can help you find that chart."
                    : "Ảnh chưa cho biết size mũ phù hợp. Anh/chị dùng thước dây đo quanh phần rộng nhất của đầu, rồi đối chiếu bảng size của mẫu mũ nhé. Em có thể giúp tìm bảng size.";
            case "ORDER_DOCUMENT" -> en
                    ? "Please open your order history or use the order details BigBike sent you to look it up. I can’t verify an order from this image alone."
                    : "Anh/chị mở Lịch sử đơn hàng hoặc dùng thông tin BigBike đã gửi để tra đơn nhé. Em chưa thể xác minh đơn chỉ từ ảnh này.";
            case "UNRELATED" -> en
                    ? "This image is outside the help I can offer. I can help you choose motorcycle gear or answer questions about BigBike orders and policies."
                    : "Ảnh này nằm ngoài phần em có thể hỗ trợ. Em có thể giúp chọn đồ bảo hộ hoặc giải đáp về đơn hàng và chính sách của BigBike nhé.";
            case "PRODUCT_SEARCH" -> {
                if (value.products().size() == 1 && !analysis.candidateSlugs().isEmpty()) yield en
                        ? "The item looks similar to " + value.products().get(0).name() + ". Open the model below to compare the details."
                        : "Món trong ảnh trông giống " + value.products().get(0).name() + ". Anh/chị mở mẫu bên dưới để xem chi tiết nhé.";
                if (!"UNKNOWN".equals(analysis.group()) && value.products().isEmpty()) yield en
                        ? "This looks like " + analysis.group() + ". There are no available models in this group at the moment. Please contact the shop through the options below."
                        : "Đây là " + analysis.group() + ". Các mẫu cùng loại hiện chưa có hàng. Anh/chị liên hệ shop qua các kênh bên dưới nhé.";
                if (!"UNKNOWN".equals(analysis.group()) && !value.products().isEmpty()) yield en
                        ? "This looks like " + analysis.group() + ". I haven’t identified the exact model; here are some options in this group."
                        : "Đây là " + analysis.group() + ". Em chưa xác định được mẫu cụ thể; anh/chị xem các mẫu cùng loại bên dưới nhé.";
                yield en ? "I haven’t identified the item yet. Please describe it or send a clearer view so I can help you find it."
                        : "Em chưa nhận ra món trong ảnh. Anh/chị mô tả thêm hoặc gửi góc chụp rõ hơn để em tìm giúp nhé.";
            }
            default -> "UNKNOWN".equals(intent) ? (en
                    ? "I haven’t identified the item yet. Please describe it so I can help you find it."
                    : "Em chưa nhận ra món trong ảnh. Anh/chị mô tả thêm để em tìm giúp nhé.") : value.answer();
        };
        return new ImageTurnResult(answer, value.source(), value.resultKind(), value.products(), value.analyzed(), value.continuesToText(), value.evidence());
    }

    private ChatImageStorageService.StoredContent readForAnalysis(ChatImageEntity image) {
        ChatTurnBudget.checkTime();
        try {
            return storageService.read(image.getStorageBucket(), image.getStorageObjectKey(), image.getMimeType());
        } catch (RuntimeException firstFailure) {
            ChatTurnBudget.checkTime();
            return storageService.read(image.getStorageBucket(), image.getStorageObjectKey(), image.getMimeType());
        }
    }

    private void markFailed(List<ChatImageEntity> images) {
        for (var image : images) { image.setStatus("ANALYSIS_FAILED"); image.setIntentCode("UNKNOWN"); imageRepo.save(image); }
    }

    private static ImageTurnResult technicalFailure(String lang) {
        return new ImageTurnResult("en".equals(lang)
                ? "Sorry, I couldn’t read the images this time. Please describe the item and I’ll help you find it."
                : "Em xin lỗi, lần này chưa đọc được ảnh. Anh/chị mô tả món cần tìm để em hỗ trợ tiếp nhé.",
                ChatMessageSource.PROVIDER_UNAVAILABLE, "CLARIFICATION", List.of(), false, true);
    }

    public long imageUsageOn(java.time.LocalDate date) { return quotaService.usedOn(date); }

    private ChatImageEvidence imageEvidence(ChatImageAnalysisClient.ImageAnalysis analysis, CatalogContext context) {
        String groupName = "LOW".equals(analysis.confidence()) ? null : context.canonicalGroup(analysis.group());
        String group = groupName == null ? null : context.products().stream()
                .flatMap(product -> java.util.stream.Stream.concat(java.util.stream.Stream.of(product.category()),
                        product.categories() == null ? java.util.stream.Stream.empty() : product.categories().stream()))
                .filter(java.util.Objects::nonNull).filter(category -> groupName.equals(category.name()))
                .map(com.bigbike.bigbike_backend.domain.catalog.CategorySummary::slug).filter(java.util.Objects::nonNull)
                .findFirst().orElse(null);
        String observed = "PRODUCT".equals(analysis.brandRole()) && "HIGH".equals(analysis.brandConfidence())
                && analysis.brand() != null && !"UNKNOWN".equals(analysis.brand())
                && !Set.of("bigbike", "youtube", "facebook", "tiktok", "instagram").contains(normalizeBrand(analysis.brand()))
                ? analysis.brand() : null;
        String brand = null;
        if (observed != null) {
            String value = normalizeBrand(observed);
            var match = context.products().stream().map(Product::brand).filter(java.util.Objects::nonNull)
                    .filter(item -> value.equals(normalizeBrand(item.name())) || value.equals(normalizeBrand(item.slug())))
                    .findFirst();
            if (match.isPresent()) { brand = match.get().slug(); observed = match.get().name(); }
        }
        return new ChatImageEvidence(group, brand, observed, analysis.candidateSlugs());
    }

    private static String normalizeBrand(String value) {
        return value == null ? "" : java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private ImageTurnResult brandResult(ChatImageEvidence evidence, CatalogContext context, String lang) {
        boolean english = "en".equals(lang);
        List<Product> brandProducts = context.products().stream().filter(product -> product.brand() != null
                && evidence.brand() != null && evidence.brand().equals(product.brand().slug())).toList();
        List<Product> products = brandProducts.stream().filter(product -> evidence.group() == null || java.util.stream.Stream.concat(
                        java.util.stream.Stream.of(product.category()), product.categories() == null ? java.util.stream.Stream.empty() : product.categories().stream())
                        .filter(java.util.Objects::nonNull).anyMatch(category -> evidence.group().equals(category.slug()))).toList();
        List<ChatProductCardResponse> cards = products.stream().sorted(ChatToolService.decisionProductComparator()).map(ChatToolService::toCard)
                .filter(card -> "IN_STOCK".equals(card.stockState())).limit(8).toList();
        String answer;
        if (brandProducts.isEmpty()) answer = english ? "I can see the " + evidence.brandName() + " brand. BigBike does not currently sell this brand. Would you like similar options from the brands we carry?"
                : "Em thấy thương hiệu " + evidence.brandName() + ". Hiện BigBike chưa kinh doanh hãng này. Anh/chị muốn xem sản phẩm tương đương từ các hãng bên em đang bán không?";
        else if (products.isEmpty()) answer = english ? "BigBike carries " + evidence.brandName() + ", but we do not currently have products of this type from that brand. Would you like other options?"
                : "BigBike có bán " + evidence.brandName() + ", nhưng hiện chưa có loại hàng này của hãng. Anh/chị muốn xem lựa chọn khác không?";
        else if (cards.isEmpty()) answer = english ? "BigBike carries " + evidence.brandName() + ", but its models are currently out of stock. Please contact the shop through the options below."
                : "BigBike có bán " + evidence.brandName() + ", nhưng các mẫu hiện đang tạm hết hàng. Anh/chị liên hệ shop qua các kênh bên dưới nhé.";
        else answer = english ? "I can see the " + evidence.brandName() + " brand. These are the models BigBike currently has available."
                : "Em thấy thương hiệu " + evidence.brandName() + ". Anh/chị xem các mẫu của hãng đang có hàng bên dưới nhé.";
        return new ImageTurnResult(answer, ChatMessageSource.TOOL, cards.isEmpty() ? "ANSWER" : "PRODUCT_RESULTS", cards, true, true, evidence);
    }

    static ChatImageAnalysisClient.ImageAnalysis evidenceBoundAnalysis(
            ChatImageAnalysisClient.ImageAnalysis provider,
            Optional<ChatProductImageFingerprintService.VisualMatch> visualMatch,
            CatalogContext context
    ) {
        if (visualMatch.isEmpty()) {
            // A model name inferred from branding/OCR is not enough evidence to claim a catalog
            // match. Keep only the recognized group and discard every provider-selected slug.
            return new ChatImageAnalysisClient.ImageAnalysis(
                    provider.intent(), provider.group(), provider.confidence(), List.of(),
                    provider.unsafe(), provider.brand(), provider.brandRole(), provider.brandConfidence());
        }
        String slug = visualMatch.get().slug();
        Product matched = context.productsBySlug().get(slug);
        if (matched == null) {
            return new ChatImageAnalysisClient.ImageAnalysis(
                    provider.intent(), provider.group(), provider.confidence(), List.of(),
                    provider.unsafe(), provider.brand(), provider.brandRole(), provider.brandConfidence());
        }
        String group = provider.group();
        if (context.canonicalGroup(group) == null && matched.category() != null) {
            group = matched.category().name();
        }
        return new ChatImageAnalysisClient.ImageAnalysis(
                provider.intent(), group, "HIGH", List.of(slug), provider.unsafe(), provider.brand(), provider.brandRole(), provider.brandConfidence());
    }

    @Transactional(readOnly = true)
    public ChatImageStorageService.StoredContent customerContent(
            UUID imageId, UUID customerId, UUID visitorId) {
        ChatImageEntity image = requireReadableImage(imageId);
        requireOwner(image.getConversationId(), customerId, visitorId);
        return storageService.read(
                image.getStorageBucket(), image.getStorageObjectKey(), image.getMimeType());
    }

    @Transactional(readOnly = true)
    public ChatImageStorageService.StoredContent adminContent(UUID imageId) {
        ChatImageEntity image = requireReadableImage(imageId);
        return storageService.read(
                image.getStorageBucket(), image.getStorageObjectKey(), image.getMimeType());
    }

    @Transactional(readOnly = true)
    public Map<UUID, List<ChatImageResponse>> referencesByMessageIds(Collection<UUID> messageIds) {
        if (messageIds == null || messageIds.isEmpty()) return Map.of();
        return imageRepo.findByCustomerMessageIdInOrderByCreatedAtAsc(messageIds).stream()
                .filter(item -> item.getCustomerMessageId() != null)
                .filter(item -> item.getDeletedAt() == null)
                .filter(item -> !TERMINAL_WITHOUT_CONTENT.contains(item.getStatus()))
                .sorted(Comparator.comparingInt(ChatImageEntity::getAttachmentPosition))
                .collect(Collectors.groupingBy(
                        ChatImageEntity::getCustomerMessageId,
                        LinkedHashMap::new,
                        Collectors.mapping(this::toResponse, Collectors.toList())));
    }

    public boolean deleteForConversations(Collection<UUID> conversationIds) {
        if (conversationIds == null || conversationIds.isEmpty()) return true;
        List<ChatImageEntity> images = imageRepo.findByConversationIds(conversationIds);
        for (ChatImageEntity image : images) {
            if (!deleteOne(image)) {
                log.warn("chat_image_delete_failed imageId={} type={}",
                        image.getId(), "STORAGE_FAILURE");
                return false;
            }
        }
        imageRepo.deleteAll(images);
        return true;
    }

    public int deleteExpiredImages(Instant cutoff) {
        Instant now = cutoff == null ? Instant.now() : cutoff;
        Map<UUID, ChatImageEntity> candidates = new LinkedHashMap<>();
        imageRepo.findByExpiresAtBeforeOrderByExpiresAtAsc(now)
                .forEach(image -> candidates.put(image.getId(), image));
        imageRepo.findByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(
                        "PENDING", now.minusSeconds(3600))
                .forEach(image -> candidates.put(image.getId(), image));
        imageRepo.findByStatusInAndDeletedAtIsNullOrderByCreatedAtAsc(
                        List.of("REJECTED_UNSAFE", "DELETING"))
                .forEach(image -> candidates.put(image.getId(), image));
        int deleted = 0;
        for (ChatImageEntity image : candidates.values()) {
            if (!deleteOne(image)) continue;
            imageRepo.delete(image);
            deleted++;
        }
        return deleted;
    }

    private boolean deleteOne(ChatImageEntity image) {
        if (image.getDeletedAt() != null || "DELETED".equals(image.getStatus())) return true;
        try {
            image.setStatus("DELETING");
            imageRepo.save(image);
            storageService.delete(image.getStorageBucket(), image.getStorageObjectKey());
            image.setDeletedAt(Instant.now());
            image.setStatus("DELETED");
            imageRepo.save(image);
            return true;
        } catch (RuntimeException exception) {
            log.warn("chat_image_object_delete_failed imageId={} type={}",
                    image.getId(), exception.getClass().getSimpleName());
            return false;
        }
    }

    private void registerRollbackCleanup(ChatImageStorageService.StoredImage stored) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == TransactionSynchronization.STATUS_COMMITTED) return;
                try {
                    storageService.delete(stored.bucket(), stored.objectKey());
                } catch (RuntimeException exception) {
                    log.warn("chat_image_rollback_cleanup_failed type={}",
                            exception.getClass().getSimpleName());
                }
            }
        });
    }

    private ImageTurnResult resultFor(
            String intent,
            ChatImageAnalysisClient.ImageAnalysis analysis,
            CatalogContext context,
            List<String> rankedSlugs,
            String lang
    ) {
        boolean english = "en".equals(lang);
        return switch (intent) {
            case "DAMAGED_PRODUCT" -> new ImageTurnResult(
                    english
                            ? "I’ve recorded the damaged-product image. I cannot decide warranty eligibility from an image; please contact BigBike through Hotline, Zalo or Messenger for help."
                            : "Em đã ghi nhận ảnh sản phẩm bị lỗi/hỏng. Em không tự kết luận bảo hành chỉ từ ảnh; anh/chị vui lòng liên hệ BigBike qua Hotline, Zalo hoặc Messenger để được hỗ trợ.",
                    ChatMessageSource.CONTACT_FALLBACK, "CONTACT", List.of(), true, false);
            case "ORDER_DOCUMENT" -> new ImageTurnResult(
                    english
                            ? "I cannot use numbers or text in this image to confirm an order. Please sign in and open your order history, or use BigBike’s order lookup with the original order details."
                            : "Em không dùng số hoặc chữ trên ảnh để khẳng định thông tin đơn. Anh/chị vui lòng đăng nhập xem Lịch sử đơn hàng, hoặc tra đơn bằng thông tin gốc đã nhận từ BigBike.",
                    ChatMessageSource.TOOL, "ANSWER", List.of(), true, false);
            case "SIZE_FROM_PERSON" -> new ImageTurnResult(
                    english
                            ? "I cannot estimate a helmet size from a head or body photo. Please use a measuring tape around the widest part of your head, then compare that measurement with the product’s saved size chart. You can also contact BigBike through Hotline, Zalo or Messenger."
                            : "Em không đoán size mũ từ ảnh đầu hoặc ảnh người. Anh/chị cần dùng thước dây đo vòng qua phần rộng nhất của đầu, rồi đối chiếu bảng size đã lưu của từng mẫu. Anh/chị cũng có thể liên hệ BigBike qua Hotline, Zalo hoặc Messenger.",
                    ChatMessageSource.TOOL, "ANSWER", List.of(), true, false);
            case "UNRELATED" -> new ImageTurnResult(
                    english
                            ? "I cannot help analyze this image. I can assist with BigBike products, protective gear, orders and published shop policies."
                            : "Em chưa thể hỗ trợ phân tích ảnh này. Em có thể giúp về sản phẩm, đồ bảo hộ, đơn hàng và chính sách đã công bố của BigBike.",
                    ChatMessageSource.OUT_OF_SCOPE, "REFUSAL", List.of(), true, false);
            case "PRODUCT_SEARCH" -> productResult(analysis, context, rankedSlugs, lang);
            default -> unknownResult(lang, true);
        };
    }

    ImageTurnResult videoResult(String intent, ChatImageAnalysisClient.ImageAnalysis analysis,
            CatalogContext context, List<String> rankedSlugs, String lang) {
        if ("PRODUCT_SEARCH".equals(intent)) return productResult(analysis, context, rankedSlugs, lang, true);
        ImageTurnResult result = resultFor(intent, analysis, context, rankedSlugs, lang);
        // Non-product templates contain no catalog names; change only the media noun.
        String answer = result.answer().replace("an image", "a video").replace("image", "video")
                .replace("a head or body photo", "a video of a person").replace("ảnh", "video");
        return new ImageTurnResult(answer, result.source(), result.resultKind(), result.products(),
                result.analyzed(), result.continuesToText());
    }

    private ImageTurnResult productResult(ChatImageAnalysisClient.ImageAnalysis analysis,
            CatalogContext context, List<String> rankedSlugs, String lang) {
        return productResult(analysis, context, rankedSlugs, lang, false);
    }

    private ImageTurnResult productResult(
            ChatImageAnalysisClient.ImageAnalysis analysis,
            CatalogContext context,
            List<String> rankedSlugs,
            String lang, boolean video
    ) {
        boolean english = "en".equals(lang);
        Map<String, Product> bySlug = context.productsBySlug();
        List<ChatProductCardResponse> matched = analysis.candidateSlugs().stream()
                .map(bySlug::get)
                .filter(java.util.Objects::nonNull)
                .map(ChatToolService::toCard)
                .filter(card -> "IN_STOCK".equals(card.stockState()))
                .distinct()
                .limit(3)
                .toList();
        String group = context.canonicalGroup(analysis.group());
        if (group == null && !matched.isEmpty()) {
            Product product = bySlug.get(matched.get(0).slug());
            group = product == null || product.category() == null ? null : product.category().name();
        }
        if ("HIGH".equals(analysis.confidence()) && matched.size() == 1) {
            ChatProductCardResponse card = matched.get(0);
            String answer = english
                    ? (video ? "The product in this video looks similar to " : "This image looks similar to ") + card.name()
                            + ", which BigBike currently sells. This is visual similarity only, not confirmation that it is the same product; please open the model below to compare it yourself."
                    : (video ? "Sản phẩm trong video trông giống mẫu " : "Ảnh này trông giống mẫu ") + card.name()
                            + " bên em đang bán. Đây chỉ là mức độ giống qua hình, không phải khẳng định cùng một sản phẩm; anh/chị vui lòng mở mẫu bên dưới để tự đối chiếu.";
            return new ImageTurnResult(
                    answer, ChatMessageSource.TOOL, "PRODUCT_RESULTS", List.of(card), true, true);
        }
        String resolvedGroup = group;
        List<ChatProductCardResponse> groupCards = groupSuggestions(context, resolvedGroup, rankedSlugs);
        if (resolvedGroup != null) {
            String answer = english
                    ? "I can recognize this as likely belonging to the " + resolvedGroup
                            + " group, but I cannot identify a specific model reliably. The currently sold models below are for you to compare; I am not claiming any is the same product."
                    : (video ? "Em nhận ra sản phẩm trong video có vẻ thuộc nhóm " : "Em nhận ra ảnh có vẻ thuộc nhóm ") + resolvedGroup
                            + " nhưng chưa xác định đáng tin cậy được mẫu cụ thể. Các mẫu cùng nhóm đang bán bên dưới để anh/chị tự đối chiếu; em không khẳng định mẫu nào là cùng sản phẩm.";
            return new ImageTurnResult(
                    answer, ChatMessageSource.TOOL, groupCards.isEmpty() ? "ANSWER" : "PRODUCT_RESULTS",
                    groupCards, true, true);
        }
        if (video) return videoResult("UNKNOWN", analysis, context, rankedSlugs, lang);
        return unknownResult(lang, true);
    }

    /**
     * Owner decision 2026-09-07: the three "same group" models must mean something to the customer.
     * They used to be the first three in-stock products of the category in slug order, so every
     * full-face helmet photo produced the same three cards. Now the models this photo actually
     * looks most like come first — the scores are already computed while searching for a match —
     * and any remaining slot is filled from what the shop itself puts forward
     * ({@link ChatToolService#representativeProducts}: pinned to the homepage first, then closest
     * to the group's median price). Similarity ordering only; nothing here claims a match.
     */
    private static List<ChatProductCardResponse> groupSuggestions(
            CatalogContext context,
            String group,
            List<String> rankedSlugs
    ) {
        if (group == null) return List.of();
        List<Product> inGroup = context.products().stream()
                .filter(product -> java.util.stream.Stream.concat(java.util.stream.Stream.of(product.category()),
                        product.categories() == null ? java.util.stream.Stream.empty() : product.categories().stream())
                        .filter(java.util.Objects::nonNull)
                        .anyMatch(category -> group.equalsIgnoreCase(category.name())))
                .filter(product -> "IN_STOCK".equals(ChatToolService.toCard(product).stockState()))
                .toList();
        if (inGroup.isEmpty()) return List.of();

        Map<String, Product> bySlug = inGroup.stream().collect(Collectors.toMap(
                Product::slug, Function.identity(), (first, ignored) -> first, LinkedHashMap::new));
        Set<String> taken = new LinkedHashSet<>();
        List<Product> chosen = new ArrayList<>();
        for (String slug : rankedSlugs == null ? List.<String>of() : rankedSlugs) {
            Product product = bySlug.get(slug);
            if (product == null || !taken.add(slug)) continue;
            chosen.add(product);
            if (chosen.size() == GROUP_SUGGESTION_LIMIT) break;
        }
        if (chosen.size() < GROUP_SUGGESTION_LIMIT) {
            for (Product product : ChatToolService.representativeProducts(inGroup)) {
                if (!taken.add(product.slug())) continue;
                chosen.add(product);
                if (chosen.size() == GROUP_SUGGESTION_LIMIT) break;
            }
        }
        return chosen.stream().map(ChatToolService::toCard).toList();
    }

    private static ImageTurnResult limitResult(String lang, String reason) {
        boolean english = "en".equals(lang);
        String answer = english
                ? "BigBike has used today’s image allowance. Please describe the item and I’ll help you find it, or use the contact options below."
                : "Hôm nay BigBike đã dùng hết lượt đọc ảnh. Anh/chị mô tả món cần tìm để em hỗ trợ tiếp, hoặc liên hệ shop qua các kênh bên dưới nhé.";
        return new ImageTurnResult(
                answer, ChatMessageSource.TOOL, "CLARIFICATION", List.of(), false, true);
    }

    private static ImageTurnResult unsafeResult(String lang) {
        return new ImageTurnResult(
                "en".equals(lang)
                        ? "I cannot process this image. I can still help with BigBike products, protective gear and shop policies."
                        : "Em không thể xử lý ảnh này. Em vẫn có thể hỗ trợ sản phẩm, đồ bảo hộ và chính sách của BigBike.",
                ChatMessageSource.CONTENT_REFUSAL, "REFUSAL", List.of(), true, false);
    }

    private static ImageTurnResult unknownResult(String lang, boolean analyzed) {
        return new ImageTurnResult(
                "en".equals(lang)
                        ? "I cannot recognize a specific product reliably from this image. Please describe the item in text, or contact BigBike through Hotline, Zalo or Messenger for help."
                        : "Em chưa nhận ra đáng tin cậy được sản phẩm cụ thể trong ảnh. Anh/chị vui lòng mô tả thêm bằng chữ, hoặc liên hệ BigBike qua Hotline, Zalo hoặc Messenger để được hỗ trợ.",
                ChatMessageSource.TOOL, "CLARIFICATION", List.of(), analyzed, true);
    }

    CatalogContext catalogContext(List<Product> products) {
        List<Product> safeProducts = products == null ? List.of() : products.stream()
                .filter(product -> product.slug() != null && product.name() != null)
                .sorted(Comparator.comparing(Product::slug))
                .toList();
        List<ChatImageAnalysisClient.CatalogCandidate> candidates = safeProducts.stream()
                .map(product -> new ChatImageAnalysisClient.CatalogCandidate(
                        product.slug(), product.name(),
                        product.category() == null ? "" : product.category().name(),
                        product.brand() == null ? "" : product.brand().name()))
                .toList();
        List<String> groups = safeProducts.stream()
                .flatMap(product -> java.util.stream.Stream.concat(java.util.stream.Stream.of(product.category()),
                        product.categories() == null ? java.util.stream.Stream.empty() : product.categories().stream()))
                .filter(java.util.Objects::nonNull)
                .map(category -> category.name())
                .filter(name -> name != null && !name.isBlank())
                .distinct()
                .sorted()
                .toList();
        Map<String, Product> bySlug = safeProducts.stream().collect(Collectors.toMap(
                Product::slug, Function.identity(), (first, ignored) -> first, LinkedHashMap::new));
        return new CatalogContext(safeProducts, candidates, groups, bySlug);
    }

    /**
     * Owner decision 2026-09-07: the picture decides what the turn is about, not the words typed
     * with it.
     *
     * <p>The previous version rewrote the intent from caption substrings alone, so "em muốn đặt
     * đơn hàng mẫu này" pushed a customer who wanted to buy into order-lookup guidance, and "mũ
     * này có size nào ạ?" over a product photo was answered as if it were a photo of someone's
     * head — losing the product cards and the buy button in both cases. Those two redirections are
     * now reachable only when the vision result itself says the image is a receipt or a person.
     *
     * <p>A caption still escalates to {@code DAMAGED_PRODUCT}, because a customer reporting
     * breakage must reach a human whatever the picture looks like. It no longer escalates on the
     * bare word "bảo hành": asking how long the warranty lasts is a policy question the text
     * advisory answers from the published policy. Concluding a specific warranty case from an
     * image stays forbidden either way (CHAT_RULE_058).
     */
    static String resolveIntent(String detected, String caption, boolean hasVisualMatch) {
        String intent = detected == null || detected.isBlank() ? "UNKNOWN" : detected;
        String normalized = ChatToolService.normalize(caption == null ? "" : caption);
        boolean reportsDamage = containsAny(normalized, "bi hong", "bi loi", "bi vo", "bi nut",
                "bi gay", "bi be", "damaged", "broken", "cracked", "defect");
        if (reportsDamage && !"UNRELATED".equals(intent)) return "DAMAGED_PRODUCT";
        if ("UNKNOWN".equals(intent) && hasVisualMatch) return "PRODUCT_SEARCH";
        return intent;
    }

    private static boolean containsAny(String value, String... needles) {
        for (String needle : needles) if (value.contains(needle)) return true;
        return false;
    }

    private ChatConversationEntity createConversation(
            UUID customerId, UUID visitorId, String lang) {
        if (customerId == null && visitorId == null) {
            throw new NotFoundException("Không tìm thấy phiên hội thoại.");
        }
        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setCustomerId(customerId);
        conversation.setVisitorId(visitorId);
        conversation.setLocale("en".equals(lang) ? "en" : "vi");
        return conversationRepo.saveAndFlush(conversation);
    }

    private ChatConversationEntity requireOwner(
            UUID conversationId, UUID customerId, UUID visitorId) {
        ChatConversationEntity conversation = conversationRepo.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hội thoại."));
        requireOwner(conversation, customerId, visitorId);
        return conversation;
    }

    private ChatConversationEntity requireOwnerForUpdate(
            UUID conversationId, UUID customerId, UUID visitorId) {
        ChatConversationEntity conversation = conversationRepo.findByIdForUpdate(conversationId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hội thoại."));
        requireOwner(conversation, customerId, visitorId);
        return conversation;
    }

    private static void requireOwner(
            ChatConversationEntity conversation, UUID customerId, UUID visitorId) {
        UUID owner = conversation.getCustomerId();
        boolean customerOwns = owner != null && owner.equals(customerId);
        boolean visitorOwns = owner == null && visitorId != null
                && visitorId.equals(conversation.getVisitorId());
        if (!customerOwns && !visitorOwns) {
            throw new NotFoundException("Không tìm thấy hội thoại.");
        }
    }

    private ChatImageEntity requireReadableImage(UUID imageId) {
        return imageRepo.findById(imageId)
                .filter(image -> image.getDeletedAt() == null)
                .filter(image -> !TERMINAL_WITHOUT_CONTENT.contains(image.getStatus()))
                .orElseThrow(() -> new NotFoundException("Không tìm thấy ảnh."));
    }

    private ChatImageResponse toResponse(ChatImageEntity image) {
        return new ChatImageResponse(
                image.getId(), "/api/v1/chat/images/" + image.getId() + "/content",
                image.getMimeType(), image.getWidth(), image.getHeight(), image.getSizeBytes(),
                image.getStatus(), image.getCreatedAt());
    }

    /**
     * @param continuesToText whether the assistant should go on to answer the words the customer
     *     typed with the photo. Only this class can say so: a receipt image, a head photo and a
     *     recognised group with nothing in stock all come out as {@code TOOL / "ANSWER"} with no
     *     cards, so the caller cannot tell them apart from the other fields. The refusals stop the
     *     turn; recognition, "I could not identify this" and "the daily image allowance is used up"
     *     all continue, because the typed question deserves an answer in each of those cases.
     */
    public record ImageTurnResult(
            String answer,
            String source,
            String resultKind,
            List<ChatProductCardResponse> products,
            boolean analyzed,
            boolean continuesToText,
            ChatImageEvidence evidence
    ) {
        public ImageTurnResult(String answer, String source, String resultKind, List<ChatProductCardResponse> products,
                boolean analyzed, boolean continuesToText) {
            this(answer, source, resultKind, products, analyzed, continuesToText, null);
        }
        ImageTurnResult withEvidence(ChatImageEvidence value) {
            return new ImageTurnResult(answer, source, resultKind, products, analyzed, continuesToText, value);
        }
        public ImageTurnResult {
            products = products == null ? List.of() : List.copyOf(products);
        }
    }

    record CatalogContext(
            List<Product> products,
            List<ChatImageAnalysisClient.CatalogCandidate> candidates,
            List<String> groups,
            Map<String, Product> productsBySlug
    ) {
        String canonicalGroup(String proposed) {
            if (proposed == null || proposed.isBlank() || "UNKNOWN".equalsIgnoreCase(proposed)) {
                return null;
            }
            return groups.stream().filter(group -> group.equalsIgnoreCase(proposed.trim()))
                    .findFirst().orElse(null);
        }
    }
}
