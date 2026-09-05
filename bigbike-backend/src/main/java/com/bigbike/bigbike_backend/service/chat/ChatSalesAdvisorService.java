package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatClarificationResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatNextStepResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deterministic, zero-provider-call sales policy applied after a grounded answer is available.
 * It changes conversation guidance, never product facts, prices, stock or published policies.
 */
@Service
@RequiredArgsConstructor
public class ChatSalesAdvisorService {

    private static final int MAX_ANSWER_CHARS = 2_000;
    private static final Set<String> NO_FOLLOW_UP_SOURCES = Set.of(
            ChatMessageSource.OUT_OF_SCOPE,
            ChatMessageSource.CONTENT_REFUSAL,
            ChatMessageSource.ROLE_DEFENSE,
            ChatMessageSource.CONTACT_FALLBACK,
            ChatMessageSource.PROVIDER_UNAVAILABLE);
    private static final Set<String> NO_FOLLOW_UP_RESULT_KINDS = Set.of(
            "OUT_OF_SCOPE", "REFUSAL", "CONTACT", "CLARIFICATION");

    private final CatalogReadService catalogReadService;

    @Transactional(readOnly = true)
    public Advice advise(
            ChatConversationEntity conversation,
            String question,
            String lang,
            ChatAssistantSettings.Snapshot settings,
            ChatToolService.ConversationContext context,
            String baseAnswer,
            List<ChatProductCardResponse> baseProducts,
            String source,
            String resultKind,
            ChatClarificationResponse clarification,
            List<ChatActionResponse> proposedActions
    ) {
        boolean english = "en".equals(lang);
        String normalized = ChatToolService.normalize(question == null ? "" : question);
        List<ChatProductCardResponse> products = baseProducts == null
                ? List.of() : List.copyOf(baseProducts);
        String stage = classifyStage(normalized, products, context);
        String answer = baseAnswer == null ? "" : baseAnswer.trim();
        String outcome = outcomeCode(source, resultKind, products, clarification);

        CheaperAlternative cheaper = isPriceObjection(normalized)
                ? cheaperAlternative(products, context, lang) : null;
        if (cheaper != null) {
            products = List.of(cheaper.card());
            answer = cheaper.answer();
            stage = "CHOOSING";
            outcome = "CHEAPER_ALTERNATIVE";
        }

        Product focus = focusProduct(products, context, lang);
        boolean missingSizeGuide = asksSize(normalized) && focus != null && !hasSizeGuide(focus);
        if (missingSizeGuide) {
            answer = missingSizeAnswer(focus, english);
            if (confirmsMissingSizeGuide(normalized)) {
                answer = (english ? "Yes, that is correct. " : "Dạ, đúng rồi. ") + answer;
            }
            outcome = "MISSING_SIZE_GUIDE";
            stage = "DECIDING";
        } else if (asksAuthenticity(normalized)) {
            answer = authenticityAnswer(settings, english);
            outcome = "WARRANTY_POLICY";
            stage = "DECIDING";
        }

        List<ChatProductCardResponse> crossSell = shouldCrossSell(normalized, stage, focus)
                ? crossSellProducts(focus) : List.of();
        if (!crossSell.isEmpty()) {
            answer = append(answer, crossSellSentence(crossSell, english));
            outcome = "CROSS_SELL_OFFERED";
        }

        boolean declinedStep = declinedCurrentProposal(normalized);
        if (declinedStep && conversation.getLastNextStepType() != null) {
            conversation.setDeclinedNextStepType(conversation.getLastNextStepType());
        }

        NextStep next = chooseNextStep(
                normalized, stage, products, crossSell, clarification,
                cheaper != null, declinedStep, english);
        if (conversation.getDeclinedNextStepType() != null
                && conversation.getDeclinedNextStepType().equals(next.response().type())) {
            next = lowPressureAlternative(english);
        }
        // CHAT_RULE_001 (owner decision 2026-09-05): a follow-up line is only appended when it
        // fits the question. Pasting a sales prompt onto a refusal, an out-of-scope reply or a
        // question the assistant just asked reads like a machine and annoyed customers.
        if (nextStepFitsContext(source, resultKind, clarification, answer)) {
            answer = appendNextStep(answer, next.copy());
        }

        conversation.setSalesStage(stage);
        conversation.setLastNextStepType(next.response().type());
        List<ChatActionResponse> actions = stageActions(
                stage, next.response().type(), proposedActions);
        return new Advice(
                answer, products, crossSell, stage, outcome, next.response(),
                actions);
    }

