package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductFaq;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlight;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariantOption;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.order.OrderReadService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Fixed, read-only tool allowlist for Bi. No tool accepts SQL, table names or customer identity. */
@Service
@RequiredArgsConstructor
public class ChatToolService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter EN_DATE =
            DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US);
    private static final Pattern PRODUCT_URL = Pattern.compile(
            "/(?:product|san-pham|sp)/([a-z0-9-]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern COLOR_REQUEST = Pattern.compile(
            "\\b(?:mau sac|mau|color|colour)\\s+([a-z0-9]+)\\b");
    private static final Pattern SIZE_REQUEST = Pattern.compile(
            "\\b(?:size|kich co)\\s*[:：-]?\\s*([a-z0-9]+)\\b");
    /**
     * CHAT_RULE_017: variant questions are request framing, not product identifiers. The
     * pattern is deliberately contextual: a concrete option such as "size M" is left for the
     * option filter, while "co size va mau nao" is removed from the name/model query.
     */
    private static final Pattern VARIANT_INQUIRY = Pattern.compile(
            "\\b(?:co\\s+)?(?:size|sizes|kich co|mau sac|mau|color|colour)"
                    + "(?:\\s+(?:va|and)\\s+(?:size|sizes|kich co|mau sac|mau|color|colour))*"
                    + "\\s+(?:nao|gi|any|available)(?:\\s+khong)?\\b");
    /** "theo ngân sách" narrows intent but does not name a product. */
    private static final Pattern BUDGET_FRAMING = Pattern.compile(
            "\\b(?:theo|trong)\\s+(?:ngan sach|budget|tam gia)\\b");
    private static final Set<String> NON_VALUE_OPTION_TOKENS = Set.of(
            "va", "and", "or", "nao", "gi", "any", "available", "khong");

    // CHAT_RULE_015 — price is read on the diacritic-stripped question, so an unaccented
    // customer ("tu 5 trieu") parses exactly like an accented one.
    /** "3 - 5 triệu", "300 đến 500k": the leading number borrows the trailing unit. */
    private static final Pattern SHARED_UNIT_RANGE = Pattern.compile(
            "(\\d+(?:[.,]\\d+)?)\\s*(?:-|–|—|~|den|toi|to|and)\\s*(\\d+(?:[.,]\\d+)?)"
                    + "\\s*(trieu|tr|million|nghin|ngan|k)(?![a-z0-9])");
    /** "5 triệu", "5tr", "500k", "500 nghìn". */
    private static final Pattern UNIT_AMOUNT = Pattern.compile(
            "(\\d+(?:[.,]\\d+)?)\\s*(trieu|tr|million|nghin|ngan|k)(?![a-z0-9])");
    /** "5.000.000", "500,000đ" — grouped plain đồng amounts. */
    private static final Pattern PLAIN_AMOUNT = Pattern.compile(
            "(\\d{1,3}(?:[.,]\\d{3})+)\\s*(?:vnd|dong|d)?(?![a-z0-9])");

    private static final List<String> MAX_MARKERS_BEFORE = List.of(
            "duoi", "khong qua", "khong hon", "khong toi", "toi da", "it hon", "thap hon",
            "re hon", "under", "below", "less than", "up to", "max", "cheaper than");
    private static final List<String> MAX_MARKERS_AFTER = List.of(
            "do lai", "tro xuong", "do xuong", "tro lai", "or less");
    private static final List<String> MIN_MARKERS_BEFORE = List.of(
            "tu", "tren", "hon", "lon hon", "cao hon", "mac hon", "it nhat", "toi thieu",
            "from", "above", "over", "at least", "more than", "starting");
    private static final List<String> MIN_MARKERS_AFTER = List.of(
            "tro len", "do len", "tro nen", "or more", "and up", "upwards");
    /** "khoảng 2 triệu" is a band, not a ceiling — CHAT_RULE_015. */
    private static final long BAND_LOW_PERCENT = 70;
    private static final long BAND_HIGH_PERCENT = 120;

    /** Over-fetch so dropping unpriced rows (CHAT_RULE_017) still leaves five results. */
    private static final int SEARCH_PAGE_SIZE = 10;
    /** Identifier search stays bounded before the tool projects at most three verified cards. */
    private static final int DISCOVERY_CANDIDATE_LIMIT = 100;
    private static final int MAX_TOOL_RESPONSE_CHARS = 12_000;

    private static final Map<String, String> CATEGORY_KEYWORDS = categoryKeywords();
    private static final Map<String, String> BRAND_KEYWORDS = brandKeywords();
    private static final Set<String> GENERIC_PRODUCT_TOKENS = genericProductTokens();

    private final CatalogReadService catalogReadService;
    private final OrderReadService orderReadService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ToolOutcome resolve(
            String question,
            String lang,
            UUID customerId,
            ChatAssistantSettings.Snapshot settings
    ) {
        return resolve(question, lang, customerId, settings, ConversationContext.empty());
    }

    /**
     * Direct service entry point retained for regression tests and internal callers. Production
     * chat supplies the persisted, derived context through {@link ToolContext}; it never sends
     * raw conversation history to Gemini.
     */
    ToolOutcome resolve(
            String question,
            String lang,
            UUID customerId,
            ChatAssistantSettings.Snapshot settings,
            ConversationContext conversationContext
    ) {
        String normalized = normalize(question);
        boolean english = "en".equals(lang);

        Optional<ToolOutcome> fastPath = resolveFastPath(
                question, lang, customerId, settings, conversationContext);
        if (fastPath.isPresent()) return fastPath.get();
        // Kept for direct service callers and legacy regression tests. Production chat uses
        // resolveFastPath followed by Gemini function selection for signed-in orders.
        if (isOrderQuestion(normalized)) {
            return orderOutcome(customerId, english, orderScope(normalized));
        }
        return productOutcome(question, normalized, lang, english, true, conversationContext);
    }

    /** Local answers that are deterministic and do not need Gemini or a data-bearing tool. */
    public Optional<ToolOutcome> resolveFastPath(
            String question,
            String lang,
            UUID customerId,
            ChatAssistantSettings.Snapshot settings
    ) {
        return resolveFastPath(question, lang, customerId, settings, ConversationContext.empty());
    }

    /**
     * Context is a server-derived summary only. It is used for deterministic follow-ups such as
     * "tôi đăng nhập rồi" and for the next allow-listed product tool, never as model history.
     */
    public Optional<ToolOutcome> resolveFastPath(
            String question,
            String lang,
            UUID customerId,
            ChatAssistantSettings.Snapshot settings,
            ConversationContext conversationContext
    ) {
        String normalized = normalize(question);
        boolean english = "en".equals(lang);

        if (isLoginAcknowledgement(normalized)
                && conversationContext.awaitingOrderLogin()
                && customerId != null) {
            return Optional.of(orderOutcome(customerId, english, OrderScope.LATEST));
        }

        if (isGreetingOrHelp(normalized)) {
            return Optional.of(ToolOutcome.local(
                    english
                            ? "Hello, I’m Bi, BigBike’s virtual assistant. I can help you find currently sold products, check verified store policies or view orders on your signed-in account. Tell me the product, brand, category or price range you are considering, or choose Talk to staff for direct help."
                            : "Dạ, em là Bi, trợ lý ảo của BigBike. Em có thể tìm sản phẩm đang bán, tra chính sách đã công bố hoặc xem đơn của tài khoản đang đăng nhập. Anh/chị cho em biết tên hàng, thương hiệu, danh mục hoặc tầm giá đang quan tâm; nếu cần, anh/chị có thể bấm Gặp nhân viên.",
                    "TEMPLATE", false, false, false));
        }
        if (isAmbiguousComparison(question, normalized)) {
            return Optional.of(ToolOutcome.local(
                    english
                            ? "I can compare products once you share the names or links of the models you want to compare. Which two or three models should I check for you?"
                            : "Dạ, em có thể so sánh khi anh/chị cho em tên hoặc link của các mẫu cần xem. Anh/chị muốn so sánh hai hoặc ba mẫu nào ạ?",
                    "TEMPLATE", false, false, false));
        }
        if (isAmbiguousBudget(normalized)) {
            return Optional.of(ToolOutcome.local(
                    english
                            ? "I can filter products once I know your budget. What price range would you like me to check?"
                            : "Dạ, em có thể lọc sản phẩm theo ngân sách. Anh/chị muốn xem trong tầm giá nào ạ?",
                    "TEMPLATE", false, false, false));
        }
        if (isLeadDecline(normalized)) {
            return Optional.of(ToolOutcome.local(
                    english
                            ? "No problem — I won’t ask for your contact details again. You can keep chatting with me or choose Talk to staff at any time. Your contact options will remain available if you change your mind."
                            : "Dạ không sao ạ, em sẽ không hỏi lại thông tin liên hệ. Anh/chị vẫn có thể hỏi tiếp hoặc bấm Gặp nhân viên bất cứ lúc nào. Các kênh liên hệ vẫn được giữ sẵn nếu anh/chị đổi ý.",
                    "TEMPLATE", false, false, true));
        }
        if (isHumanHandoff(normalized)) {
            return Optional.of(ToolOutcome.local(
                    english
                            ? "This request needs a BigBike staff member to review it directly. Please choose Talk to staff below so the team can help without making an unsupported promise. I’ll keep the contact options available."
                            : "Trường hợp này cần nhân viên BigBike kiểm tra trực tiếp để hỗ trợ đúng chính sách. Anh/chị bấm Gặp nhân viên bên dưới giúp em nhé; em không tự hứa giảm giá, ngày giao hoặc ngoại lệ đổi trả. Các kênh liên hệ luôn được giữ sẵn.",
                    "TEMPLATE", false, true, false));
        }
        if (isOrderQuestion(normalized) && customerId == null) {
            return Optional.of(orderOutcome(null, english, orderScope(normalized)));
        }
        if (isOrderQuestion(normalized)) {
            return Optional.of(orderOutcome(customerId, english, orderScope(normalized)));
        }
        if (isShopInfoQuestion(normalized)) {
            return Optional.of(shopInfoOutcome(settings, english));
        }
        if (isPolicyQuestion(normalized)) {
            return Optional.of(policyOutcome(normalized, english));
        }
        if (isKnownOffTopic(normalized)) {
            return Optional.of(ToolOutcome.local(
                    english
                            ? "I can only help with products currently sold by BigBike, store policies and your signed-in orders. I can’t advise on motorcycles, politics or topics outside the shop. Please choose Talk to staff if you need other help from BigBike."
                            : "Em chỉ hỗ trợ sản phẩm BigBike đang bán, chính sách cửa hàng và đơn của tài khoản đã đăng nhập. Em không tư vấn xe, chính trị hoặc nội dung ngoài phạm vi shop. Anh/chị có thể bấm Gặp nhân viên nếu cần BigBike hỗ trợ việc khác.",
                    "TEMPLATE", true, false, false));
        }
        return Optional.empty();
    }

    private ToolOutcome productOutcome(
            String question,
            String normalized,
            String lang,
            boolean english,
            boolean includeDetail,
            ConversationContext conversationContext
    ) {
        PriceIntent requested = extractPriceIntent(normalized);
        CatalogIntent catalogIntent = effectiveCatalogIntent(question, lang, conversationContext);
        String category = catalogIntent.category();
        String brand = catalogIntent.brand();
        String color = extractRequestedOption(normalized, COLOR_REQUEST);
        String size = extractRequestedOption(normalized, SIZE_REQUEST);
        ProductQuery query = extractProductQuery(question, catalogIntent.metadataTokens());

        Attempt used = null;
        List<Product> products = List.of();
        for (Attempt attempt : buildAttempts(query, normalized, category, brand, color, requested)) {
            List<Product> candidates = searchAttempt(attempt, lang);
            if (attempt.price().hasBounds() && !attempt.priceDropped()) {
                // Catalog filtering is based on retail price, while the customer sees the
                // effective sale price. Merge a broad, still allow-listed page so a discounted
                // product whose retail price is above the ceiling is not silently missed.
                candidates = mergeProducts(candidates, searchAttemptWide(attempt, lang));
            }
            List<Product> items = sellable(candidates)
                    .stream()
                    .filter(product -> matchesSellingPrice(product, attempt.price()))
                    .filter(product -> matchesRequestedVariant(product, color, size, lang))
                    .toList();
            if (!items.isEmpty()) {
                used = attempt;
                products = items.stream().limit(3).toList();
                break;
            }
        }

        if (used == null) {
            return ToolOutcome.local(
                    query.hasSpecificIdentifier()
                            ? (english
                            ? "I couldn’t find that exact currently sold BigBike model. I won’t replace it with a different product, price or stock status. Please check the spelling or choose Talk to staff for a verified alternative."
                            : "Em chưa tìm thấy đúng mẫu đang bán mà anh/chị hỏi trên BigBike. Em không đổi sang sản phẩm khác hoặc đoán giá, tình trạng kho. Anh/chị kiểm tra lại tên mẫu hoặc bấm Gặp nhân viên để được gợi ý thay thế đã xác minh nhé.")
                            : (english
                            ? "I couldn’t find a currently published BigBike product matching that request. I won’t guess a product, price or stock status. Please try a shorter product name or choose Talk to staff."
                            : "Em chưa tìm thấy sản phẩm đang bán phù hợp với yêu cầu này trên BigBike. Em không đoán tên hàng, giá hoặc tình trạng kho. Anh/chị thử nhập tên sản phẩm ngắn hơn hoặc bấm Gặp nhân viên giúp em nhé."),
                    "TOOL", false, false, false);
        }

        List<ChatProductCardResponse> cards = products.stream()
                .map(ChatToolService::toCard)
                .toList();

        Map<String, Object> arguments = new LinkedHashMap<>();
        arguments.put("q", nullToEmpty(used.query()));
        arguments.put("category", nullToEmpty(used.category()));
        arguments.put("brand", nullToEmpty(used.brand()));
        arguments.put("color", nullToEmpty(used.color()));
        arguments.put("size", nullToEmpty(size));
        arguments.put("min_price", used.price().min() == null ? "" : used.price().min());
        arguments.put("max_price", used.price().max() == null ? "" : used.price().max());
        arguments.put("sort", used.sort());
        arguments.put("lang", lang);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tool", "search_products");
        payload.put("arguments", arguments);
        payload.put("requestedMinPrice", requested.min() == null ? "" : requested.min());
        payload.put("requestedMaxPrice", requested.max() == null ? "" : requested.max());
        List<String> notes = searchNotes(used, requested, english);
        Set<RequiredDisclosure> requiredDisclosures = searchDisclosures(used, requested);
        if (!notes.isEmpty()) payload.put("notes", notes);
        payload.put("results", products.stream().map(ChatToolService::productSummary).toList());

        if (includeDetail && asksForProductDetail(normalized)) {
            Product detail;
            try {
                detail = catalogReadService.getProductBySlug(products.get(0).slug(), lang);
            } catch (RuntimeException ignored) {
                return ToolOutcome.local(
                        english
                                ? "I found a matching product, but its detailed information is not available right now. I won’t guess the size, specifications or stock options. Please open the product page later or choose Talk to staff."
                                : "Em đã tìm thấy sản phẩm phù hợp nhưng thông tin chi tiết hiện chưa sẵn sàng. Em không đoán size, thông số hoặc lựa chọn tồn kho. Anh/chị thử mở trang sản phẩm sau hoặc bấm Gặp nhân viên giúp em nhé.",
                        "TOOL", false, true, false);
            }
            if (detail == null) {
                return ToolOutcome.local(
                        english
                                ? "I found a matching product, but its detailed information is not available right now. I won’t guess the size, specifications or stock options. Please open the product page later or choose Talk to staff."
                                : "Em đã tìm thấy sản phẩm phù hợp nhưng thông tin chi tiết hiện chưa sẵn sàng. Em không đoán size, thông số hoặc lựa chọn tồn kho. Anh/chị thử mở trang sản phẩm sau hoặc bấm Gặp nhân viên giúp em nhé.",
                        "TOOL", false, true, false);
            }
            payload.put("detailTool", "get_product");
            payload.put("detail", productDetail(detail));
        }

        return ToolOutcome.ai(toJson(payload), cards, requiredDisclosures);
    }

    /** Execute one already validated call. This is the only function-calling path to DB reads. */
    @Transactional(readOnly = true, timeout = 5)
    public ToolExecution execute(
            ChatToolRegistry.ValidatedCall call,
            ToolContext context,
            ToolSession session
    ) {
        session.begin(call.name());
        ToolExecution result = switch (call.name()) {
            case ChatToolRegistry.SEARCH_PRODUCTS -> executeSearch(call, context);
            case ChatToolRegistry.GET_PRODUCT -> executeGetProduct(call, context, session);
            case ChatToolRegistry.GET_POLICY -> executePolicy(call, context);
            case ChatToolRegistry.GET_SHOP_INFO -> executeShopInfo(context);
            case ChatToolRegistry.GET_MY_ORDERS -> executeOrders(call, context);
            default -> throw new IllegalArgumentException("Unsupported chat tool");
        };
        session.complete(call.name(), result.products());
        return result;
    }

    private ToolExecution executeSearch(
            ChatToolRegistry.ValidatedCall call, ToolContext context) {
        validateSearchAgainstQuestion(call, context);
        String normalized = normalize(context.question());
        ToolOutcome outcome = productOutcome(
                context.question(),
                normalized,
                context.lang(),
                "en".equals(context.lang()),
                false,
                context.conversationContext());
        if (outcome.aiRequired()) {
            DeterministicAnswer terminal = verifiedSearchAnswer(context, outcome);
            return new ToolExecution(
                    ChatToolRegistry.SEARCH_PRODUCTS,
                    outcome.toolJson(),
                    outcome.products(),
                    List.of(),
                    outcome.requiredDisclosures(),
                    terminal);
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("tool", ChatToolRegistry.SEARCH_PRODUCTS);
        response.put("results", List.of());
        response.put("notes", List.of(outcome.localAnswer()));
        return new ToolExecution(
                ChatToolRegistry.SEARCH_PRODUCTS,
                toJson(response),
                List.of(),
                outcome.actions(),
                outcome.requiredDisclosures(),
                DeterministicAnswer.from(outcome));
    }

    /**
     * A verified size/colour answer is safer and more useful than asking the model to
     * paraphrase variants. It is deliberately limited to one exact model and uses only
     * sellable variant data; broad discovery stays on the normal model path.
     */
    private DeterministicAnswer verifiedSearchAnswer(
            ToolContext context, ToolOutcome outcome) {
        DeterministicAnswer variant = verifiedVariantAnswer(context, outcome.products());
        if (variant != null) return variant;

        DeterministicAnswer availability = verifiedAvailabilityAnswer(context, outcome.products());
        if (availability != null) return availability;

        return verifiedClosestAlternativeAnswer(context, outcome);
    }

    /**
     * A one-product availability question must not depend on a prose model conclusion. The
     * product card has already passed the publication, price and in-stock checks, so this
     * answer is stable when the same model is asked repeatedly.
     */
    private DeterministicAnswer verifiedAvailabilityAnswer(
            ToolContext context, List<ChatProductCardResponse> products) {
        String normalized = normalize(context.question());
        CatalogIntent intent = effectiveCatalogIntent(
                context.question(), context.lang(), context.conversationContext());
        ProductQuery query = extractProductQuery(context.question(), intent.metadataTokens());
        if (!asksForProductAvailability(normalized)
                || !query.hasSpecificIdentifier()
                || products == null
                || products.size() != 1) {
            return null;
        }

        String name = plain(products.get(0).name(), 160);
        boolean english = "en".equals(context.lang());
        String answer = english
                ? "I found " + name + " and it is currently available at BigBike. "
                        + "Please open the product card to review its current options and details."
                : "Dạ, em đã tìm thấy " + name + " và mẫu này hiện còn hàng tại BigBike. "
                        + "Anh/chị mở thẻ sản phẩm để xem lựa chọn và thông tin hiện có nhé.";
        return new DeterministicAnswer(answer, false, false, false);
    }

    /**
     * CHAT_RULE_018: once the backend deliberately drops a price range or widens wording,
     * return the verified cards with the required disclosure instead of giving the model a
     * chance to claim a bare no-match result with no product card.
     */
    private static DeterministicAnswer verifiedClosestAlternativeAnswer(
            ToolContext context, ToolOutcome outcome) {
        if (outcome.products() == null || outcome.products().isEmpty()) return null;
        boolean english = "en".equals(context.lang());
        if (outcome.requiredDisclosures().contains(RequiredDisclosure.PRICE_RANGE_MISS)) {
            return new DeterministicAnswer(
                    english
                            ? "I could not find a currently sold product in the price range you requested. "
                                    + "The product cards below are the closest available options; please tell me if you want a different range."
                            : "Dạ, em chưa tìm thấy sản phẩm đang bán trong tầm giá anh/chị hỏi. "
                                    + "Các thẻ bên dưới là phương án gần nhất đang có; anh/chị cho em biết tầm giá khác nếu muốn em lọc tiếp nhé.",
                    false,
                    false,
                    false);
        }
        if (outcome.requiredDisclosures().contains(RequiredDisclosure.BROADENED_SEARCH)) {
            return new DeterministicAnswer(
                    english
                            ? "The product cards below come from a broader search than your original wording. "
                                    + "Please tell me a more specific name, category or budget so I can narrow the results."
                            : "Dạ, danh sách thẻ bên dưới đang rộng hơn yêu cầu ban đầu của anh/chị. "
                                    + "Anh/chị cho em tên mẫu, loại hàng hoặc tầm giá cụ thể hơn để em lọc lại nhé.",
                    false,
                    false,
                    false);
        }
        return null;
    }

    private DeterministicAnswer verifiedVariantAnswer(
            ToolContext context, List<ChatProductCardResponse> products) {
        String normalized = normalize(context.question());
        CatalogIntent intent = effectiveCatalogIntent(
                context.question(), context.lang(), context.conversationContext());
        ProductQuery query = extractProductQuery(context.question(), intent.metadataTokens());
        if (!asksForProductDetail(normalized) || !query.hasSpecificIdentifier()
                || products == null || products.size() != 1) {
            return null;
        }

        boolean english = "en".equals(context.lang());
        Product product;
        try {
            product = catalogReadService.getProductBySlug(products.get(0).slug(), context.lang());
        } catch (RuntimeException ignored) {
            return detailUnavailableAnswer(english);
        }
        if (product == null || sellable(List.of(product)).isEmpty()) {
            return detailUnavailableAnswer(english);
        }

        Map<String, List<String>> options = normalizedAvailableOptions(product.variants());
        List<String> colors = options.getOrDefault("color", List.of()).stream().limit(8).toList();
        List<String> sizes = options.getOrDefault("size", List.of()).stream().limit(8).toList();
        if (colors.isEmpty() && sizes.isEmpty()) return detailUnavailableAnswer(english);

        String optionText = optionText(colors, sizes, english);
        String name = plain(product.name(), 160);
        String answer = english
                ? "I checked " + name + " and its currently sellable options are " + optionText
                        + ". These are only variants that can currently be sold. Open the product page to choose the valid colour-and-size combination, or choose Talk to staff if you need confirmation."
                : "Dạ, em đã kiểm tra " + name + " và các lựa chọn đang bán là " + optionText
                        + ". Đây chỉ là các biến thể hiện còn có thể bán. Anh/chị mở trang sản phẩm để chọn đúng tổ hợp màu và size, hoặc bấm Gặp nhân viên nếu cần xác nhận thêm nhé.";
        return new DeterministicAnswer(answer, false, false, false);
    }

    private static String optionText(List<String> colors, List<String> sizes, boolean english) {
        List<String> parts = new ArrayList<>();
        if (!colors.isEmpty()) {
            parts.add((english ? "colours " : "màu ") + String.join(", ", colors));
        }
        if (!sizes.isEmpty()) {
            parts.add((english ? "sizes " : "size ") + String.join(", ", sizes));
        }
        return String.join(english ? "; " : "; ", parts);
    }

    private static DeterministicAnswer detailUnavailableAnswer(boolean english) {
        return new DeterministicAnswer(
                english
                        ? "I found the matching product, but I can’t verify its currently sellable size or colour options right now. I won’t guess the options. Please choose Talk to staff so BigBike can check it directly."
                        : "Dạ, em đã tìm thấy sản phẩm phù hợp nhưng chưa xác minh được lựa chọn size hoặc màu đang bán. Em không đoán các lựa chọn này. Anh/chị bấm Gặp nhân viên để BigBike kiểm tra trực tiếp giúp mình nhé.",
                false,
                true,
                false);
    }

    private void validateSearchAgainstQuestion(
            ChatToolRegistry.ValidatedCall call, ToolContext context) {
        Map<String, Object> arguments = call.arguments();
        if (!context.lang().equals(arguments.get("lang"))) {
            throw new IllegalArgumentException("Tool language does not match request");
        }
        String normalized = normalize(context.question());
        PriceIntent price = extractPriceIntent(normalized);
        assertOptionalBound(arguments, "minPrice", price.min());
        assertOptionalBound(arguments, "maxPrice", price.max());

        CatalogIntent catalogIntent = effectiveCatalogIntent(
                context.question(), context.lang(), context.conversationContext());
        assertOptionalCatalogFilter(arguments, "category", catalogIntent.category(), normalized);
        assertOptionalCatalogFilter(arguments, "brand", catalogIntent.brand(), normalized);

        for (String field : List.of("query", "color", "size")) {
            Object raw = arguments.get(field);
            if (raw instanceof String text && !allTokensAppear(normalized, text)) {
                throw new IllegalArgumentException("Tool filter is not grounded in the question");
            }
        }
        Object sort = arguments.get("sort");
        if (sort != null && !sortFor(price, normalized).equals(sort)) {
            throw new IllegalArgumentException("Tool sort conflicts with the question");
        }
    }

    private static void assertOptionalBound(
            Map<String, Object> arguments, String field, Long protectedValue) {
        Object supplied = arguments.get(field);
        if (supplied == null) return;
        if (protectedValue == null || !protectedValue.equals(supplied)) {
            throw new IllegalArgumentException("Tool price conflicts with the question");
        }
    }

    private static void assertOptionalCatalogFilter(
            Map<String, Object> arguments,
            String field,
            String protectedValue,
            String normalizedQuestion
    ) {
        Object supplied = arguments.get(field);
        if (!(supplied instanceof String text)) return;
        String normalizedValue = normalize(text).replace('-', ' ');
        boolean matchesProtected = protectedValue != null
                && normalize(protectedValue).replace('-', ' ').equals(normalizedValue);
        if (!matchesProtected && !allTokensAppear(normalizedQuestion, normalizedValue)) {
            throw new IllegalArgumentException("Tool catalog filter is not grounded in the question");
        }
    }

    private static boolean allTokensAppear(String normalizedQuestion, String candidate) {
        String normalizedCandidate = normalize(candidate)
                .replace('-', ' ')
                .replaceAll("[^\\p{Alnum}/]+", " ")
                .trim();
        List<String> tokens = List.of(normalizedCandidate.split("\\s+"));
        return !tokens.isEmpty() && tokens.stream()
                .filter(token -> !token.isBlank())
                .allMatch(token -> hasWord(normalizedQuestion, token));
    }

    /**
     * Resolves public catalogue metadata at request time instead of maintaining a second,
     * fallible list of brands and category names in chat code. This keeps matching invariant
     * for casing, accents, punctuation and spacing while keeping the catalogue itself out of
     * the model prompt (CHAT_RULE_003–005 and CHAT_RULE_017).
     */
    private CatalogIntent resolveCatalogIntent(String question, String lang) {
        String normalized = normalize(question);
        if (normalized.isBlank()) return CatalogIntent.empty();

        List<CatalogAlias> categoryAliases = new ArrayList<>();
        Set<String> categorySlugs = new LinkedHashSet<>();
        try {
            // Load both public localizations: an English storefront must still understand a
            // Vietnamese category word and vice versa, but we never send either list to Gemini.
            addCategoryAliases(categoryAliases, categorySlugs, catalogReadService.listAssistantCategories("vi"));
            addCategoryAliases(categoryAliases, categorySlugs, catalogReadService.listAssistantCategories("en"));
        } catch (RuntimeException ignored) {
            // A temporary metadata-read failure must not turn into an invented category. The
            // later allow-listed search will either verify a product or give the safe fallback.
        }

        Optional<CatalogAlias> categoryMatch = bestCatalogAlias(normalized, categoryAliases);
        String category = categoryMatch.map(CatalogAlias::target).orElse(null);
        Set<String> metadataTokens = new LinkedHashSet<>();
        categoryMatch.ifPresent(match -> addPhraseTokens(metadataTokens, match.phrase()));

        // The compact generic aliases are only a convenience for common product types. They
        // are verified against public metadata when it is available. If that metadata read is
        // temporarily unavailable, this lexical adapter can still pass the known category slug
        // to the catalogue layer; that layer treats an unknown slug as an empty result, never as
        // a broad product match.
        if (category == null) {
            String legacyCategory = matchKeyword(normalized, CATEGORY_KEYWORDS);
            if (legacyCategory != null
                    && (categorySlugs.isEmpty() || categorySlugs.contains(legacyCategory))) {
                category = legacyCategory;
                CATEGORY_KEYWORDS.entrySet().stream()
                        .filter(entry -> legacyCategory.equals(entry.getValue()))
                        .filter(entry -> phraseMatches(normalized, entry.getKey()))
                        .findFirst()
                        .ifPresent(entry -> addPhraseTokens(metadataTokens, entry.getKey()));
            }
        }
        if (category != null) addPhraseTokens(metadataTokens, category);

        List<CatalogAlias> brandAliases = new ArrayList<>();
        try {
            for (Brand brand : catalogReadService.listAssistantBrands()) {
                if (brand == null || !brand.isVisible() || blankToNull(brand.slug()) == null) continue;
                addSourceAliases(brandAliases, brand.slug(), brand.name());
                addSourceAliases(brandAliases, brand.slug(), brand.slug());
            }
        } catch (RuntimeException ignored) {
            // See category handling above. No static brand table is used as a fallback.
        }
        Optional<CatalogAlias> brandMatch = bestCatalogAlias(normalized, brandAliases);
        String brand = brandMatch.map(CatalogAlias::target).orElse(null);
        brandMatch.ifPresent(match -> addPhraseTokens(metadataTokens, match.phrase()));
        if (brand != null) addPhraseTokens(metadataTokens, brand);

        return new CatalogIntent(category, brand, Set.copyOf(metadataTokens));
    }

    /**
     * The prior turn may constrain a short follow-up such as "Cho tôi 3 sản phẩm dưới 3 tr".
     * Only a small, server-derived catalog scope is carried; a new explicit category, brand or
     * model always wins, and raw message text is never reused or sent to the provider.
     */
    private CatalogIntent effectiveCatalogIntent(
            String question,
            String lang,
            ConversationContext conversationContext
    ) {
        CatalogIntent direct = resolveCatalogIntent(question, lang);
        ConversationContext context = conversationContext == null
                ? ConversationContext.empty() : conversationContext;
        if (!shouldApplyConversationCatalogScope(question, direct, context)) {
            return direct;
        }
        Set<String> tokens = new LinkedHashSet<>(direct.metadataTokens());
        if (context.category() != null) addPhraseTokens(tokens, context.category());
        if (context.brand() != null) addPhraseTokens(tokens, context.brand());
        return new CatalogIntent(
                direct.category() == null ? context.category() : direct.category(),
                direct.brand() == null ? context.brand() : direct.brand(),
                Set.copyOf(tokens));
    }

    private boolean shouldApplyConversationCatalogScope(
            String question,
            CatalogIntent direct,
            ConversationContext context
    ) {
        if (!context.hasCatalogScope()
                || direct.category() != null
                || direct.brand() != null) {
            return false;
        }
        ProductQuery query = extractProductQuery(question, direct.metadataTokens());
        if (query.hasSpecificIdentifier()) return false;
        String normalized = normalize(question);
        return isProductFollowUp(normalized);
    }

    /** A generic price/count request is meaningful only after a product scope was established. */
    private static boolean isProductFollowUp(String normalized) {
        return extractPriceIntent(normalized).hasBounds()
                || hasWord(normalized,
                        "san pham", "hang", "product", "products", "item", "items",
                        "tim", "show", "xem", "cho toi", "cho minh", "them", "tiep");
    }

    /**
     * Builds the persisted context after a safe turn. It holds only public catalog constraints
     * and fixed local route state; it deliberately cannot contain customer prose or PII.
     */
    public ConversationContext recordConversationContext(
            ConversationContext previous,
            String question,
            String lang,
            List<ChatProductCardResponse> products,
            List<ChatActionResponse> actions
    ) {
        ConversationContext prior = previous == null ? ConversationContext.empty() : previous;
        CatalogIntent direct = resolveCatalogIntent(question, lang);
        String normalized = normalize(question);
        PriceIntent price = extractPriceIntent(normalized);
        ProductQuery query = extractProductQuery(question, direct.metadataTokens());
        boolean productScopeMentioned = direct.category() != null
                || direct.brand() != null
                || query.hasSpecificIdentifier()
                || isProductFollowUp(normalized);

        String category = direct.category() != null ? direct.category() : prior.category();
        String brand = direct.brand() != null ? direct.brand() : prior.brand();
        Long minPrice = price.hasBounds() ? price.min() : prior.minPrice();
        Long maxPrice = price.hasBounds() ? price.max() : prior.maxPrice();
        if (!productScopeMentioned) {
            // Keep the last verified catalog scope for a later short follow-up, but do not use
            // it unless shouldApplyConversationCatalogScope() says the new message is product-related.
            category = prior.category();
            brand = prior.brand();
            minPrice = prior.minPrice();
            maxPrice = prior.maxPrice();
        }

        List<String> slugs = products == null || products.isEmpty()
                ? prior.productSlugs()
                : products.stream()
                        .filter(product -> product != null && product.slug() != null)
                        .map(ChatProductCardResponse::slug)
                        .map(String::trim)
                        .filter(slug -> !slug.isBlank())
                        .distinct()
                        .limit(3)
                        .toList();
        boolean askedToLogin = actions != null && actions.stream()
                .anyMatch(action -> action != null && "LOGIN".equals(action.type()));
        boolean reachedOrderHistory = actions != null && actions.stream()
                .anyMatch(action -> action != null && "ORDER_HISTORY".equals(action.type()));
        boolean awaitingOrderLogin = askedToLogin || (!reachedOrderHistory && prior.awaitingOrderLogin());
        return new ConversationContext(
                category, brand, minPrice, maxPrice, slugs, awaitingOrderLogin);
    }

    private static void addCategoryAliases(
            List<CatalogAlias> aliases, Set<String> slugs, List<Category> categories) {
        if (categories == null) return;
        for (Category category : categories) {
            if (category == null || !category.isVisible() || category.deleted()
                    || blankToNull(category.slug()) == null) {
                continue;
            }
            slugs.add(category.slug());
            addSourceAliases(aliases, category.slug(), category.name());
            addSourceAliases(aliases, category.slug(), category.slug());
            addSourceAliases(aliases, category.slug(), category.slugEn());
        }
    }

    /** Adds full and short public aliases, e.g. "tai nghe" from a longer category title. */
    private static void addSourceAliases(List<CatalogAlias> aliases, String target, String source) {
        String phrase = normalize(source).replaceAll("[^\\p{Alnum}]+", " ").trim();
        if (blankToNull(target) == null || phrase.isBlank()) return;
        String[] tokens = phrase.split("\\s+");
        int maxLength = Math.min(tokens.length, 4);
        for (int size = 1; size <= maxLength; size++) {
            for (int start = 0; start + size <= tokens.length; start++) {
                String alias = String.join(" ", List.of(tokens).subList(start, start + size));
                if (!alias.isBlank()) aliases.add(new CatalogAlias(target, alias, size));
            }
        }
    }

    private static Optional<CatalogAlias> bestCatalogAlias(
            String normalizedQuestion, List<CatalogAlias> aliases) {
        List<CatalogAlias> matches = aliases.stream()
                .filter(alias -> phraseMatches(normalizedQuestion, alias.phrase()))
                .sorted(Comparator.comparingInt(CatalogAlias::wordCount).reversed()
                        .thenComparing(Comparator.comparingInt(
                                (CatalogAlias alias) -> alias.phrase().length()).reversed()))
                .toList();
        if (matches.isEmpty()) return Optional.empty();
        CatalogAlias best = matches.get(0);
        boolean ambiguous = matches.stream()
                .filter(match -> match.wordCount() == best.wordCount()
                        && match.phrase().length() == best.phrase().length())
                .map(CatalogAlias::target)
                .distinct()
                .count() > 1;
        return ambiguous ? Optional.empty() : Optional.of(best);
    }

    private static boolean phraseMatches(String normalizedQuestion, String normalizedAlias) {
        String question = padWords(normalizedQuestion);
        String alias = normalize(normalizedAlias).replaceAll("[^\\p{Alnum}]+", " ").trim();
        if (alias.isBlank()) return false;
        if (question.contains(" " + alias + " ")) return true;
        String compactAlias = alias.replace(" ", "");
        if (compactAlias.length() < 3) return false;
        String compactQuestion = normalizedQuestion.replaceAll("[^\\p{Alnum}]+", "");
        return compactQuestion.contains(compactAlias);
    }

    private ToolExecution executeGetProduct(
            ChatToolRegistry.ValidatedCall call, ToolContext context, ToolSession session) {
        String slug = (String) call.arguments().get("slug");
        if (!session.isAllowedSlug(slug) && !customerSuppliedExactSlug(context.question(), slug)) {
            throw new IllegalArgumentException("Product slug was not verified in this turn");
        }
        Product product = catalogReadService.getProductBySlug(slug, context.lang());
        if (product == null || sellable(List.of(product)).isEmpty()) {
            throw new IllegalArgumentException("Product is not publicly sellable");
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("tool", ChatToolRegistry.GET_PRODUCT);
        response.put("result", productDetail(product));
        return new ToolExecution(
                ChatToolRegistry.GET_PRODUCT,
                toJson(response),
                List.of(toCard(product)),
                List.of());
    }

    /** A model may not turn a product name into a guessed slug; only an exact slug/URL qualifies. */
    private static boolean customerSuppliedExactSlug(String question, String slug) {
        if (question == null || slug == null || slug.isBlank()) return false;
        Matcher productUrl = PRODUCT_URL.matcher(question);
        while (productUrl.find()) {
            if (slug.equalsIgnoreCase(productUrl.group(1))) return true;
        }
        String rawTokens = normalize(question)
                .replaceAll("[^\\p{Alnum}-]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return (" " + rawTokens + " ").contains(" " + slug.toLowerCase(Locale.ROOT) + " ");
    }

    private ToolExecution executePolicy(
            ChatToolRegistry.ValidatedCall call, ToolContext context) {
        String topic = (String) call.arguments().get("topic");
        if (!policyTopicMatchesQuestion(normalize(context.question()), topic)) {
            throw new IllegalArgumentException("Policy tool is not grounded in the question");
        }
        String policyQuestion = switch (topic) {
            case "warranty" -> "warranty";
            case "return_exchange" -> "return exchange";
            case "payment" -> "payment";
            case "shipping" -> "shipping";
            case "size" -> "size guide";
            default -> throw new IllegalArgumentException("Unsupported policy topic");
        };
        ToolOutcome policy = policyOutcome(policyQuestion, "en".equals(context.lang()));
        return new ToolExecution(
                ChatToolRegistry.GET_POLICY,
                toJson(Map.of("tool", ChatToolRegistry.GET_POLICY,
                        "topic", topic, "policy", policy.localAnswer())),
                List.of(),
                List.of());
    }

    private ToolExecution executeShopInfo(ToolContext context) {
        if (!isShopInfoQuestion(normalize(context.question()))) {
            throw new IllegalArgumentException("Shop-info tool is not grounded in the question");
        }
        ChatAssistantSettings.Snapshot settings = context.settings();
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("hotline", nullToEmpty(settings.contacts().hotline()));
        info.put("zalo", nullToEmpty(settings.contacts().zaloDisplay()));
        info.put("messenger", nullToEmpty(settings.contacts().messengerDisplay()));
        info.put("address", nullToEmpty(settings.address()));
        info.put("openingHours", List.of(
                nullToEmpty(settings.openingHoursWeekday()),
                nullToEmpty(settings.openingHoursWeekend())).stream().filter(value -> !value.isBlank()).toList());
        return new ToolExecution(
                ChatToolRegistry.GET_SHOP_INFO,
                toJson(Map.of("tool", ChatToolRegistry.GET_SHOP_INFO, "shop", info)),
                List.of(),
                List.of());
    }

    private ToolExecution executeOrders(
            ChatToolRegistry.ValidatedCall call, ToolContext context) {
        if (!isOrderQuestion(normalize(context.question()))) {
            throw new IllegalArgumentException("Order tool is not grounded in the question");
        }
        if (context.customerId() == null) {
            throw new IllegalArgumentException("Signed-in customer is required");
        }
        String scope = (String) call.arguments().get("scope");
        int limit = "latest".equals(scope) ? 1 : 5;
        List<Map<String, Object>> summaries = orderReadService
                .listCustomerOrderSummaries(context.customerId(), limit).stream()
                .limit(limit)
                .map(ChatToolService::orderSummary)
                .toList();
        List<ChatActionResponse> actions = summaries.isEmpty()
                ? List.of() : List.of(new ChatActionResponse("ORDER_HISTORY"));
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("tool", ChatToolRegistry.GET_MY_ORDERS);
        response.put("scope", scope);
        response.put("orders", summaries);
        return new ToolExecution(
                ChatToolRegistry.GET_MY_ORDERS, toJson(response), List.of(), actions);
    }

    private static Map<String, Object> orderSummary(
            OrderReadService.CustomerOrderSummary order) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("orderNumber", nullToEmpty(order.orderNumber()));
        summary.put("status", nullToEmpty(order.status()));
        summary.put("placedAt", order.placedAt() == null ? "" : order.placedAt().toString());
        summary.put("createdAt", order.createdAt() == null ? "" : order.createdAt().toString());
        summary.put("totalAmount", order.totalAmount() == null ? "" : order.totalAmount());
        summary.put("currency", nullToEmpty(order.currency()));
        return Map.copyOf(summary);
    }

    /**
     * Ordered search attempts, narrowest first. CHAT_RULE_018: an attempt that drops the
     * price filter or widens the keyword is flagged so Bi has to admit it to the customer;
     * there is deliberately no "empty keyword, no filter" whole-catalogue sweep.
     */
    private static List<Attempt> buildAttempts(
            ProductQuery productQuery,
            String normalized,
            String category,
            String brand,
            String color,
            PriceIntent price
    ) {
        if (productQuery.hasSpecificIdentifier()) {
            return buildIdentifierAttempts(productQuery, normalized, category, brand, color, price);
        }
        return buildGenericAttempts(productQuery.text(), normalized, category, brand, color, price);
    }

    /**
     * Keep every model/name identifier on every retry. This prevents a named request from
     * degrading into a generic category sweep when the exact catalogue match is absent.
     */
    private static List<Attempt> buildIdentifierAttempts(
            ProductQuery query,
            String normalized,
            String category,
            String brand,
            String color,
            PriceIntent price
    ) {
        String sort = sortFor(price, normalized);
        List<Attempt> attempts = new ArrayList<>();
        attempts.add(new Attempt(query.text(), category, brand, color, price, sort, false, false,
                query.identifiers()));
        if (price.hasBounds()) {
            String nearest = price.kind() == PriceKind.MIN ? "price:desc" : "price:asc";
            attempts.add(new Attempt(query.text(), category, brand, color, PriceIntent.none(), nearest,
                    false, true, query.identifiers()));
        }
        return attempts;
    }

    private static List<Attempt> buildGenericAttempts(
            String query, String normalized, String category, String brand, String color, PriceIntent price) {
        String sort = sortFor(price, normalized);
        String freeText = blankToNull(query);
        String widerKeyword = blankToNull(fallbackProductQuery(normalized));
        boolean filtered = category != null || brand != null;

        List<Attempt> attempts = new ArrayList<>();
        attempts.add(new Attempt(freeText, category, brand, color, price, sort, false, false, List.of()));
        if (freeText != null && filtered) {
            // A category/brand filter makes this fallback safe, but removing a customer word is
            // still broader than the original request. Flag it so Bi keeps useful cards while
            // clearly labelling them as close alternatives.
            attempts.add(new Attempt(null, category, brand, color, price, sort, true, false, List.of()));
        }
        if (freeText != null && !filtered && widerKeyword != null
                && !widerKeyword.equalsIgnoreCase(freeText)) {
            attempts.add(new Attempt(widerKeyword, null, null, color, price, sort, true, false, List.of()));
        }
        if (price.hasBounds()) {
            // Nothing in the asked range: show the closest side of it, never the cheapest junk.
            String nearest = price.kind() == PriceKind.MIN ? "price:desc" : "price:asc";
            PriceIntent unpriced = PriceIntent.none();
            if (filtered) {
                attempts.add(new Attempt(null, category, brand, color, unpriced, nearest, false, true, List.of()));
            } else {
                if (freeText != null) {
                    attempts.add(new Attempt(freeText, null, null, color, unpriced, nearest, false, true, List.of()));
                }
                if (widerKeyword != null) {
                    attempts.add(new Attempt(widerKeyword, null, null, color, unpriced, nearest, true, true, List.of()));
                }
            }
        }
        return attempts;
    }

    private static List<String> searchNotes(
            Attempt used, PriceIntent requested, boolean english) {
        List<String> notes = new ArrayList<>();
        if (used.priceDropped() && requested.hasBounds()) {
            notes.add(english
                    ? "BigBike currently sells nothing in the price range the customer asked for. Say that plainly first, then present these as the closest available options. Never imply they match the range."
                    : "BigBike hiện không có sản phẩm nào trong tầm giá khách hỏi. Phải nói rõ điều đó trước, rồi mới giới thiệu đây là phương án gần nhất. Không được để khách hiểu nhầm là đúng tầm giá.");
        }
        if (used.broadened()) {
            notes.add(english
                    ? "The exact wording matched nothing, so this list is wider than the request. Tell the customer the list is broader and invite them to narrow it down."
                    : "Đúng từ khách gõ thì không ra kết quả nên danh sách này rộng hơn yêu cầu. Phải nói rõ danh sách đang rộng hơn và mời khách nói cụ thể hơn.");
        }
        return notes;
    }

    private static Set<RequiredDisclosure> searchDisclosures(
            Attempt used, PriceIntent requested) {
        Set<RequiredDisclosure> disclosures = new LinkedHashSet<>();
        if (used.priceDropped() && requested.hasBounds()) {
            disclosures.add(RequiredDisclosure.PRICE_RANGE_MISS);
        }
        if (used.broadened()) {
            disclosures.add(RequiredDisclosure.BROADENED_SEARCH);
        }
        return Set.copyOf(disclosures);
    }

    /** CHAT_RULE_017: a product with no sellable price must never be quoted to a customer. */
    private static List<Product> sellable(List<Product> items) {
        return items.stream()
                .filter(product -> product != null)
                .filter(ChatToolService::hasSellablePrice)
                .filter(ChatToolService::hasSellableCurrency)
                .filter(ChatToolService::isCurrentlySellable)
                .toList();
    }

    private static List<Product> mergeProducts(List<Product> first, List<Product> second) {
        Map<String, Product> merged = new LinkedHashMap<>();
        for (Product product : first) {
            if (product != null) merged.put(product.slug(), product);
        }
        for (Product product : second) {
            if (product != null) merged.putIfAbsent(product.slug(), product);
        }
        return List.copyOf(merged.values());
    }

    private static boolean hasSellablePrice(Product product) {
        BigDecimal effective = effectiveSellingPrice(product);
        return effective != null && effective.signum() > 0;
    }

    private static boolean hasSellableCurrency(Product product) {
        return product.price() != null && "VND".equalsIgnoreCase(product.price().currency());
    }

    private static boolean isCurrentlySellable(Product product) {
        if (product.publishStatus()
                != com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED
                || !Boolean.TRUE.equals(product.available())
                || product.stockState()
                != com.bigbike.bigbike_backend.domain.catalog.ProductStockState.IN_STOCK) {
            return false;
        }
        if (product.variants() != null && !product.variants().isEmpty()) {
            return product.variants().stream().anyMatch(variant ->
                    variant != null
                            && variant.isAvailable()
                            && variant.stockState()
                            == com.bigbike.bigbike_backend.domain.catalog.ProductStockState.IN_STOCK);
        }
        return true;
    }

    private static boolean matchesSellingPrice(Product product, PriceIntent intent) {
        if (!intent.hasBounds()) return true;
        BigDecimal value = effectiveSellingPrice(product);
        if (value == null || value.signum() <= 0) return false;
        if (intent.min() != null && value.compareTo(BigDecimal.valueOf(intent.min())) < 0) return false;
        // CHAT_RULE_015: a ceiling is exclusive for "dưới"/"under".
        if (intent.max() != null && intent.kind() == PriceKind.MAX
                && value.compareTo(BigDecimal.valueOf(intent.max())) >= 0) return false;
        return intent.max() == null || value.compareTo(BigDecimal.valueOf(intent.max())) <= 0;
    }

    private static BigDecimal effectiveSellingPrice(Product product) {
        if (product.price() == null) return null;
        BigDecimal sale = product.price().salePrice();
        BigDecimal retail = product.price().retailPrice();
        if (sale != null && sale.signum() > 0 && retail != null && retail.signum() > 0
                && sale.compareTo(retail) < 0) return sale;
        return retail;
    }

    private boolean matchesRequestedVariant(Product product, String color, String size, String lang) {
        if (color == null && size == null) return true;
        Product source = product;
        if (product.variants() == null || product.variants().isEmpty()
                || product.variants().stream().filter(variant -> variant != null).noneMatch(
                        variant -> variant.options() != null && !variant.options().isEmpty())) {
            try {
                source = catalogReadService.getProductBySlug(product.slug(), lang);
            } catch (RuntimeException ignored) {
                return false;
            }
        }
        if (source == null || source.variants() == null || source.variants().isEmpty()) return false;
        return source.variants().stream()
                .filter(variant -> variant != null)
                .filter(variant -> variant.isAvailable()
                        && variant.stockState()
                        == com.bigbike.bigbike_backend.domain.catalog.ProductStockState.IN_STOCK)
                .anyMatch(variant -> variant.options() != null && variant.options().stream()
                        .filter(option -> option != null)
                        .allMatch(option -> {
                    String key = canonicalAttribute(option.name());
                    String value = normalize(option.value());
                    if ("color".equals(key) && color != null) return value.contains(color);
                    if ("size".equals(key) && size != null) return value.equals(size);
                    return true;
                }) && hasRequestedOption(variant, color, size));
    }

    private List<Product> searchAttempt(Attempt attempt, String lang) {
        if (!attempt.identifierTokens().isEmpty()) {
            return catalogReadService.searchProductsForAssistant(
                    attempt.identifierTokens(),
                    attempt.category(),
                    attempt.brand(),
                    attempt.price().min(),
                    attempt.price().max(),
                    attempt.sort(),
                    DISCOVERY_CANDIDATE_LIMIT,
                    lang);
        }
        return searchProducts(
                attempt.query(),
                attempt.category(),
                attempt.brand(),
                attempt.price().min(),
                attempt.price().max(),
                attempt.color(),
                null,
                attempt.sort(),
                lang).items();
    }

    private List<Product> searchAttemptWide(Attempt attempt, String lang) {
        if (!attempt.identifierTokens().isEmpty()) {
            return catalogReadService.searchProductsForAssistant(
                    attempt.identifierTokens(),
                    attempt.category(),
                    attempt.brand(),
                    null,
                    null,
                    attempt.sort(),
                    DISCOVERY_CANDIDATE_LIMIT,
                    lang);
        }
        return searchProductsWide(
                attempt.query(),
                attempt.category(),
                attempt.brand(),
                null,
                null,
                attempt.color(),
                null,
                attempt.sort(),
                lang).items();
    }

    private static boolean hasRequestedOption(ProductVariant variant, String color, String size) {
        Set<String> keys = new LinkedHashSet<>();
        if (variant.options() != null) {
            variant.options().forEach(option -> keys.add(canonicalAttribute(option.name())));
        }
        return (color == null || keys.contains("color")) && (size == null || keys.contains("size"));
    }

    PageResult<Product> searchProducts(
            String query,
            String category,
            String brand,
            Long minPrice,
            Long maxPrice,
            String color,
            String gender,
            String sort,
            String lang
    ) {
        return catalogReadService.listProducts(
                1, SEARCH_PAGE_SIZE, blankToNull(sort) == null ? "price:asc" : sort,
                blankToNull(category), blankToNull(brand), blankToNull(query),
                blankToNull(color), blankToNull(gender), minPrice, maxPrice, null, lang);
    }

    /**
     * Fetches a sufficiently wide allow-listed page for effective-price validation. The
     * catalogue's SQL range is based on retail price, while Bi must apply the effective sale
     * price locally; a ten-row page could otherwise hide a valid discounted product behind
     * retail-priced rows that are outside the customer's requested range.
     */
    private PageResult<Product> searchProductsWide(
            String query,
            String category,
            String brand,
            Long minPrice,
            Long maxPrice,
            String color,
            String gender,
            String sort,
            String lang
    ) {
        return catalogReadService.listProducts(
                1, 100, blankToNull(sort) == null ? "price:asc" : sort,
                blankToNull(category), blankToNull(brand), blankToNull(query),
                blankToNull(color), blankToNull(gender), minPrice, maxPrice, null, lang);
    }

    private ToolOutcome orderOutcome(UUID customerId, boolean english, OrderScope scope) {
        if (customerId == null) {
            return ToolOutcome.local(
                    english
                            ? "I can only read orders from a signed-in BigBike account. Please sign in and ask again, or use the existing order lookup page with your order number and verification code. I won’t ask for an email or phone number in chat."
                            : "Em chỉ xem được đơn của tài khoản BigBike đang đăng nhập. Anh/chị có thể đăng nhập rồi hỏi lại, hoặc mở trang Tra cứu đơn hàng bằng mã đơn và mã xác thực đơn hàng. Em không nhận email hay số điện thoại qua chat.",
                    "TOOL", false, false, false,
                    List.of(new ChatActionResponse("LOGIN"), new ChatActionResponse("ORDER_LOOKUP")));
        }

        int requestedSize = scope == OrderScope.LATEST ? 1 : 5;
        List<OrderReadService.CustomerOrderSummary> orders = orderReadService
                .listCustomerOrderSummaries(customerId, requestedSize);
        if (orders.isEmpty()) {
            return ToolOutcome.local(
                    english
                            ? "This signed-in account does not have any orders yet. I checked only the account that is currently signed in and did not use identity details from chat. Please choose Talk to staff if an order appears to be missing."
                            : "Tài khoản đang đăng nhập chưa có đơn hàng nào. Em chỉ kiểm tra đúng tài khoản hiện tại và không dùng thông tin nhận dạng gửi trong chat. Nếu anh/chị thấy thiếu đơn, vui lòng bấm Gặp nhân viên.",
                    "TOOL", false, false, false);
        }

        if (scope == OrderScope.LATEST) {
            OrderReadService.CustomerOrderSummary order = orders.get(0);
            String answer = english
                    ? "Your most recent BigBike order is " + safeOrderNumber(order) + ". Status: "
                            + statusLabel(order.status(), true) + ". Order date: " + dateLabel(order, true)
                            + ". Total: " + amountLabel(order, true) + ". Open your account orders to see more."
                    : "Dạ, em đã kiểm tra: đơn hàng gần đây nhất của anh/chị là " + safeOrderNumber(order) + ". Trạng thái: "
                            + statusLabel(order.status(), false) + ". Ngày đặt: " + dateLabel(order, false)
                            + ". Tổng tiền: " + amountLabel(order, false) + ". Anh/chị mở mục Đơn hàng trong tài khoản để xem thêm.";
            return ToolOutcome.local(answer, "TOOL", false, false, false,
                    List.of(new ChatActionResponse("ORDER_HISTORY")));
        }

        List<String> lines = orders.stream().map(order ->
                safeOrderNumber(order) + " — " + statusLabel(order.status(), english)
                        + " — " + dateLabel(order, english) + " — " + amountLabel(order, english)).toList();
        String answer = english
                ? "Here are the recent orders from your signed-in account: " + String.join("; ", lines)
                        + ". I’m showing only the order number, status, order date and total. Open your account orders to see more."
                : "Đây là các đơn hàng gần đây của tài khoản đang đăng nhập: " + String.join("; ", lines)
                        + ". Em chỉ hiển thị mã đơn, trạng thái, ngày đặt và tổng tiền. Anh/chị mở mục Đơn hàng trong tài khoản để xem thêm.";
        return ToolOutcome.local(answer, "TOOL", false, false, false,
                List.of(new ChatActionResponse("ORDER_HISTORY")));
    }

    private static String safeOrderNumber(OrderReadService.CustomerOrderSummary order) {
        return order.orderNumber() == null || order.orderNumber().isBlank()
                ? "đơn hàng" : order.orderNumber();
    }

    private static String dateLabel(OrderReadService.CustomerOrderSummary order, boolean english) {
        if (order.placedAt() == null) return english ? "date unavailable" : "chưa có ngày đặt";
        return (english ? EN_DATE : DATE).format(order.placedAt().atZone(VN_ZONE));
    }

    private static String amountLabel(OrderReadService.CustomerOrderSummary order, boolean english) {
        if (order.totalAmount() == null || order.totalAmount().signum() < 0
                || !"VND".equalsIgnoreCase(order.currency())) {
            return english ? "total unavailable" : "chưa có tổng tiền";
        }
        java.text.NumberFormat formatter = java.text.NumberFormat.getIntegerInstance(
                english ? Locale.US : Locale.forLanguageTag("vi-VN"));
        return formatter.format(order.totalAmount().setScale(0, java.math.RoundingMode.HALF_UP)) + " ₫";
    }

    private static String statusLabel(String raw, boolean english) {
        return switch (raw == null ? "" : raw.toUpperCase(Locale.ROOT)) {
            case "PENDING" -> english ? "Pending" : "Chờ xử lý";
            case "PROCESSING" -> english ? "Processing" : "Đang xử lý";
            case "COMPLETED" -> english ? "Completed" : "Đã hoàn thành";
            case "CANCELLED" -> english ? "Cancelled" : "Đã huỷ";
            default -> english ? "Being updated" : "Đang cập nhật";
        };
    }

    private static ToolOutcome shopInfoOutcome(
            ChatAssistantSettings.Snapshot settings, boolean english) {
        var contacts = settings.contacts();
        List<String> parts = new ArrayList<>();
        if (contacts.hotline() != null && !contacts.hotline().isBlank()) {
            parts.add("Hotline: " + contacts.hotline());
        }
        if (contacts.zaloDisplay() != null && !contacts.zaloDisplay().isBlank()) {
            parts.add("Zalo: " + contacts.zaloDisplay());
        }
        if (contacts.messengerDisplay() != null && !contacts.messengerDisplay().isBlank()) {
            parts.add("Messenger: " + contacts.messengerDisplay());
        }
        if (!settings.address().isBlank()) {
            parts.add((english ? "Address: " : "Địa chỉ: ") + settings.address());
        }
        List<String> openingHours = new ArrayList<>();
        if (!settings.openingHoursWeekday().isBlank()) openingHours.add(settings.openingHoursWeekday());
        if (!settings.openingHoursWeekend().isBlank()) openingHours.add(settings.openingHoursWeekend());
        if (!openingHours.isEmpty()) {
            parts.add((english ? "Opening hours: " : "Giờ mở cửa: ") + String.join("; ", openingHours));
        }
        String details = parts.isEmpty()
                ? (english ? "contact details are not available" : "chưa có dữ liệu liên hệ")
                : String.join("; ", parts);
        return ToolOutcome.local(
                english
                        ? "BigBike’s current contact information is: " + details
                                + ". Please choose Talk to staff for a direct conversation. Your contact options remain available below."
                        : "Dạ, em cập nhật thông tin liên hệ hiện có của BigBike: " + details
                                + ". Anh/chị có thể bấm Gặp nhân viên để trao đổi trực tiếp. Các kênh liên hệ vẫn được giữ sẵn bên dưới.",
                "TEMPLATE", false, false, false);
    }

    private static ToolOutcome policyOutcome(String normalized, boolean english) {
        String answer;
        if (hasWord(normalized, "doi tra", "return", "returns", "exchange")) {
            answer = english
                    ? "BigBike’s published policy allows a size/product exchange request within 7 days, and a refund/return request within 1 day, subject to the listed product-condition rules. Sale items and shipping responsibility have separate conditions. Please open the Returns and Exchanges Policy or choose Talk to staff before sending anything back."
                    : "Dạ, em tóm tắt chính sách công bố của BigBike: yêu cầu đổi size/đổi sản phẩm trong 7 ngày và hoàn tiền/trả hàng trong 1 ngày, tùy điều kiện nguyên trạng đã nêu. Hàng sale và phí vận chuyển có điều kiện riêng. Anh/chị vui lòng mở trang Chính sách đổi trả hoặc bấm Gặp nhân viên trước khi gửi hàng về.";
        } else if (hasWord(normalized, "bao hanh", "warranty")) {
            answer = english
                    ? "BigBike provides genuine manufacturer warranty under each brand’s policy, and the exact period is shown on each product page. Impact damage, modification and normal wear are not automatically covered. For a complex warranty case, please choose Talk to staff and send photos or video."
                    : "Dạ, em xác nhận BigBike bảo hành chính hãng theo chính sách từng thương hiệu; thời hạn cụ thể hiển thị trên trang sản phẩm. Va đập, tự ý sửa đổi và hao mòn tự nhiên không mặc nhiên thuộc diện bảo hành. Trường hợp phức tạp, anh/chị bấm Gặp nhân viên và gửi ảnh/video giúp shop kiểm tra.";
        } else if (hasWord(normalized, "size", "sizes", "kich co", "do size", "size guide")) {
            answer = english
                    ? "Please use the helmet or protective-clothing size guide and compare your actual measurement with the product’s own size table when available. Some products do not yet have a size table, so I won’t infer a size from height or weight alone. Choose Talk to staff if you want BigBike to confirm the fit."
                    : "Anh/chị dùng hướng dẫn đo size mũ hoặc trang phục và đối chiếu số đo thật với bảng size riêng của sản phẩm nếu có. Một số sản phẩm chưa nhập bảng size nên em không suy ra size chỉ từ chiều cao/cân nặng. Anh/chị bấm Gặp nhân viên nếu muốn BigBike xác nhận thêm.";
        } else if (hasWord(normalized, "thanh toan", "payment")) {
            answer = english
                    ? "BigBike currently supports two manual payment methods: cash on delivery (COD) and bank transfer. Bi cannot take payment or place an order on your behalf. Please continue through the cart to choose a method and review the order before confirming."
                    : "Dạ, em xác nhận BigBike hiện hỗ trợ hai hình thức thanh toán thủ công: nhận hàng trả tiền (COD) và chuyển khoản ngân hàng. Em không nhận tiền và không chốt đơn thay anh/chị. Anh/chị vui lòng đi qua Giỏ hàng để chọn hình thức và kiểm tra lại trước khi xác nhận.";
        } else {
            answer = english
                    ? "BigBike does not add a shipping fee to the current online order total, and there is no shipping-method selector at checkout. I can’t promise a delivery date because no confirmed timing data is available. Choose Talk to staff for a destination-specific estimate."
                    : "Đơn online hiện không cộng phí vận chuyển vào tổng tiền và không có bước chọn hãng giao hàng khi thanh toán. Em không cam kết ngày giao vì hệ thống chưa có dữ liệu thời gian xác nhận. Anh/chị bấm Gặp nhân viên nếu cần ước tính theo địa chỉ cụ thể.";
        }
        return ToolOutcome.local(answer, "TEMPLATE", false, false, false);
    }

    private static Map<String, Object> productSummary(Product product) {
        ChatProductCardResponse card = toCard(product);
        return Map.of(
                "slug", nullToEmpty(card.slug()),
                "name", nullToEmpty(card.name()),
                "retailPrice", card.retailPrice() == null ? "" : card.retailPrice(),
                "salePrice", card.salePrice() == null ? "" : card.salePrice(),
                "currency", nullToEmpty(card.currency()),
                "stockState", nullToEmpty(card.stockState()));
    }

    private static Map<String, Object> productDetail(Product product) {
        Map<String, Object> detail = new LinkedHashMap<>(productSummary(product));
        detail.put("shortDescription", plain(product.shortDescription(), 800));
        detail.put("description", plain(product.description(), 1800));
        detail.put("specifications", plain(product.specifications(), 1800));
        detail.put("sizeGuide", plain(product.sizeGuide(), 1200));
        detail.put("pros", highlights(product, true));
        detail.put("cons", highlights(product, false));
        detail.put("faqs", product.faqs() == null ? List.of() : product.faqs().stream()
                .limit(5)
                .map(ChatToolService::faq)
                .toList());
        detail.put("availableOptions", normalizedAvailableOptions(product.variants()));
        detail.put("availableVariants", normalizedAvailableVariants(product.variants()));
        return detail;
    }

    private static List<String> highlights(Product product, boolean positive) {
        if (product.highlights() == null) return List.of();
        List<ProductHighlight> values = positive
                ? product.highlights().positiveNotes()
                : product.highlights().negativeNotes();
        return values == null ? List.of() : values.stream()
                .map(ProductHighlight::content)
                .filter(value -> value != null && !value.isBlank())
                .limit(5)
                .toList();
    }

    private static Map<String, String> faq(ProductFaq faq) {
        return Map.of("question", nullToEmpty(faq.question()), "answer", nullToEmpty(faq.answer()));
    }

    private static Map<String, List<String>> normalizedAvailableOptions(List<ProductVariant> variants) {
        if (variants == null) return Map.of();
        Map<String, Set<String>> grouped = new LinkedHashMap<>();
        variants.stream()
                .filter(variant -> variant != null && variant.isAvailable())
                .filter(variant -> variant.stockState()
                        == com.bigbike.bigbike_backend.domain.catalog.ProductStockState.IN_STOCK)
                .forEach(variant -> {
            if (variant.options() == null) return;
            for (ProductVariantOption option : variant.options()) {
                if (option == null || option.value() == null || option.value().isBlank()) continue;
                String key = canonicalAttribute(option.name());
                grouped.computeIfAbsent(key, ignored -> new LinkedHashSet<>()).add(option.value());
            }
        });
        Map<String, List<String>> result = new LinkedHashMap<>();
        grouped.forEach((key, values) -> result.put(key, List.copyOf(values)));
        return result;
    }

    static List<Map<String, String>> normalizedAvailableVariants(List<ProductVariant> variants) {
        if (variants == null) return List.of();
        return variants.stream()
                .filter(variant -> variant != null && variant.isAvailable())
                .filter(variant -> variant.stockState()
                        == com.bigbike.bigbike_backend.domain.catalog.ProductStockState.IN_STOCK)
                .filter(variant -> variant.options() != null && !variant.options().isEmpty())
                .limit(20)
                .map(variant -> {
                    Map<String, String> combination = new LinkedHashMap<>();
                    for (ProductVariantOption option : variant.options()) {
                        if (option == null) continue;
                        String key = canonicalAttribute(option.name());
                        String value = option.value() == null ? "" : option.value().trim();
                        if (!key.isBlank() && !value.isBlank()) combination.put(key, value);
                    }
                    return Map.copyOf(combination);
                })
                .filter(combination -> !combination.isEmpty())
                .distinct()
                .toList();
    }

    private static String canonicalAttribute(String raw) {
        String normalized = normalize(raw);
        if (normalized.equals("mau") || normalized.equals("mau sac") || normalized.equals("color")) {
            return "color";
        }
        if (normalized.equals("size") || normalized.equals("kich co")) return "size";
        if (normalized.equals("model")) return "model";
        return normalized;
    }

    private static ChatProductCardResponse toCard(Product product) {
        BigDecimal retail = product.price() == null ? null : product.price().retailPrice();
        BigDecimal sale = product.price() == null ? null : product.price().salePrice();
        if (sale == null || retail == null || retail.signum() <= 0 || sale.signum() <= 0
                || sale.compareTo(retail) >= 0) {
            sale = null;
        }
        return new ChatProductCardResponse(
                product.slug(),
                product.name(),
                product.image() == null ? null : product.image().url(),
                retail,
                sale,
                product.price() == null ? "VND" : product.price().currency(),
                isCurrentlySellable(product) ? "IN_STOCK"
                        : product.stockState() == null ? null : product.stockState().name());
    }

    private String toJson(Object value) {
        try {
            String json = objectMapper.writeValueAsString(value);
            if (json.length() > MAX_TOOL_RESPONSE_CHARS) {
                throw new IllegalStateException("Chat tool response exceeds safe limit");
            }
            return json;
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize chat tool response", exception);
        }
    }

    /**
     * Keeps product identifiers while removing only conversational framing, general labels and
     * price language. The resulting tokens are deliberately independent of their word order so
     * the assistant can search a title/model without treating the whole customer sentence as a
     * contiguous catalog substring.
     */
    static ProductQuery extractProductQuery(String question) {
        if (question == null || question.isBlank()) return ProductQuery.empty();
        Matcher slug = PRODUCT_URL.matcher(question);
        if (slug.find()) return productQuery(slug.group(1));
        boolean hasPriceIntent = extractPriceIntent(normalize(question)).hasBounds();
        String cleaned = normalize(question)
                // These phrases describe the request, not a product name/model. Keep the
                // original question unchanged for asksForProductDetail and option parsing.
                .replaceAll(VARIANT_INQUIRY.pattern(), " ")
                .replaceAll(BUDGET_FRAMING.pattern(), " ")
                .replaceAll("(?iU)(toi muon|minh muon|toi can|cho toi|cho em|giup em|tim|tu van|tham khao"
                        + "|please|find|find me|search|show me|i want|i need|looking for|can you|could you)", " ")
                .replaceAll("(?iU)\\b(thuong hieu|brand|danh muc|category)\\b", " ")
                .replaceAll("(?iU)(trong luong|nang bao nhieu|weight|thong so|specifications?)", " ")
                // Price wording belongs to min/max filters, not to the product-name search.
                // Grouped đồng amounts go first so "2.500.000đ" is not chopped into "2." + "500.000đ".
                .replaceAll("(?iU)\\d{1,3}(?:[.,]\\d{3})+\\s*(?:d|vnd|dong)?", " ")
                .replaceAll("(?iU)\\d+(?:[.,]\\d+)?\\s*(?:trieu|tr|million|nghin|ngan|k|d|vnd|dong)\\b", " ")
                .replaceAll("(?iU)\\b(tu|den|toi|tren|duoi|hon|khoang|tam|to|between|about|around"
                        + "|ruoi|tro len|tro xuong|do lai|khong qua"
                        + "|toi da|toi thieu|it nhat"
                        + "|under|below|above|over|from|about|around|up to|at least)\\b", " ")
                .replaceAll("(?iU)\\b(san pham|hang hoa|con hang|bao nhieu|the nao|shop|nao|khong|co|gi"
                        + "|minh|a|voi|nhe|vay|ad|admin)\\b", " ")
                .replaceAll("(?U)(^|\\s)[.,;:\\-–—/]+(?=\\s|$)", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return productQuery(cleaned, hasPriceIntent);
    }

    /**
     * Category/brand words are metadata filters, not model identifiers. Removing only the
     * metadata verified above prevents a request such as "mũ AGV K3" from requiring every
     * catalogue title to repeat "mũ" and "AGV", while preserving the actual model token K3.
     */
    private ProductQuery extractProductQuery(String question, Set<String> metadataTokens) {
        ProductQuery parsed = extractProductQuery(question);
        if (metadataTokens == null || metadataTokens.isEmpty() || parsed.tokens().isEmpty()) return parsed;
        List<String> tokens = parsed.tokens().stream()
                .filter(token -> !metadataTokens.contains(token))
                .toList();
        List<String> identifiers = tokens.stream()
                .filter(token -> !GENERIC_PRODUCT_TOKENS.contains(token))
                .filter(token -> !extractPriceIntent(normalize(question)).hasBounds() || !token.matches("\\d+"))
                .toList();
        return new ProductQuery(String.join(" ", tokens), tokens, identifiers);
    }

    private static ProductQuery productQuery(String value) {
        return productQuery(value, false);
    }

    private static ProductQuery productQuery(String value, boolean hasPriceIntent) {
        String normalized = normalize(value)
                .replaceAll("[^\\p{Alnum}/]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.isBlank()) return ProductQuery.empty();
        LinkedHashSet<String> distinct = new LinkedHashSet<>();
        for (String token : normalized.split("\\s+")) {
            if (!token.isBlank() && token.length() <= 64) distinct.add(token);
            if (distinct.size() == 12) break;
        }
        List<String> tokens = List.copyOf(distinct);
        List<String> identifiers = tokens.stream()
                .filter(token -> !GENERIC_PRODUCT_TOKENS.contains(token))
                // The price parser may leave the leading number of a shared-unit range
                // ("3 đến 5 triệu") in the product wording. It is not a model token there.
                .filter(token -> !hasPriceIntent || !token.matches("\\d+"))
                .toList();
        return new ProductQuery(String.join(" ", tokens), tokens, identifiers);
    }

    /** Last-resort accented keyword — catalogue text search is diacritic-sensitive. */
    private static String fallbackProductQuery(String normalized) {
        if (normalized.contains("3/4")) return "3/4";
        if (normalized.contains("fullface")) return "fullface";
        if (hasWord(normalized, "lat ham")) return "lật hàm";
        if (hasWord(normalized, "mu", "non", "helmet")) return "mũ";
        if (hasWord(normalized, "gang", "gang tay", "glove")) return "găng";
        if (hasWord(normalized, "giay", "boot")) return "giày";
        if (hasWord(normalized, "ao", "jacket")) return "áo";
        if (hasWord(normalized, "tui", "balo", "bag")) return "túi";
        return "";
    }

    /**
     * CHAT_RULE_015 — reads the direction of the price the customer stated instead of
     * forcing every number into a ceiling.
     */
    static PriceIntent extractPriceIntent(String normalized) {
        Matcher shared = SHARED_UNIT_RANGE.matcher(normalized);
        if (shared.find()) {
            long unit = unitMultiplier(shared.group(3));
            return range(amount(shared.group(1), unit), amount(shared.group(2), unit));
        }

        List<Long> values = new ArrayList<>();
        List<int[]> spans = new ArrayList<>();
        Matcher unitAmount = UNIT_AMOUNT.matcher(normalized);
        while (unitAmount.find()) {
            long unit = unitMultiplier(unitAmount.group(2));
            long value = amount(unitAmount.group(1), unit);
            if (unit >= 1_000_000L && normalized.startsWith(" ruoi", unitAmount.end())) {
                value += 500_000L;
            }
            values.add(value);
            spans.add(new int[]{unitAmount.start(), unitAmount.end()});
        }
        if (values.isEmpty()) {
            Matcher plain = PLAIN_AMOUNT.matcher(normalized);
            while (plain.find()) {
                values.add(amount(plain.group(1).replace(".", "").replace(",", ""), 1L));
                spans.add(new int[]{plain.start(), plain.end()});
            }
        }
        if (values.isEmpty()) return PriceIntent.none();

        if (values.size() >= 2
                && isRangeConnector(normalized.substring(spans.get(0)[1], spans.get(1)[0]))) {
            return range(values.get(0), values.get(1));
        }

        long value = values.get(0);
        String before = lastWords(normalized.substring(0, spans.get(0)[0]));
        String after = firstWords(normalized.substring(spans.get(0)[1]));
        if (hasWord(before, MAX_MARKERS_BEFORE) || hasWord(after, MAX_MARKERS_AFTER)) {
            return new PriceIntent(null, value, PriceKind.MAX);
        }
        if (hasWord(before, MIN_MARKERS_BEFORE) || hasWord(after, MIN_MARKERS_AFTER)) {
            return new PriceIntent(value, null, PriceKind.MIN);
        }
        return new PriceIntent(
                value * BAND_LOW_PERCENT / 100, value * BAND_HIGH_PERCENT / 100, PriceKind.BAND);
    }

    /** CHAT_RULE_016 — order follows what the customer asked for, never "cheapest first". */
    private static String sortFor(PriceIntent price, String normalized) {
        if (hasWord(normalized, "cao cap", "cao cap nhat", "cao nhat", "dat nhat", "xin nhat",
                "tot nhat", "xin nha", "premium", "flagship", "hang hieu", "best")) {
            return "price:desc";
        }
        if (hasWord(normalized, "gia re", "re nhat", "gia tot", "tiet kiem", "binh dan",
                "cheap", "budget", "affordable")) {
            return "price:asc";
        }
        return price.kind() == PriceKind.NONE ? "createdAt:desc" : "price:asc";
    }

    private static PriceIntent range(long first, long second) {
        return new PriceIntent(Math.min(first, second), Math.max(first, second), PriceKind.RANGE);
    }

    private static long unitMultiplier(String unit) {
        return switch (unit) {
            case "trieu", "tr", "million" -> 1_000_000L;
            case "nghin", "ngan", "k" -> 1_000L;
            default -> 1L;
        };
    }

    private static long amount(String raw, long unit) {
        return new BigDecimal(raw.replace(',', '.'))
                .multiply(BigDecimal.valueOf(unit))
                .longValue();
    }

    private static String lastWords(String value) {
        String[] words = value.trim().split("\\s+");
        return String.join(" ", List.of(words).subList(Math.max(0, words.length - 3), words.length));
    }

    private static String firstWords(String value) {
        String[] words = value.trim().split("\\s+");
        return String.join(" ", List.of(words).subList(0, Math.min(3, words.length)));
    }

    private static boolean isRangeConnector(String between) {
        String value = between.replaceAll("\\s+", " ").trim();
        return List.of("-", "–", "—", "~", "den", "toi", "to", "va", "and").contains(value);
    }

    /** Most specific keyword wins, so "áo mùa hè" never falls through to "áo mưa". */
    private static String matchKeyword(String normalized, Map<String, String> keywords) {
        String padded = padWords(normalized);
        for (Map.Entry<String, String> entry : keywords.entrySet()) {
            if (padded.contains(" " + entry.getKey() + " ")) return entry.getValue();
        }
        return null;
    }

    /** Whole-word match so "mua" never counts as "mu" and "quan tam" never as "tam". */
    private static boolean hasWord(String value, String... words) {
        return hasWord(value, List.of(words));
    }

    private static boolean hasWord(String value, List<String> words) {
        String padded = padWords(value);
        for (String word : words) if (padded.contains(" " + word + " ")) return true;
        return false;
    }

    /** Punctuation becomes spaces so "bảo hành?" still matches "bao hanh"; "3/4" survives. */
    private static String padWords(String value) {
        return " " + value.replaceAll("[^\\p{Alnum}/]+", " ").trim() + " ";
    }

    static String normalize(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'D')
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
    }

    private static boolean asksForProductDetail(String value) {
        return hasWord(value, "trong luong", "nang", "weight", "thong so", "spec", "specs",
                "faq", "kich co", "size", "sizes", "mau", "mau sac", "color", "colour");
    }

    private static boolean asksForProductAvailability(String value) {
        return hasWord(value,
                "co", "con hang", "con ban", "ton kho", "available", "in stock", "still available");
    }

    private static boolean isOrderQuestion(String value) {
        return hasWord(value, "don hang", "don cua toi", "don cua minh", "don gan nhat",
                "don moi nhat", "cac don", "lich su don", "my order", "my orders", "order status",
                "recent order", "recent orders", "latest order", "latest orders",
                "where is my order", "order where");
    }

    private static OrderScope orderScope(String value) {
        if (hasWord(value, "cac", "nhung", "my orders", "recent orders", "latest orders", "all orders")) {
            return OrderScope.RECENT;
        }
        return OrderScope.LATEST;
    }

    private static boolean isGreetingOrHelp(String value) {
        boolean shortGreeting = hasWord(value, "xin chao", "chao", "hello", "hi", "hey")
                && value.split("\\s+").length <= 5;
        boolean generalHelp = hasWord(value, "tro giup", "ban co the giup", "toi muon duoc tu van",
                "i need advice", "what can you help", "what do you do", "general advice");
        return (shortGreeting || generalHelp) && !hasTaskCue(value);
    }

    private static boolean hasTaskCue(String value) {
        return matchKeyword(value, CATEGORY_KEYWORDS) != null
                || matchKeyword(value, BRAND_KEYWORDS) != null
                || extractPriceIntent(value).hasBounds()
                || hasWord(value, "san pham", "product", "products", "tim", "find", "show",
                        "return", "returns", "exchange", "warranty", "shipping", "payment",
                        "don hang", "order", "orders", "size", "sizes", "size guide",
                        "mau", "mau sac", "color", "colour", "kich co");
    }

    private static String extractRequestedOption(String normalized, Pattern pattern) {
        Matcher matcher = pattern.matcher(normalized);
        if (!matcher.find()) return null;
        String value = matcher.group(1);
        String normalizedValue = value == null ? "" : normalize(value);
        return normalizedValue.isBlank() || NON_VALUE_OPTION_TOKENS.contains(normalizedValue)
                ? null : normalizedValue;
    }

    private static boolean isShopInfoQuestion(String value) {
        return hasWord(value, "dia chi", "gio mo cua", "hotline", "so dien thoai", "dien thoai",
                "zalo", "messenger", "lien he", "address", "opening hour", "opening hours", "contact");
    }

    private static boolean isPolicyQuestion(String value) {
        return hasWord(value, "bao hanh", "doi tra", "doi hang", "tra hang", "phi ship", "ship",
                "giao hang", "van chuyen", "thanh toan", "chon size", "do size", "kich co",
                "warranty", "return", "returns", "exchange", "shipping", "delivery", "payment",
                "size guide");
    }

    private static boolean policyTopicMatchesQuestion(String value, String topic) {
        return switch (topic) {
            case "warranty" -> hasWord(value, "bao hanh", "warranty");
            case "return_exchange" -> hasWord(
                    value, "doi tra", "doi hang", "tra hang", "return", "returns", "exchange");
            case "payment" -> hasWord(value, "thanh toan", "payment", "cod", "chuyen khoan");
            case "shipping" -> hasWord(
                    value, "phi ship", "giao hang", "van chuyen", "shipping", "delivery");
            case "size" -> hasWord(
                    value, "chon size", "do size", "kich co", "size", "sizes", "size guide");
            default -> false;
        };
    }

    private static boolean isHumanHandoff(String value) {
        return hasWord(value, "khieu nai", "complaint", "complaints", "thuong luong",
                "giam gia", "giam duoc", "bot gia", "discount", "negotiate", "negotiation",
                "deal", "deal gia", "bao hanh phuc tap", "tu choi bao hanh", "warranty claim",
                "loi san pham", "hang loi", "product complaint");
    }

    private static boolean isKnownOffTopic(String value) {
        boolean motorcycleTopic = hasWord(value, "xe may", "motorcycle", "motorcycles", "motorbike",
                "motorbikes");
        boolean productContext = matchKeyword(value, CATEGORY_KEYWORDS) != null
                || matchKeyword(value, BRAND_KEYWORDS) != null
                || hasWord(value, "san pham", "product", "products", "phu kien", "accessory");
        boolean newsTopic = hasWord(value, "tin tuc", "bai viet", "news", "article", "articles");
        return newsTopic
                || hasWord(value, "chinh tri", "politic", "politics", "bau cu", "election", "elections",
                "tu van xe", "mua xe nao", "sua xe", "engine repair")
                || (motorcycleTopic && !productContext);
    }

    private static boolean isAmbiguousComparison(String question, String normalized) {
        String compact = normalized.replaceAll("[^\\p{Alnum}]+", " ").trim();
        return Set.of(
                "so sanh", "so sanh cac mau", "so sanh san pham",
                "compare", "compare products", "compare models")
                .contains(compact);
    }

    private static boolean isAmbiguousBudget(String normalized) {
        boolean changeBudget = hasWord(normalized, "doi ngan sach", "loc theo ngan sach",
                "change budget", "filter by budget", "new budget");
        boolean budgetFraming = BUDGET_FRAMING.matcher(normalized).find()
                || hasWord(normalized, "ngan sach", "budget");
        return (changeBudget || budgetFraming) && !extractPriceIntent(normalized).hasBounds();
    }

    private static boolean isLoginAcknowledgement(String normalized) {
        return hasWord(normalized,
                "toi da dang nhap", "minh da dang nhap", "toi dang nhap roi", "minh dang nhap roi",
                "da dang nhap roi",
                "i am signed in", "i signed in", "logged in");
    }

    private static boolean isLeadDecline(String value) {
        return hasWord(value, "khong can lien he", "khong de lai so", "no thanks", "do not contact");
    }

    private static String plain(String html, int max) {
        if (html == null || html.isBlank()) return "";
        String text = html.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
        return text.length() <= max ? text : text.substring(0, max);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    /**
     * CHAT_RULE_017 — spoken words to catalogue slug. Keys are diacritic-free so an
     * unaccented customer ("gang tay", "mu bao hiem") lands on the same category as an
     * accented one; catalogue free-text search is diacritic-sensitive and would miss both.
     * Insertion order is the match order: most specific first.
     */
    private static Map<String, String> categoryKeywords() {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("fullface", "mu-bao-hiem-fullface");
        map.put("full face", "mu-bao-hiem-fullface");
        map.put("lat ham", "mu-bao-hiem-lat-ham-thao-ham");
        map.put("thao ham", "mu-bao-hiem-lat-ham-thao-ham");
        map.put("dual sport", "mu-bao-hiem-dual-sport");
        map.put("dualsport", "mu-bao-hiem-dual-sport");
        map.put("3/4", "mu-bao-hiem-3-4");
        map.put("1/2", "mu-bao-hiem-3-4");
        map.put("nua dau", "mu-bao-hiem-3-4");
        map.put("tai nghe", "tai-nghe-bluetooth-mu-bao-hiem");
        map.put("bluetooth", "tai-nghe-bluetooth-mu-bao-hiem");
        map.put("intercom", "tai-nghe-bluetooth-mu-bao-hiem");
        map.put("pinlock", "pinlock-kinh-chong-suong-mu");
        map.put("kinh mu", "pinlock-kinh-chong-suong-mu");
        map.put("chong suong", "pinlock-kinh-chong-suong-mu");
        map.put("mu bao hiem", "mu-bao-hiem");
        map.put("non bao hiem", "mu-bao-hiem");
        map.put("helmet", "mu-bao-hiem");
        map.put("mu", "mu-bao-hiem");
        map.put("non", "mu-bao-hiem");
        map.put("gang tay touring", "gang-tay-touring");
        map.put("gang tay", "gang-tay-xe-may-moto");
        map.put("gang", "gang-tay-xe-may-moto");
        map.put("glove", "gang-tay-xe-may-moto");
        map.put("gloves", "gang-tay-xe-may-moto");
        map.put("giay touring", "giay-touring");
        map.put("giay mua he", "giay-mua-he");
        map.put("giay", "giay-bao-ho-moto-phuot");
        map.put("boot", "giay-bao-ho-moto-phuot");
        map.put("boots", "giay-bao-ho-moto-phuot");
        map.put("ao lot", "ao-lot");
        map.put("trum dau", "trum-dau");
        map.put("balaclava", "trum-dau");
        map.put("khan trum", "trum-dau");
        map.put("ao quan mua he", "ao-quan-moto-mua-he");
        map.put("ao mua he", "ao-quan-moto-mua-he");
        map.put("ao quan touring", "ao-quan-moto-touring");
        map.put("ao touring", "ao-quan-moto-touring");
        map.put("ao quan adventure", "ao-quan-moto-adventure");
        map.put("ao adventure", "ao-quan-moto-adventure");
        map.put("ao mua", "ao-mua-do-di-mua-moto");
        map.put("do di mua", "ao-mua-do-di-mua-moto");
        map.put("ao giap", "ao-quan-bao-ho");
        map.put("ao bao ho", "ao-quan-bao-ho");
        map.put("ao khoac", "ao-quan-bao-ho");
        map.put("quan ao", "ao-quan-bao-ho");
        map.put("jacket", "ao-quan-bao-ho");
        map.put("ao", "ao-quan-bao-ho");
        map.put("giap tay", "giap-bao-ho-tay-chan");
        map.put("giap chan", "giap-bao-ho-tay-chan");
        map.put("giap lung", "giap-bao-ho-tay-chan");
        map.put("bao ho tay", "giap-bao-ho-tay-chan");
        map.put("bao ho chan", "giap-bao-ho-tay-chan");
        map.put("balo", "balo-phuot-balo-moto");
        map.put("backpack", "balo-phuot-balo-moto");
        map.put("tui treo xe", "tui-treo-xe-may-tui-hit-binh-xang");
        map.put("tui hit", "tui-treo-xe-may-tui-hit-binh-xang");
        map.put("binh xang", "tui-treo-xe-may-tui-hit-binh-xang");
        map.put("tui deo dui", "tui-deo-dui-moto-phuot");
        map.put("tui dui", "tui-deo-dui-moto-phuot");
        map.put("tui deo hong", "tui-deo-hong-tui-deo-dui");
        map.put("tui hong", "tui-deo-hong-tui-deo-dui");
        map.put("tui", "balo-tui-deo-tui-treo-xe");
        map.put("gia do dien thoai", "gia-do-dien-thoai-xe-may");
        map.put("gia do", "gia-do-dien-thoai-xe-may");
        map.put("camera hanh trinh", "phu-kien-camera-hanh-trinh");
        return map;
    }

    private static Map<String, String> brandKeywords() {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("rs taichi", "taichi");
        map.put("rstaichi", "taichi");
        map.put("taichi", "taichi");
        map.put("ls2", "ls2");
        map.put("komine", "komine");
        map.put("givi", "givi");
        map.put("ilm", "ilm");
        map.put("scs", "scs");
        map.put("hevik", "hevik");
        map.put("kewig", "kewig");
        map.put("spyke", "spyke");
        map.put("caberg", "caberg");
        map.put("agv", "agv");
        map.put("sixs", "sixs");
        map.put("six s", "sixs");
        map.put("xpeed", "xpeed");
        map.put("hjc", "hjc");
        map.put("scoyco", "scoyco");
        map.put("smk", "smk");
        map.put("dainese", "dainese");
        map.put("rok straps", "rok-straps");
        map.put("rok strap", "rok-straps");
        map.put("sw motech", "sw-motech");
        map.put("swmotech", "sw-motech");
        map.put("nic", "nic");
        return map;
    }

    /** Terms that describe a generic catalogue/brand context rather than a product model. */
    private static Set<String> genericProductTokens() {
        Set<String> tokens = new LinkedHashSet<>(List.of(
                "san", "pham", "hang", "hoa", "product", "products", "item", "items",
                "shop", "bigbike", "gia", "price", "con", "hang", "available",
                "toi", "minh", "em", "anh", "chi", "ban", "muon", "can", "dang", "xin",
                "tim", "find", "show", "please", "giup", "gium", "tu", "van",
                "cho", "voi", "duoc", "and", "or", "the", "a", "an",
                "cao", "cap", "premium", "xin", "tot", "nhat", "re", "tiet", "kiem",
                "binh", "dan", "cheap", "cheapest", "new", "newest", "best",
                "di", "phuot",
                "thuong", "hieu", "brand", "danh", "muc", "category",
                "how", "much", "any", "from", "under", "below", "above", "over",
                "tu", "den", "toi", "tren", "duoi", "hon", "khoang", "tam"));
        CATEGORY_KEYWORDS.keySet().forEach(key -> addPhraseTokens(tokens, key));
        BRAND_KEYWORDS.keySet().forEach(key -> addPhraseTokens(tokens, key));
        return Set.copyOf(tokens);
    }

    private static void addPhraseTokens(Set<String> target, String phrase) {
        String normalized = normalize(phrase).replaceAll("[^\\p{Alnum}/]+", " ");
        for (String token : normalized.split("\\s+")) {
            if (!token.isBlank()) target.add(token);
        }
    }

    enum PriceKind { NONE, MIN, MAX, BAND, RANGE }

    record PriceIntent(Long min, Long max, PriceKind kind) {
        static PriceIntent none() {
            return new PriceIntent(null, null, PriceKind.NONE);
        }

        boolean hasBounds() {
            return min != null || max != null;
        }
    }

    /** One ordered search attempt; {@code broadened}/{@code priceDropped} must reach the customer. */
    private record Attempt(
            String query,
            String category,
            String brand,
            String color,
            PriceIntent price,
            String sort,
            boolean broadened,
            boolean priceDropped,
            List<String> identifierTokens
    ) {}

    record ProductQuery(String text, List<String> tokens, List<String> identifiers) {
        static ProductQuery empty() {
            return new ProductQuery("", List.of(), List.of());
        }

        boolean hasSpecificIdentifier() {
            return !identifiers.isEmpty();
        }
    }

    private record CatalogAlias(String target, String phrase, int wordCount) {}

    private record CatalogIntent(String category, String brand, Set<String> metadataTokens) {
        static CatalogIntent empty() {
            return new CatalogIntent(null, null, Set.of());
        }
    }

    private enum OrderScope { LATEST, RECENT }

    public enum RequiredDisclosure {
        PRICE_RANGE_MISS,
        BROADENED_SEARCH
    }

    /**
     * Persisted as JSON on the conversation, never supplied verbatim to Gemini. All values are
     * public catalog constraints or a fixed route-state flag, not customer prose or identity.
     */
    public record ConversationContext(
            String category,
            String brand,
            Long minPrice,
            Long maxPrice,
            List<String> productSlugs,
            boolean awaitingOrderLogin
    ) {
        public ConversationContext {
            category = trimScope(category);
            brand = trimScope(brand);
            productSlugs = productSlugs == null ? List.of() : productSlugs.stream()
                    .filter(slug -> slug != null && !slug.isBlank())
                    .map(String::trim)
                    .distinct()
                    .limit(3)
                    .toList();
        }

        public static ConversationContext empty() {
            return new ConversationContext(null, null, null, null, List.of(), false);
        }

        boolean hasCatalogScope() {
            return category != null || brand != null;
        }

        private static String trimScope(String value) {
            return value == null || value.isBlank() ? null : value.trim();
        }
    }

    public record ToolContext(
            String question,
            String lang,
            UUID customerId,
            ChatAssistantSettings.Snapshot settings,
            ConversationContext conversationContext
    ) {
        public ToolContext(
                String question,
                String lang,
                UUID customerId,
                ChatAssistantSettings.Snapshot settings
        ) {
            this(question, lang, customerId, settings, ConversationContext.empty());
        }

        public ToolContext {
            conversationContext = conversationContext == null
                    ? ConversationContext.empty() : conversationContext;
        }
    }

    public static final class ToolSession {
        private final List<String> executed = new ArrayList<>();
        private final Set<String> allowedSlugs = new LinkedHashSet<>();

        void begin(String name) {
            if (executed.size() >= 2 || executed.contains(name)) {
                throw new IllegalStateException("Chat tool execution limit exceeded");
            }
            if (executed.size() == 1
                    && !(ChatToolRegistry.SEARCH_PRODUCTS.equals(executed.get(0))
                    && ChatToolRegistry.GET_PRODUCT.equals(name))) {
                throw new IllegalStateException("Invalid chat tool sequence");
            }
            executed.add(name);
        }

        void complete(String name, List<ChatProductCardResponse> products) {
            if (!ChatToolRegistry.SEARCH_PRODUCTS.equals(name) || products == null) return;
            products.stream()
                    .map(ChatProductCardResponse::slug)
                    .filter(slug -> slug != null && !slug.isBlank())
                    .forEach(allowedSlugs::add);
        }

        public boolean isAllowedSlug(String slug) {
            return allowedSlugs.contains(slug);
        }

        public int executionCount() {
            return executed.size();
        }
    }

    public record ToolExecution(
            String name,
            String responseJson,
            List<ChatProductCardResponse> products,
            List<ChatActionResponse> actions,
            Set<RequiredDisclosure> requiredDisclosures,
            DeterministicAnswer terminalAnswer
    ) {
        public ToolExecution(
                String name,
                String responseJson,
                List<ChatProductCardResponse> products,
                List<ChatActionResponse> actions,
                Set<RequiredDisclosure> requiredDisclosures
        ) {
            this(name, responseJson, products, actions, requiredDisclosures, null);
        }

        public ToolExecution(
                String name,
                String responseJson,
                List<ChatProductCardResponse> products,
                List<ChatActionResponse> actions
        ) {
            this(name, responseJson, products, actions, Set.of(), null);
        }

        public ToolExecution {
            products = products == null ? List.of() : List.copyOf(products);
            actions = actions == null ? List.of() : List.copyOf(actions);
            requiredDisclosures = requiredDisclosures == null
                    ? Set.of() : Set.copyOf(requiredDisclosures);
        }
    }

    /** Fixed customer-safe output derived entirely from a verified backend tool result. */
    public record DeterministicAnswer(
            String answer,
            boolean offTopic,
            boolean handoffRecommended,
            boolean leadPrompt
    ) {
        static DeterministicAnswer from(ToolOutcome outcome) {
            return new DeterministicAnswer(
                    outcome.localAnswer(),
                    outcome.offTopic(),
                    outcome.handoffRecommended(),
                    false);
        }
    }

    public record ToolOutcome(
            boolean aiRequired,
            String localAnswer,
            String source,
            String toolJson,
            List<ChatProductCardResponse> products,
            boolean offTopic,
            boolean handoffRecommended,
            boolean leadDeclined,
            List<ChatActionResponse> actions,
            Set<RequiredDisclosure> requiredDisclosures
    ) {
        static ToolOutcome ai(String toolJson, List<ChatProductCardResponse> products) {
            return ai(toolJson, products, Set.of());
        }

        static ToolOutcome ai(
                String toolJson,
                List<ChatProductCardResponse> products,
                Set<RequiredDisclosure> requiredDisclosures
        ) {
            return new ToolOutcome(
                    true, null, "AI", toolJson, List.copyOf(products), false, false, false,
                    List.of(), Set.copyOf(requiredDisclosures));
        }

        static ToolOutcome local(
                String answer, String source, boolean offTopic, boolean handoff, boolean leadDeclined) {
            return local(answer, source, offTopic, handoff, leadDeclined, List.of());
        }

        static ToolOutcome local(
                String answer,
                String source,
                boolean offTopic,
                boolean handoff,
                boolean leadDeclined,
                List<ChatActionResponse> actions) {
            return new ToolOutcome(false, answer, source, "{}", List.of(), offTopic, handoff, leadDeclined,
                    List.copyOf(actions), Set.of());
        }
    }
}
