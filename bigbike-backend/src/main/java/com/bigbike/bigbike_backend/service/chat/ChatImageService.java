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

    private final ChatImageJpaRepository imageRepo;
    private final ChatConversationJpaRepository conversationRepo;
    private final ChatAssistantSettings assistantSettings;
    private final ChatImageStorageService storageService;
    private final ChatImageDailyQuotaService quotaService;
    private final ChatImageAnalysisClient analysisClient;
    private final CatalogReadService catalogReadService;
    private final ChatProductImageFingerprintService fingerprintService;

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
                    "requestId", "CHAT_IMAGE_INVALID", "Thiếu mã gửi ảnh.");
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
                    "Hội thoại này đã đạt giới hạn " + conversationLimit + " ảnh.");
        }

        ChatImageEntity image = new ChatImageEntity();
        image.setId(UUID.randomUUID());
        image.setRequestId(requestId);
        image.setConversationId(conversation.getId());
        image.setStatus("PENDING");
        image.setExpiresAt(conversation.getExpiresAt());
        ChatImageStorageService.StoredImage stored = storageService.store(
                conversation.getId(), image.getId(), file);
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

    public ImageTurnResult processTurn(
            ChatConversationEntity conversation,
            UUID customerMessageId,
            List<UUID> imageIds,
            String caption,
            String lang
    ) {
        ChatImageEntity image = requireTurnImage(conversation, customerMessageId, imageIds);
        image.setCustomerMessageId(customerMessageId);
        image.setStatus("ATTACHED");
        imageRepo.saveAndFlush(image);

        ChatAssistantSettings.ImageSettings settings = assistantSettings.imageSettings();
        if (!quotaService.tryReserve(settings.dailyLimit())) {
            image.setStatus("LIMIT_SKIPPED");
            imageRepo.save(image);
            return limitResult(lang, "DAILY_LIMIT");
        }

        image.setStatus("PROCESSING");
        imageRepo.saveAndFlush(image);
        ChatImageStorageService.StoredContent content = storageService.read(
                image.getStorageBucket(), image.getStorageObjectKey(), image.getMimeType());
        List<Product> catalog = catalogReadService.listAssistantDecisionProducts(lang);
        CatalogContext catalogContext = catalogContext(catalog);
        Optional<ChatProductImageFingerprintService.VisualMatch> visualMatch;
        try {
            visualMatch = fingerprintService.findStrictMatch(
                    content.bytes(), image.getSha256(), catalogContext.products());
        } catch (RuntimeException exception) {
            // A missing/stale catalog thumbnail must degrade to group-only recognition, never to
            // a guessed model and never to a failed customer conversation.
            log.warn("chat_product_fingerprint_match_failed type={}",
                    exception.getClass().getSimpleName());
            visualMatch = Optional.empty();
        }
        ChatImageAnalysisClient.AnalysisCall call = analysisClient.analyze(
                content.bytes(), content.mimeType(), caption,
                catalogContext.candidates(), catalogContext.groups());
        if (call.analysis().isEmpty()
                && visualMatch.filter(match -> "CONTENT_SHA256".equals(match.evidence())).isEmpty()) {
            image.setStatus("UNRECOGNIZED");
            image.setIntentCode("UNKNOWN");
            imageRepo.save(image);
            return unknownResult(lang, true);
        }
        ChatImageAnalysisClient.ImageAnalysis analysis = call.analysis().orElseGet(() ->
                new ChatImageAnalysisClient.ImageAnalysis(
                        "PRODUCT_SEARCH", "UNKNOWN", "LOW", List.of(), false));
        if (analysis.unsafe()) {
            image.setStatus("REJECTED_UNSAFE");
            image.setSafetyCode("PROVIDER_SAFETY");
            image.setIntentCode("UNKNOWN");
            imageRepo.saveAndFlush(image);
            try {
                storageService.delete(image.getStorageBucket(), image.getStorageObjectKey());
                image.setDeletedAt(Instant.now());
                imageRepo.save(image);
            } catch (RuntimeException exception) {
                // The terminal status blocks every content endpoint immediately. Retention cleanup
                // retries object deletion without exposing the customer image or its metadata.
                log.warn("chat_image_unsafe_delete_failed imageId={} type={}",
                        image.getId(), exception.getClass().getSimpleName());
            }
            return unsafeResult(lang);
        }

        String intent = overrideHighRiskIntent(analysis.intent(), caption);
        if (visualMatch.isPresent() && "UNKNOWN".equals(intent)) intent = "PRODUCT_SEARCH";
        analysis = evidenceBoundAnalysis(analysis, visualMatch, catalogContext);
        image.setIntentCode(intent);
        image.setStatus("UNKNOWN".equals(intent) ? "UNRECOGNIZED" : "READY");
        imageRepo.save(image);
        return resultFor(intent, analysis, catalogContext, lang);
    }

    private ChatImageEntity requireTurnImage(
            ChatConversationEntity conversation,
            UUID customerMessageId,
            List<UUID> imageIds
    ) {
        if (imageIds == null || imageIds.isEmpty()) {
            throw ValidationException.fromField(
                    "imageIds", "CHAT_IMAGE_NOT_FOUND", "Không tìm thấy ảnh cần xử lý.");
        }
        if (imageIds.size() > 1) {
            throw ValidationException.fromField(
                    "imageIds", "CHAT_IMAGE_TURN_LIMIT", "Mỗi lượt chỉ gửi được một ảnh.");
        }
        ChatImageEntity image = imageRepo.findById(imageIds.get(0))
                .filter(item -> item.getConversationId().equals(conversation.getId()))
                .orElseThrow(() -> ValidationException.fromField(
                        "imageIds", "CHAT_IMAGE_NOT_FOUND", "Không tìm thấy ảnh trong hội thoại này."));
        if (image.getCustomerMessageId() != null
                && !image.getCustomerMessageId().equals(customerMessageId)) {
            throw ValidationException.fromField(
                    "imageIds", "CHAT_IMAGE_NOT_FOUND", "Ảnh này đã được gửi ở một lượt khác.");
        }
        return image;
    }

    private static ChatImageAnalysisClient.ImageAnalysis evidenceBoundAnalysis(
            ChatImageAnalysisClient.ImageAnalysis provider,
            Optional<ChatProductImageFingerprintService.VisualMatch> visualMatch,
            CatalogContext context
    ) {
        if (visualMatch.isEmpty()) {
            // A model name inferred from branding/OCR is not enough evidence to claim a catalog
            // match. Keep only the recognized group and discard every provider-selected slug.
            return new ChatImageAnalysisClient.ImageAnalysis(
                    provider.intent(), provider.group(), provider.confidence(), List.of(),
                    provider.unsafe());
        }
        String slug = visualMatch.get().slug();
        Product matched = context.productsBySlug().get(slug);
        if (matched == null) {
            return new ChatImageAnalysisClient.ImageAnalysis(
                    provider.intent(), provider.group(), provider.confidence(), List.of(),
                    provider.unsafe());
        }
        String group = provider.group();
        if (context.canonicalGroup(group) == null && matched.category() != null) {
            group = matched.category().name();
        }
        return new ChatImageAnalysisClient.ImageAnalysis(
                provider.intent(), group, "HIGH", List.of(slug), provider.unsafe());
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
            String lang
    ) {
        boolean english = "en".equals(lang);
        return switch (intent) {
            case "DAMAGED_PRODUCT" -> new ImageTurnResult(
                    english
                            ? "I’ve recorded the damaged-product image. I cannot decide warranty eligibility from an image; please contact BigBike through Hotline, Zalo or Messenger for help."
                            : "Em đã ghi nhận ảnh sản phẩm bị lỗi/hỏng. Em không tự kết luận bảo hành chỉ từ ảnh; anh/chị vui lòng liên hệ BigBike qua Hotline, Zalo hoặc Messenger để được hỗ trợ.",
                    "CONTACT_FALLBACK", "CONTACT", List.of(), true);
            case "ORDER_DOCUMENT" -> new ImageTurnResult(
                    english
                            ? "I cannot use numbers or text in this image to confirm an order. Please sign in and open your order history, or use BigBike’s order lookup with the original order details."
                            : "Em không dùng số hoặc chữ trên ảnh để khẳng định thông tin đơn. Anh/chị vui lòng đăng nhập xem Lịch sử đơn hàng, hoặc tra đơn bằng thông tin gốc đã nhận từ BigBike.",
                    "TOOL", "ANSWER", List.of(), true);
            case "SIZE_FROM_PERSON" -> new ImageTurnResult(
                    english
                            ? "I cannot estimate a helmet size from a head or body photo. Please use a measuring tape around the widest part of your head, then compare that measurement with the product’s saved size chart. You can also contact BigBike through Hotline, Zalo or Messenger."
                            : "Em không đoán size mũ từ ảnh đầu hoặc ảnh người. Anh/chị cần dùng thước dây đo vòng qua phần rộng nhất của đầu, rồi đối chiếu bảng size đã lưu của từng mẫu. Anh/chị cũng có thể liên hệ BigBike qua Hotline, Zalo hoặc Messenger.",
                    "TOOL", "ANSWER", List.of(), true);
            case "UNRELATED" -> new ImageTurnResult(
                    english
                            ? "I cannot help analyze this image. I can assist with BigBike products, protective gear, orders and published shop policies."
                            : "Em chưa thể hỗ trợ phân tích ảnh này. Em có thể giúp về sản phẩm, đồ bảo hộ, đơn hàng và chính sách đã công bố của BigBike.",
                    "OUT_OF_SCOPE", "REFUSAL", List.of(), true);
            case "PRODUCT_SEARCH" -> productResult(analysis, context, lang);
            default -> unknownResult(lang, true);
        };
    }

    private ImageTurnResult productResult(
            ChatImageAnalysisClient.ImageAnalysis analysis,
            CatalogContext context,
            String lang
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
                    ? "This image looks similar to " + card.name()
                            + ", which BigBike currently sells. This is visual similarity only, not confirmation that it is the same product; please open the model below to compare it yourself."
                    : "Ảnh này trông giống mẫu " + card.name()
                            + " bên em đang bán. Đây chỉ là mức độ giống qua hình, không phải khẳng định cùng một sản phẩm; anh/chị vui lòng mở mẫu bên dưới để tự đối chiếu.";
            return new ImageTurnResult(answer, "TOOL", "PRODUCT_RESULTS", List.of(card), true);
        }
        String resolvedGroup = group;
        List<ChatProductCardResponse> groupCards = resolvedGroup == null ? List.of() : context.products().stream()
                .filter(product -> product.categories() != null && product.categories().stream()
                        .filter(java.util.Objects::nonNull)
                        .anyMatch(category -> resolvedGroup.equalsIgnoreCase(category.name())))
                .map(ChatToolService::toCard)
                .filter(card -> "IN_STOCK".equals(card.stockState()))
                .limit(3)
                .toList();
        if (resolvedGroup != null) {
            String answer = english
                    ? "I can recognize this as likely belonging to the " + resolvedGroup
                            + " group, but I cannot identify a specific model reliably. The currently sold models below are for you to compare; I am not claiming any is the same product."
                    : "Em nhận ra ảnh có vẻ thuộc nhóm " + resolvedGroup
                            + " nhưng chưa xác định đáng tin cậy được mẫu cụ thể. Các mẫu cùng nhóm đang bán bên dưới để anh/chị tự đối chiếu; em không khẳng định mẫu nào là cùng sản phẩm.";
            return new ImageTurnResult(
                    answer, "TOOL", groupCards.isEmpty() ? "ANSWER" : "PRODUCT_RESULTS",
                    groupCards, true);
        }
        return unknownResult(lang, true);
    }

    private static ImageTurnResult limitResult(String lang, String reason) {
        boolean english = "en".equals(lang);
        String answer = english
                ? "The shop’s image-analysis allowance has been reached for today. You can still describe the item in text and continue chatting normally, or contact BigBike through Hotline, Zalo or Messenger."
                : "Hôm nay shop đã dùng hết lượt đọc ảnh. Anh/chị vẫn có thể mô tả sản phẩm bằng chữ và tiếp tục trò chuyện bình thường, hoặc liên hệ BigBike qua Hotline, Zalo hoặc Messenger.";
        return new ImageTurnResult(answer, "TOOL", "CLARIFICATION", List.of(), true);
    }

    private static ImageTurnResult unsafeResult(String lang) {
        return new ImageTurnResult(
                "en".equals(lang)
                        ? "I cannot process this image. I can still help with BigBike products, protective gear and shop policies."
                        : "Em không thể xử lý ảnh này. Em vẫn có thể hỗ trợ sản phẩm, đồ bảo hộ và chính sách của BigBike.",
                "CONTENT_REFUSAL", "REFUSAL", List.of(), true);
    }

    private static ImageTurnResult unknownResult(String lang, boolean analyzed) {
        return new ImageTurnResult(
                "en".equals(lang)
                        ? "I cannot recognize a specific product reliably from this image. Please describe the item in text, or contact BigBike through Hotline, Zalo or Messenger for help."
                        : "Em chưa nhận ra đáng tin cậy được sản phẩm cụ thể trong ảnh. Anh/chị vui lòng mô tả thêm bằng chữ, hoặc liên hệ BigBike qua Hotline, Zalo hoặc Messenger để được hỗ trợ.",
                "TOOL", "CLARIFICATION", List.of(), analyzed);
    }

    private CatalogContext catalogContext(List<Product> products) {
        List<Product> safeProducts = products == null ? List.of() : products.stream()
                .filter(product -> product.slug() != null && product.name() != null)
                .sorted(Comparator.comparing(Product::slug))
                .limit(250)
                .toList();
        List<ChatImageAnalysisClient.CatalogCandidate> candidates = safeProducts.stream()
                .map(product -> new ChatImageAnalysisClient.CatalogCandidate(
                        product.slug(), product.name(),
                        product.category() == null ? "" : product.category().name(),
                        product.brand() == null ? "" : product.brand().name()))
                .toList();
        List<String> groups = safeProducts.stream()
                .flatMap(product -> product.categories() == null
                        ? java.util.stream.Stream.of(product.category())
                        : product.categories().stream())
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

    private static String overrideHighRiskIntent(String detected, String caption) {
        String normalized = ChatToolService.normalize(caption == null ? "" : caption);
        if (containsAny(normalized, "bi hong", "bi loi", "bi vo", "bi nut", "bao hanh",
                "damaged", "broken", "defect", "warranty")) return "DAMAGED_PRODUCT";
        if (containsAny(normalized, "hoa don", "don hang", "ma don", "bill", "invoice",
                "order screenshot", "tracking")) return "ORDER_DOCUMENT";
        if (containsAny(normalized, "size nao", "co vua", "vong dau", "kich co",
                "what size", "fit me", "head size")) return "SIZE_FROM_PERSON";
        return detected == null ? "UNKNOWN" : detected;
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

    public record ImageTurnResult(
            String answer,
            String source,
            String resultKind,
            List<ChatProductCardResponse> products,
            boolean analyzed
    ) {
        public ImageTurnResult {
            products = products == null ? List.of() : List.copyOf(products);
        }
    }

    private record CatalogContext(
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