    private static String classifyStage(
            String normalized,
            List<ChatProductCardResponse> products,
            ChatToolService.ConversationContext context
    ) {
        if (isPostPurchase(normalized)) return "POST_PURCHASE";
        if (containsAny(normalized,
                "xem mau khac", "doi sang mau khac", "so sanh", "phan van",
                "show other models", "compare", "changed my mind")) return "CHOOSING";
        boolean hasReference = products.size() == 1
                || context != null && context.productSlugs().size() == 1;
        if (hasReference && containsAny(normalized,
                "size", "kich co", "con hang", "co con", "gia cuoi", "chot",
                "lay mau", "mua mau", "giao bao lau", "bao hanh", "doi tra",
                "in stock", "available", "final price", "delivery", "warranty",
                "return", "buy this", "take this")) return "DECIDING";
        if (products.size() > 1 || products.size() == 1
                || context != null && (context.category() != null || context.brand() != null)) {
            return "CHOOSING";
        }
        return "BROWSING";
    }

    private CheaperAlternative cheaperAlternative(
            List<ChatProductCardResponse> products,
            ChatToolService.ConversationContext context,
            String lang
    ) {
        Product baseline = focusProduct(products, context, lang);
        BigDecimal baselinePrice = effectivePrice(baseline);
        if (baseline == null || baselinePrice == null) return null;
        Set<String> categories = categorySlugs(baseline);
        if (categories.isEmpty()) return null;
        Product alternative = catalogReadService.listAssistantDecisionProducts(lang).stream()
                .filter(product -> product != null && !baseline.slug().equals(product.slug()))
                .filter(product -> product.stockState() == ProductStockState.IN_STOCK)
                .filter(product -> Boolean.TRUE.equals(product.available()))
                .filter(product -> !disjoint(categories, categorySlugs(product)))
                .filter(product -> effectivePrice(product) != null
                        && effectivePrice(product).compareTo(baselinePrice) < 0)
                .max(Comparator.comparing(ChatSalesAdvisorService::effectivePrice))
                .map(product -> loadProduct(product.slug(), lang))
                .orElse(null);
        if (alternative == null) return null;
        ChatProductCardResponse card = ChatToolService.toCard(alternative);
        if (!"IN_STOCK".equals(card.stockState())) return null;
        return new CheaperAlternative(card, cheaperAnswer(baseline, alternative, lang));
    }

    private static String cheaperAnswer(Product baseline, Product alternative, String lang) {
        boolean english = "en".equals(lang);
        BigDecimal difference = effectivePrice(baseline).subtract(effectivePrice(alternative));
        String tradeoff = tradeoff(baseline, alternative, english);
        return english
                ? alternative.name() + " is a currently available option in the same product group and costs "
                        + money(difference, true) + " less than " + baseline.name() + ". " + tradeoff
                        + " I cannot lower the listed price myself."
                : alternative.name() + " là lựa chọn đang còn hàng trong cùng nhóm sản phẩm và thấp hơn "
                        + baseline.name() + " " + money(difference, false) + ". " + tradeoff
                        + " Em không tự hạ giá niêm yết.";
    }

