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
import com.bigbike.bigbike_backend.repository.catalog.ProductSearchTerms;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.order.OrderReadService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.text.NumberFormat;
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
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Fixed, read-only tool allowlist for Trợ lý BigBike. No tool accepts SQL, table names or customer identity. */
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
    private static final Pattern RAW_OPTION_SLUG = Pattern.compile(
            "^[a-z0-9]+(?:[-_][a-z0-9]+)+$", Pattern.CASE_INSENSITIVE);
    private static final Pattern UNSAFE_OPTION_VALUE = Pattern.compile(
            "[<>\\\\/]|\\b(?:sku|variant|option|code|id)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern SIZE_GUIDE_RANGE = Pattern.compile(
            "(?i)\\b(XXL|XL|XS|S|M|L)\\b[^0-9]{0,18}(\\d{2})\\s*(?:-|–|—|den|toi|to)\\s*(\\d{2})\\s*cm\\b");
    private static final Pattern TECHNICAL_MEASUREMENT = Pattern.compile(
            "(?i)\\b(?:dot|ece|pinlock|\\d+(?:[.,]\\d+)?\\s*(?:g|kg|mm|cm))\\b");
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
    private static final String PRICE_WORD_TOKEN = "(?:mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)";
    private static final String PRICE_NUMBER_TOKEN = "(?:\\d+(?:[.,]\\d+)?|" + PRICE_WORD_TOKEN + ")";
    /** "3 - 5 triệu", "300 đến 500k": the leading number borrows the trailing unit. */
    private static final Pattern SHARED_UNIT_RANGE = Pattern.compile(
            "(?<![a-z0-9])(" + PRICE_NUMBER_TOKEN + ")\\s*(?:-|–|—|~|den|toi|to|and)\\s*("
                    + PRICE_NUMBER_TOKEN + ")\\s*(trieu|tr|million|nghin|ngan|k|cu|lit)(?![a-z0-9])");
    /** "5 triệu", "5tr", "500k", "500 nghìn", "hai triệu", "2 củ". */
    private static final Pattern UNIT_AMOUNT = Pattern.compile(
            "(?<![a-z0-9])(" + PRICE_NUMBER_TOKEN + ")\\s*(trieu|tr|million|nghin|ngan|k|cu|lit)(?![a-z0-9])");
    /**
     * Approved compact million forms from CHAT_RULE_015. The fractional part is deliberately
     * limited to one through three digits: 1tr5 / 1tr50 / 1tr500 are decimal-million forms
     * explicitly approved by CHAT_RULE_015.
     */
    private static final Pattern COMPACT_MILLION_AMOUNT = Pattern.compile(
            "(?<![a-z0-9])(\\d+)\\s*(?:trieu|tr)\\s*(\\d{1,3})(?![a-z0-9])");
    /** "5.000.000", "500,000đ" — grouped plain đồng amounts. */
    private static final Pattern PLAIN_AMOUNT = Pattern.compile(
            "(\\d{1,3}(?:[.,]\\d{3})+)\\s*(?:vnd|dong|d)?(?![a-z0-9])");
    /** A customer can deliberately remove a carried price constraint on a later product turn. */
    private static final Pattern PRICE_SCOPE_RESET = Pattern.compile(
            "\\b(?:bo\\s+(?:gioi\\s+han|loc)(?:\\s+gia)?|xem\\s+het(?:\\s+di)?|"
                    + "gia\\s+nao\\s+cung\\s+duoc|khong\\s+gioi\\s+han|"
                    + "no\\s+(?:price\\s+)?limit|show\\s+all|any\\s+price)\\b");

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
    /**
     * CHAT_RULE_017: approved chat abbreviations are expanded by exact whole word/phrase only,
     * before category and brand recognition. Insertion order is deliberate: specific phrases
     * such as "mu bh" take priority over their shorter components.
     */
    private static final Map<String, String> APPROVED_ABBREVIATIONS = approvedAbbreviations();
    /**
     * An approved product-type text filter prevents a product merely co-categorized with
     * headsets (for example a camera) from being counted or shown as a headset. This is an
     * explicit whitelist, never an inferred keyword.
     */
    private static final Map<String, String> CATEGORY_TYPE_QUERIES = categoryTypeQueries();
    private static final Set<String> GENERIC_PRODUCT_TOKENS = genericProductTokens();
    /**
     * CHAT_RULE_017: approved conversational fillers are not product identifiers. This is an
     * exact, reviewable whitelist rather than a heuristic, so a model code is never discarded
     * merely because it looks like ordinary Vietnamese or English.
     */
    private static final Set<String> CONVERSATIONAL_FILLER_TOKENS = conversationalFillerTokens();
    private static final Map<String, Long> PRICE_WORD_VALUES = priceWordValues();

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
        String normalized = normalizeIntent(question);
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
        String normalized = normalizeIntent(question);
        boolean english = "en".equals(lang);

        if (isLoginAcknowledgement(normalized)
                && conversationContext.awaitingOrderLogin()
                && customerId != null) {
            return Optional.of(orderOutcome(customerId, english, OrderScope.LATEST));
        }

        // Product cards are verified server state, so a demonstrative/comparison follow-up is
        // resolved deterministically regardless of whether RECENT_TURNS is enabled for Gemini.
        Optional<ToolOutcome> referencedProduct = referencedProductOutcome(
                question, normalized, lang, english, conversationContext);
        if (referencedProduct.isPresent()) return referencedProduct;

        if (isNeedPrompt(normalized)) {
            return Optional.of(needPromptOutcome(lang));
        }

        if (isGreetingOrHelp(normalized)) {
            return Optional.of(ToolOutcome.local(
                    english
                            ? "Hello, I’m BigBike Assistant, BigBike’s AI shopping assistant. I can help you find currently sold products, check verified store policies or view orders on your signed-in account. Tell me the product, brand, category or price range you are considering, or choose Talk to staff for direct help."
                            : "Dạ, em là Trợ lý BigBike, trợ lý ảo AI của BigBike. Em có thể tìm sản phẩm đang bán, tra chính sách đã công bố hoặc xem đơn của tài khoản đang đăng nhập. Anh/chị cho em biết tên hàng, thương hiệu, danh mục hoặc tầm giá đang quan tâm; nếu cần, anh/chị có thể bấm Gặp nhân viên.",
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
        // A named model asking about size is product detail, not the generic shop size policy.
        if (isPolicyQuestion(normalized) && !extractProductQuery(question).hasSpecificIdentifier()) {
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

    /**
     * Resolves a demonstrative follow-up from the bounded, server-persisted card allowlist. It
     * intentionally runs before Gemini so “mẫu này/cái này/nó” cannot be turned into a guessed
     * product search or a generic fallback.
     */
    private Optional<ToolOutcome> referencedProductOutcome(
            String question,
            String normalized,
            String lang,
            boolean english,
            ConversationContext conversationContext
    ) {
        ConversationContext context = conversationContext == null
                ? ConversationContext.empty() : conversationContext;
        Optional<List<Product>> selection = recentProductSelection(
                question, normalized, lang, english, context, false);
        if (selection.isEmpty()) return Optional.empty();
        List<Product> matches = selection.get();
        if (matches.size() > 1) {
            return Optional.of(isCollectiveComparisonRequest(normalized)
                    ? comparisonProductOutcome(matches, english)
                    : ambiguousProductOutcome(matches, english));
        }
        Product product = matches.get(0);

        DeterministicAnswer detail = productDetailAnswer(question, normalized, english, product);
        String answer = detail == null
                ? referencedAvailabilityAnswer(product, english)
                : detail.answer();
        return Optional.of(ToolOutcome.local(
                answer,
                "TOOL",
                false,
                false,
                false,
                List.of(),
                List.of(toCard(product))));
    }

    private Optional<List<Product>> recentProductSelection(
            String question,
            String normalized,
            String lang,
            boolean english,
            ConversationContext context,
            boolean modelSelectedReference
    ) {
        if (context == null || context.productSlugs().isEmpty()) return Optional.empty();
        List<String> identifiers = isCollectiveComparisonRequest(normalized)
                ? List.of()
                : referenceIdentifiers(normalized);
        boolean explicitReference = hasProductReference(question, normalized, english)
                || isProductConfirmation(normalized);
        boolean productSignal = modelSelectedReference
                || explicitReference
                || isComparisonRequest(normalized)
                || (identifiers.isEmpty() && (asksForProductDetail(normalized)
                || (asksForProductAvailability(normalized)
                && normalized.split("\\s+").length <= 7)));
        if (!productSignal) return Optional.empty();

        List<Product> recent = context.productSlugs().stream()
                .map(slug -> {
                    try {
                        return catalogReadService.getProductBySlug(slug, lang);
                    } catch (RuntimeException ignored) {
                        return null;
                    }
                })
                .filter(product -> product != null && !sellable(List.of(product)).isEmpty())
                .limit(8)
                .toList();
        if (recent.isEmpty()) return Optional.empty();

        if (identifiers.isEmpty()) return Optional.of(recent);
        List<Product> matches = recent.stream()
                .filter(product -> productMatchesIdentifiers(product, identifiers))
                .toList();
        return matches.isEmpty() ? Optional.empty() : Optional.of(matches);
    }

    private static List<String> referenceIdentifiers(String normalized) {
        if (normalized == null || normalized.isBlank()) return List.of();
        String withoutProperties = normalized.replaceAll(
                "(?iU)\\b(?:gia|price|cost|bao nhieu|how much|trong luong|can nang|nang|weight|"
                        + "thong so ky thuat|thong so|ky thuat|chuan an toan|safety standards?|"
                        + "technical details?|chi tiet|"
                        + "specifications?|specs?|size|sizes|kich co|bang size|bang co|"
                        + "mau sac|color|colour|bao hanh|warranty|phu hop|suitable|nen mua|"
                        + "con hang|ton kho|available|in stock|re hon|cheaper)\\b", " ");
        return ProductSearchTerms.tokens(withoutProperties).stream()
                // Short grammar/deictic words are not model identifiers; short alphanumeric
                // codes such as K3/MF5 remain eligible because they contain a digit.
                .filter(token -> token.length() > 3 || token.matches(".*\\d.*"))
                .toList();
    }

    private static boolean productMatchesIdentifiers(Product product, List<String> identifiers) {
        String searchable = normalize(String.join(" ", List.of(
                nullToEmpty(product.name()), nullToEmpty(product.slug()), nullToEmpty(product.sku()))));
        return identifiers.stream().allMatch(searchable::contains);
    }

    private static ToolOutcome ambiguousProductOutcome(List<Product> products, boolean english) {
        List<ChatProductCardResponse> cards = products.stream()
                .limit(8)
                .map(ChatToolService::toCard)
                .toList();
        List<String> names = cards.stream().map(ChatProductCardResponse::name).toList();
        String answer = english
                ? "I found more than one possible recent model: " + String.join(", ", names)
                        + ". Which exact model would you like me to check?"
                : "Dạ, có nhiều mẫu có thể là sản phẩm anh/chị đang hỏi: "
                        + String.join(", ", names)
                        + ". Anh/chị chọn đúng tên mẫu để em kiểm tra nhé?";
        // The choices are already visible from the preceding turn; do not render duplicates.
        return ToolOutcome.local(answer, "TOOL", false, false, false);
    }

    private static ToolOutcome comparisonProductOutcome(List<Product> products, boolean english) {
        List<Product> selected = products.stream().limit(3).toList();
        List<ChatProductCardResponse> cards = selected.stream()
                .map(ChatToolService::toCard)
                .toList();
        return ToolOutcome.local(
                comparisonAnswer(selected, english), "TOOL", false, false, false, List.of(), cards);
    }

    /**
     * Comparison follows the immediately preceding verified product cards. Every displayed
     * value is read from the selected product records; a missing value stays explicitly missing.
     */
    private static String comparisonAnswer(List<Product> products, boolean english) {
        String intro = english
                ? "I compared the verified products from the previous result."
                : "Dạ, em so sánh các sản phẩm đã được xác minh từ kết quả ngay trước đó.";
        List<String> sentences = new ArrayList<>();
        sentences.add(intro);
        products.stream()
                .map(product -> comparisonProductLine(product, english))
                .map(value -> value.endsWith(".") ? value : value + ".")
                .forEach(sentences::add);
        sentences.add(english
                ? "Open the products below for the complete saved details, or tell me which one you want to inspect next."
                : "Anh/chị mở các sản phẩm bên dưới để xem đầy đủ thông tin đã lưu, hoặc nói mẫu nào cần kiểm tra tiếp nhé.");
        return String.join(" ", sentences);
    }

    private static String comparisonProductLine(Product product, boolean english) {
        String name = plain(product.name(), 160);
        Map<String, List<String>> options = normalizedAvailableOptions(product.variants());
        List<String> sizes = sortSizes(options.getOrDefault("size", List.of())).stream()
                .limit(8).toList();
        List<String> colors = options.getOrDefault("color", List.of()).stream()
                .limit(8).toList();
        List<String> variants = normalizedAvailableVariants(product.variants()).stream()
                .map(ChatToolService::displayableVariantCombination)
                .filter(value -> !value.isBlank())
                .limit(4)
                .toList();
        List<String> prices = availableVariantPriceLabels(product, english).stream()
                .limit(4).toList();
        List<String> facts = technicalFacts(product).stream().limit(2).toList();
        List<String> warnings = safetyWarnings(product).stream().limit(1).toList();
        String missing = english ? "not saved" : "chưa có dữ liệu lưu";
        StringBuilder line = new StringBuilder(name).append(": ");
        line.append(english ? "price " : "giá ")
                .append(prices.isEmpty() ? missing : String.join(", ", prices));
        line.append(english ? "; sizes " : "; size ")
                .append(sizes.isEmpty() ? missing : String.join(", ", sizes));
        line.append(english ? "; colours " : "; màu ")
                .append(colors.isEmpty() ? missing : String.join(", ", colors));
        line.append(english ? "; sellable options " : "; lựa chọn đang bán ")
                .append(variants.isEmpty() ? missing : String.join("; ", variants));
        line.append(english ? "; technical facts " : "; thông tin kỹ thuật ")
                .append(facts.isEmpty() ? missing : String.join("; ", facts));
        if (!warnings.isEmpty()) {
            line.append(english ? "; safety warning " : "; cảnh báo an toàn ")
                    .append(warnings.get(0));
        }
        return plain(line.toString(), 900);
    }

    private static String displayableVariantCombination(Map<String, String> combination) {
        return combination.entrySet().stream()
                .filter(entry -> "color".equals(entry.getKey()) || "size".equals(entry.getKey()))
                .sorted(Map.Entry.comparingByKey())
                .map(Map.Entry::getValue)
                .filter(value -> value != null && !value.isBlank())
                .reduce((left, right) -> left + " / " + right)
                .orElse("");
    }

    private static boolean hasProductReference(String question, String normalized, boolean english) {
        if (hasWord(normalized, "san pham nay", "mau nay", "cai nay", "this one", "this model", "it")) {
            return true;
        }
        if (english) return false;
        return question != null && Pattern.compile("(?iu)(?:^|[^\\p{L}])nó(?:$|[^\\p{L}])")
                .matcher(question).find()
                || hasWord(normalized, "no");
    }

    private static String referencedAvailabilityAnswer(Product product, boolean english) {
        String name = plain(product.name(), 160);
        return english
                ? "I found " + name + " and it is currently available at BigBike. "
                + "Please open the product below to review its current options and details."
                : "Dạ, em đã tìm thấy " + name + " và mẫu này hiện còn hàng tại BigBike. "
                + "Anh/chị mở sản phẩm bên dưới để xem lựa chọn và thông tin hiện có nhé.";
    }

    private ToolOutcome productOutcome(
            String question,
            String normalized,
            String lang,
            boolean english,
            boolean includeDetail,
            ConversationContext conversationContext
    ) {
        return productOutcome(
                question,
                normalized,
                lang,
                english,
                includeDetail,
                effectiveSearchIntent(question, lang, conversationContext),
                conversationContext);
    }

    private ToolOutcome productOutcome(
            String question,
            String normalized,
            String lang,
            boolean english,
            boolean includeDetail,
            SearchIntent searchIntent,
            ConversationContext conversationContext
    ) {
        PriceIntent requested = searchIntent.appliedPrice();
        CatalogIntent catalogIntent = searchIntent.catalogIntent();
        String category = catalogIntent.category();
        String brand = catalogIntent.brand();
        String color = searchIntent.color();
        String size = searchIntent.size();
        ProductQuery query = searchIntent.query();

        List<Attempt> attempts = buildAttempts(
                query, normalized, category, brand, color, requested, catalogIntent.typeQuery());
        Attempt used = null;
        AttemptSearchResult usedSearch = null;
        List<Product> matchingProducts = List.of();
        boolean inheritedBrandDropped = false;
        for (Attempt attempt : attempts) {
            AttemptSearchResult search = searchAttempt(attempt, lang);
            List<Product> candidates = search.products();
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
                usedSearch = search;
                matchingProducts = items;
                break;
            }
        }

        // A range has two meaningful nearest directions. The normal MIN/MAX fallback remains
        // unchanged; only RANGE avoids the old price:asc path that surfaced merely the cheapest
        // products instead of one model just below and one just above the requested interval.
        if (used == null && requested.kind() == PriceKind.RANGE) {
            Attempt closestScope = attempts.stream()
                    .filter(attempt -> !attempt.broadened() && !attempt.priceDropped())
                    .findFirst()
                    .orElse(null);
            if (closestScope != null) {
                List<Product> candidates = sellable(searchAttemptWide(closestScope, lang)).stream()
                        .filter(product -> matchesRequestedVariant(product, color, size, lang))
                        .toList();
                List<Product> nearest = nearestRangeAlternatives(candidates, requested);
                if (!nearest.isEmpty()) {
                    used = new Attempt(
                            closestScope.query(),
                            closestScope.category(),
                            closestScope.brand(),
                            closestScope.color(),
                            PriceIntent.none(),
                            closestScope.sort(),
                            false,
                            true,
                            closestScope.identifierTokens());
                    usedSearch = new AttemptSearchResult(candidates, null);
                    matchingProducts = nearest;
                }
            }
        }

        // CHAT_RULE_018: a brand that came only from the previous turn is a reversible
        // constraint, not a customer choice for this turn. If it is the reason an otherwise
        // scoped follow-up has no result, retry once without that inherited brand. Never remove
        // a brand the customer/model grounded in the current turn, and never broaden beyond the
        // current category.
        if (used == null && searchIntent.inheritedBrand() && category != null) {
            List<Attempt> withoutInheritedBrand = buildAttempts(
                    query, normalized, category, null, color, requested, catalogIntent.typeQuery());
            for (Attempt attempt : withoutInheritedBrand) {
                AttemptSearchResult search = searchAttempt(attempt, lang);
                List<Product> candidates = search.products();
                if (attempt.price().hasBounds() && !attempt.priceDropped()) {
                    candidates = mergeProducts(candidates, searchAttemptWide(attempt, lang));
                }
                List<Product> items = sellable(candidates)
                        .stream()
                        .filter(product -> matchesSellingPrice(product, attempt.price()))
                        .filter(product -> matchesRequestedVariant(product, color, size, lang))
                        .toList();
                if (!items.isEmpty()) {
                    used = attempt;
                    usedSearch = search;
                    matchingProducts = items;
                    inheritedBrandDropped = true;
                    break;
                }
            }
        }

        if (used == null) {
            Optional<ToolOutcome> spellingClarification = fuzzyProductClarification(
                    query, category, brand, lang, english);
            if (spellingClarification.isPresent()) return spellingClarification.get();
            return ToolOutcome.local(
                    searchIntent.inheritedPrice()
                            ? inheritedPriceNoMatchAnswer(requested, english)
                            : query.hasSpecificIdentifier()
                            ? (english
                            ? "BigBike does not currently have that exact model. Tell me the product type and budget you prefer, and I will check verified alternatives without substituting a random product."
                            : "Dạ, shop hiện chưa có đúng mẫu anh/chị vừa hỏi. Em không đổi sang sản phẩm khác hoặc đưa lựa chọn ngẫu nhiên; anh/chị cho em loại hàng và tầm giá mong muốn để em tra mẫu tương đương đang bán nhé.")
                            : (english
                            ? "I could not find a currently sold BigBike product matching that request. Tell me the product type or budget you prefer so I can search again without guessing."
                            : "Dạ, em chưa tìm thấy sản phẩm đang bán phù hợp với yêu cầu này. Anh/chị cho em loại hàng hoặc tầm giá mong muốn để em tra lại, em sẽ không đoán sản phẩm nhé."),
                    "TOOL", false, false, false);
        }

        List<Product> orderedProducts = used.priceDropped()
                ? matchingProducts
                : prioritizePreviouslyShown(matchingProducts, conversationContext);
        List<Product> products = orderedProducts.stream().limit(8).toList();

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
        boolean inheritedPriceApplied = searchIntent.inheritedPrice() && !used.priceDropped();
        payload.put("inheritedPrice", inheritedPriceApplied);
        payload.put("displayedCardCount", products.size());
        List<String> notes = searchNotes(
                used, requested, searchIntent.inheritedPrice(), inheritedBrandDropped, english);
        Set<RequiredDisclosure> requiredDisclosures = searchDisclosures(
                used, requested, searchIntent.inheritedPrice(), inheritedBrandDropped);
        CatalogTotals catalogTotals = catalogTotalsFor(
                searchIntent, query, used, usedSearch, color, lang);
        // Identifier discovery is bounded to 100 verified products. Below that ceiling the
        // complete filtered result set is known, so CHAT_RULE_020 permits the backend to state
        // the real match count (for example both MF509 and MF510 for "MF5").
        if (catalogTotals == null
                && query.hasSpecificIdentifier()
                && !used.broadened()
                && !used.priceDropped()
                && matchingProducts.size() < DISCOVERY_CANDIDATE_LIMIT) {
            catalogTotals = new CatalogTotals(
                    matchingProducts.size(), matchingProducts.size(), null);
        }
        if (!notes.isEmpty()) payload.put("notes", notes);
        if (catalogTotals != null) {
            payload.put("totalItems", catalogTotals.currentTotalItems());
            payload.put("scopeTotalItems", catalogTotals.scopeTotalItems());
            if (catalogTotals.priceRangeTotalItems() != null) {
                payload.put("priceRangeTotalItems", catalogTotals.priceRangeTotalItems());
            }
        }
        payload.put("results", products.stream().map(ChatToolService::productSummary).toList());

        if (includeDetail && query.hasSpecificIdentifier() && asksForProductDetail(normalized)) {
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
            payload.put("detail", productDetail(detail, english));
        }

        List<String> matchingNames = catalogTotals != null
                && catalogTotals.currentTotalItems() <= 4
                && matchingProducts.size() == catalogTotals.currentTotalItems()
                ? orderedProducts.stream()
                        .map(product -> plain(product.name(), 160))
                        .filter(name -> !name.isBlank())
                        .distinct()
                        .limit(8)
                        .toList()
                : List.of();

        SearchScope verifiedResultScope = verifiedResultScope(used, orderedProducts);
        return ToolOutcome.ai(
                toJson(payload), cards, requiredDisclosures, inheritedPriceApplied, catalogTotals,
                matchingNames,
                verifiedResultScope);
    }

    private static SearchScope verifiedResultScope(Attempt used, List<Product> products) {
        String category = used.category();
        String brand = used.brand();
        if (category == null && products != null && !products.isEmpty()) {
            List<String> categories = products.stream()
                    .map(Product::category)
                    .filter(value -> value != null && value.slug() != null && !value.slug().isBlank())
                    .map(value -> value.slug())
                    .distinct()
                    .toList();
            if (categories.size() == 1) category = categories.get(0);
        }
        // Never turn a coincidental common brand in the capped result page into a future
        // customer filter. Brand scope is persisted only when the accepted current search
        // explicitly carried that brand.
        return new SearchScope(category, brand, used.price().min(), used.price().max());
    }

    /**
     * CHAT_RULE_024: build a bounded candidate set from identifier character n-grams, then
     * validate every complete customer token with edit distance. This is not a whole-catalogue
     * fallback and it never silently rewrites a model name: only verified sellable candidates
     * are shown and the customer must confirm one.
     */
    private Optional<ToolOutcome> fuzzyProductClarification(
            ProductQuery query,
            String category,
            String brand,
            String lang,
            boolean english
    ) {
        if (query == null || !query.hasSpecificIdentifier()) return Optional.empty();
        List<String> identifiers = query.identifiers().stream()
                .filter(token -> token != null && token.length() >= 3)
                .limit(4)
                .toList();
        if (identifiers.isEmpty()) return Optional.empty();

        LinkedHashMap<String, Product> candidates = new LinkedHashMap<>();
        fuzzyCandidateSeeds(identifiers).stream().limit(8).forEach(seed -> {
            List<Product> found = catalogReadService.searchProductsForAssistant(
                    List.of(seed), category, brand, null, null,
                    "name:asc", 12, lang);
            sellable(found).forEach(product -> candidates.putIfAbsent(product.slug(), product));
        });
        if (candidates.isEmpty()) return Optional.empty();

        List<ScoredProduct> ranked = candidates.values().stream()
                .map(product -> scoreFuzzyProduct(identifiers, product))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .sorted(Comparator.comparingDouble(ScoredProduct::score)
                        .thenComparing(scored -> normalize(scored.product().name())))
                .toList();
        if (ranked.isEmpty()) return Optional.empty();
        double best = ranked.get(0).score();
        List<Product> close = ranked.stream()
                .filter(scored -> scored.score() <= best + 0.08d)
                .map(ScoredProduct::product)
                .limit(3)
                .toList();
        if (close.isEmpty()) return Optional.empty();

        List<ChatProductCardResponse> cards = close.stream().map(ChatToolService::toCard).toList();
        if (close.size() == 1) {
            String name = plain(close.get(0).name(), 160);
            return Optional.of(ToolOutcome.local(
                    english
                            ? "Did you mean " + name + "? Please confirm this model and I will recheck its current price, stock or product details."
                            : "Dạ, có phải anh/chị đang tìm " + name + " không ạ? Anh/chị xác nhận đúng mẫu này, em sẽ tra lại giá, tồn kho hoặc thông tin sản phẩm hiện tại.",
                    "TOOL", false, false, false, List.of(), cards));
        }

        List<String> choices = cards.stream()
                .map(card -> card.name() + " (" + cardPrice(card, english) + ")")
                .toList();
        return Optional.of(ToolOutcome.local(
                english
                        ? "The closest currently sold models are " + String.join(", ", choices)
                                + ". Which exact model did you mean?"
                        : "Dạ, các mẫu gần nhất đang bán gồm " + String.join(", ", choices)
                                + ". Anh/chị đang tìm đúng mẫu nào ạ?",
                "TOOL", false, false, false, List.of(), cards));
    }

    private static List<String> fuzzyCandidateSeeds(List<String> identifiers) {
        LinkedHashSet<String> seeds = new LinkedHashSet<>();
        identifiers.stream()
                .sorted(Comparator.comparingInt(String::length).reversed())
                .forEach(token -> {
                    seeds.add(token);
                    if (token.length() < 5) return;
                    int gramLength = Math.max(3, token.length() - 2);
                    for (int index = 0; index + gramLength <= token.length(); index++) {
                        seeds.add(token.substring(index, index + gramLength));
                    }
                });
        return List.copyOf(seeds);
    }

    private static Optional<ScoredProduct> scoreFuzzyProduct(
            List<String> identifiers, Product product) {
        String source = String.join(" ", List.of(
                nullToEmpty(product.name()), nullToEmpty(product.slug()), nullToEmpty(product.sku())));
        List<String> candidateTokens = ProductSearchTerms.tokens(source);
        if (candidateTokens.isEmpty()) return Optional.empty();
        double total = 0;
        for (String identifier : identifiers) {
            int bestDistance = candidateTokens.stream()
                    .mapToInt(candidate -> editDistance(identifier, candidate))
                    .min()
                    .orElse(Integer.MAX_VALUE);
            int allowed = identifier.length() <= 3 ? 0
                    : identifier.length() <= 5 ? 1
                    : Math.max(2, (int) Math.floor(identifier.length() * 0.30d));
            if (bestDistance > allowed) return Optional.empty();
            total += (double) bestDistance / Math.max(identifier.length(), 1);
        }
        return Optional.of(new ScoredProduct(product, total / identifiers.size()));
    }

    static int editDistance(String left, String right) {
        if (left == null || right == null) return Integer.MAX_VALUE;
        int[] previous = new int[right.length() + 1];
        for (int column = 0; column <= right.length(); column++) previous[column] = column;
        for (int row = 1; row <= left.length(); row++) {
            int[] current = new int[right.length() + 1];
            current[0] = row;
            for (int column = 1; column <= right.length(); column++) {
                int cost = left.charAt(row - 1) == right.charAt(column - 1) ? 0 : 1;
                current[column] = Math.min(
                        Math.min(current[column - 1] + 1, previous[column] + 1),
                        previous[column - 1] + cost);
            }
            previous = current;
        }
        return previous[right.length()];
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
            case ChatToolRegistry.LIST_CATEGORIES -> executeListCategories(context);
            case ChatToolRegistry.GET_PRODUCT -> executeGetProduct(call, context, session);
            case ChatToolRegistry.GET_POLICY -> executePolicy(call, context);
            case ChatToolRegistry.GET_SHOP_INFO -> executeShopInfo(context);
            case ChatToolRegistry.GET_MY_ORDERS -> executeOrders(call, context);
            default -> throw new IllegalArgumentException("Unsupported chat tool");
        };
        session.complete(call.name(), result.products());
        return result;
    }

    private ToolExecution executeListCategories(ToolContext context) {
        List<Map<String, Object>> categories = catalogReadService
                .listAssistantCategorySummaries(context.lang()).stream()
                .map(category -> Map.<String, Object>of(
                        "name", category.name(),
                        "sellableProductCount", category.sellableProductCount()))
                .toList();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("tool", ChatToolRegistry.LIST_CATEGORIES);
        response.put("categories", categories);
        return new ToolExecution(
                ChatToolRegistry.LIST_CATEGORIES,
                toJson(response),
                List.of(),
                List.of());
    }

    private ToolExecution executeSearch(
            ChatToolRegistry.ValidatedCall call, ToolContext context) {
        String normalized = normalizeIntent(context.question());
        // With RECENT_TURNS enabled, choosing a product-search tool for a detail/availability
        // question is the model's reference signal. The backend does not need to recognise a
        // closed list of Vietnamese pronouns; it only verifies whether the saved product set is
        // uniquely resolvable. Discovery requests still flow through normal search so a request
        // for alternatives cannot be mistaken for a reference to the previous product.
        boolean modelSelectedReference = context.settings().recentTurnPairs() > 0
                && (asksForProductDetail(normalized) || asksForProductAvailability(normalized));
        Optional<ToolExecution> groundedReference = recentUniqueProductExecution(
                context, ChatToolRegistry.SEARCH_PRODUCTS, modelSelectedReference);
        if (groundedReference.isPresent()) return groundedReference.get();
        Optional<ToolExecution> ambiguity = recentProductAmbiguityExecution(
                context, ChatToolRegistry.SEARCH_PRODUCTS, modelSelectedReference);
        if (ambiguity.isPresent()) return ambiguity.get();
        SearchIntent searchIntent = context.settings().searchAiInterpretationEnabled()
                ? validateSearchByResult(call, context)
                : validateSearchAgainstQuestion(call, context);
        if (!searchIntent.hasUsableConstraint()) {
            return searchClarification(context);
        }
        ToolOutcome outcome = productOutcome(
                context.question(),
                normalized,
                context.lang(),
                "en".equals(context.lang()),
                false,
                searchIntent,
                context.conversationContext());
        if (outcome.aiRequired()) {
            DeterministicAnswer terminal = verifiedSearchAnswer(context, outcome);
            return new ToolExecution(
                    ChatToolRegistry.SEARCH_PRODUCTS,
                    outcome.toolJson(),
                    outcome.products(),
                    List.of(),
                    outcome.requiredDisclosures(),
                    terminal,
                    outcome.catalogTotals(),
                    outcome.effectiveSearchScope());
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("tool", ChatToolRegistry.SEARCH_PRODUCTS);
        response.put("results", outcome.products());
        response.put("notes", List.of(outcome.localAnswer()));
        return new ToolExecution(
                ChatToolRegistry.SEARCH_PRODUCTS,
                toJson(response),
                outcome.products(),
                outcome.actions(),
                outcome.requiredDisclosures(),
                DeterministicAnswer.from(outcome, context.question()),
                null,
                searchIntent.searchScope());
    }

    /**
     * The new interpretation path never turns a removed model filter into a broad catalogue
     * scan. A deterministic clarification keeps the customer turn recoverable while avoiding a
     * provider answer that might otherwise guess what an empty search meant.
     */
    private ToolExecution searchClarification(ToolContext context) {
        boolean english = "en".equals(context.lang());
        String answer = english
                ? "I need one product type, brand, model, colour, size or price range before I search BigBike. Please tell me which item you want so I can check currently sold products without guessing."
                : "Dạ, em cần anh/chị cho em biết loại hàng, thương hiệu, mẫu, màu, size hoặc tầm giá trước khi tìm. Anh/chị nói rõ món cần xem để em chỉ kiểm tra các sản phẩm BigBike đang bán, không đoán thay mình nhé.";
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("tool", ChatToolRegistry.SEARCH_PRODUCTS);
        response.put("results", List.of());
        response.put("notes", List.of(answer));
        return new ToolExecution(
                ChatToolRegistry.SEARCH_PRODUCTS,
                toJson(response),
                List.of(),
                List.of(),
                Set.of(),
                new DeterministicAnswer(answer, false, false, false),
                null,
                null);
    }

    private Optional<ToolExecution> recentProductAmbiguityExecution(
            ToolContext context, String toolName, boolean modelSelectedReference) {
        String normalized = normalizeIntent(context.question());
        boolean english = "en".equals(context.lang());
        Optional<List<Product>> selection = recentProductSelection(
                context.question(), normalized, context.lang(), english,
                context.conversationContext(), modelSelectedReference);
        if (selection.isEmpty() || selection.get().size() <= 1) return Optional.empty();
        ToolOutcome outcome = isCollectiveComparisonRequest(normalized)
                ? comparisonProductOutcome(selection.get(), english)
                : ambiguousProductOutcome(selection.get(), english);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("tool", toolName);
        response.put("results", outcome.products().stream()
                .map(card -> Map.of("slug", card.slug(), "name", card.name()))
                .toList());
        response.put("notes", List.of(outcome.localAnswer()));
        return Optional.of(new ToolExecution(
                toolName,
                toJson(response),
                outcome.products(),
                List.of(),
                Set.of(),
                DeterministicAnswer.from(outcome, context.question()),
                null,
                null));
    }

    private Optional<ToolExecution> recentUniqueProductExecution(
            ToolContext context, String toolName, boolean modelSelectedReference) {
        String normalized = normalizeIntent(context.question());
        boolean english = "en".equals(context.lang());
        Optional<List<Product>> selection = recentProductSelection(
                context.question(), normalized, context.lang(), english,
                context.conversationContext(), modelSelectedReference);
        if (selection.isEmpty() || selection.get().size() != 1) return Optional.empty();
        Product product = selection.get().get(0);
        DeterministicAnswer detail = productDetailAnswer(
                context.question(), normalized, english, product);
        String answer = detail == null ? referencedAvailabilityAnswer(product, english) : detail.answer();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("tool", toolName);
        response.put("result", productDetail(product, english));
        return Optional.of(new ToolExecution(
                toolName,
                toJson(response),
                List.of(toCard(product)),
                List.of(),
                Set.of(),
                new DeterministicAnswer(answer, false, false, false),
                null,
                null));
    }

    /**
     * A verified size/colour answer is safer and more useful than asking the model to
     * paraphrase variants. It is deliberately limited to one exact model and uses only
     * sellable variant data; broad discovery stays on the normal model path.
     */
    private DeterministicAnswer verifiedSearchAnswer(
            ToolContext context, ToolOutcome outcome) {
        DeterministicAnswer inheritedFilterDropped = verifiedInheritedFilterDroppedAnswer(context, outcome);
        if (inheritedFilterDropped != null) return inheritedFilterDropped;

        DeterministicAnswer closest = verifiedClosestAlternativeAnswer(context, outcome);
        if (closest != null) return closest;

        DeterministicAnswer variant = verifiedVariantAnswer(context, outcome.products());
        if (variant != null) return variant;

        DeterministicAnswer availability = verifiedAvailabilityAnswer(context, outcome.products());
        if (availability != null) return availability;

        DeterministicAnswer inheritedPrice = verifiedInheritedPriceAnswer(context, outcome);
        if (inheritedPrice != null) return inheritedPrice;

        DeterministicAnswer catalogCount = verifiedCatalogCountAnswer(context, outcome);
        if (catalogCount != null) return catalogCount;
        return null;
    }

    private static DeterministicAnswer verifiedInheritedFilterDroppedAnswer(
            ToolContext context, ToolOutcome outcome) {
        if (outcome.products() == null || outcome.products().isEmpty()
                || !outcome.requiredDisclosures().contains(RequiredDisclosure.INHERITED_FILTER_DROPPED)) {
            return null;
        }
        boolean english = "en".equals(context.lang());
        String retainedPriceScope = outcome.inheritedPrice()
                ? (english
                ? " I am still using the price range from your previous product request."
                : " Em vẫn lọc theo tầm giá anh/chị đã nêu trước đó.")
                : "";
        String answer = english
                ? "The inherited filter from your previous product request returned no matches, so I removed only that older filter and searched this request again."
                + retainedPriceScope + " The products below are the currently available results after that retry. "
                + "Tell me a new budget if you would like me to narrow the list again."
                : "Dạ, bộ lọc đã nêu ở lượt trước không có kết quả phù hợp nên em đã bỏ riêng bộ lọc cũ và tìm lại yêu cầu này."
                + retainedPriceScope + " Các sản phẩm bên dưới là kết quả đang bán sau lần tìm lại. "
                + "Anh/chị có thể gửi tầm giá mới để em lọc hẹp lại nhé.";
        return new DeterministicAnswer(answer, false, false, false);
    }

    /**
     * CHAT_RULE_007/020: the server knows both the exact matching total and the capped card
     * count, so it writes the sentence instead of asking the model to reconcile them. This keeps
     * the visible-card count honest while allowing a verified catalog total when one exists.
     */
    private DeterministicAnswer verifiedCatalogCountAnswer(
            ToolContext context, ToolOutcome outcome) {
        CatalogTotals totals = outcome.catalogTotals();
        List<ChatProductCardResponse> products = outcome.products();
        if (totals == null || products == null || products.isEmpty() || totals.currentTotalItems() <= 0) {
            return null;
        }
        int displayed = products.size();
        if (displayed != Math.min(totals.currentTotalItems(), 8)) return null;

        boolean english = "en".equals(context.lang());
        boolean priceScoped = totals.priceRangeTotalItems() != null;
        String group = catalogGroupLabel(outcome.effectiveSearchScope(), context.lang());
        String total = Long.toString(totals.currentTotalItems());
        String first = english
                ? (priceScoped
                ? "In the price range you asked about, BigBike has " + total + " matching " + group + "."
                : "BigBike currently has " + total + " matching " + group + ".")
                : (priceScoped
                ? "Dạ, trong tầm giá anh/chị hỏi, shop có " + total + " mẫu " + group + "."
                : "Dạ, shop hiện có " + total + " mẫu " + group + " phù hợp.");

        List<String> names = outcome.matchingProductNames();
        List<String> sentences = new ArrayList<>();
        sentences.add(first);
        if (names != null && !names.isEmpty()) {
            List<String> namedPrices = products.stream()
                    .limit(8)
                    .map(product -> product.name() + " (" + cardPrice(product, english) + ")")
                    .toList();
            sentences.add(english
                    ? "The matching models are " + String.join(", ", namedPrices) + "."
                    : "Các mẫu phù hợp gồm " + String.join(", ", namedPrices) + ".");
        }
        sentences.add(english
                ? (totals.currentTotalItems() > displayed
                ? "I am showing " + displayed + " representative products below from those " + total + " matches."
                : "I am showing all " + displayed + " matching products below.")
                : (totals.currentTotalItems() > displayed
                ? "Em đang hiển thị " + displayed + " mẫu tiêu biểu bên dưới trong tổng " + total + " mẫu phù hợp."
                : "Em đang hiển thị đầy đủ " + displayed + " sản phẩm phù hợp bên dưới."));
        sentences.add(english
                ? (names != null && names.size() > 1
                ? "Which model would you like me to check in detail?"
                : "Open the product below to review its current details and options.")
                : (names != null && names.size() > 1
                ? "Anh/chị muốn em kiểm tra chi tiết mẫu nào ạ?"
                : "Anh/chị có thể mở sản phẩm bên dưới để xem thông tin và lựa chọn hiện có nhé."));
        return new DeterministicAnswer(String.join(" ", sentences), false, false, false);
    }

    private String catalogGroupLabel(SearchScope currentScope, String lang) {
        String category = currentScope == null ? null : currentScope.category();
        if (category == null) return "en".equals(lang) ? "products" : "sản phẩm";
        try {
            return catalogReadService.listAssistantCategories(lang).stream()
                    .filter(item -> item != null && category.equals(item.slug()))
                    .map(Category::name)
                    .filter(name -> name != null && !name.isBlank())
                    .findFirst()
                    .map(name -> "en".equals(lang)
                            ? name.toLowerCase(Locale.ENGLISH)
                            : lowerFirst(name))
                    .orElse("en".equals(lang) ? "products" : "sản phẩm");
        } catch (RuntimeException ignored) {
            return "en".equals(lang) ? "products" : "sản phẩm";
        }
    }

    private static String lowerFirst(String value) {
        if (value == null || value.isBlank()) return value;
        return value.substring(0, 1).toLowerCase(Locale.forLanguageTag("vi-VN")) + value.substring(1);
    }

    private static String cardPrice(ChatProductCardResponse product, boolean english) {
        BigDecimal price = product.salePrice() != null ? product.salePrice() : product.retailPrice();
        if (price == null) return english ? "price unavailable" : "chưa có giá";
        String formatted = NumberFormat.getIntegerInstance(
                english ? Locale.US : Locale.forLanguageTag("vi-VN")).format(price);
        return english ? formatted + "₫" : formatted + "đ";
    }

    /**
     * A one-product availability question must not depend on a prose model conclusion. The
     * product card has already passed the publication, price and in-stock checks, so this
     * answer is stable when the same model is asked repeatedly.
     */
    private DeterministicAnswer verifiedAvailabilityAnswer(
            ToolContext context, List<ChatProductCardResponse> products) {
        String normalized = normalizeIntent(context.question());
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
                        + "Please open the product below to review its current options and details."
                : "Dạ, em đã tìm thấy " + name + " và mẫu này hiện còn hàng tại BigBike. "
                        + "Anh/chị mở sản phẩm bên dưới để xem lựa chọn và thông tin hiện có nhé.";
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
            PriceIntent price = effectivePriceForTerminal(context, outcome);
            String inheritedScope = outcome.inheritedPrice()
                    ? inheritedPriceScopeLead(price, english) : null;
            boolean broadened = outcome.requiredDisclosures().contains(RequiredDisclosure.BROADENED_SEARCH);
            return new DeterministicAnswer(
                    english
                            ? (inheritedScope == null
                            ? "I could not find a currently sold product in the price range you requested. "
                            : inheritedScope + " but I could not find a currently sold product in that range. ")
                                    + "The products below are the closest available options; please tell me if you want a different range."
                                    + (broadened
                                    ? " This list is broader than your original wording; share a more specific name or category if you want to narrow it."
                                    : "")
                            : (inheritedScope == null
                            ? "Dạ, em chưa tìm thấy sản phẩm đang bán trong tầm giá anh/chị hỏi. "
                            : inheritedScope + " nhưng chưa tìm thấy sản phẩm đang bán phù hợp. ")
                                    + "Các sản phẩm bên dưới là phương án gần nhất đang có; anh/chị cho em biết tầm giá khác nếu muốn em lọc tiếp nhé."
                                    + (broadened
                                    ? " Danh sách này cũng rộng hơn cách hỏi ban đầu; anh/chị cho em tên hoặc loại hàng cụ thể hơn để em thu hẹp lại nhé."
                                    : ""),
                    false,
                    false,
                    false);
        }
        if (outcome.requiredDisclosures().contains(RequiredDisclosure.BROADENED_SEARCH)) {
            PriceIntent price = effectivePriceForTerminal(context, outcome);
            String inheritedScope = outcome.inheritedPrice()
                    ? inheritedPriceScopeLead(price, english) : null;
            return new DeterministicAnswer(
                    english
                            ? (inheritedScope == null ? "" : inheritedScope + ". ")
                                    + "The products below come from a broader search than your original wording. "
                                    + "Please tell me a more specific name, category or budget so I can narrow the results."
                            : (inheritedScope == null
                                    ? "Dạ, các sản phẩm bên dưới đang rộng hơn yêu cầu ban đầu của anh/chị. "
                                    : inheritedScope + ". Các sản phẩm bên dưới đang rộng hơn yêu cầu ban đầu của anh/chị. ")
                                    + "Anh/chị cho em tên mẫu, loại hàng hoặc tầm giá cụ thể hơn để em lọc lại nhé.",
                    false,
                    false,
                    false);
        }
        return null;
    }

    /**
     * A carried price range is a constraint the customer did not repeat verbatim. Return a
     * backend-written terminal answer so the scope can never be hidden by model prose.
     */
    private static DeterministicAnswer verifiedInheritedPriceAnswer(
            ToolContext context, ToolOutcome outcome) {
        if (!outcome.inheritedPrice() || outcome.products() == null || outcome.products().isEmpty()) {
            return null;
        }
        boolean english = "en".equals(context.lang());
        PriceIntent price = effectivePriceForTerminal(context, outcome);
        String scopeLead = inheritedPriceScopeLead(price, english);
        if (scopeLead == null) return null;
        String countSentence = inheritedCatalogCountSentence(
                outcome.catalogTotals(), context.question(), english);
        String answer = english
                ? scopeLead + ". " + countSentence
                        + " The products below are currently sold and available within that range; "
                        + "please open them to choose the model that suits you."
                : scopeLead + ". " + countSentence
                        + " Các sản phẩm bên dưới đang bán và còn hàng trong phạm vi này; "
                        + "anh/chị có thể xem thêm để chọn mẫu phù hợp nhé.";
        return new DeterministicAnswer(answer, false, false, false);
    }

    /** Uses only current-turn count evidence; no count is invented when the search has none. */
    private static String inheritedCatalogCountSentence(
            CatalogTotals totals, String question, boolean english) {
        if (totals == null || totals.priceRangeTotalItems() == null) return "";
        String normalizedQuestion = normalizeIntent(question);
        boolean headsetScope = hasWord(normalizedQuestion, "tai nghe");
        if (english) {
            String scope = headsetScope ? "headset" : "this product group";
            return "BigBike currently has " + totals.scopeTotalItems() + " " + scope
                    + " products, including " + totals.priceRangeTotalItems() + " in that range.";
        }
        String scope = headsetScope ? "tai nghe" : "trong nhóm này";
        return "Shop hiện có " + totals.scopeTotalItems() + " mẫu " + scope
                + ", trong tầm giá này có " + totals.priceRangeTotalItems() + " mẫu.";
    }

    private static PriceIntent effectivePriceForTerminal(ToolContext context, ToolOutcome outcome) {
        ConversationContext conversationContext = context.conversationContext() == null
                ? ConversationContext.empty() : context.conversationContext();
        return outcome.inheritedPrice()
                ? priceIntentFromContext(conversationContext)
                : extractPriceIntent(normalizeIntent(context.question()));
    }

    private static String inheritedPriceNoMatchAnswer(PriceIntent price, boolean english) {
        String scopeLead = inheritedPriceScopeLead(price, english);
        if (scopeLead == null) {
            return english
                    ? "I could not find a currently sold product matching this request. Please try a different price range or choose Talk to staff for help choosing another option."
                    : "Dạ, em chưa tìm thấy sản phẩm đang bán phù hợp với yêu cầu này. Anh/chị thử đổi tầm giá hoặc bấm Gặp nhân viên để BigBike kiểm tra thêm nhé.";
        }
        return english
                ? scopeLead + " but I could not find a currently sold product that matches it. "
                        + "Please try a different range or choose Talk to staff for help choosing another option."
                : scopeLead + " nhưng chưa tìm thấy sản phẩm đang bán phù hợp. "
                        + "Anh/chị thử đổi tầm giá hoặc bấm Gặp nhân viên để BigBike kiểm tra thêm nhé.";
    }

    private static String inheritedPriceScopeLead(PriceIntent price, boolean english) {
        if (price == null || !price.hasBounds()) return null;
        String scope = priceScopeLabel(price, english);
        return english
                ? "I am filtering by " + scope + " from your previous product request"
                : "Dạ, em đang lọc theo " + scope + " mà anh/chị đã nêu trước đó";
    }

    private static String priceScopeLabel(PriceIntent price, boolean english) {
        if (price.min() != null && price.max() != null) {
            return english
                    ? "the range from " + millionLabel(price.min(), true) + " to " + millionLabel(price.max(), true)
                    : "tầm giá từ " + millionLabel(price.min(), false) + " đến " + millionLabel(price.max(), false);
        }
        if (price.min() != null) {
            return english
                    ? "prices from " + millionLabel(price.min(), true) + " upward"
                    : "tầm giá từ " + millionLabel(price.min(), false) + " trở lên";
        }
        return english
                ? "prices under " + millionLabel(price.max(), true)
                : "tầm giá dưới " + millionLabel(price.max(), false);
    }

    private static String millionLabel(long amount, boolean english) {
        String millions = BigDecimal.valueOf(amount)
                .divide(BigDecimal.valueOf(1_000_000L))
                .stripTrailingZeros()
                .toPlainString();
        return english
                ? millions + " million"
                : millions.replace('.', ',') + " triệu";
    }

    private DeterministicAnswer verifiedVariantAnswer(
            ToolContext context, List<ChatProductCardResponse> products) {
        String normalized = normalizeIntent(context.question());
        CatalogIntent intent = effectiveCatalogIntent(
                context.question(), context.lang(), context.conversationContext());
        ProductQuery query = extractProductQuery(context.question(), intent.metadataTokens());
        ProductDetailIntent detailIntent = productDetailIntent(normalized);
        if (!asksForProductDetail(normalized) || !query.hasSpecificIdentifier()
                || !detailIntent.hasRequestedDetail() || products == null || products.size() != 1) {
            return null;
        }

        boolean english = "en".equals(context.lang());
        Product product;
        try {
            product = catalogReadService.getProductBySlug(products.get(0).slug(), context.lang());
        } catch (RuntimeException ignored) {
            return detailUnavailableAnswer(english, detailIntent);
        }
        if (product == null || sellable(List.of(product)).isEmpty()) {
            return detailUnavailableAnswer(english, detailIntent);
        }

        return productDetailAnswer(context.question(), normalized, english, product);
    }

    private static DeterministicAnswer productDetailAnswer(
            String question,
            String normalized,
            boolean english,
            Product product
    ) {
        ProductDetailIntent detailIntent = productDetailIntent(normalized);
        if (!detailIntent.hasRequestedDetail()) return null;
        Map<String, List<String>> options = normalizedAvailableOptions(product.variants());
        List<String> colors = options.getOrDefault("color", List.of()).stream().limit(8).toList();
        List<String> sizes = sortSizes(options.getOrDefault("size", List.of())).stream().limit(8).toList();
        String name = plain(product.name(), 160);
        List<String> sentences = new ArrayList<>();
        if (detailIntent.technical()) {
            List<String> facts = technicalFacts(product);
            List<String> warnings = safetyWarnings(product);
            int factLimit = warnings.isEmpty() ? 3 : 2;
            sentences.add(english
                    ? (facts.isEmpty()
                    ? "BigBike does not have technical specifications saved for " + name + "."
                    : "The saved technical details for " + name + " are "
                            + String.join("; ", facts.stream().limit(factLimit).toList()) + ".")
                    : (facts.isEmpty()
                    ? "Dạ, shop chưa có thông số kỹ thuật được lưu cho " + name + "."
                    : "Dạ, thông số kỹ thuật đã lưu cho " + name + ": "
                            + String.join("; ", facts.stream().limit(factLimit).toList()) + "."));
            if (!warnings.isEmpty()) {
                String warning = warnings.get(0);
                sentences.add(english
                        ? "Important saved safety warning: " + warning + "."
                        : "Lưu ý an toàn bắt buộc từ trang sản phẩm: " + warning + ".");
            }
        }
        if (detailIntent.size()) {
            List<String> guideRows = sizeGuideRows(product);
            String sellableSizes = sizes.isEmpty()
                    ? (english ? "no currently available size is listed" : "chưa có size đang bán được ghi nhận")
                    : String.join(", ", sizes);
            if (isDetailConfirmation(normalized)) {
                sentences.add(english
                        ? "Yes, " + name + " currently has these sellable sizes: " + sellableSizes + "."
                        : "Dạ, đúng rồi: " + name + " hiện có các size đang bán là " + sellableSizes + ".");
                sentences.add(english
                        ? (guideRows.isEmpty()
                        ? "BigBike does not have a saved measurement size chart for this model."
                        : "The saved size guide is " + String.join("; ", guideRows) + ".")
                        : (guideRows.isEmpty()
                        ? "Shop chưa có bảng size theo số đo được lưu cho mẫu này."
                        : "Bảng size đã lưu: " + String.join("; ", guideRows) + "."));
            } else if (english) {
                sentences.add("The currently sellable sizes are " + sellableSizes + "."
                        + (guideRows.isEmpty()
                        ? ""
                        : " The saved size guide is " + String.join("; ", guideRows) + "."));
                if (guideRows.isEmpty()) {
                    sentences.add("BigBike does not have a saved measurement size chart for this model.");
                }
            } else {
                sentences.add("Các size đang bán là " + sellableSizes + "."
                        + (guideRows.isEmpty()
                        ? ""
                        : " Bảng size đã lưu: " + String.join("; ", guideRows) + "."));
                if (guideRows.isEmpty()) {
                    sentences.add("Shop chưa có bảng size theo số đo được lưu cho mẫu này.");
                }
            }
        }
        if (detailIntent.color()) {
            sentences.add(english
                    ? (colors.isEmpty()
                    ? "There is no safely displayable current colour name for this model."
                    : "The currently sellable colours are " + String.join(", ", colors) + ".")
                    : (colors.isEmpty()
                    ? "Hiện chưa có tên màu đang bán có thể hiển thị an toàn cho mẫu này."
                    : "Các màu đang bán là " + String.join(", ", colors) + "."));
        }
        if (detailIntent.price() || detailIntent.technical()) {
            List<String> prices = availableVariantPriceLabels(product, english);
            sentences.add(english
                    ? (prices.isEmpty()
                    ? "BigBike does not have a current verified price saved for this model."
                    : "The current verified prices are " + String.join("; ", prices) + ".")
                    : (prices.isEmpty()
                    ? "Shop chưa có mức giá hiện tại đã xác minh cho mẫu này."
                    : "Giá hiện tại theo lựa chọn đang bán: " + String.join("; ", prices) + "."));
        }
        if (detailIntent.suitability()) {
            List<String> advice = suitabilityFacts(product);
            sentences.add(english
                    ? (advice.isEmpty()
                    ? "The product page does not currently contain enough saved suitability guidance for this model."
                    : "The saved product guidance says: " + String.join("; ", advice) + ".")
                    : (advice.isEmpty()
                    ? "Trang sản phẩm hiện chưa có đủ nội dung đã lưu để kết luận mẫu này phù hợp với ai."
                    : "Theo nội dung đã lưu trên trang sản phẩm: " + String.join("; ", advice) + "."));
        }
        if (detailIntent.warranty()) {
            List<String> warranty = warrantyFacts(product);
            sentences.add(english
                    ? (warranty.isEmpty()
                    ? "This product page does not currently state an exact saved warranty period, so I will not infer one."
                    : "The saved warranty information is: " + String.join("; ", warranty) + ".")
                    : (warranty.isEmpty()
                    ? "Trang sản phẩm hiện chưa ghi thời hạn bảo hành cụ thể, nên em không tự suy đoán."
                    : "Thông tin bảo hành đã lưu: " + String.join("; ", warranty) + "."));
        }
        if (detailIntent.comparison()) {
            sentences.add(english
                    ? "I have identified " + name
                            + "; please name the other model so I can compare only verified product data."
                    : "Em đã xác định mẫu " + name
                            + "; anh/chị cho em tên mẫu còn lại để em so sánh đúng dữ liệu đã xác minh nhé.");
        }
        if (sentences.size() > 4) {
            sentences = new ArrayList<>(sentences.subList(0, 4));
        }
        sentences.add(english
                ? (detailIntent.size()
                ? "Measure your head circumference first, then choose Talk to staff if you would like size advice."
                : "Open the product page for the complete saved information, or choose Talk to staff if you need confirmation.")
                : (detailIntent.size()
                ? "Anh/chị nên đo vòng đầu trước, rồi bấm Gặp nhân viên nếu cần tư vấn chọn cỡ nhé."
                : "Anh/chị có thể mở trang sản phẩm để xem đầy đủ thông tin đã lưu, hoặc bấm Gặp nhân viên nếu cần xác nhận thêm nhé."));
        return new DeterministicAnswer(String.join(" ", sentences), false, false, false);
    }

    private static boolean isDetailConfirmation(String normalized) {
        return hasWord(normalized, "dung khong", "dung ko", "phai khong", "right");
    }

    private static boolean isProductConfirmation(String normalized) {
        return hasWord(normalized, "dung roi", "chinh no", "chinh xac", "yes", "correct");
    }

    private static ProductDetailIntent productDetailIntent(String normalized) {
        return new ProductDetailIntent(
                hasWord(normalized, "thong so", "trong luong", "can nang", "nang", "weight", "spec", "specs",
                        "dot", "ece", "chuan an toan", "thong gio"),
                hasWord(normalized, "size", "sizes", "kich co", "bang size", "bang co", "chon co",
                        "size guide"),
                hasWord(normalized, "mau", "mau sac", "color", "colour"),
                hasWord(normalized, "gia", "gia bao nhieu", "price", "cost", "how much"),
                hasWord(normalized, "phu hop", "hop voi ai", "nen mua", "danh cho ai", "suitable",
                        "who is it for", "should i buy"),
                hasWord(normalized, "bao hanh", "warranty"),
                hasWord(normalized, "so sanh", "khac gi", "re hon", "compare", "difference", "cheaper"));
    }

    /** Only facts physically present in stored product text are eligible for the chat summary. */
    private static List<String> technicalFacts(Product product) {
        Map<String, RankedTechnicalFact> facts = new LinkedHashMap<>();
        List<String> storedSpecificationSources = List.of(
                nullToEmpty(product.specifications()),
                nullToEmpty(product.specStats()));
        // Product descriptions are sales copy, not a second specification source.  Only fall
        // back to them when both dedicated fields are empty, preserving the documented source
        // order and preventing a marketing sentence from displacing saved specifications.
        List<String> sources = storedSpecificationSources.stream().anyMatch(source -> !source.isBlank())
                ? storedSpecificationSources
                : List.of(nullToEmpty(product.description()), nullToEmpty(product.shortDescription()));
        for (int sourceOrder = 0; sourceOrder < sources.size(); sourceOrder++) {
            int position = 0;
            for (String sentence : readableTechnicalProductText(sources.get(sourceOrder))
                    .split("(?<=[.!?;])\\s+")) {
                String fact = sentence.replaceAll("[.!?;]+$", "").trim();
                int score = technicalFactScore(fact);
                if (score <= 0) {
                    position++;
                    continue;
                }
                String normalizedFact = normalize(fact);
                facts.putIfAbsent(normalizedFact,
                        new RankedTechnicalFact(plain(fact, 320), score, sourceOrder, position));
                position++;
            }
        }
        return facts.values().stream()
                .sorted(Comparator.comparingInt(RankedTechnicalFact::score).reversed()
                        .thenComparingInt(RankedTechnicalFact::sourceOrder)
                        .thenComparingInt(RankedTechnicalFact::position))
                .map(RankedTechnicalFact::fact)
                .limit(3)
                .toList();
    }

    /** Safety caveats saved by the owner outrank optional feature copy (CHAT_RULE_006/007). */
    private static List<String> safetyWarnings(Product product) {
        List<String> sources = List.of(
                nullToEmpty(product.specifications()),
                nullToEmpty(product.specStats()),
                nullToEmpty(product.description()),
                nullToEmpty(product.shortDescription()),
                nullToEmpty(product.quickAnswerSummary()),
                product.suitabilitySection() == null
                        ? "" : nullToEmpty(product.suitabilitySection().getHtml()));
        for (String source : sources) {
            List<String> sentences = savedSentences(source);
            for (int index = 0; index < sentences.size(); index++) {
                String sentence = sentences.get(index);
                String normalized = normalize(sentence);
                boolean explicitWarning = hasWord(normalized, "canh bao", "luu y an toan",
                        "safety warning", "warning");
                boolean reducedProtection = hasWord(normalized, "khong tuong duong",
                        "khong mang lai", "khong bao ve", "does not provide", "not equivalent")
                        && hasWord(normalized, "an toan", "bao ve", "che chan", "fullface",
                        "protection", "coverage");
                boolean configurationLimit = hasWord(normalized, "chung nhan", "certification",
                        "certified") && hasWord(normalized, "cau hinh", "configuration");
                if (!(explicitWarning || reducedProtection || configurationLimit)) continue;
                String warning = sentence;
                if (configurationLimit && index + 1 < sentences.size()) {
                    String next = sentences.get(index + 1);
                    String nextNormalized = normalize(next);
                    if (hasWord(nextNormalized, "khong tuong duong", "khong mang lai",
                            "khong bao ve", "does not provide", "not equivalent")) {
                        warning = warning + ". " + next;
                    }
                }
                if (reducedProtection && index > 0) {
                    String previous = sentences.get(index - 1);
                    String previousNormalized = normalize(previous);
                    if (hasWord(previousNormalized, "chung nhan", "certification", "certified")) {
                        warning = previous + ". " + warning;
                    }
                }
                return List.of(plain(warning.replaceAll("[.!?;]+$", ""), 500));
            }
        }
        return List.of();
    }

    private static List<String> availableVariantPriceLabels(Product product, boolean english) {
        Map<BigDecimal, Set<String>> labelsByPrice = new LinkedHashMap<>();
        if (product.variants() != null) {
            product.variants().stream()
                    .filter(variant -> variant != null && variant.isAvailable())
                    .filter(variant -> variant.stockState()
                            == com.bigbike.bigbike_backend.domain.catalog.ProductStockState.IN_STOCK)
                    .forEach(variant -> {
                        BigDecimal price = effectivePrice(variant.price());
                        if (price == null) return;
                        Set<String> labels = labelsByPrice.computeIfAbsent(
                                price.stripTrailingZeros(), ignored -> new LinkedHashSet<>());
                        if (variant.options() == null) return;
                        variant.options().stream()
                                .filter(option -> option != null
                                        && "color".equals(canonicalAttribute(option.name())))
                                .map(option -> displayableOptionValue("color", option.value()))
                                .filter(value -> value != null && !value.isBlank())
                                .forEach(labels::add);
                    });
        }
        if (labelsByPrice.isEmpty()) {
            BigDecimal productPrice = effectivePrice(product.price());
            return productPrice == null ? List.of() : List.of(money(productPrice, english));
        }
        return labelsByPrice.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> entry.getValue().isEmpty()
                        ? money(entry.getKey(), english)
                        : String.join(" / ", entry.getValue()) + ": " + money(entry.getKey(), english))
                .toList();
    }

    private static BigDecimal effectivePrice(com.bigbike.bigbike_backend.domain.catalog.ProductPrice price) {
        if (price == null) return null;
        BigDecimal value = price.salePrice() != null ? price.salePrice() : price.retailPrice();
        return value == null || value.signum() <= 0 ? null : value;
    }

    private static String money(BigDecimal amount, boolean english) {
        String formatted = NumberFormat.getIntegerInstance(
                english ? Locale.US : Locale.forLanguageTag("vi-VN")).format(amount);
        return formatted + (english ? "₫" : "đ");
    }

    private static List<String> suitabilityFacts(Product product) {
        List<String> preferred = savedSentences(product.suitabilitySection() == null
                ? "" : product.suitabilitySection().getHtml());
        if (!preferred.isEmpty()) return preferred.stream().limit(2).toList();
        List<String> sources = List.of(
                nullToEmpty(product.suitabilityAdvisory()),
                nullToEmpty(product.quickAnswerSummary()),
                nullToEmpty(product.description()),
                nullToEmpty(product.shortDescription()));
        List<String> result = new ArrayList<>();
        for (String source : sources) {
            for (String sentence : savedSentences(source)) {
                String normalized = normalize(sentence);
                if (hasWord(normalized, "phu hop", "danh cho", "nen chon", "khi nao chon",
                        "suitable", "ideal for", "choose this", "best for")) {
                    result.add(sentence);
                    if (result.size() == 2) return List.copyOf(result);
                }
            }
        }
        return List.copyOf(result);
    }

    private static List<String> warrantyFacts(Product product) {
        List<String> sources = new ArrayList<>(List.of(
                nullToEmpty(product.description()),
                nullToEmpty(product.specifications()),
                nullToEmpty(product.quickAnswerSummary())));
        if (product.faqs() != null) {
            product.faqs().stream()
                    .filter(faq -> faq != null)
                    .forEach(faq -> sources.add(
                            nullToEmpty(faq.question()) + ". " + nullToEmpty(faq.answer())));
        }
        List<String> result = new ArrayList<>();
        for (String source : sources) {
            for (String sentence : savedSentences(source)) {
                if (hasWord(normalize(sentence), "bao hanh", "warranty")) {
                    result.add(sentence);
                    if (result.size() == 2) return List.copyOf(result);
                }
            }
        }
        return List.copyOf(result);
    }

    private static List<String> savedSentences(String source) {
        if (source == null || source.isBlank()) return List.of();
        String readable = readableProductText(source);
        if (readable.isBlank()) return List.of();
        return java.util.Arrays.stream(readable.split("(?<=[.!?;])\\s+"))
                .map(sentence -> sentence.replaceAll("[.!?;]+$", "").trim())
                .filter(sentence -> sentence.length() >= 12)
                .map(sentence -> plain(sentence, 500))
                .filter(sentence -> !sentence.isBlank())
                .distinct()
                .toList();
    }

    private static int technicalFactScore(String fact) {
        if (fact == null || fact.isBlank()) return 0;
        String normalized = normalize(fact);
        if (isTechnicalHeadingFragment(fact, normalized)) return 0;
        boolean safety = hasWord(normalized, "dot", "ece", "fmvss", "tieu chuan an toan",
                "chuan an toan", "safety standard");
        boolean material = hasWord(normalized, "abs", "eps", "polycarbonate", "carbon", "composite");
        boolean measurement = TECHNICAL_MEASUREMENT.matcher(fact).find()
                || hasWord(normalized, "trong luong", "can nang", "weight", "kich thuoc", "dimensions");
        boolean technical = hasWord(normalized, "thong gio", "khe lay gio", "khe thoat gio", "pinlock",
                "visor", "chin curtain");
        if (!(safety || material || measurement || technical)) return 0;
        return safety ? 400 : material ? 300 : measurement ? 200 : 100;
    }

    private static boolean isTechnicalHeadingFragment(String fact, String normalized) {
        String compact = fact.replaceAll("[^\\p{L}]", "");
        boolean upperCase = !compact.isBlank() && compact.equals(compact.toUpperCase(Locale.ROOT));
        return upperCase && !fact.matches(".*\\d.*") && hasWord(normalized,
                "tieu chuan an toan", "thong so ky thuat", "tinh nang", "chat lieu", "kich thuoc");
    }

    /** Heading-only fragments are not technical evidence; keep only their body content. */
    private static String readableTechnicalProductText(String value) {
        if (value == null || value.isBlank()) return "";
        String withoutHeadings = value.replaceAll("(?is)<h[1-6][^>]*>.*?</h[1-6]>", " ");
        return readableProductText(withoutHeadings);
    }

    private record RankedTechnicalFact(String fact, int score, int sourceOrder, int position) {}

    private record ScoredProduct(Product product, double score) {}

    private static List<String> sizeGuideRows(Product product) {
        String guide = product.sizeGuideSection() == null
                ? product.sizeGuide() : product.sizeGuideSection().getHtml();
        if (guide == null || guide.isBlank()) return List.of();
        Map<String, String> rows = new LinkedHashMap<>();
        Matcher matcher = SIZE_GUIDE_RANGE.matcher(readableProductText(guide));
        while (matcher.find()) {
            String size = matcher.group(1).toUpperCase(Locale.ROOT);
            rows.putIfAbsent(size, size + " " + matcher.group(2) + "–" + matcher.group(3) + " cm");
        }
        return sortSizes(new ArrayList<>(rows.keySet())).stream().map(rows::get).toList();
    }

    private static List<String> sortSizes(List<String> values) {
        if (values == null || values.isEmpty()) return List.of();
        List<String> order = List.of("XS", "S", "M", "L", "XL", "XXL");
        return values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(value -> value.trim().toUpperCase(Locale.ROOT))
                .distinct()
                .sorted(Comparator.<String>comparingInt(value -> {
                    int index = order.indexOf(value);
                    return index < 0 ? Integer.MAX_VALUE : index;
                }).thenComparing(String::compareTo))
                .toList();
    }

    private static String readableProductText(String value) {
        if (value == null || value.isBlank()) return "";
        return plain(value.replaceAll("(?i)</(?:p|li|h[1-6])>|<br\\s*/?>", ". "), 4_000);
    }

    private static DeterministicAnswer detailUnavailableAnswer(
            boolean english, ProductDetailIntent detailIntent) {
        String requested = detailIntent.technical()
                ? (english ? "technical details" : "thông số kỹ thuật")
                : detailIntent.size()
                ? (english ? "size information" : "thông tin size")
                : (english ? "colour information" : "thông tin màu");
        return new DeterministicAnswer(
                english
                        ? "I found the matching product, but its " + requested + " is not available right now. I will not guess. Please open the product page later or choose Talk to staff so BigBike can check it directly."
                        : "Dạ, em đã tìm thấy sản phẩm phù hợp nhưng hiện chưa có đủ thông tin về " + requested + ". Em không đoán thông tin này. Anh/chị mở trang sản phẩm sau hoặc bấm Gặp nhân viên để BigBike kiểm tra trực tiếp giúp mình nhé.",
                false,
                true,
                false);
    }

    private SearchIntent validateSearchAgainstQuestion(
            ChatToolRegistry.ValidatedCall call, ToolContext context) {
        Map<String, Object> arguments = call.arguments();
        if (!context.lang().equals(arguments.get("lang"))) {
            throw new IllegalArgumentException("Tool language does not match request");
        }
        String normalized = normalizeIntent(context.question());
        SearchIntent derived = effectiveSearchIntent(
                context.question(), context.lang(), context.conversationContext());
        assertOptionalBound(arguments, "minPrice", derived.appliedPrice().min());
        assertOptionalBound(arguments, "maxPrice", derived.appliedPrice().max());

        CatalogIntent catalogIntent = applyVerifiedModelCatalogFilters(
                arguments, derived.catalogIntent());

        for (String field : List.of("query", "color", "size")) {
            Object raw = arguments.get(field);
            boolean verifiedCatalogMeaning = "query".equals(field)
                    && raw instanceof String text
                    && isVerifiedCatalogSemanticProposal(text, catalogIntent);
            if (raw instanceof String text
                    && !allTokensAppear(normalized, text)
                    && !verifiedCatalogMeaning) {
                throw new IllegalArgumentException("Tool filter is not grounded in the question");
            }
        }
        Object sort = arguments.get("sort");
        if (sort != null && !sortFor(derived.appliedPrice(), normalized).equals(sort)) {
            throw new IllegalArgumentException("Tool sort conflicts with the question");
        }
        // The accepted category/brand values came from the model call, but the phrase tokens
        // remain the deterministic evidence parsed from the current question. This lets model
        // interpretation help only inside the public-catalogue boundary selected by the owner.
        ProductQuery query = extractProductQuery(context.question(), catalogIntent.metadataTokens());
        return new SearchIntent(
                catalogIntent,
                query,
                derived.appliedPrice(),
                derived.inheritedPrice(),
                derived.inheritedBrand(),
                derived.color(),
                derived.size());
    }

    /**
     * Đợt 2: Gemini chooses a useful interpretation; the backend independently compares each
     * proposed filter with the customer input, persisted safe scope and current public metadata.
     * A bad semantic field is discarded rather than becoming an exception that loses the turn.
     */
    private SearchIntent validateSearchByResult(
            ChatToolRegistry.ValidatedCall call, ToolContext context) {
        Map<String, Object> arguments = call.arguments();
        String normalized = normalizeIntent(context.question());
        ConversationContext previous = context.conversationContext() == null
                ? ConversationContext.empty() : context.conversationContext();
        CatalogVocabulary vocabulary = publicCatalogVocabulary();

        boolean categorySupplied = arguments.get("category") instanceof String value && !value.isBlank();
        boolean brandSupplied = arguments.get("brand") instanceof String value && !value.isBlank();
        String category = acceptedPublicCatalogTarget(
                arguments.get("category"), vocabulary.categoryAliases());
        String brand = acceptedPublicCatalogTarget(
                arguments.get("brand"), vocabulary.brandAliases());
        CatalogIntent catalogIntent = catalogIntentForTargets(category, brand);
        ProductQuery query = sanitizeModelProductQuery(
                arguments.get("query"), catalogIntent, context.question());

        // Only a short product follow-up can inherit a previously verified scope. Explicit
        // model/name wording never inherits it, so an unrelated product cannot silently be
        // constrained by a prior conversation.
        boolean categoryChanged = categoryChanged(category, previous);
        boolean inheritedBrand = false;
        if (!categoryChanged
                && !query.hasSpecificIdentifier()
                && previous.hasCatalogScope()) {
            category = category == null ? previous.category() : category;
            if (brand == null && !brandSupplied && previous.brand() != null) {
                brand = previous.brand();
                inheritedBrand = true;
            }
            catalogIntent = catalogIntentForTargets(category, brand);
            query = sanitizeModelProductQuery(
                    arguments.get("query"), catalogIntent, context.question());
        }

        PriceIntent directPrice = extractPriceIntent(normalized);
        boolean inheritedPrice = !directPrice.hasBounds()
                && !isPriceScopeReset(normalized)
                && hasConversationPrice(previous)
                && shouldApplyConversationPriceScope(normalized, catalogIntent, query, previous);
        // minPrice/maxPrice supplied by Gemini are deliberately not used. The price scope is
        // always the parser result from this customer turn or an already verified prior scope.
        PriceIntent appliedPrice = inheritedPrice ? priceIntentFromContext(previous) : directPrice;
        String color = verifiedCustomerOption(arguments.get("color"), normalized);
        String size = verifiedCustomerOption(arguments.get("size"), normalized);
        return new SearchIntent(
                catalogIntent, query, appliedPrice, inheritedPrice, inheritedBrand, color, size);
    }

    private static CatalogIntent catalogIntentForTargets(String category, String brand) {
        Set<String> metadataTokens = new LinkedHashSet<>();
        if (category != null) addPhraseTokens(metadataTokens, category);
        if (brand != null) addPhraseTokens(metadataTokens, brand);
        return new CatalogIntent(
                category,
                brand,
                Set.copyOf(metadataTokens),
                approvedTypeQuery(category));
    }

    /** A model field can use only one exact canonical alias from live public metadata. */
    private static String acceptedPublicCatalogTarget(
            Object supplied, List<CatalogAlias> publicAliases) {
        if (!(supplied instanceof String text) || publicAliases == null) return null;
        String normalizedValue = catalogSemanticPhrase(text);
        if (normalizedValue.isBlank()) return null;
        List<String> targets = publicAliases.stream()
                .filter(CatalogAlias::canonical)
                .filter(alias -> normalizedValue.equals(alias.phrase()))
                .map(CatalogAlias::target)
                .distinct()
                .toList();
        return targets.size() == 1 ? targets.get(0) : null;
    }

    /**
     * Generic wording may be normalised by Gemini, but every model/name/code token must already
     * exist in the customer's own message. This retains semantic product-type interpretation
     * without letting a hallucinated concrete model create a card or a fallback search.
     */
    private ProductQuery sanitizeModelProductQuery(
            Object supplied,
            CatalogIntent catalogIntent,
            String customerQuestion
    ) {
        ProductQuery customer = extractProductQuery(customerQuestion, catalogIntent.metadataTokens());
        // A concrete name/model typed by the customer is stronger than the model's reformulated
        // query. Keeping all customer identifier tokens makes equivalent wording converge and
        // prevents "MF5" or "HS711" from being silently widened to a generic helmet search.
        if (customer.hasSpecificIdentifier()) return customer;
        if (!(supplied instanceof String text) || text.isBlank()) return ProductQuery.empty();
        ProductQuery proposed = extractProductQuery(text, catalogIntent.metadataTokens());
        if (!proposed.hasSpecificIdentifier()) return proposed;
        Set<String> customerIdentifiers = new LinkedHashSet<>(customer.identifiers());
        List<String> tokens = proposed.tokens().stream()
                .filter(token -> !proposed.identifiers().contains(token)
                        || customerIdentifiers.contains(token))
                .toList();
        List<String> identifiers = tokens.stream()
                .filter(customerIdentifiers::contains)
                .toList();
        return new ProductQuery(String.join(" ", tokens), List.copyOf(tokens), List.copyOf(identifiers));
    }

    /** Colour and size remain literal customer constraints, never semantic expansion fields. */
    private static String verifiedCustomerOption(Object supplied, String normalizedQuestion) {
        if (!(supplied instanceof String text) || !allTokensAppear(normalizedQuestion, text)) {
            return null;
        }
        String value = normalize(text).replaceAll("[^\\p{Alnum}]+", " ").trim();
        return value.isBlank() ? null : value;
    }

    private static void assertOptionalBound(
            Map<String, Object> arguments, String field, Long protectedValue) {
        Object supplied = arguments.get(field);
        if (supplied == null) return;
        if (protectedValue == null || !protectedValue.equals(supplied)) {
            throw new IllegalArgumentException("Tool price conflicts with the question");
        }
    }

    private CatalogIntent applyVerifiedModelCatalogFilters(
            Map<String, Object> arguments,
            CatalogIntent deterministicIntent
    ) {
        CatalogVocabulary vocabulary = publicCatalogVocabulary();
        String category = verifiedModelCatalogTarget(
                arguments.get("category"), deterministicIntent.category(), vocabulary.categoryAliases());
        String brand = verifiedModelCatalogTarget(
                arguments.get("brand"), deterministicIntent.brand(), vocabulary.brandAliases());
        return new CatalogIntent(
                category,
                brand,
                deterministicIntent.metadataTokens(),
                deterministicIntent.typeQuery());
    }

    /**
     * Model catalogue fields become usable only after both checks pass: the current question
     * has already resolved the same target deterministically, and the model value names that
     * target through live public metadata. This intentionally does not loosen name/model,
     * price, colour or size validation.
     */
    private static String verifiedModelCatalogTarget(
            Object supplied,
            String deterministicTarget,
            List<CatalogAlias> publicAliases
    ) {
        if (supplied == null) return deterministicTarget;
        if (!(supplied instanceof String text) || deterministicTarget == null) {
            throw new IllegalArgumentException("Tool catalog filter is not grounded in the question");
        }
        List<String> mappedTargets = publicAliases.stream()
                .filter(CatalogAlias::canonical)
                .filter(alias -> catalogSemanticPhrase(text).equals(alias.phrase()))
                .map(CatalogAlias::target)
                .distinct()
                .toList();
        if (mappedTargets.size() != 1 || !deterministicTarget.equals(mappedTargets.get(0))) {
            throw new IllegalArgumentException("Tool catalog filter is not grounded in the question");
        }
        return deterministicTarget;
    }

    /**
     * Some providers put a category phrase in the generic query field. It is accepted only as
     * a category/brand meaning already proven by the current question and live public metadata;
     * it never becomes an expanded model/name query.
     */
    private boolean isVerifiedCatalogSemanticProposal(String supplied, CatalogIntent deterministicIntent) {
        if (supplied == null || deterministicIntent == null) return false;
        CatalogVocabulary vocabulary = publicCatalogVocabulary();
        String normalizedValue = catalogSemanticPhrase(supplied);
        return mapsPublicCanonicalAliasToTarget(
                normalizedValue, deterministicIntent.category(), vocabulary.categoryAliases())
                || mapsPublicCanonicalAliasToTarget(
                normalizedValue, deterministicIntent.brand(), vocabulary.brandAliases());
    }

    private static boolean mapsPublicCanonicalAliasToTarget(
            String normalizedValue, String target, List<CatalogAlias> aliases) {
        if (target == null) return false;
        List<String> mappedTargets = aliases.stream()
                .filter(CatalogAlias::canonical)
                .filter(alias -> normalizedValue.equals(alias.phrase()))
                .map(CatalogAlias::target)
                .distinct()
                .toList();
        return mappedTargets.size() == 1 && target.equals(mappedTargets.get(0));
    }

    /** Normalizes a model-supplied public category/brand phrase without granting fuzzy matching. */
    private static String catalogSemanticPhrase(String value) {
        return normalize(value).replaceAll("[^\\p{Alnum}]+", " ").trim();
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
        String normalized = normalizeIntent(question);
        if (normalized.isBlank()) return CatalogIntent.empty();

        CatalogVocabulary vocabulary = publicCatalogVocabulary();
        Optional<CatalogAlias> categoryMatch = bestCatalogAlias(normalized, vocabulary.categoryAliases());
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
                    && (vocabulary.categorySlugs().isEmpty()
                    || vocabulary.categorySlugs().contains(legacyCategory))) {
                category = legacyCategory;
                CATEGORY_KEYWORDS.entrySet().stream()
                        .filter(entry -> legacyCategory.equals(entry.getValue()))
                        .filter(entry -> phraseMatches(normalized, entry.getKey()))
                        .findFirst()
                        .ifPresent(entry -> addPhraseTokens(metadataTokens, entry.getKey()));
            }
        }
        Optional<FuzzyCatalogMatch> categoryCorrection = bestUniqueOneCharacterCorrection(
                normalized, vocabulary.categoryAliases(), 1);
        boolean directAliasIsShort = categoryMatch.map(match -> match.wordCount() < 2).orElse(false);
        if (categoryCorrection.isPresent()
                && (category == null || (directAliasIsShort
                && category.equals(categoryCorrection.get().target())))) {
            category = categoryCorrection.get().target();
            // Keep the customer's misspelled phrase out of model/name discovery. It is already
            // proven to be a unique public category alias, rather than an identifier to search.
            addPhraseTokens(metadataTokens, categoryCorrection.get().customerPhrase());
        }
        if (category != null) addPhraseTokens(metadataTokens, category);

        Optional<CatalogAlias> brandMatch = bestCatalogAlias(normalized, vocabulary.brandAliases());
        String brand = brandMatch.map(CatalogAlias::target).orElse(null);
        brandMatch.ifPresent(match -> addPhraseTokens(metadataTokens, match.phrase()));
        if (brand == null) {
            Optional<FuzzyCatalogMatch> correction = bestUniqueOneCharacterCorrection(
                    normalized, vocabulary.brandAliases(), 1);
            if (correction.isPresent()) {
                brand = correction.get().target();
                addPhraseTokens(metadataTokens, correction.get().customerPhrase());
            }
        }
        if (brand != null) addPhraseTokens(metadataTokens, brand);

        return new CatalogIntent(
                category, brand, Set.copyOf(metadataTokens), approvedTypeQuery(category));
    }

    /**
     * Reads the current public vocabulary once per intent resolution. Normalized aliases remain
     * backend-only; the small canonical display vocabulary is exposed separately below.
     */
    private CatalogVocabulary publicCatalogVocabulary() {
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
        return new CatalogVocabulary(
                List.copyOf(categoryAliases), Set.copyOf(categorySlugs), List.copyOf(brandAliases));
    }

    /**
     * Public, metadata-only vocabulary supplied to Gemini at the start of a turn. It is rebuilt
     * from the current visible catalogue so the model is never asked to guess group or brand
     * names. Product names, prices, stock and counts are intentionally absent.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true, timeout = 5)
    public AssistantCatalogVocabulary assistantCatalogVocabulary() {
        Map<String, AssistantCategoryVocabulary> categories = new LinkedHashMap<>();
        try {
            addAssistantCategories(categories, catalogReadService.listAssistantCategories("vi"), false);
            addAssistantCategories(categories, catalogReadService.listAssistantCategories("en"), true);
        } catch (RuntimeException ignored) {
            // A vocabulary refresh failure must not turn into an invented list. Keep any public
            // entries already read and let the normal tool validator decide later.
        }

        List<AssistantBrandVocabulary> brands = new ArrayList<>();
        try {
            for (Brand brand : catalogReadService.listAssistantBrands()) {
                if (brand == null || !brand.isVisible()) continue;
                String slug = blankToNull(brand.slug());
                String name = assistantVocabularyText(brand.name());
                if (slug != null && name != null) {
                    brands.add(new AssistantBrandVocabulary(slug, name));
                }
            }
        } catch (RuntimeException ignored) {
            // See category handling above; do not substitute a static brand list.
        }
        return new AssistantCatalogVocabulary(
                categories.values().stream()
                        .sorted(Comparator.comparing(AssistantCategoryVocabulary::slug))
                        .toList(),
                brands.stream()
                        .sorted(Comparator.comparing(AssistantBrandVocabulary::slug))
                        .toList());
    }

    private static void addAssistantCategories(
            Map<String, AssistantCategoryVocabulary> target,
            List<Category> source,
            boolean english
    ) {
        if (source == null) return;
        for (Category category : source) {
            if (category == null || !category.isVisible() || category.deleted()) continue;
            String slug = blankToNull(category.slug());
            String name = assistantVocabularyText(category.name());
            if (slug == null || name == null) continue;
            AssistantCategoryVocabulary current = target.get(slug);
            String nameVi = current == null ? null : current.nameVi();
            String nameEn = current == null ? null : current.nameEn();
            if (english) nameEn = name;
            else nameVi = name;
            target.put(slug, new AssistantCategoryVocabulary(
                    slug,
                    nameVi == null ? name : nameVi,
                    nameEn == null ? name : nameEn));
        }
    }

    private static String assistantVocabularyText(String value) {
        String clean = blankToNull(value);
        if (clean == null) return null;
        return clean.length() <= 120 ? clean : clean.substring(0, 120);
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
        String category = direct.category() == null ? context.category() : direct.category();
        return new CatalogIntent(
                category,
                direct.brand() == null ? context.brand() : direct.brand(),
                Set.copyOf(tokens),
                direct.typeQuery() == null ? approvedTypeQuery(category) : direct.typeQuery());
    }

    /**
     * Applies only server-derived context to a product follow-up. A price stated in the current
     * message always wins; otherwise a previously saved price range can constrain a clear
     * follow-up without sending the conversation text to Gemini (CHAT_RULE_005/018).
     */
    private SearchIntent effectiveSearchIntent(
            String question,
            String lang,
            ConversationContext conversationContext
    ) {
        ConversationContext context = conversationContext == null
                ? ConversationContext.empty() : conversationContext;
        String normalized = normalizeIntent(question);
        CatalogIntent directCatalog = resolveCatalogIntent(question, lang);
        CatalogIntent catalogIntent = effectiveCatalogIntent(question, lang, context);
        ProductQuery query = extractProductQuery(question, catalogIntent.metadataTokens());
        PriceIntent directPrice = extractPriceIntent(normalized);
        boolean inheritedPrice = !directPrice.hasBounds()
                && !isPriceScopeReset(normalized)
                && hasConversationPrice(context)
                && shouldApplyConversationPriceScope(normalized, catalogIntent, query, context);
        boolean inheritedBrand = directCatalog.brand() == null
                && context.brand() != null
                && catalogIntent.brand() != null
                && catalogIntent.brand().equalsIgnoreCase(context.brand())
                && shouldApplyConversationCatalogScope(question, directCatalog, context);
        PriceIntent appliedPrice = inheritedPrice ? priceIntentFromContext(context) : directPrice;
        return new SearchIntent(
                catalogIntent,
                query,
                appliedPrice,
                inheritedPrice,
                inheritedBrand,
                extractRequestedOption(normalized, COLOR_REQUEST),
                extractRequestedOption(normalized, SIZE_REQUEST));
    }

    private static boolean hasConversationPrice(ConversationContext context) {
        return context.minPrice() != null || context.maxPrice() != null;
    }

    private static PriceIntent priceIntentFromContext(ConversationContext context) {
        if (context.minPrice() != null && context.maxPrice() != null) {
            return new PriceIntent(context.minPrice(), context.maxPrice(), PriceKind.RANGE);
        }
        if (context.minPrice() != null) {
            return new PriceIntent(context.minPrice(), null, PriceKind.MIN);
        }
        if (context.maxPrice() != null) {
            return new PriceIntent(null, context.maxPrice(), PriceKind.MAX);
        }
        return PriceIntent.none();
    }

    private static boolean shouldApplyConversationPriceScope(
            String normalized,
            CatalogIntent catalogIntent,
            ProductQuery query,
            ConversationContext context
    ) {
        if (query.hasSpecificIdentifier()) return false;
        if (categoryChanged(catalogIntent.category(), context)) return false;
        // A category/brand explicitly named now, or inherited by a recognised follow-up, makes
        // the scope product-specific. Never carry price into an unrelated conversational turn.
        return catalogIntent.category() != null
                || catalogIntent.brand() != null
                || (context.hasCatalogScope() && isStructuralProductFollowUp(normalized));
    }

    private static boolean categoryChanged(String candidate, ConversationContext context) {
        return candidate != null
                && context != null
                && context.category() != null
                && !candidate.equalsIgnoreCase(context.category());
    }

    /** A generic helmet alias must not override a more specific helmet category from this turn. */
    private static boolean categoryChangedProductFamily(String candidate, String previous) {
        if (candidate == null || previous == null) return false;
        return !categoryProductFamily(candidate).equals(categoryProductFamily(previous));
    }

    private static boolean sameCategoryProductFamily(String left, String right) {
        return left != null && right != null
                && categoryProductFamily(left).equals(categoryProductFamily(right));
    }

    private static String categoryProductFamily(String category) {
        String normalized = normalize(category).replace('-', ' ');
        // The public headset slug contains the words "mũ bảo hiểm" as part of its path. Test
        // the specific product family first so a headset turn cannot be mistaken for a helmet
        // turn and inherit the old helmet scope.
        if (hasWord(normalized, "tai nghe", "headset", "headsets")) {
            return "headset";
        }
        if (hasWord(normalized, "mu bao hiem", "non bao hiem", "helmet", "helmets")) {
            return "helmet";
        }
        return normalized;
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
        String normalized = normalizeIntent(question);
        return isStructuralProductFollowUp(normalized);
    }

    /**
     * Legacy/no-history fallback. It uses shape (short + product property/price) rather than a
     * closed vocabulary of demonstratives; the normal history-enabled path relies on the
     * model-selected tool and verifies the result instead.
     */
    private static boolean isStructuralProductFollowUp(String normalized) {
        if (normalized == null || normalized.isBlank()) return false;
        int wordCount = normalized.split("\\s+").length;
        return wordCount <= 12
                && (isPriceScopeReset(normalized)
                || extractPriceIntent(normalized).hasBounds()
                || asksForProductDetail(normalized)
                || asksForProductAvailability(normalized)
                || wordCount <= 6);
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
        return recordConversationContext(previous, question, lang, products, actions, null);
    }

    /**
     * Persists the accepted semantic scope from a successful model-selected search. This is the
     * only path by which an AI interpretation can influence a later customer follow-up.
     */
    public ConversationContext recordConversationContext(
            ConversationContext previous,
            String question,
            String lang,
            List<ChatProductCardResponse> products,
            List<ChatActionResponse> actions,
            SearchScope acceptedSearchScope
    ) {
        ConversationContext prior = previous == null ? ConversationContext.empty() : previous;
        if (isNeedPrompt(normalizeIntent(question))) {
            return ConversationContext.empty();
        }
        boolean verifiedSearch = acceptedSearchScope != null
                && products != null
                && !products.isEmpty();
        String category = verifiedSearch ? acceptedSearchScope.category() : prior.category();
        String brand = verifiedSearch ? acceptedSearchScope.brand() : prior.brand();
        Long minPrice = verifiedSearch ? acceptedSearchScope.minPrice() : prior.minPrice();
        Long maxPrice = verifiedSearch ? acceptedSearchScope.maxPrice() : prior.maxPrice();

        List<String> slugs = products == null || products.isEmpty()
                ? prior.productSlugs()
                : products.stream()
                        .filter(product -> product != null && product.slug() != null)
                        .map(ChatProductCardResponse::slug)
                        .map(String::trim)
                        .filter(slug -> !slug.isBlank())
                        .distinct()
                        .limit(8)
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
        // Full public names/slugs are the only aliases a model may propose. Shorter fragments
        // remain deterministic customer-side matching aids and cannot authorize a model filter.
        aliases.add(new CatalogAlias(target, phrase, tokens.length, true));
        int maxLength = Math.min(tokens.length, 4);
        for (int size = 1; size <= maxLength; size++) {
            for (int start = 0; start + size <= tokens.length; start++) {
                String alias = String.join(" ", List.of(tokens).subList(start, start + size));
                if (!alias.isBlank() && !alias.equals(phrase)) {
                    aliases.add(new CatalogAlias(target, alias, size, false));
                }
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

    /**
     * CHAT_RULE_017 permits one-character correction only for public category/brand aliases.
     * The input window and candidate must be alphabetic and at least four characters after
     * normalization; product models, SKU-like values, colours, sizes and prices never reach
     * this method. A tie between different public targets is intentionally left unresolved.
     */
    private static Optional<FuzzyCatalogMatch> bestUniqueOneCharacterCorrection(
            String normalizedQuestion, List<CatalogAlias> aliases, int minimumWordCount) {
        if (aliases == null || aliases.isEmpty()) return Optional.empty();
        String words = normalizedQuestion.replaceAll("[^\\p{Alnum}]+", " ").trim();
        if (words.isBlank()) return Optional.empty();
        String[] questionTokens = words.split("\\s+");
        Map<String, String> matchedTargets = new LinkedHashMap<>();
        for (CatalogAlias alias : aliases) {
            if (alias.wordCount() < minimumWordCount) continue;
            String normalizedAlias = alias.phrase().replace(" ", "");
            if (normalizedAlias.length() < 4 || !normalizedAlias.matches("[a-z]+")) continue;
            for (int start = 0; start + alias.wordCount() <= questionTokens.length; start++) {
                String customerPhrase = String.join(
                        " ", List.of(questionTokens).subList(start, start + alias.wordCount()));
                String compactCustomerPhrase = customerPhrase.replace(" ", "");
                if (compactCustomerPhrase.length() < 4 || !compactCustomerPhrase.matches("[a-z]+")) continue;
                if (oneCharacterAway(compactCustomerPhrase, normalizedAlias)) {
                    matchedTargets.putIfAbsent(alias.target(), customerPhrase);
                }
            }
        }
        if (matchedTargets.size() != 1) return Optional.empty();
        Map.Entry<String, String> match = matchedTargets.entrySet().iterator().next();
        return Optional.of(new FuzzyCatalogMatch(match.getKey(), match.getValue()));
    }

    /** Returns true only for one insertion, deletion or replacement; no broader fuzzy score. */
    private static boolean oneCharacterAway(String first, String second) {
        if (first.equals(second) || Math.abs(first.length() - second.length()) > 1) return false;
        if (first.length() == second.length()) {
            int differences = 0;
            for (int index = 0; index < first.length(); index++) {
                if (first.charAt(index) != second.charAt(index) && ++differences > 1) return false;
            }
            return differences == 1;
        }
        String shorter = first.length() < second.length() ? first : second;
        String longer = first.length() < second.length() ? second : first;
        int shortIndex = 0;
        int longIndex = 0;
        boolean skipped = false;
        while (shortIndex < shorter.length() && longIndex < longer.length()) {
            if (shorter.charAt(shortIndex) == longer.charAt(longIndex)) {
                shortIndex++;
                longIndex++;
            } else if (skipped) {
                return false;
            } else {
                skipped = true;
                longIndex++;
            }
        }
        return true;
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
        if (!session.hasExecutedSearch() && !context.conversationContext().productSlugs().isEmpty()) {
            Optional<ToolExecution> ambiguity = recentProductAmbiguityExecution(
                    context, ChatToolRegistry.GET_PRODUCT, true);
            if (ambiguity.isPresent()) return ambiguity.get();
            Optional<List<Product>> selection = recentProductSelection(
                    context.question(), normalizeIntent(context.question()), context.lang(),
                    "en".equals(context.lang()), context.conversationContext(), true);
            if (selection.isPresent() && selection.get().size() == 1) {
                // The model selected the intent; the backend selects only the uniquely grounded
                // verified slug, never the model's guess among recent cards.
                slug = selection.get().get(0).slug();
            } else if (!customerSuppliedExactSlug(context.question(), slug)) {
                throw new IllegalArgumentException("Product reference is not uniquely grounded");
            }
        }
        if (!session.isAllowedSlug(slug) && !customerSuppliedExactSlug(context.question(), slug)) {
            throw new IllegalArgumentException("Product slug was not verified in this turn");
        }
        Product product = catalogReadService.getProductBySlug(slug, context.lang());
        if (product == null || sellable(List.of(product)).isEmpty()) {
            throw new IllegalArgumentException("Product is not publicly sellable");
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("tool", ChatToolRegistry.GET_PRODUCT);
        response.put("result", productDetail(product, "en".equals(context.lang())));
        DeterministicAnswer terminal = asksForProductDetail(normalizeIntent(context.question()))
                ? productDetailAnswer(
                        context.question(),
                        normalizeIntent(context.question()),
                        "en".equals(context.lang()),
                        product)
                : null;
        return new ToolExecution(
                ChatToolRegistry.GET_PRODUCT,
                toJson(response),
                List.of(toCard(product)),
                List.of(),
                Set.of(),
                terminal,
                null,
                null);
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
            PriceIntent price,
            String typeQuery
    ) {
        if (productQuery.hasSpecificIdentifier()) {
            return buildIdentifierAttempts(
                    productQuery, normalized, category, brand, color, price, typeQuery);
        }
        // A short follow-up such as "Từ 3tr đến 5tr đi" may leave only a conversational
        // word after price parsing. It is not a catalogue keyword: keeping it would make the
        // first scoped attempt empty, then label the valid retry as a broadened search. Use
        // only meaningful residual tokens when a category has no approved type query.
        String genericQuery = typeQuery == null ? meaningfulGenericQuery(productQuery) : typeQuery;
        return buildGenericAttempts(genericQuery, normalized, category, brand, color, price);
    }

    private static String meaningfulGenericQuery(ProductQuery productQuery) {
        if (productQuery == null) return "";
        return String.join(" ", ProductSearchTerms.tokens(productQuery.text()));
    }

    /**
     * Try the exact model/name first. CHAT_RULE_018 then permits one explicitly labelled,
     * still-scoped alternative only when the same customer sentence also resolved a category or
     * brand. It never becomes an unbounded catalogue sweep, and the BROADENED_SEARCH disclosure
     * is mandatory on that last resort.
     */
    private static List<Attempt> buildIdentifierAttempts(
            ProductQuery query,
            String normalized,
            String category,
            String brand,
            String color,
            PriceIntent price,
            String typeQuery
    ) {
        String sort = sortFor(price, normalized);
        List<Attempt> attempts = new ArrayList<>();
        attempts.add(new Attempt(query.text(), category, brand, color, price, sort, false, false,
                query.identifiers()));
        if (price.hasBounds() && price.kind() != PriceKind.RANGE) {
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
        boolean filtered = category != null || brand != null;

        List<Attempt> attempts = new ArrayList<>();
        attempts.add(new Attempt(freeText, category, brand, color, price, sort, false, false, List.of()));
        if (freeText != null && filtered) {
            // A category/brand filter makes this fallback safe, but removing a customer word is
            // still broader than the original request. Flag it so Bi keeps useful cards while
            // clearly labelling them as close alternatives.
            attempts.add(new Attempt(null, category, brand, color, price, sort, true, false, List.of()));
        }
        if (price.hasBounds() && price.kind() != PriceKind.RANGE) {
            // Nothing in the asked range: show the closest side of it, never the cheapest junk.
            String nearest = price.kind() == PriceKind.MIN ? "price:desc" : "price:asc";
            PriceIntent unpriced = PriceIntent.none();
            if (filtered) {
                attempts.add(new Attempt(null, category, brand, color, unpriced, nearest, false, true, List.of()));
            } else {
                if (freeText != null) {
                    attempts.add(new Attempt(freeText, null, null, color, unpriced, nearest, false, true, List.of()));
                }
            }
        }
        return attempts;
    }

    private static List<String> searchNotes(
            Attempt used,
            PriceIntent requested,
            boolean inheritedPrice,
            boolean inheritedBrandDropped,
            boolean english) {
        List<String> notes = new ArrayList<>();
        if (requested.hasBounds()) {
            // The separate inherited flag in the payload tells the model whether this is a
            // carried constraint; the fixed disclosure is enforced independently by the guard.
            notes.add(english
                    ? "If inheritedPrice is true, plainly state that the displayed products are filtered by the price range from the customer's previous product request."
                    : "Nếu inheritedPrice là true, phải nói rõ danh sách đang được lọc theo tầm giá khách đã nêu ở lượt hỏi sản phẩm trước.");
        }
        boolean inheritedFilterDropped = inheritedBrandDropped
                || used.priceDropped() && requested.hasBounds() && inheritedPrice;
        if (inheritedFilterDropped) {
            notes.add(english
                    ? "One inherited filter produced no match and was removed only for this retry. State that clearly and invite the customer to refine the request."
                    : "Một bộ lọc kế thừa không có kết quả và đã được bỏ riêng cho lần tìm lại này. Phải nói rõ điều đó và mời khách nêu lại nhu cầu.");
        } else if (used.priceDropped() && requested.hasBounds()) {
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
            Attempt used,
            PriceIntent requested,
            boolean inheritedPrice,
            boolean inheritedBrandDropped) {
        Set<RequiredDisclosure> disclosures = new LinkedHashSet<>();
        if (inheritedPrice && requested.hasBounds() && !used.priceDropped()) {
            disclosures.add(RequiredDisclosure.INHERITED_PRICE_RANGE);
        }
        if (inheritedBrandDropped || used.priceDropped() && requested.hasBounds() && inheritedPrice) {
            disclosures.add(RequiredDisclosure.INHERITED_FILTER_DROPPED);
        } else if (used.priceDropped() && requested.hasBounds()) {
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

    /** One closest model on each side is more honest than a lowest-price sort for a price range. */
    private static List<Product> nearestRangeAlternatives(
            List<Product> candidates, PriceIntent requested) {
        if (candidates == null || requested.min() == null || requested.max() == null) return List.of();
        BigDecimal minimum = BigDecimal.valueOf(requested.min());
        BigDecimal maximum = BigDecimal.valueOf(requested.max());
        Comparator<Product> byPrice = Comparator.comparing(
                ChatToolService::effectiveSellingPrice,
                Comparator.nullsLast(Comparator.naturalOrder()));
        Product below = candidates.stream()
                .filter(product -> {
                    BigDecimal price = effectiveSellingPrice(product);
                    return price != null && price.compareTo(minimum) < 0;
                })
                .max(byPrice)
                .orElse(null);
        Product above = candidates.stream()
                .filter(product -> {
                    BigDecimal price = effectiveSellingPrice(product);
                    return price != null && price.compareTo(maximum) > 0;
                })
                .min(byPrice)
                .orElse(null);
        List<Product> nearest = new ArrayList<>();
        if (below != null) nearest.add(below);
        if (above != null) nearest.add(above);
        return List.copyOf(nearest);
    }

    /** Keep a model already discussed visible when it still belongs to the current verified set. */
    private static List<Product> prioritizePreviouslyShown(
            List<Product> products, ConversationContext conversationContext) {
        if (products == null || products.isEmpty()
                || conversationContext == null || conversationContext.productSlugs().isEmpty()) {
            return products == null ? List.of() : List.copyOf(products);
        }
        Map<String, Integer> previousOrder = new LinkedHashMap<>();
        for (int index = 0; index < conversationContext.productSlugs().size(); index++) {
            previousOrder.put(conversationContext.productSlugs().get(index), index);
        }
        return products.stream()
                .sorted(Comparator.comparingInt(product -> previousOrder.getOrDefault(
                        product.slug(), Integer.MAX_VALUE)))
                .toList();
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

    private AttemptSearchResult searchAttempt(Attempt attempt, String lang) {
        if (!attempt.identifierTokens().isEmpty()) {
            List<Product> products = catalogReadService.searchProductsForAssistant(
                    attempt.identifierTokens(),
                    attempt.category(),
                    attempt.brand(),
                    attempt.price().min(),
                    attempt.price().max(),
                    attempt.sort(),
                    DISCOVERY_CANDIDATE_LIMIT,
                    lang);
            return new AttemptSearchResult(products, null);
        }
        PageResult<Product> page = searchProducts(
                attempt.query(),
                attempt.category(),
                attempt.brand(),
                attempt.price().min(),
                attempt.price().max(),
                attempt.color(),
                null,
                attempt.sort(),
                lang);
        return new AttemptSearchResult(page == null ? List.of() : page.items(), page);
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
        PageResult<Product> page = searchProductsWide(
                attempt.query(),
                attempt.category(),
                attempt.brand(),
                null,
                null,
                attempt.color(),
                null,
                attempt.sort(),
                lang);
        return page == null ? List.of() : page.items();
    }

    /**
     * CHAT_RULE_020: catalog counts are exposed only for an initial, non-identifier search that
     * remains inside a verified category/brand scope. A fallback or model-name lookup has no
     * count evidence, so the response guard keeps numerical catalogue claims forbidden there.
     */
    private CatalogTotals catalogTotalsFor(
            SearchIntent searchIntent,
            ProductQuery query,
            Attempt used,
            AttemptSearchResult selectedSearch,
            String color,
            String lang
    ) {
        if (used == null
                || query.hasSpecificIdentifier()
                || used.broadened()
                || used.priceDropped()
                || (used.category() == null && used.brand() == null)) {
            return null;
        }

        String typeQuery = searchIntent.catalogIntent().typeQuery();
        PageResult<Product> scopePage = null;
        boolean selectedAlreadyIsScope = !used.price().hasBounds()
                && color == null
                && nullToEmpty(used.query()).equals(nullToEmpty(typeQuery));
        if (selectedAlreadyIsScope) {
            scopePage = selectedSearch == null ? null : selectedSearch.page();
        }
        if (scopePage == null) {
            scopePage = searchProducts(
                    typeQuery,
                    used.category(),
                    used.brand(),
                    null,
                    null,
                    null,
                    null,
                    sortFor(PriceIntent.none(), ""),
                    lang);
        }
        if (scopePage == null) return null;

        if (!used.price().hasBounds()) {
            return new CatalogTotals(scopePage.totalItems(), scopePage.totalItems(), null);
        }

        PageResult<Product> pricePage = searchProducts(
                typeQuery,
                used.category(),
                used.brand(),
                used.price().min(),
                used.price().max(),
                null,
                null,
                used.sort(),
                lang);
        if (pricePage == null) return null;
        return new CatalogTotals(
                pricePage.totalItems(), scopePage.totalItems(), pricePage.totalItems());
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
                blankToNull(color), productGenderFilters(gender), minPrice, maxPrice, null, lang);
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
                blankToNull(color), productGenderFilters(gender), minPrice, maxPrice, null, lang);
    }

    private static List<String> productGenderFilters(String raw) {
        String value = blankToNull(raw);
        if (value == null) return List.of();
        return switch (value.toLowerCase(Locale.ROOT)) {
            case "nam" -> List.of("Nam");
            case "nữ" -> List.of("Nữ");
            default -> List.of();
        };
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
                    ? "BigBike currently supports two manual payment methods: cash on delivery (COD) and bank transfer. BigBike Assistant cannot take payment or place an order on your behalf. Please continue through the cart to choose a method and review the order before confirming."
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

    private static Map<String, Object> productDetail(Product product, boolean english) {
        Map<String, Object> detail = new LinkedHashMap<>(productSummary(product));
        detail.put("shortDescription", plain(product.shortDescription(), 800));
        detail.put("description", plain(product.description(), 1800));
        detail.put("quickAnswer", plain(product.quickAnswerSummary(), 800));
        detail.put("specifications", plain(product.specifications(), 1800));
        detail.put("specStats", plain(product.specStats(), 1800));
        detail.put("suitability", product.suitabilitySection() == null
                ? plain(product.suitabilityAdvisory(), 1600)
                : plain(product.suitabilitySection().getHtml(), 1600));
        detail.put("safetyWarnings", safetyWarnings(product));
        detail.put("sizeGuide", plain(product.sizeGuide(), 1200));
        detail.put("sizeGuideSection", product.sizeGuideSection() == null
                ? "" : plain(product.sizeGuideSection().getHtml(), 1200));
        detail.put("pros", highlights(product, true));
        detail.put("cons", highlights(product, false));
        detail.put("faqs", product.faqs() == null ? List.of() : product.faqs().stream()
                .limit(5)
                .map(ChatToolService::faq)
                .toList());
        detail.put("availableOptions", normalizedAvailableOptions(product.variants()));
        detail.put("availableVariants", normalizedAvailableVariants(product.variants()));
        detail.put("availableVariantPrices", availableVariantPriceLabels(product, english));
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
                String value = displayableOptionValue(key, option.value());
                if (key.isBlank() || value == null) continue;
                grouped.computeIfAbsent(key, ignored -> new LinkedHashSet<>()).add(value);
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
                        String value = displayableOptionValue(key, option.value());
                        if (!key.isBlank() && value != null && !value.isBlank()) combination.put(key, value);
                    }
                    return Map.copyOf(combination);
                })
                .filter(combination -> !combination.isEmpty())
                .distinct()
                .toList();
    }

    /**
     * Variant options are admin data, not display copy. Colour values are humanized here so a
     * raw slug can never enter a chat tool payload; a value that cannot be transformed safely is
     * omitted instead of being shown verbatim.
     */
    private static String displayableOptionValue(String key, String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim();
        if (!"color".equals(key)) return value;
        return normalizeColorForDisplay(value);
    }

    static String normalizeColorForDisplay(String raw) {
        if (raw == null || raw.isBlank() || raw.length() > 80) return null;
        String value = raw.trim();
        if (UNSAFE_OPTION_VALUE.matcher(value).find()) return null;
        String separated = value
                .replaceAll("[_-]+", " ")
                .replaceAll("(?<=[\\p{L}])(?=\\d)", " ")
                .replaceAll("(?<=\\d)(?=[\\p{L}])", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (separated.isBlank()) return null;
        List<String> words = new ArrayList<>();
        for (String token : separated.split(" ")) {
            if (!token.matches("[\\p{L}\\p{N}]{1,20}")) return null;
            // Values such as ff320, day1 and 353 are technical model/code fragments, not
            // customer-facing colour names. Standalone numeric suffixes remain allowed for
            // real values such as den-nham-3.
            if (token.matches("(?=.*[\\p{L}])(?=.*\\d).*")
                    || token.matches("\\d{2,}")) return null;
            words.add(displayColorWord(token));
        }
        if (words.isEmpty() || words.size() > 6) return null;
        String result = String.join(" ", words);
        // This closes the path even if a later edit changes the token transformation above.
        return RAW_OPTION_SLUG.matcher(result).matches() ? null : result;
    }

    private static String displayColorWord(String token) {
        return switch (normalize(token)) {
            case "den" -> "Đen";
            case "trang" -> "Trắng";
            case "xam" -> "Xám";
            case "do" -> "Đỏ";
            case "xanh" -> "Xanh";
            case "vang" -> "Vàng";
            case "nham" -> "Nhám";
            case "bong" -> "Bóng";
            case "dam" -> "Đậm";
            case "nhat" -> "Nhạt";
            case "la" -> "Lá";
            case "bac" -> "Bạc";
            case "cam" -> "Cam";
            case "tim" -> "Tím";
            case "hong" -> "Hồng";
            case "nau" -> "Nâu";
            default -> token.substring(0, 1).toUpperCase(Locale.forLanguageTag("vi-VN"))
                    + token.substring(1).toLowerCase(Locale.forLanguageTag("vi-VN"));
        };
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
        String normalizedQuestion = normalizeIntent(question);
        boolean hasPriceIntent = extractPriceIntent(normalizedQuestion).hasBounds();
        String cleaned = normalizedQuestion
                // These phrases describe the request, not a product name/model. Keep the
                // original question unchanged for asksForProductDetail and option parsing.
                .replaceAll(VARIANT_INQUIRY.pattern(), " ")
                .replaceAll(BUDGET_FRAMING.pattern(), " ")
                .replaceAll(PRICE_SCOPE_RESET.pattern(), " ")
                // Exact, reviewed request framing must not become a product identifier. This
                // keeps natural switches such as "Chuyển sang tìm tai nghe" scoped to the new
                // category instead of searching for literal words "chuyển" and "sang".
                .replaceAll("(?iU)\\b(?:tim dung (?:mau|san pham)|find (?:the )?exact (?:model|product)"
                        + "|chuyen sang|doi sang|switch to|change to)\\b", " ")
                // A concrete option is a product constraint, not a model code. Option extraction
                // still reads the unmodified normalized question in productOutcome().
                .replaceAll(SIZE_REQUEST.pattern(), " ")
                .replaceAll(COLOR_REQUEST.pattern(), " ")
                .replaceAll("(?iU)(toi muon|minh muon|toi can|cho toi|cho em|giup em|tim|tu van|tham khao"
                        + "|please|find|find me|search|show me|i want|i need|looking for|can you|could you)", " ")
                .replaceAll("(?iU)\\b(thuong hieu|brand|danh muc|category)\\b", " ")
                .replaceAll("(?iU)(trong luong|nang bao nhieu|weight|thong so|specifications?)", " ")
                // Price wording belongs to min/max filters, not to the product-name search.
                // Grouped đồng amounts go first so "2.500.000đ" is not chopped into "2." + "500.000đ".
                .replaceAll("(?iU)\\d{1,3}(?:[.,]\\d{3})+\\s*(?:d|vnd|dong)?", " ")
                .replaceAll("(?iU)\\d+\\s*(?:trieu|tr)\\s*(?:\\d{1,3})(?![a-z0-9])", " ")
                .replaceAll("(?iU)(?:\\d+(?:[.,]\\d+)?|" + PRICE_WORD_TOKEN
                        + ")\\s*(?:trieu|tr|million|nghin|ngan|k|cu|lit|d|vnd|dong)\\b", " ")
                .replaceAll("(?iU)\\b(tu|den|toi|tren|duoi|hon|khoang|tam|to|between|about|around"
                        + "|ruoi|tro len|tro xuong|do lai|khong qua"
                        + "|toi da|toi thieu|it nhat"
                        + "|under|below|above|over|from|about|around|up to|at least)\\b", " ")
                .replaceAll("(?iU)\\b(san pham|hang hoa|con hang|bao nhieu|the nao|shop|nao|khong|co|gi"
                        + "|minh|a|voi|nhe|vay|ad|admin)\\b", " ")
                .replaceAll("(?U)(^|\\s)[.,;:\\-–—/]+(?=\\s|$)", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return productQuery(cleaned, hasPriceIntent, true);
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
                .filter(token -> !extractPriceIntent(normalizeIntent(question)).hasBounds() || !token.matches("\\d+"))
                .toList();
        return new ProductQuery(String.join(" ", tokens), tokens, identifiers);
    }

    private static ProductQuery productQuery(String value) {
        return productQuery(value, false, false);
    }

    private static ProductQuery productQuery(String value, boolean hasPriceIntent) {
        return productQuery(value, hasPriceIntent, false);
    }

    private static ProductQuery productQuery(
            String value, boolean hasPriceIntent, boolean removeConversationalFillers) {
        String normalized = normalizeIntent(value)
                .replaceAll("[^\\p{Alnum}/]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.isBlank()) return ProductQuery.empty();
        LinkedHashSet<String> distinct = new LinkedHashSet<>();
        for (String token : normalized.split("\\s+")) {
            if (removeConversationalFillers && CONVERSATIONAL_FILLER_TOKENS.contains(token)) continue;
            if (!token.isBlank() && token.length() <= 64) distinct.add(token);
            if (distinct.size() == 12) break;
        }
        List<String> tokens = List.copyOf(distinct);
        List<String> identifiers = tokens.stream()
                .filter(token -> !GENERIC_PRODUCT_TOKENS.contains(token))
                .filter(token -> !CONVERSATIONAL_FILLER_TOKENS.contains(token))
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
        normalized = normalizeIntent(normalized);
        Matcher shared = SHARED_UNIT_RANGE.matcher(normalized);
        if (shared.find()) {
            long unit = unitMultiplier(shared.group(3));
            return range(amount(shared.group(1), unit), amount(shared.group(2), unit));
        }

        List<ParsedAmount> parsedAmounts = new ArrayList<>();
        Matcher compactMillion = COMPACT_MILLION_AMOUNT.matcher(normalized);
        while (compactMillion.find()) {
            parsedAmounts.add(new ParsedAmount(
                    compactMillionAmount(compactMillion.group(1), compactMillion.group(2)),
                    compactMillion.start(), compactMillion.end()));
        }
        Matcher unitAmount = UNIT_AMOUNT.matcher(normalized);
        while (unitAmount.find()) {
            if (overlapsKnownAmount(unitAmount.start(), unitAmount.end(), parsedAmounts)) continue;
            long unit = unitMultiplier(unitAmount.group(2));
            long value = amount(unitAmount.group(1), unit);
            if (unit >= 1_000_000L && normalized.startsWith(" ruoi", unitAmount.end())) {
                value += 500_000L;
            }
            parsedAmounts.add(new ParsedAmount(value, unitAmount.start(), unitAmount.end()));
        }
        if (parsedAmounts.isEmpty()) {
            Matcher plain = PLAIN_AMOUNT.matcher(normalized);
            while (plain.find()) {
                parsedAmounts.add(new ParsedAmount(
                        amount(plain.group(1).replace(".", "").replace(",", ""), 1L),
                        plain.start(), plain.end()));
            }
        }
        if (parsedAmounts.isEmpty()) return PriceIntent.none();
        parsedAmounts.sort(Comparator.comparingInt(ParsedAmount::start));

        if (parsedAmounts.size() >= 2
                && isRangeConnector(normalized.substring(
                parsedAmounts.get(0).end(), parsedAmounts.get(1).start()))) {
            return range(parsedAmounts.get(0).value(), parsedAmounts.get(1).value());
        }

        ParsedAmount first = parsedAmounts.get(0);
        long value = first.value();
        String before = lastWords(normalized.substring(0, first.start()));
        String after = firstWords(normalized.substring(first.end()));
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
            case "trieu", "tr", "million", "cu", "lit" -> 1_000_000L;
            case "nghin", "ngan", "k" -> 1_000L;
            default -> 1L;
        };
    }

    private static long amount(String raw, long unit) {
        Long wordValue = PRICE_WORD_VALUES.get(raw);
        if (wordValue != null) return wordValue * unit;
        return new BigDecimal(raw.replace(',', '.'))
                .multiply(BigDecimal.valueOf(unit))
                .longValue();
    }

    private static long compactMillionAmount(String whole, String fraction) {
        long base = Long.parseLong(whole) * 1_000_000L;
        long suffix = Long.parseLong(fraction);
        long scale = switch (fraction.length()) {
            case 1 -> 100_000L;
            case 2 -> 10_000L;
            case 3 -> 1_000L;
            default -> throw new IllegalArgumentException("Unsupported compact million precision");
        };
        return base + suffix * scale;
    }

    private static boolean overlapsKnownAmount(int start, int end, List<ParsedAmount> knownAmounts) {
        return knownAmounts.stream().anyMatch(known -> start < known.end() && end > known.start());
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

    /**
     * Keeps normalization pure for catalogue/model comparisons while applying the small approved
     * shorthand table at customer-intent boundaries. The boundaries are exact alphanumeric word
     * boundaries, so the approved one-letter forms never alter a price such as {@code 500k} or a
     * model such as {@code V2}.
     */
    static String normalizeIntent(String value) {
        String normalized = normalize(value)
                // Preserve price separators for CHAT_RULE_015; product tokenization performs
                // its own punctuation cleanup after price/option extraction.
                .replaceAll("[^\\p{Alnum}/.,~\\-–—]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.isBlank()) return normalized;
        String expanded = " " + normalized + " ";
        for (Map.Entry<String, String> entry : APPROVED_ABBREVIATIONS.entrySet()) {
            String expression = "(?<![\\p{Alnum}])" + Pattern.quote(entry.getKey())
                    + "(?![\\p{Alnum}])";
            expanded = expanded.replaceAll(expression, entry.getValue());
        }
        String contextual = expanded.replaceAll("\\s+", " ").trim();
        if (contextual.matches(".*\\b(?:co|con|con hang|duoc|phai|khong)\\b.*\\bhong(?:\\s+(?:shop|ad|anh chi))?$")
                && !contextual.matches(".*\\b(?:mau|deo|giap)\\s+hong(?:\\s+(?:shop|ad|anh chi))?$")) {
            contextual = contextual.replaceFirst("\\bhong(?=(?:\\s+(?:shop|ad|anh chi))?$)", "khong");
        }
        return contextual;
    }

    private static boolean isPriceScopeReset(String normalized) {
        return normalized != null && PRICE_SCOPE_RESET.matcher(normalized).find();
    }

    private static boolean asksForProductDetail(String value) {
        // FAQ answers stay in the rich get_product payload for the model; the structured
        // deterministic fields above cover the common detail intents handled locally.
        return productDetailIntent(value).hasRequestedDetail() || hasWord(value, "faq");
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

    static boolean isComparisonRequest(String normalized) {
        return normalized != null && productDetailIntent(normalized).comparison();
    }

    /** Collective comparison means all immediately preceding cards, not an ambiguous cheaper/other one. */
    private static boolean isCollectiveComparisonRequest(String normalized) {
        if (normalized == null || normalized.isBlank()) return false;
        String compact = normalized.replaceAll("[^\\p{Alnum}]+", " ").trim();
        return hasWord(compact,
                "so sanh", "so sanh cac mau", "so sanh san pham", "so sanh giup em",
                "hai mau nay", "2 mau nay", "ba mau nay", "3 mau nay", "ca hai", "ca ba",
                "compare", "compare products", "compare models", "compare these models",
                "compare these products", "both models", "all three models");
    }

    private static boolean isNeedPrompt(String normalized) {
        if (normalized == null) return false;
        String compact = normalized.replaceAll("[^\\p{Alnum}]+", " ").trim();
        return Set.of("tim theo nhu cau", "doi nhu cau", "find by need", "change needs")
                .contains(compact);
    }

    private ToolOutcome needPromptOutcome(String lang) {
        boolean english = "en".equals(lang);
        List<String> names = catalogReadService.listAssistantCategories(lang).stream()
                .filter(category -> category.parentId() == null)
                .sorted(Comparator
                        .comparing((Category category) -> category.sortOrder() == null
                                ? Integer.MAX_VALUE : category.sortOrder())
                        .thenComparing(category -> nullToEmpty(category.name()), String.CASE_INSENSITIVE_ORDER))
                .map(Category::name)
                .filter(name -> name != null && !name.isBlank())
                .filter(name -> !english || !Pattern.compile("[à-ỹÀ-ỸđĐ]").matcher(name).find())
                .distinct()
                .limit(4)
                .toList();
        String answer;
        if (names.isEmpty()) {
            answer = english
                    ? "What type of product or riding need would you like help with? Tell me the item and budget, and I will check currently sold products without guessing."
                    : "Dạ, anh/chị đang cần loại sản phẩm nào hoặc muốn dùng cho nhu cầu gì ạ? Anh/chị cho em biết loại hàng và tầm giá để em kiểm tra đúng sản phẩm đang bán nhé.";
        } else {
            String choices = String.join(", ", names);
            answer = english
                    ? "BigBike’s main product groups include " + choices + ". Which group or riding need would you like help with?"
                    : "Dạ, một số nhóm hàng chính của BigBike gồm " + choices + ". Anh/chị đang cần nhóm nào hoặc muốn dùng cho nhu cầu gì ạ?";
        }
        return ToolOutcome.local(answer, "TEMPLATE", false, false, false);
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

    /** Backend-owned lead eligibility; the model cannot suppress a qualifying product/fallback signal. */
    static boolean shouldOfferLeadPrompt(
            String question,
            List<ChatProductCardResponse> products,
            boolean recoverableFallback
    ) {
        if (recoverableFallback || (products != null && !products.isEmpty())) return true;
        String normalized = normalizeIntent(question);
        if (normalized.isBlank()
                || isGreetingOrHelp(normalized)
                || isKnownOffTopic(normalized)
                || isHumanHandoff(normalized)
                || isLeadDecline(normalized)) {
            return false;
        }
        ProductDetailIntent detailIntent = productDetailIntent(normalized);
        return detailIntent.hasRequestedDetail()
                || asksForProductAvailability(normalized)
                || extractProductQuery(question).hasSpecificIdentifier()
                || hasWord(normalized, "gia", "price", "size", "stock", "con hang", "ton kho",
                        "available", "mau", "color", "colour");
    }

    private static String plain(String html, int max) {
        if (html == null || html.isBlank()) return "";
        if (max <= 0) return "";
        String text = html
                .replaceAll("(?i)<br\\s*/?>", ". ")
                .replaceAll("(?i)</(?:p|li|h[1-6]|div|tr|td|section)>", ". ")
                .replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (text.length() <= max) return text;

        int cut = lastSentenceBoundary(text, max);
        if (cut <= 0) {
            int next = nextSentenceBoundary(text, max);
            cut = next > 0 && next <= max + 240 ? next : lastWordBoundary(text, max);
        }
        if (cut <= 0) cut = Math.min(max, text.length());
        String candidate = text.substring(0, cut).trim();
        if (isHeadingOnly(candidate)) {
            int next = nextSentenceBoundary(text, cut);
            if (next > cut) candidate = text.substring(0, next).trim();
        }
        if (candidate.length() >= text.length()) return candidate;
        return candidate + " …";
    }

    private static int lastSentenceBoundary(String text, int max) {
        int boundary = -1;
        for (int index = 0; index < Math.min(max, text.length()); index++) {
            char current = text.charAt(index);
            if (".!?。！？;".indexOf(current) >= 0
                    && (index + 1 == text.length() || Character.isWhitespace(text.charAt(index + 1)))) {
                boundary = index + 1;
            }
        }
        return boundary;
    }

    private static int nextSentenceBoundary(String text, int start) {
        for (int index = Math.max(0, start); index < text.length(); index++) {
            char current = text.charAt(index);
            if (".!?。！？;".indexOf(current) >= 0
                    && (index + 1 == text.length() || Character.isWhitespace(text.charAt(index + 1)))) {
                return index + 1;
            }
        }
        return -1;
    }

    private static int lastWordBoundary(String text, int max) {
        int end = Math.min(max, text.length());
        int boundary = text.lastIndexOf(' ', end - 1);
        return boundary > 0 ? boundary : end;
    }

    private static boolean isHeadingOnly(String value) {
        String normalized = normalize(value.replaceAll("[.!?;]+$", "").trim());
        if (normalized.isBlank() || value.matches(".*\\d.*")) return false;
        String compact = value.replaceAll("[^\\p{L}]", "");
        boolean shortUppercase = !compact.isBlank()
                && compact.equals(compact.toUpperCase(Locale.ROOT))
                && value.trim().split("\\s+").length <= 10;
        boolean knownHeading = hasWord(normalized,
                "tieu chuan an toan", "thong so ky thuat", "tinh nang", "chat lieu", "kich thuoc");
        return shortUppercase || (knownHeading && value.trim().split("\\s+").length <= 10);
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

    /**
     * CHAT_RULE_017 approved shorthand table. The loop order is part of the contract: a specific
     * phrase must be expanded before a shorter constituent token can be considered. Matching is
     * implemented with explicit word boundaries in {@link #normalizeIntent(String)}.
     */
    private static Map<String, String> approvedAbbreviations() {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("mu bh", "mu bao hiem");
        map.put("mbh", "mu bao hiem");
        map.put("non", "mu bao hiem");
        map.put("kieng", "kinh");
        map.put("mu ff", "mu fullface");
        map.put("tn", "tai nghe");
        map.put("bh", "bao hanh");
        map.put("sdt", "so dien thoai");
        map.put("cty", "cong ty");
        map.put("ship", "giao hang");
        map.put("sz", "size");
        map.put("bnhieu", "bao nhieu");
        map.put("bn", "bao nhieu");
        map.put("hok", "khong");
        map.put("khong", "khong");
        map.put("ko", "khong");
        map.put("ntn", "nhu the nao");
        map.put("dc", "duoc");
        map.put("ae", "anh em");
        map.put("ad", "admin");
        map.put("z", "vay");
        map.put("j", "gi");
        return java.util.Collections.unmodifiableMap(map);
    }

    /** Product-type free-text filters approved for a category with intentionally broad membership. */
    private static Map<String, String> categoryTypeQueries() {
        return Map.of("tai-nghe-bluetooth-mu-bao-hiem", "tai nghe");
    }

    private static String approvedTypeQuery(String category) {
        return category == null ? null : CATEGORY_TYPE_QUERIES.get(category);
    }

    private static Map<String, Long> priceWordValues() {
        Map<String, Long> values = new LinkedHashMap<>();
        values.put("mot", 1L);
        values.put("hai", 2L);
        values.put("ba", 3L);
        values.put("bon", 4L);
        values.put("nam", 5L);
        values.put("sau", 6L);
        values.put("bay", 7L);
        values.put("tam", 8L);
        values.put("chin", 9L);
        values.put("muoi", 10L);
        return Map.copyOf(values);
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
                "size", "mau", "sac",
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

    /**
     * Exact conversational-filler whitelist used before model/name matching. These are words
     * that do not identify an item by themselves in this shopping dialogue; keeping it explicit
     * is the safety boundary required by CHAT_RULE_017.
     */
    private static Set<String> conversationalFillerTokens() {
        return Set.of(
                "thi", "sao", "y", "la", "vay", "the", "a", "u", "nhe", "nha", "nua", "di", "nhung",
                "khac", "loai", "cai", "xem", "kia", "nay", "do", "o", "tren", "duoi",
                "nhu", "tuong", "tu", "da", "trao", "doi", "noi", "hoi", "con", "ma",
                "thoi", "luon", "size", "mau", "ok",
                "then", "so", "what", "about", "also", "else", "another", "other", "same",
                "similar", "previous", "earlier", "please", "thanks", "thank", "okay", "show",
                "see");
    }

    private static void addPhraseTokens(Set<String> target, String phrase) {
        String normalized = normalize(phrase).replaceAll("[^\\p{Alnum}/]+", " ");
        for (String token : normalized.split("\\s+")) {
            if (!token.isBlank()) target.add(token);
        }
    }

    enum PriceKind { NONE, MIN, MAX, BAND, RANGE }

    private record ParsedAmount(long value, int start, int end) {}

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

    private record AttemptSearchResult(List<Product> products, PageResult<Product> page) {
        private AttemptSearchResult {
            products = products == null ? List.of() : List.copyOf(products);
        }
    }

    /** Exact count evidence created from the current non-identifier catalog search only. */
    public record CatalogTotals(
            long currentTotalItems,
            long scopeTotalItems,
            Long priceRangeTotalItems
    ) {}

    record ProductQuery(String text, List<String> tokens, List<String> identifiers) {
        static ProductQuery empty() {
            return new ProductQuery("", List.of(), List.of());
        }

        boolean hasSpecificIdentifier() {
            return !identifiers.isEmpty();
        }
    }

    private record CatalogAlias(String target, String phrase, int wordCount, boolean canonical) {}

    private record CatalogVocabulary(
            List<CatalogAlias> categoryAliases,
            Set<String> categorySlugs,
            List<CatalogAlias> brandAliases
    ) {}

    /** Public metadata only; safe to include in the initial Gemini request. */
    public record AssistantCatalogVocabulary(
            List<AssistantCategoryVocabulary> categories,
            List<AssistantBrandVocabulary> brands
    ) {
        public AssistantCatalogVocabulary {
            categories = categories == null ? List.of() : List.copyOf(categories);
            brands = brands == null ? List.of() : List.copyOf(brands);
        }

        public static AssistantCatalogVocabulary empty() {
            return new AssistantCatalogVocabulary(List.of(), List.of());
        }

        public boolean isEmpty() {
            return categories.isEmpty() && brands.isEmpty();
        }
    }

    public record AssistantCategoryVocabulary(String slug, String nameVi, String nameEn) {}

    public record AssistantBrandVocabulary(String slug, String name) {}

    private record FuzzyCatalogMatch(String target, String customerPhrase) {}

    private record CatalogIntent(
            String category,
            String brand,
            Set<String> metadataTokens,
            String typeQuery
    ) {
        static CatalogIntent empty() {
            return new CatalogIntent(null, null, Set.of(), null);
        }
    }

    private record ProductDetailIntent(
            boolean technical,
            boolean size,
            boolean color,
            boolean price,
            boolean suitability,
            boolean warranty,
            boolean comparison
    ) {
        boolean hasRequestedDetail() {
            return technical || size || color || price || suitability || warranty || comparison;
        }
    }

    /** Effective server-side search scope; it contains no customer prose or identity. */
    private record SearchIntent(
            CatalogIntent catalogIntent,
            ProductQuery query,
            PriceIntent appliedPrice,
            boolean inheritedPrice,
            boolean inheritedBrand,
            String color,
            String size
    ) {
        boolean hasUsableConstraint() {
            return catalogIntent.category() != null
                    || catalogIntent.brand() != null
                    || appliedPrice.hasBounds()
                    || query.text() != null && !query.text().isBlank()
                    || color != null
                    || size != null;
        }

        SearchScope searchScope() {
            return new SearchScope(
                    catalogIntent.category(),
                    catalogIntent.brand(),
                    appliedPrice.min(),
                    appliedPrice.max());
        }
    }

    private enum OrderScope { LATEST, RECENT }

    public enum RequiredDisclosure {
        INHERITED_PRICE_RANGE,
        INHERITED_FILTER_DROPPED,
        PRICE_RANGE_MISS,
        BROADENED_SEARCH
    }

    /** Safe, server-accepted search scope that may be persisted for a short follow-up. */
    public record SearchScope(String category, String brand, Long minPrice, Long maxPrice) {
        public SearchScope {
            category = ConversationContext.trimScope(category);
            brand = ConversationContext.trimScope(brand);
        }

        boolean hasAnyScope() {
            return category != null || brand != null || minPrice != null || maxPrice != null;
        }
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
                    .limit(8)
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

        public ToolSession() {
            this(List.of());
        }

        /**
         * A prior card grants a one-turn, server-verified detail lookup only. The provider never
         * controls this seed and every value is reduced to the public-slug form before use.
         */
        public ToolSession(List<String> recentVerifiedProducts) {
            if (recentVerifiedProducts == null) return;
            recentVerifiedProducts.stream()
                    .filter(slug -> slug != null && slug.matches("[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*"))
                    .map(ChatToolService::normalizedSlug)
                    .limit(8)
                    .forEach(allowedSlugs::add);
        }

        void begin(String name) {
            if (executed.size() >= 3) {
                throw new IllegalStateException("Chat tool execution limit exceeded");
            }
            executed.add(name);
        }

        void complete(String name, List<ChatProductCardResponse> products) {
            if (!ChatToolRegistry.SEARCH_PRODUCTS.equals(name) || products == null) return;
            products.stream()
                    .map(ChatProductCardResponse::slug)
                    .filter(slug -> slug != null && !slug.isBlank())
                    .map(ChatToolService::normalizedSlug)
                    .forEach(allowedSlugs::add);
        }

        public boolean isAllowedSlug(String slug) {
            return slug != null && allowedSlugs.contains(normalizedSlug(slug));
        }

        public int executionCount() {
            return executed.size();
        }

        boolean hasExecutedSearch() {
            return executed.contains(ChatToolRegistry.SEARCH_PRODUCTS);
        }
    }

    private static String normalizedSlug(String slug) {
        return slug.trim().toLowerCase(Locale.ROOT);
    }

    public record ToolExecution(
            String name,
            String responseJson,
            List<ChatProductCardResponse> products,
            List<ChatActionResponse> actions,
            Set<RequiredDisclosure> requiredDisclosures,
            DeterministicAnswer terminalAnswer,
            CatalogTotals catalogTotals,
            SearchScope searchScope
    ) {
        public ToolExecution(
                String name,
                String responseJson,
                List<ChatProductCardResponse> products,
                List<ChatActionResponse> actions,
                Set<RequiredDisclosure> requiredDisclosures,
                DeterministicAnswer terminalAnswer,
                CatalogTotals catalogTotals
        ) {
            this(name, responseJson, products, actions, requiredDisclosures, terminalAnswer, catalogTotals, null);
        }

        public ToolExecution(
                String name,
                String responseJson,
                List<ChatProductCardResponse> products,
                List<ChatActionResponse> actions,
                Set<RequiredDisclosure> requiredDisclosures,
                DeterministicAnswer terminalAnswer
        ) {
            this(name, responseJson, products, actions, requiredDisclosures, terminalAnswer, null, null);
        }

        public ToolExecution(
                String name,
                String responseJson,
                List<ChatProductCardResponse> products,
                List<ChatActionResponse> actions,
                Set<RequiredDisclosure> requiredDisclosures
        ) {
            this(name, responseJson, products, actions, requiredDisclosures, null, null, null);
        }

        public ToolExecution(
                String name,
                String responseJson,
                List<ChatProductCardResponse> products,
                List<ChatActionResponse> actions
        ) {
            this(name, responseJson, products, actions, Set.of(), null, null, null);
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

        static DeterministicAnswer from(ToolOutcome outcome, String question) {
            return new DeterministicAnswer(
                    outcome.localAnswer(),
                    outcome.offTopic(),
                    outcome.handoffRecommended(),
                    shouldOfferLeadPrompt(question, outcome.products(), outcome.aiRequired()));
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
            Set<RequiredDisclosure> requiredDisclosures,
            boolean inheritedPrice,
            CatalogTotals catalogTotals,
            List<String> matchingProductNames,
            SearchScope effectiveSearchScope
    ) {
        static ToolOutcome ai(String toolJson, List<ChatProductCardResponse> products) {
            return ai(toolJson, products, Set.of(), false, null, List.of(), null);
        }

        static ToolOutcome ai(
                String toolJson,
                List<ChatProductCardResponse> products,
                Set<RequiredDisclosure> requiredDisclosures
        ) {
            return ai(toolJson, products, requiredDisclosures, false, null, List.of(), null);
        }

        static ToolOutcome ai(
                String toolJson,
                List<ChatProductCardResponse> products,
                Set<RequiredDisclosure> requiredDisclosures,
                boolean inheritedPrice
        ) {
            return ai(toolJson, products, requiredDisclosures, inheritedPrice, null, List.of(), null);
        }

        static ToolOutcome ai(
                String toolJson,
                List<ChatProductCardResponse> products,
                Set<RequiredDisclosure> requiredDisclosures,
                boolean inheritedPrice,
                CatalogTotals catalogTotals
        ) {
            return ai(toolJson, products, requiredDisclosures, inheritedPrice, catalogTotals, List.of(), null);
        }

        static ToolOutcome ai(
                String toolJson,
                List<ChatProductCardResponse> products,
                Set<RequiredDisclosure> requiredDisclosures,
                boolean inheritedPrice,
                CatalogTotals catalogTotals,
                List<String> matchingProductNames
        ) {
            return ai(toolJson, products, requiredDisclosures, inheritedPrice, catalogTotals,
                    matchingProductNames, null);
        }

        static ToolOutcome ai(
                String toolJson,
                List<ChatProductCardResponse> products,
                Set<RequiredDisclosure> requiredDisclosures,
                boolean inheritedPrice,
                CatalogTotals catalogTotals,
                List<String> matchingProductNames,
                SearchScope effectiveSearchScope
        ) {
            return new ToolOutcome(
                    true, null, "AI", toolJson, List.copyOf(products), false, false, false,
                    List.of(), Set.copyOf(requiredDisclosures), inheritedPrice, catalogTotals,
                    matchingProductNames == null ? List.of() : List.copyOf(matchingProductNames),
                    effectiveSearchScope);
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
            return local(answer, source, offTopic, handoff, leadDeclined, actions, List.of());
        }

        static ToolOutcome local(
                String answer,
                String source,
                boolean offTopic,
                boolean handoff,
                boolean leadDeclined,
                List<ChatActionResponse> actions,
                List<ChatProductCardResponse> products) {
            return new ToolOutcome(false, answer, source, "{}",
                    products == null ? List.of() : List.copyOf(products), offTopic, handoff, leadDeclined,
                    List.copyOf(actions), Set.of(), false, null, List.of(), null);
        }
    }
}