    private static String tradeoff(Product baseline, Product alternative, boolean english) {
        if (hasSizeGuide(baseline) && !hasSizeGuide(alternative)) {
            return english
                    ? "The trade-off is that BigBike does not yet have this model's size guide."
                    : "Đánh đổi là shop chưa có hướng dẫn size của mẫu này.";
        }
        if (hasText(baseline.specifications()) && !hasText(alternative.specifications())) {
            return english
                    ? "The trade-off is that its detailed specifications are not yet saved."
                    : "Đánh đổi là thông số chi tiết của mẫu này chưa được cập nhật.";
        }
        int baselineOptions = availableVariantCount(baseline);
        int alternativeOptions = availableVariantCount(alternative);
        if (alternativeOptions < baselineOptions) {
            return english
                    ? "The trade-off is fewer currently available variant choices."
                    : "Đánh đổi là số lựa chọn phiên bản đang còn hàng ít hơn.";
        }
        String alternativeBrand = alternative.brand() == null ? null : alternative.brand().name();
        String baselineBrand = baseline.brand() == null ? null : baseline.brand().name();
        if (hasText(alternativeBrand) && !alternativeBrand.equalsIgnoreCase(baselineBrand)) {
            return english
                    ? "The trade-off is switching to " + alternativeBrand
                            + "; BigBike does not have enough saved data to claim identical features."
                    : "Đánh đổi là chuyển sang thương hiệu " + alternativeBrand
                            + "; shop chưa có đủ dữ liệu để khẳng định tính năng giống hệt.";
        }
        return english
                ? "BigBike does not have enough saved data to claim identical features, so compare the product details before deciding."
                : "Shop chưa có đủ dữ liệu để khẳng định tính năng giống hệt, nên anh/chị cần đối chiếu trang chi tiết trước khi chọn.";
    }

    private Product focusProduct(
            List<ChatProductCardResponse> products,
            ChatToolService.ConversationContext context,
            String lang
    ) {
        String slug = products != null && products.size() == 1 ? products.get(0).slug()
                : context != null && context.productSlugs().size() == 1
                        ? context.productSlugs().get(0) : null;
        return loadProduct(slug, lang);
    }

    private Product loadProduct(String slug, String lang) {
        if (slug == null || slug.isBlank()) return null;
        try {
            return catalogReadService.getProductBySlug(slug, lang);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static boolean shouldCrossSell(String normalized, String stage, Product focus) {
        return focus != null && "DECIDING".equals(stage) && containsAny(normalized,
                "chot", "toi lay", "lay mau nay", "mua mau nay", "them vao gio",
                "quyet dinh lay", "i will take", "i'll take", "buy this", "add to cart",
                "decided on this");
    }

    private static List<ChatProductCardResponse> crossSellProducts(Product focus) {
        if (focus.accessoryProducts() == null || focus.accessoryProducts().isEmpty()) return List.of();
        return focus.accessoryProducts().stream()
                .filter(product -> product.publishStatus()
                        == com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED)
                .filter(product -> !product.discontinued())
                .filter(product -> Boolean.TRUE.equals(product.available()))
                .map(ChatToolService::toCard)
                .filter(card -> "IN_STOCK".equals(card.stockState()))
                .filter(card -> card.retailPrice() != null && card.retailPrice().signum() > 0)
                .limit(2)
                .toList();
    }

    private static String crossSellSentence(
            List<ChatProductCardResponse> crossSell,
            boolean english
    ) {
        String names = crossSell.stream().map(ChatProductCardResponse::name)
                .reduce((left, right) -> left + " và " + right).orElse("");
        return english
                ? "For this main item, BigBike has explicitly linked these in-stock accessories: "
                        + crossSell.stream().map(ChatProductCardResponse::name)
                                .reduce((left, right) -> left + " and " + right).orElse("") + "."
                : "Với món chính này, BigBike đã khai đúng phụ kiện còn hàng gồm " + names + ".";
    }

    private static NextStep chooseNextStep(
            String normalized,
            String stage,
            List<ChatProductCardResponse> products,
            List<ChatProductCardResponse> crossSell,
            ChatClarificationResponse clarification,
            boolean cheaper,
            boolean declined,
            boolean english
    ) {
        String slug = products.size() == 1 ? products.get(0).slug() : null;
        if (clarification != null) return next(
                "ANSWER_CLARIFICATION", null, clarification.id().toString(), english,
                "Choose one option below so I can continue with the right need.",
                "Anh/chị chọn một phương án bên dưới để em tư vấn tiếp đúng nhu cầu.");
        if (declined) return lowPressureAlternative(english);
        if (!crossSell.isEmpty()) return next(
                "VIEW_ACCESSORIES", crossSell.get(0).slug(), null, english,
                "Open an accessory below only if you want to complete this setup.",
                "Anh/chị mở món kèm bên dưới nếu muốn hoàn thiện đúng bộ này.");
        if (cheaper) return next(
                "VIEW_CHEAPER_ALTERNATIVE", slug, null, english,
                "Open the lower-priced model below to compare the trade-off before choosing.",
                "Anh/chị mở mẫu rẻ hơn bên dưới để đối chiếu phần đánh đổi trước khi chọn.");
        if ("POST_PURCHASE".equals(stage)) return next(
                "VIEW_ORDER", null, null, english,
                "Open your order history to continue with that specific order.",
                "Anh/chị mở lịch sử đơn để tiếp tục xử lý đúng đơn đó.");
        if ("DECIDING".equals(stage)) {
            if (asksSize(normalized)) return next(
                    "CHOOSE_SIZE", slug, null, english,
                    "Choose the size shown for this model, or contact BigBike through Hotline, Zalo or Messenger before adding it to your cart.",
                    "Anh/chị chọn size đang hiển thị của mẫu này, hoặc liên hệ BigBike qua Hotline, Zalo hoặc Messenger trước khi thêm giỏ.");
            return next("ADD_TO_CART", slug, null, english,
                    "Add this model to your cart when you are ready to proceed.",
                    "Anh/chị thêm mẫu này vào giỏ khi đã sẵn sàng chốt.");
        }
        if ("CHOOSING".equals(stage)) return next(
                "CHOOSE_PRIORITY", slug, null, english,
                "Tell me your single top priority so I can eliminate the less suitable choice.",
                "Anh/chị cho em một ưu tiên quan trọng nhất để em loại bớt mẫu chưa hợp.");
        return next("SHARE_NEED", null, null, english,
                "Tell me the product type, use and budget you have in mind so I can narrow the search.",
                "Anh/chị cho em loại hàng, cách dùng và tầm giá để em khoanh đúng nhu cầu.");
    }

    private static NextStep lowPressureAlternative(boolean english) {
        return next("PAUSE", null, null, english,
                "When you want a comparison, send me the two models you are considering.",
                "Khi muốn so sánh, anh/chị gửi em hai mẫu đang cân nhắc.");
    }

    private static NextStep next(
            String type,
            String slug,
            String clarificationId,
            boolean english,
            String englishCopy,
            String vietnameseCopy
    ) {
        return new NextStep(
                new ChatNextStepResponse(type, slug, clarificationId),
                english ? englishCopy : vietnameseCopy);
    }

    private static List<ChatActionResponse> stageActions(
            String stage,
            String nextStep,
            List<ChatActionResponse> proposed
    ) {
        Set<String> allowed = switch (stage) {
            case "POST_PURCHASE" -> Set.of("ORDER_HISTORY", "ORDER_LOOKUP");
            case "DECIDING" -> Set.of("CHECK_SIZE", "CHECK_STOCK", "VIEW_POLICY");
            case "CHOOSING" -> Set.of("COMPARE_PRODUCTS", "CHECK_SIZE", "CHANGE_BUDGET");
            default -> Set.of("CHANGE_NEEDS", "CHANGE_BUDGET", "FIND_PRODUCTS");
        };
        LinkedHashSet<String> types = new LinkedHashSet<>();
        if (proposed != null) proposed.stream()
                .map(ChatActionResponse::type)
                .filter(allowed::contains)
                .forEach(types::add);
        if (types.isEmpty()) {
            String fallback = switch (nextStep) {
                case "VIEW_ORDER" -> "ORDER_HISTORY";
                case "CHOOSE_SIZE" -> "CHECK_SIZE";
                case "CHOOSE_PRIORITY" -> "COMPARE_PRODUCTS";
                case "SHARE_NEED", "PAUSE" -> "CHANGE_NEEDS";
                default -> null;
            };
            if (fallback != null && allowed.contains(fallback)) types.add(fallback);
        }
        return types.stream().limit(1).map(ChatActionResponse::new).toList();
    }

    private static String missingSizeAnswer(Product product, boolean english) {
        List<String> availableSizes = ChatToolService.normalizedAvailableVariants(product.variants()).stream()
                .map(combination -> combination.get("size"))
                .filter(ChatSalesAdvisorService::hasText)
                .distinct()
                .toList();
        String verifiedAvailability = availableSizes.isEmpty() ? ""
                : english
                        ? "The sizes currently shown as in stock are "
                                + String.join(", ", availableSizes) + ". "
                        : "Các size đang còn hàng là "
                                + String.join(", ", availableSizes) + ". ";
        return english
                ? verifiedAvailability + "BigBike does not yet have a size guide saved for " + product.name()
                        + ", so I will not guess measurements or borrow a table from another product."
                : verifiedAvailability + "Shop chưa có hướng dẫn size của " + product.name()
                        + " vì chưa cập nhật bảng size theo số đo, nên em không đoán số đo"
                        + " và không lấy bảng size của sản phẩm khác.";
    }

    private static String authenticityAnswer(ChatAssistantSettings.Snapshot settings, boolean english) {
        ChatAssistantSettings.PolicyText policy = settings == null
                ? ChatAssistantSettings.PolicyText.empty() : settings.warrantyPolicy();
        if (!policy.available()) {
            return english
                    ? "BigBike does not have enough published warranty information to confirm this point here."
                    : "BigBike chưa có đủ thông tin bảo hành đã công bố để xác nhận điểm này ngay trong chat.";
        }
        String excerpt = firstSentences(policy.text(), 2, 520);
        return english
                ? policy.title() + ": " + excerpt
                : policy.title() + ": " + excerpt;
    }

    /** Sales prompts belong on sales answers, not on refusals or on an open question. */
    private static boolean nextStepFitsContext(
            String source,
            String resultKind,
            ChatClarificationResponse clarification,
            String answer
    ) {
        if (clarification != null) return false;
        if (NO_FOLLOW_UP_SOURCES.contains(source)) return false;
        if (NO_FOLLOW_UP_RESULT_KINDS.contains(resultKind)) return false;
        String trimmed = answer == null ? "" : answer.trim();
        return !trimmed.endsWith("?");
    }

    private static String appendNextStep(String answer, String nextStep) {
        if (!hasText(nextStep)) return answer;
        String normalizedAnswer = ChatToolService.normalize(answer);
        String normalizedStep = ChatToolService.normalize(nextStep);
        if (normalizedAnswer.endsWith(normalizedStep)) return answer;
        int allowance = MAX_ANSWER_CHARS - nextStep.length() - 2;
        String base = answer == null ? "" : answer.trim();
        if (base.length() > allowance) {
            base = base.substring(0, Math.max(0, allowance)).trim();
        }
        return base.isBlank() ? nextStep : base + "\n\n" + nextStep;
    }

    private static String append(String answer, String sentence) {
        if (!hasText(sentence)) return answer;
        return hasText(answer) ? answer.trim() + " " + sentence.trim() : sentence.trim();
    }

    private static String outcomeCode(
            String source,
            String resultKind,
            List<ChatProductCardResponse> products,
            ChatClarificationResponse clarification
    ) {
        if (ChatMessageSource.CONTACT_FALLBACK.equals(source)) return "UNANSWERED";
        if (clarification != null) return "CLARIFICATION";
        if (products != null && !products.isEmpty()) return "PRODUCTS_SHOWN";
        if ("OUT_OF_SCOPE".equals(resultKind) || "REFUSAL".equals(resultKind)) return resultKind;
        return "ANSWERED";
    }

    private static boolean isPostPurchase(String normalized) {
        return containsAny(normalized,
                "don cua toi", "don hang cua toi", "ma don", "don dang giao", "don da mua",
                "san pham da mua", "bao hanh mon da mua", "doi tra mon da mua",
                "my order", "order status", "order number", "item i bought", "purchased item");
    }

    private static boolean isPriceObjection(String normalized) {
        return containsAny(normalized,
                "dat qua", "mac qua", "gia cao", "re hon", "qua ngan sach",
                "too expensive", "price is high", "cheaper", "over budget");
    }

    private static boolean asksSize(String normalized) {
        return containsAny(normalized, "size", "kich co", "bang size", "vua khong", "fit");
    }

    private static boolean confirmsMissingSizeGuide(String normalized) {
        return containsAny(normalized,
                "chua co bang size", "chua co huong dan size", "khong co bang size",
                "no size guide", "does not have a size guide", "not have a size guide");
    }

    private static boolean asksAuthenticity(String normalized) {
        return containsAny(normalized,
                "chinh hang", "hang that", "hang fake", "hang gia", "authentic", "genuine", "fake");
    }

    private static boolean declinedCurrentProposal(String normalized) {
        return containsAny(normalized,
                "de toi xem them", "toi xem them da", "chua muon", "de suy nghi", "khong can dau",
                "let me look", "let me think", "not ready", "do not ask again");
    }

    private static boolean hasSizeGuide(Product product) {
        return product != null && (hasText(product.sizeGuide())
                || product.sizeGuideSection() != null
                        && hasText(product.sizeGuideSection().getHtml()));
    }

    private static int availableVariantCount(Product product) {
        return product == null || product.variants() == null ? 0
                : (int) product.variants().stream()
                        .filter(variant -> variant != null && variant.isAvailable()
                                && variant.stockState() == ProductStockState.IN_STOCK)
                        .count();
    }

    private static Set<String> categorySlugs(Product product) {
        Set<String> values = new LinkedHashSet<>();
        if (product == null) return values;
        if (product.category() != null && hasText(product.category().slug())) {
            values.add(product.category().slug());
        }
        if (product.categories() != null) product.categories().stream()
                .filter(category -> category != null && hasText(category.slug()))
                .map(category -> category.slug())
                .forEach(values::add);
        return values;
    }

    private static boolean disjoint(Set<String> left, Set<String> right) {
        for (String value : left) if (right.contains(value)) return false;
        return true;
    }

    private static BigDecimal effectivePrice(Product product) {
        if (product == null || product.price() == null) return null;
        BigDecimal retail = product.price().retailPrice();
        BigDecimal sale = product.price().salePrice();
        if (sale != null && sale.signum() > 0 && retail != null
                && sale.compareTo(retail) < 0) return sale;
        return retail != null && retail.signum() > 0 ? retail : null;
    }

    private static String money(BigDecimal value, boolean english) {
        NumberFormat format = NumberFormat.getIntegerInstance(
                english ? Locale.US : Locale.forLanguageTag("vi-VN"));
        return format.format(value.setScale(0, java.math.RoundingMode.HALF_UP)) + " ₫";
    }

    private static String firstSentences(String value, int limit, int maxChars) {
        if (!hasText(value)) return "";
        String[] parts = value.trim().split("(?<=[.!?])\\s+");
        List<String> selected = new ArrayList<>();
        int length = 0;
        for (String part : parts) {
            if (selected.size() >= limit || length + part.length() > maxChars) break;
            selected.add(part.trim());
            length += part.length();
        }
        String result = String.join(" ", selected);
        return result.isBlank() ? value.substring(0, Math.min(value.length(), maxChars)) : result;
    }

    private static boolean containsAny(String value, String... needles) {
        if (value == null) return false;
        for (String needle : needles) if (value.contains(needle)) return true;
        return false;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public record Advice(
            String answer,
            List<ChatProductCardResponse> products,
            List<ChatProductCardResponse> crossSellProducts,
            String salesStage,
            String outcomeCode,
            ChatNextStepResponse nextStep,
            List<ChatActionResponse> actions
    ) {
        public Advice {
            products = products == null ? List.of() : List.copyOf(products);
            crossSellProducts = crossSellProducts == null ? List.of() : List.copyOf(crossSellProducts);
            actions = actions == null ? List.of() : List.copyOf(actions);
        }
    }

    private record CheaperAlternative(ChatProductCardResponse card, String answer) {}
    private record NextStep(ChatNextStepResponse response, String copy) {}
}
