package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatClarificationOptionResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatClarificationResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatClarificationSelectionRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductFaq;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlight;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariantOption;
import com.bigbike.bigbike_backend.repository.catalog.ProductSearchTerms;
import com.bigbike.bigbike_backend.repository.content.ContentReadRepository;
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
import org.jsoup.Jsoup;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Fixed, read-only tool allowlist for Trợ lý BigBike. No tool accepts SQL, table names or customer identity. */
@Service
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
            "va", "and", "or", "nao", "gi", "any", "available", "khong",
            "la", "nhu", "the", "co", "con", "dang", "dung", "roi", "bang", "guide", "chart",
            "what", "which", "how");

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
    /** Owner-approved clarity stop threshold; kept here so it can be tuned without copy changes. */
    public static final int CLARIFICATION_STOP_THRESHOLD = 8;
    public static final int CLARIFICATION_PREVIEW_LIMIT = 3;
    public static final int BESTSELLER_MIN_COMPLETED_ORDERS = 10;
    public static final int BESTSELLER_MIN_PRODUCTS = 2;
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
    private static final List<DecisionGroup> DECISION_GROUPS = decisionGroups();
    private static final Map<String, List<UseCaseChoice>> USE_CASE_CHOICES = useCaseChoices();

    private final CatalogReadService catalogReadService;
    private final OrderReadService orderReadService;
    private final ContentReadRepository contentReadRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public ChatToolService(
            CatalogReadService catalogReadService,
            OrderReadService orderReadService,
            ContentReadRepository contentReadRepository
    ) {
        this.catalogReadService = catalogReadService;
        this.orderReadService = orderReadService;
        this.contentReadRepository = contentReadRepository;
    }

    /** Compatibility constructor for unit tests that predate article grounding. */
    public ChatToolService(
            CatalogReadService catalogReadService,
            OrderReadService orderReadService
    ) {
        this(catalogReadService, orderReadService, null);
    }

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

        Optional<ToolOutcome> fastPath = resolveFastPathActive(
                question, lang, customerId, settings, conversationContext, null);
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
        return resolveFastPath(
                question, lang, customerId, settings, ConversationContext.empty(), null);
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
        return resolveFastPath(
                question, lang, customerId, settings, conversationContext, null);
    }

    public Optional<ToolOutcome> resolveFastPath(
            String question,
            String lang,
            UUID customerId,
            ChatAssistantSettings.Snapshot settings,
            ConversationContext conversationContext,
            ChatClarificationSelectionRequest clarificationSelection
    ) {
        return resolveFastPathActive(
                question, lang, customerId, settings, conversationContext,
                clarificationSelection);
    }

    private Optional<ToolOutcome> resolveFastPathActive(
            String question,
            String lang,
            UUID customerId,
            ChatAssistantSettings.Snapshot settings,
            ConversationContext conversationContext,
            ChatClarificationSelectionRequest clarificationSelection
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

        if (isThanks(normalized)) {
            return Optional.of(ToolOutcome.local(
                    english
                            ? "You’re welcome. If you need anything else, I can help with products currently sold by BigBike, store policies or orders on your signed-in account."
                            : "Dạ, em rất vui được hỗ trợ anh/chị. Khi cần thêm, anh/chị cứ hỏi em về sản phẩm BigBike đang bán, chính sách cửa hàng hoặc đơn của tài khoản đã đăng nhập nhé.",
                    "RULE", false, false));
        }

        Optional<ToolOutcome> productDecision = productDecisionOutcome(
                question, normalized, lang, conversationContext, clarificationSelection);
        if (productDecision.isPresent()) return productDecision;

        if (isNeedPrompt(normalized)) {
            return Optional.of(needPromptOutcome(lang));
        }

        if (isGreetingOrHelp(normalized)) {
            return Optional.of(ToolOutcome.local(
                    english
                            ? "Hello, I’m BigBike Assistant, BigBike’s AI shopping assistant. I can help you find currently sold products, check verified store policies or view orders on your signed-in account. Tell me the product, brand, category or price range you are considering, or choose Talk to staff for direct help."
                            : "Em là Trợ lý BigBike, trợ lý ảo AI của BigBike. Em có thể tìm sản phẩm đang bán, tra chính sách đã công bố hoặc xem đơn của tài khoản đang đăng nhập. Anh/chị cho em biết tên hàng, thương hiệu, danh mục hoặc tầm giá đang quan tâm; nếu cần, anh/chị có thể bấm Gặp nhân viên.",
                    "RULE", false, false));
        }
        if (isAmbiguousComparison(question, normalized)) {
            return Optional.of(ToolOutcome.local(
                    english
                            ? "I can compare products once you share the names or links of the models you want to compare. Which two or three models should I check for you?"
                            : "Em có thể so sánh khi anh/chị cho em tên hoặc link của các mẫu cần xem. Anh/chị muốn so sánh hai hoặc ba mẫu nào ạ?",
                    "RULE", false, false));
        }
        if (isAmbiguousBudget(normalized)) {
            return Optional.of(ToolOutcome.local(
                    english
                            ? "I can filter products once I know your budget. What price range would you like me to check?"
                            : "Anh/chị muốn xem trong tầm giá nào để em lọc sản phẩm theo ngân sách ạ?",
                    "RULE", false, false));
        }
        if (isLightestQuestion(normalized)) {
            return Optional.of(ToolOutcome.local(
                    english
                            ? "BigBike does not yet have consistently verified weight data for every currently sold helmet, so I cannot name a lightest model reliably. Tell me another priority such as helmet type, budget, size or safety standard and I will narrow the choice."
                            : "BigBike chưa có cân nặng được xác minh đồng nhất cho toàn bộ mũ đang bán, nên em chưa thể khẳng định mẫu nhẹ nhất. Anh/chị cho em tiêu chí khác như loại mũ, tầm giá, size hoặc chuẩn an toàn để em lọc đúng nhé.",
                    "RULE", false, false));
        }
        if (isSafetyHelmetAdvice(normalized)) {
            return Optional.of(safetyHelmetAdviceOutcome(lang, english));
        }
        if (isPromotionLookup(normalized)) {
            return Optional.of(promotionOutcome(lang, english));
        }
        if (isHumanHandoff(normalized)) {
            return Optional.of(ToolOutcome.local(
                    english
                            ? "This request needs a BigBike staff member to review it directly. Please choose Talk to staff below so the team can help without making an unsupported promise. I’ll keep the contact options available."
                            : "Trường hợp này cần nhân viên BigBike kiểm tra trực tiếp để hỗ trợ đúng chính sách. Anh/chị bấm Gặp nhân viên bên dưới giúp em nhé; em không tự hứa giảm giá, ngày giao hoặc ngoại lệ đổi trả. Các kênh liên hệ luôn được giữ sẵn.",
                    "RULE", false, true));
        }
        if (isOrderQuestion(normalized) && customerId == null) {
            return Optional.of(orderOutcome(null, english, orderScope(normalized)));
        }
        if (isOrderQuestion(normalized)) {
            return Optional.of(orderOutcome(customerId, english, orderScope(normalized)));
        }
        if (isBankDetailsQuestion(normalized)) {
            return Optional.of(bankTransferOutcome(settings, english));
        }
        if (isShopInfoQuestion(normalized)) {
            return Optional.of(shopInfoOutcome(settings, english));
        }
        // A named model asking about size is product detail, not the generic shop size policy.
        if (isPolicyQuestion(normalized)
                && (!isSizePolicyQuestion(normalized)
                || !extractProductQuery(question).hasSpecificIdentifier())) {
            return Optional.of(policyOutcome(normalized, english, settings));
        }
        if (isKnownOffTopic(normalized)) {
            return Optional.of(ToolOutcome.local(
                    english
                            ? "I can only help with products currently sold by BigBike, store policies and your signed-in orders. I can’t advise on motorcycles, politics or topics outside the shop. Please choose Talk to staff if you need other help from BigBike."
                            : "Em chỉ hỗ trợ sản phẩm BigBike đang bán, chính sách cửa hàng và đơn của tài khoản đã đăng nhập. Em không tư vấn xe, chính trị hoặc nội dung ngoài phạm vi shop. Anh/chị có thể bấm Gặp nhân viên nếu cần BigBike hỗ trợ việc khác.",
                    "RULE", true, false));
        }
        return Optional.empty();
    }

    /**
     * CHAT_RULE_034–036. Product ambiguity is resolved entirely from current catalog data and
     * server-owned conversation state. Returning an outcome here keeps every clarification
     * round ahead of the provider/quota gate in {@link ChatService}.
     */
    private Optional<ToolOutcome> productDecisionOutcome(
            String question,
            String normalized,
            String lang,
            ConversationContext conversationContext,
            ChatClarificationSelectionRequest clarificationSelection
    ) {
        ConversationContext context = conversationContext == null
                ? ConversationContext.empty() : conversationContext;
        boolean restartNeeds = isNeedPrompt(normalized);
        ConversationContext decisionContext = restartNeeds
                ? ConversationContext.empty() : context;
        ProductDecisionContext prior = decisionContext.productDecision() == null
                ? ProductDecisionContext.empty() : decisionContext.productDecision();
        PendingClarificationOption selected = selectedPendingOption(
                prior.pending(), clarificationSelection, normalized);
        if (selected == null && !shouldPlanProductDecision(question, normalized, lang, prior)) {
            return Optional.empty();
        }
        if (selected != null
                && prior.pending() != null
                && "REFERENCE".equals(prior.pending().criterion())) {
            return Optional.of(referenceSelectionOutcome(
                    question, normalized, lang, context, prior, selected));
        }

        DecisionCatalog catalog;
        try {
            catalog = decisionCatalog(lang);
        } catch (RuntimeException ignored) {
            // A catalog outage must not manufacture choices. The established fallback path owns
            // the customer response and operational telemetry for this exceptional condition.
            return Optional.empty();
        }
        if (catalog.products().isEmpty()) return Optional.empty();

        boolean english = "en".equals(lang);
        boolean bypass = isShowAllRequest(normalized)
                || isImpatientShowRequest(normalized)
                || selected != null && "BYPASS".equals(selected.kind());
        boolean delegated = isDelegatedChoice(normalized);

        SearchIntent intent = effectiveSearchIntent(question, lang, decisionContext);
        CatalogIntent directCatalog = resolveCatalogIntent(question, lang);
        PriceIntent price = intent.appliedPrice();
        String group = prior.group();
        String useCase = prior.useCase();
        String typeCategory = prior.typeCategory();
        String size = prior.size();
        String color = prior.color();

        if (selected != null && "FILTER".equals(selected.kind())) {
            switch (prior.pending() == null ? "" : prior.pending().criterion()) {
                case "GROUP" -> {
                    if (!selected.value().equals(group)) {
                        typeCategory = null;
                        useCase = null;
                    }
                    group = selected.value();
                }
                case "USE_CASE" -> useCase = selected.value();
                case "TYPE" -> typeCategory = selected.value();
                case "PRICE" -> price = priceFromDecisionValue(selected.value());
                case "SIZE" -> size = selected.value();
                case "COLOR" -> color = selected.value();
                default -> { /* A measurement/help choice is not a product filter. */ }
            }
        }

        String directGroup = groupForCategory(directCatalog.category(), catalog);
        if (directGroup != null) {
            if (!directGroup.equals(group)) {
                useCase = null;
                typeCategory = null;
            }
            group = directGroup;
            if (isSpecificTypeCategory(directCatalog.category(), directGroup)) {
                typeCategory = directCatalog.category();
            }
        }
        String inheritedGroup = groupForCategory(intent.catalogIntent().category(), catalog);
        if (group == null && inheritedGroup != null) {
            group = inheritedGroup;
            if (isSpecificTypeCategory(intent.catalogIntent().category(), inheritedGroup)) {
                typeCategory = intent.catalogIntent().category();
            }
        }
        if (intent.size() != null) size = intent.size();
        if (intent.color() != null) color = intent.color();
        String directUseCase = matchUseCaseAnswer(normalized, group);
        if (directUseCase != null) useCase = directUseCase;

        LinkedHashSet<String> asked = new LinkedHashSet<>(prior.askedCriteria());
        if (prior.pending() != null && prior.pending().criterion() != null) {
            asked.add(prior.pending().criterion());
        }

        String brand = intent.catalogIntent().brand();
        List<Product> active = filterDecisionProducts(
                catalog.products(), catalog, group, useCase, typeCategory,
                brand, price, size, color, lang);
        List<Product> sellable = active.stream()
                .filter(ChatToolService::isDecisionCardEligible)
                .sorted(decisionProductComparator())
                .toList();

        SearchScope scope = new SearchScope(
                typeCategory != null ? typeCategory : genericRootForGroup(group),
                brand,
                price.min(),
                price.max());
        ProductDecisionContext decidedState = new ProductDecisionContext(
                group, useCase, typeCategory, size, color, List.copyOf(asked), null);

        if (delegated) {
            return Optional.of(delegatedDecisionOutcome(
                    sellable, scope, decidedState, english));
        }
        if (bypass) {
            return Optional.of(finalDecisionOutcome(
                    sellable, scope, decidedState, english, true));
        }

        boolean hasRecognizedConstraint = group != null
                || brand != null
                || price.hasBounds()
                || size != null
                || color != null
                || useCase != null
                || typeCategory != null;
        if (hasRecognizedConstraint && sellable.size() <= CLARIFICATION_STOP_THRESHOLD) {
            return Optional.of(finalDecisionOutcome(
                    sellable, scope, decidedState, english, false));
        }

        boolean personalSize = isPersonalSizeQuestion(normalized) && intent.size() == null;
        if (group == null) {
            return groupClarification(
                    catalog, price, brand, size, color, lang, asked, personalSize);
        }

        if (personalSize && !asked.contains("MEASUREMENT")) {
            return Optional.of(measurementClarification(
                    group, sellable, scope, decidedState, asked, english));
        }

        // “Theo/đổi ngân sách” explicitly tells us which missing fact the customer wants to
        // supply. Preserve that established behavior instead of asking a less relevant need
        // question first.
        if (isAmbiguousBudget(normalized) && !price.hasBounds() && !asked.contains("PRICE")) {
            List<PendingClarificationOption> options = priceOptions(active, english);
            if (filterOptionCount(options) >= 2) {
                return Optional.of(knownGroupClarification(
                        group, active.size(), sellable, scope, decidedState, asked,
                        "PRICE", english
                                ? "Which price range would you like me to use?"
                                : "Anh/chị muốn em lọc tiếp theo tầm giá nào ạ?",
                        options, english));
            }
        }

        if (useCase == null && !asked.contains("USE_CASE")) {
            List<PendingClarificationOption> options = useCaseOptions(group, active, english);
            if (filterOptionCount(options) >= 2) {
                return Optional.of(knownGroupClarification(
                        group, active.size(), sellable, scope, decidedState, asked,
                        "USE_CASE", useCaseQuestion(group, options, english), options, english));
            }
        }

        if (!price.hasBounds() && !asked.contains("PRICE")) {
            List<PendingClarificationOption> options = priceOptions(active, english);
            if (filterOptionCount(options) >= 2) {
                return Optional.of(knownGroupClarification(
                        group, active.size(), sellable, scope, decidedState, asked,
                        "PRICE", english
                                ? "Which price range would you like me to use?"
                                : "Anh/chị muốn em lọc tiếp theo tầm giá nào ạ?",
                        options, english));
            }
        }

        if (typeCategory == null && !asked.contains("TYPE")) {
            List<PendingClarificationOption> options = typeOptions(
                    group, active, catalog, english);
            if (filterOptionCount(options) >= 2) {
                return Optional.of(knownGroupClarification(
                        group, active.size(), sellable, scope, decidedState, asked,
                        "TYPE", english
                                ? "Which product type would you like to narrow this to?"
                                : "Anh/chị muốn thu hẹp theo kiểu sản phẩm nào ạ?",
                        options, english));
            }
        }

        if (size == null && !asked.contains("SIZE")) {
            List<PendingClarificationOption> options = variantOptions(active, "size", english);
            if (filterOptionCount(options) >= 2) {
                return Optional.of(knownGroupClarification(
                        group, active.size(), sellable, scope, decidedState, asked,
                        "SIZE", english
                                ? "Which available size should I filter by?"
                                : "Anh/chị cần lọc theo size nào ạ?",
                        options, english));
            }
        }

        if (color == null && !asked.contains("COLOR")) {
            List<PendingClarificationOption> options = variantOptions(active, "color", english);
            if (filterOptionCount(options) >= 2) {
                return Optional.of(knownGroupClarification(
                        group, active.size(), sellable, scope, decidedState, asked,
                        "COLOR", english
                                ? "Which available color would you prefer?"
                                : "Anh/chị thích màu nào trong các màu đang có ạ?",
                        options, english));
            }
        }

        // No unasked, data-backed criterion can reduce the set. Asking another question would
        // not change the result, so stop and present the bounded verified cards.
        return Optional.of(finalDecisionOutcome(
                sellable, scope, decidedState, english, false));
    }

    private boolean shouldPlanProductDecision(
            String question,
            String normalized,
            String lang,
            ProductDecisionContext prior
    ) {
        if (isThanks(normalized)
                || isGreetingOrHelp(normalized)
                || isOrderQuestion(normalized)
                || isShopInfoQuestion(normalized)
                || isBankDetailsQuestion(normalized)
                || isPromotionLookup(normalized)
                || isHumanHandoff(normalized)
                || isKnownOffTopic(normalized)
                || isLightestQuestion(normalized)
                || isSafetyHelmetAdvice(normalized)
                || isAmbiguousComparison(question, normalized)) {
            return false;
        }
        if (isPolicyQuestion(normalized) && !isPersonalSizeQuestion(normalized)) return false;
        CatalogIntent direct = resolveCatalogIntent(question, lang);
        ProductQuery query = extractProductQuery(question, direct.metadataTokens());
        boolean broadRequest = hasWord(normalized,
                "tim san pham", "tim hang", "cho xem", "xem san pham", "san pham",
                "tu van giup", "tu van cho toi", "toi muon duoc tu van", "tro giup",
                "goi y giup", "doi ngan sach", "loc theo ngan sach", "find products",
                "show products", "show me", "recommend", "help me choose", "i need advice",
                "general advice", "change budget", "filter by budget", "new budget");
        boolean constraints = direct.category() != null
                || direct.brand() != null
                || extractPriceIntent(normalized).hasBounds()
                || extractRequestedOption(normalized, COLOR_REQUEST) != null
                || extractRequestedOption(normalized, SIZE_REQUEST) != null;
        if (isPersonalSizeQuestion(normalized)) return true;
        // These are explicit dialogue controls, not product names. Check them before the
        // identifier escape hatch because natural wording such as “cứ cho xem hết đi”,
        // “tùy em” or “I need advice” deliberately contains words outside the product-token
        // whitelist. They must stay on the zero-provider clarification path.
        if (isShowAllRequest(normalized)
                || isImpatientShowRequest(normalized)
                || isDelegatedChoice(normalized)
                || isAmbiguousBudget(normalized)
                || isNeedPrompt(normalized)
                || isGeneralProductAdviceRequest(normalized)) {
            return true;
        }
        // A concrete customer-supplied name/model is already a sufficiently narrow target.
        // Keep it on the established verified-search path even when the sentence also contains
        // generic framing such as “tìm sản phẩm”, otherwise the clarification planner would
        // replace an exact Tanami/MF5 lookup with arbitrary category cards. A pending broad
        // question is likewise superseded when the customer answers with an exact model.
        if (query.hasSpecificIdentifier()) return false;
        if (prior != null && prior.pending() != null) return true;
        return broadRequest || constraints || isNeedPrompt(normalized)
                || isPersonalSizeQuestion(normalized)
                || isDelegatedChoice(normalized)
                || prior != null && prior.group() != null;
    }

    private DecisionCatalog decisionCatalog(String lang) {
        List<Product> products = catalogReadService.listAssistantDecisionProducts(lang);
        List<Category> categories = catalogReadService.listAssistantCategories(lang);
        Map<String, List<String>> childIds = new LinkedHashMap<>();
        Map<String, String> slugById = new LinkedHashMap<>();
        Map<String, String> nameBySlug = new LinkedHashMap<>();
        Map<String, String> idBySlug = new LinkedHashMap<>();
        for (Category category : categories) {
            if (category == null || category.id() == null || category.slug() == null) continue;
            slugById.put(category.id(), category.slug());
            idBySlug.put(category.slug(), category.id());
            nameBySlug.put(category.slug(), category.name());
            if (category.parentId() != null) {
                childIds.computeIfAbsent(category.parentId(), ignored -> new ArrayList<>())
                        .add(category.id());
            }
        }
        Map<String, Set<String>> descendants = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : idBySlug.entrySet()) {
            descendants.put(entry.getKey(), descendantSlugs(entry.getValue(), childIds, slugById));
        }
        Map<String, Set<String>> groupSlugs = new LinkedHashMap<>();
        for (DecisionGroup group : DECISION_GROUPS) {
            LinkedHashSet<String> slugs = new LinkedHashSet<>();
            for (String root : group.roots()) {
                slugs.addAll(descendants.getOrDefault(root, Set.of(root)));
            }
            groupSlugs.put(group.key(), Set.copyOf(slugs));
        }
        return new DecisionCatalog(
                products == null ? List.of() : List.copyOf(products),
                categories == null ? List.of() : List.copyOf(categories),
                Map.copyOf(descendants), Map.copyOf(groupSlugs), Map.copyOf(nameBySlug));
    }

    private static Set<String> descendantSlugs(
            String rootId,
            Map<String, List<String>> childIds,
            Map<String, String> slugById
    ) {
        LinkedHashSet<String> visited = new LinkedHashSet<>();
        ArrayList<String> queue = new ArrayList<>(List.of(rootId));
        for (int index = 0; index < queue.size(); index++) {
            String id = queue.get(index);
            if (!visited.add(id)) continue;
            queue.addAll(childIds.getOrDefault(id, List.of()));
        }
        return visited.stream()
                .map(slugById::get)
                .filter(value -> value != null && !value.isBlank())
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    private static PendingClarificationOption selectedPendingOption(
            PendingClarification pending,
            ChatClarificationSelectionRequest selection,
            String normalizedMessage
    ) {
        if (pending == null || pending.options().isEmpty()) return null;
        if (selection != null
                && pending.id() != null
                && pending.id().equals(selection.clarificationId())) {
            Optional<PendingClarificationOption> exact = pending.options().stream()
                    .filter(option -> option.id().equals(selection.optionId()))
                    .findFirst();
            if (exact.isPresent()) return exact.get();
        }
        String normalized = normalizedMessage == null ? "" : normalizedMessage.trim();
        return pending.options().stream()
                .filter(option -> {
                    String label = normalizeIntent(option.label());
                    return !label.isBlank()
                            && (normalized.equals(label) || phraseMatches(normalized, label));
                })
                .findFirst()
                .orElse(null);
    }

    private List<Product> filterDecisionProducts(
            List<Product> source,
            DecisionCatalog catalog,
            String group,
            String useCase,
            String typeCategory,
            String brand,
            PriceIntent price,
            String size,
            String color,
            String lang
    ) {
        Set<String> groupSlugs = group == null
                ? Set.of() : catalog.groupSlugs().getOrDefault(group, Set.of());
        Set<String> typeSlugs = typeCategory == null
                ? Set.of() : catalog.descendantsBySlug().getOrDefault(typeCategory, Set.of(typeCategory));
        return source.stream()
                .filter(product -> group == null || productBelongsTo(product, groupSlugs))
                .filter(product -> typeCategory == null || productBelongsTo(product, typeSlugs))
                .filter(product -> brand == null || product.brand() != null
                        && brand.equalsIgnoreCase(product.brand().slug()))
                .filter(product -> useCase == null || matchesUseCase(product, group, useCase))
                .filter(product -> matchesSellingPrice(product, price))
                .filter(product -> matchesRequestedVariant(product, color, size, lang))
                .toList();
    }

    private static boolean productBelongsTo(Product product, Set<String> categorySlugs) {
        if (product == null || categorySlugs == null || categorySlugs.isEmpty()) return false;
        if (product.categories() != null && product.categories().stream()
                .filter(java.util.Objects::nonNull)
                .anyMatch(category -> category.slug() != null && categorySlugs.contains(category.slug()))) {
            return true;
        }
        return product.category() != null
                && product.category().slug() != null
                && categorySlugs.contains(product.category().slug());
    }

    private static String groupForCategory(String category, DecisionCatalog catalog) {
        if (category == null) return null;
        return DECISION_GROUPS.stream()
                .filter(group -> catalog.groupSlugs()
                        .getOrDefault(group.key(), Set.of()).contains(category))
                .map(DecisionGroup::key)
                .findFirst()
                .orElse(null);
    }

    private static boolean isSpecificTypeCategory(String category, String group) {
        if (category == null || group == null) return false;
        return DECISION_GROUPS.stream()
                .filter(candidate -> candidate.key().equals(group))
                .findFirst()
                .map(candidate -> !category.equals(candidate.genericRoot()))
                .orElse(false);
    }

    private static String genericRootForGroup(String group) {
        if (group == null) return null;
        return DECISION_GROUPS.stream()
                .filter(candidate -> candidate.key().equals(group))
                .map(DecisionGroup::genericRoot)
                .findFirst()
                .orElse(null);
    }

    private Optional<ToolOutcome> groupClarification(
            DecisionCatalog catalog,
            PriceIntent price,
            String brand,
            String size,
            String color,
            String lang,
            Set<String> asked,
            boolean personalSize
    ) {
        boolean english = "en".equals(lang);
        List<Product> base = filterDecisionProducts(
                catalog.products(), catalog, null, null, null,
                brand, price, size, color, lang);
        List<GroupCount> counts = DECISION_GROUPS.stream()
                .map(group -> new GroupCount(
                        group,
                        base.stream().filter(product -> productBelongsTo(
                                product, catalog.groupSlugs().getOrDefault(group.key(), Set.of())))
                                .count()))
                .filter(item -> item.count() > 0)
                .sorted(Comparator.comparingLong(GroupCount::count).reversed()
                        .thenComparing(item -> item.group().key()))
                .toList();
        if (counts.isEmpty()) return Optional.empty();

        List<PendingClarificationOption> options = new ArrayList<>();
        for (GroupCount item : counts) {
            options.add(new PendingClarificationOption(
                    "group-" + item.group().key(),
                    item.group().label(english),
                    "FILTER",
                    item.group().key(),
                    item.count()));
        }
        options.add(bypassOption(english));
        LinkedHashSet<String> nextAsked = new LinkedHashSet<>(asked);
        nextAsked.add("GROUP");
        PendingClarification pending = new PendingClarification(
                UUID.randomUUID(), "GROUP", options);
        ProductDecisionContext decision = new ProductDecisionContext(
                null, null, null, size, color, List.copyOf(nextAsked), pending);

        String joined = counts.stream()
                .map(item -> item.group().label(english) + ": " + item.count()
                        + (english ? " choices" : " lựa chọn"))
                .collect(java.util.stream.Collectors.joining("; "));
        String answer = english
                ? (price.hasBounds()
                        ? "Within the price range you gave me, BigBike currently has "
                        : "BigBike currently has ")
                        + joined + ". "
                        + (personalSize
                        ? "Each group uses a different body measurement for sizing. Which product group do you need a size for?"
                        : "Which product group do you need?")
                : (price.hasBounds()
                        ? "Trong tầm giá anh/chị đã nêu, BigBike hiện có "
                        : "BigBike hiện có ")
                        + joined + ". "
                        + (personalSize
                        ? "Mỗi nhóm dùng một số đo cơ thể khác nhau để chọn size. Anh/chị cần chọn size cho nhóm nào ạ?"
                        : "Anh/chị đang cần nhóm nào ạ?");
        return Optional.of(ToolOutcome.clarification(
                answer, List.of(), new SearchScope(null, brand, price.min(), price.max()), decision));
    }

    private ToolOutcome knownGroupClarification(
            String group,
            int activeCount,
            List<Product> sellable,
            SearchScope scope,
            ProductDecisionContext current,
            Set<String> asked,
            String criterion,
            String question,
            List<PendingClarificationOption> rawOptions,
            boolean english
    ) {
        List<PendingClarificationOption> options = withBypass(rawOptions, english);
        LinkedHashSet<String> nextAsked = new LinkedHashSet<>(asked);
        nextAsked.add(criterion);
        PendingClarification pending = new PendingClarification(
                UUID.randomUUID(), criterion, options);
        ProductDecisionContext next = new ProductDecisionContext(
                current.group(), current.useCase(), current.typeCategory(),
                current.size(), current.color(), List.copyOf(nextAsked), pending);
        List<ChatProductCardResponse> preview = representativeProducts(sellable).stream()
                .map(ChatToolService::toCard)
                .toList();
        String groupLabel = decisionGroupLabel(group, english);
        String answer = english
                ? "In " + groupLabel + ", the criteria known so far leave " + activeCount
                        + " current choices. I’m showing a few representative items that are in stock below; these are not the final results yet. "
                        + question
                : "Trong nhóm " + groupLabel + ", các tiêu chí đã biết còn " + activeCount
                        + " lựa chọn đang bán. Em gửi vài món còn hàng tiêu biểu bên dưới; đây chưa phải kết quả cuối. "
                        + question;
        return ToolOutcome.clarification(answer, preview, scope, next);
    }

    private ToolOutcome measurementClarification(
            String group,
            List<Product> sellable,
            SearchScope scope,
            ProductDecisionContext current,
            Set<String> asked,
            boolean english
    ) {
        LinkedHashSet<String> nextAsked = new LinkedHashSet<>(asked);
        nextAsked.add("MEASUREMENT");
        List<PendingClarificationOption> options = List.of(
                new PendingClarificationOption(
                        "measurement-help",
                        english ? "How to measure" : "Hướng dẫn cách đo",
                        "FILTER", "measurement-help", null),
                bypassOption(english));
        PendingClarification pending = new PendingClarification(
                UUID.randomUUID(), "MEASUREMENT", options);
        ProductDecisionContext next = new ProductDecisionContext(
                current.group(), current.useCase(), current.typeCategory(),
                current.size(), current.color(), List.copyOf(nextAsked), pending);
        String measurement = measurementForGroup(group, english);
        String answer = english
                ? "I should not guess a size from height or weight alone. What is your "
                        + measurement + " in centimetres? You can type the number, choose measurement help, or show the available sizes."
                : "Em không đoán size chỉ từ chiều cao hoặc cân nặng. " + measurement
                        + " của anh/chị là bao nhiêu cm ạ? Anh/chị có thể nhập số đo, xem hướng dẫn cách đo hoặc chọn xem các size đang có.";
        List<ChatProductCardResponse> preview = representativeProducts(sellable).stream()
                .map(ChatToolService::toCard)
                .toList();
        return ToolOutcome.clarification(answer, preview, scope, next);
    }

    private ToolOutcome finalDecisionOutcome(
            List<Product> sellable,
            SearchScope scope,
            ProductDecisionContext state,
            boolean english,
            boolean bypassed
    ) {
        List<ChatProductCardResponse> cards = sellable.stream()
                .limit(CLARIFICATION_STOP_THRESHOLD)
                .map(ChatToolService::toCard)
                .toList();
        String answer;
        if (cards.isEmpty()) {
            answer = english
                    ? "Your request is clear, but this scope has no choice in stock that I can safely recommend right now. I will not substitute an item that is out of stock."
                    : "Yêu cầu của anh/chị đã rõ, nhưng phạm vi này hiện chưa có lựa chọn còn hàng để em giới thiệu an toàn. Em không thay bằng món đã hết hàng.";
        } else if (bypassed) {
            answer = english
                    ? "As requested, I’ve stopped asking questions and am showing the matching choices that are in stock below."
                    : "Theo yêu cầu của anh/chị, em dừng hỏi và hiển thị ngay các lựa chọn còn hàng phù hợp bên dưới.";
        } else {
            answer = english
                    ? "I now have enough information and found " + cards.size()
                            + " matching choices that are in stock. I’m showing them below without asking another question."
                    : "Em đã đủ thông tin và lọc được " + cards.size()
                            + " lựa chọn còn hàng phù hợp. Em hiển thị ngay bên dưới và không hỏi thêm ạ.";
        }
        ProductDecisionContext decided = new ProductDecisionContext(
                state.group(), state.useCase(), state.typeCategory(), state.size(), state.color(),
                state.askedCriteria(), null);
        return ToolOutcome.decided(answer, cards, scope, decided);
    }

    private ToolOutcome delegatedDecisionOutcome(
            List<Product> sellable,
            SearchScope scope,
            ProductDecisionContext state,
            boolean english
    ) {
        if (sellable.isEmpty()) {
            return finalDecisionOutcome(sellable, scope, state, english, true);
        }
        DelegatedProduct choice = chooseDelegatedProduct(sellable);
        String name = plain(choice.product().name(), 160);
        String answer = switch (choice.basis()) {
            case "BEST_SELLER" -> english
                    ? "Verified completed orders show that " + name + " has sold the most in this in-stock scope, so I chose it. I’ll stop asking and show this single choice below."
                    : "Dữ liệu đơn đã hoàn tất cho thấy " + name + " bán nhiều nhất trong phạm vi còn hàng này, nên em chọn mẫu đó. Em dừng hỏi và chỉ hiển thị đúng lựa chọn này bên dưới.";
            case "FEATURED" -> english
                    ? "Data from completed orders in this scope is not meaningful enough to rank yet, so I chose " + name + " because BigBike currently marks it as featured and it is in stock. I’ll stop asking and show it below."
                    : "Dữ liệu đơn đã hoàn tất trong phạm vi này chưa đủ để xếp hạng có ý nghĩa, nên em chọn " + name + " vì BigBike đang đánh dấu nổi bật và món này còn hàng. Em dừng hỏi và hiển thị ngay bên dưới.";
            default -> english
                    ? "Data from completed orders in this scope is not meaningful enough to rank and no featured item is available, so I chose " + name + " as the item in stock closest to the middle price of this scope. I’ll stop asking and show it below."
                    : "Dữ liệu đơn đã hoàn tất trong phạm vi này chưa đủ để xếp hạng và không có món nổi bật còn hàng, nên em chọn " + name + " là món còn hàng có giá gần mức giữa của phạm vi. Em dừng hỏi và hiển thị ngay bên dưới.";
        };
        ProductDecisionContext decided = new ProductDecisionContext(
                state.group(), state.useCase(), state.typeCategory(), state.size(), state.color(),
                state.askedCriteria(), null);
        return ToolOutcome.decided(
                answer, List.of(toCard(choice.product())), scope, decided);
    }

    private static List<PendingClarificationOption> useCaseOptions(
            String group,
            List<Product> products,
            boolean english
    ) {
        List<UseCaseChoice> choices = USE_CASE_CHOICES.getOrDefault(group, List.of());
        if (choices.isEmpty() || products.isEmpty()) return List.of();
        return choices.stream()
                .map(choice -> new PendingClarificationOption(
                        "use-" + choice.key(),
                        choice.label(english),
                        "FILTER",
                        choice.key(),
                        products.stream().filter(product -> matchesUseCase(
                                product, group, choice.key())).count()))
                .filter(option -> option.count() != null
                        && option.count() > 0
                        && option.count() < products.size())
                .toList();
    }

    private static String matchUseCaseAnswer(String normalized, String group) {
        if (group == null || normalized == null || normalized.isBlank()) return null;
        return USE_CASE_CHOICES.getOrDefault(group, List.of()).stream()
                .filter(choice -> choice.customerAliases().stream()
                        .anyMatch(alias -> phraseMatches(normalized, alias)))
                .map(UseCaseChoice::key)
                .findFirst()
                .orElse(null);
    }

    private static boolean matchesUseCase(Product product, String group, String useCase) {
        if (product == null || group == null || useCase == null) return false;
        UseCaseChoice choice = USE_CASE_CHOICES.getOrDefault(group, List.of()).stream()
                .filter(candidate -> candidate.key().equals(useCase))
                .findFirst()
                .orElse(null);
        if (choice == null) return false;
        String categories = product.categories() == null ? "" : product.categories().stream()
                .filter(java.util.Objects::nonNull)
                .map(category -> nullToEmpty(category.name()) + " " + nullToEmpty(category.slug()))
                .collect(java.util.stream.Collectors.joining(" "));
        String text = normalizeIntent(
                nullToEmpty(product.name()) + " "
                        + plain(product.shortDescription(), 1_000) + " " + categories);
        return choice.productKeywords().stream().anyMatch(keyword -> phraseMatches(text, keyword));
    }

    static String useCaseQuestion(String group, boolean english) {
        return switch (group) {
            case "helmet" -> english
                    ? "Will you mainly use it for daily city riding, long tours, or paved roads and dirt routes?"
                    : "Anh/chị chủ yếu đi phố hằng ngày, đi tour đường dài hay chạy cả đường nhựa lẫn đường đất ạ?";
            case "apparel" -> english
                    ? "Do you need it for daily or hot weather riding, long tours with possible rain, or dirt riding?"
                    : "Anh/chị cần mặc hằng ngày hoặc trời nóng, đi tour dài có thể gặp mưa, hay chạy đường đất ạ?";
            case "gloves" -> english
                    ? "Are these for short hot weather city rides, long or rainy rides, or sport riding?"
                    : "Anh/chị cần đi phố quãng ngắn trời nóng, đi đường dài hoặc hay gặp mưa, hay chạy thiên về thể thao ạ?";
            case "boots" -> english
                    ? "Do you prioritize light and breathable daily wear, long or rainy tours, or higher cut protection?"
                    : "Anh/chị ưu tiên đi hằng ngày với giày nhẹ thoáng, đi tour dài có thể gặp mưa, hay cổ cao bảo vệ chắc chân ạ?";
            case "bags" -> english
                    ? "Would you like a backpack, a waist or thigh bag, or a bag mounted on the bike?"
                    : "Anh/chị muốn đeo lưng, đeo hông hoặc đùi, hay gắn túi lên xe ạ?";
            case "headset" -> english
                    ? "Will you ride solo, talk with one companion, communicate in a group of four or more, record video, or buy an accessory?"
                    : "Anh/chị dùng một mình, nói chuyện với một bạn đồng hành, đi nhóm từ bốn người, cần quay video, hay chỉ cần phụ kiện ạ?";
            case "armor" -> english
                    ? "Would you wear the armor outside your clothing or as an insert underneath?"
                    : "Anh/chị muốn mặc giáp ra ngoài áo hay dùng miếng lót bên trong ạ?";
            case "rain_base" -> english
                    ? "Do you need rainwear, an inner or head layer, or another small accessory?"
                    : "Anh/chị cần đồ đi mưa, lớp mặc trong hoặc trùm đầu, hay phụ kiện nhỏ khác ạ?";
            case "mount_camera" -> english
                    ? "Do you need to mount a phone for navigation, mount an action camera, or another bike accessory?"
                    : "Anh/chị cần gắn điện thoại để xem đường, gắn camera hành trình, hay phụ kiện khác trên xe ạ?";
            default -> english
                    ? "What will you mainly use this product for?"
                    : "Anh/chị chủ yếu dùng sản phẩm cho nhu cầu nào ạ?";
        };
    }

    static String useCaseQuestion(
            String group,
            List<PendingClarificationOption> options,
            boolean english
    ) {
        List<String> labels = options == null ? List.of() : options.stream()
                .filter(option -> option != null && "FILTER".equals(option.kind()))
                .map(PendingClarificationOption::label)
                .filter(label -> label != null && !label.isBlank())
                .toList();
        if (labels.size() < 2) return useCaseQuestion(group, english);
        String joined = joinCustomerChoices(labels, english);
        return english
                ? "Based on the current product information, which need best matches your use: "
                        + joined + "?"
                : "Theo thông tin sản phẩm đang có, nhu cầu nào sát với anh/chị nhất: "
                        + joined + " ạ?";
    }

    private static String joinCustomerChoices(List<String> labels, boolean english) {
        if (labels == null || labels.isEmpty()) return "";
        if (labels.size() == 1) return labels.get(0);
        String connector = english ? " or " : " hay ";
        if (labels.size() == 2) return labels.get(0) + connector + labels.get(1);
        return String.join(", ", labels.subList(0, labels.size() - 1))
                + connector + labels.get(labels.size() - 1);
    }

    private static List<PendingClarificationOption> typeOptions(
            String group,
            List<Product> products,
            DecisionCatalog catalog,
            boolean english
    ) {
        if (products.isEmpty()) return List.of();
        String genericRoot = genericRootForGroup(group);
        Set<String> allowed = catalog.groupSlugs().getOrDefault(group, Set.of());
        LinkedHashMap<String, Long> counts = new LinkedHashMap<>();
        for (String slug : allowed) {
            if (slug.equals(genericRoot)
                    || "uncategorized".equals(slug)
                    || "khuyen-mai-do-bao-ho-moto".equals(slug)) {
                continue;
            }
            long count = products.stream().filter(product -> productBelongsTo(
                    product, catalog.descendantsBySlug().getOrDefault(slug, Set.of(slug)))).count();
            if (count > 0 && count < products.size()) counts.put(slug, count);
        }
        return counts.entrySet().stream()
                // Prefer the broadest useful public type before a nested duplicate.
                .sorted(Comparator.<Map.Entry<String, Long>>comparingLong(Map.Entry::getValue)
                        .reversed().thenComparing(Map.Entry::getKey))
                .filter(entry -> counts.entrySet().stream().noneMatch(other ->
                        !other.getKey().equals(entry.getKey())
                                && other.getValue().equals(entry.getValue())
                                && catalog.descendantsBySlug()
                                .getOrDefault(other.getKey(), Set.of())
                                .contains(entry.getKey())
                                && other.getKey().compareTo(entry.getKey()) < 0))
                .limit(6)
                .map(entry -> new PendingClarificationOption(
                        "type-" + safeOptionId(entry.getKey()),
                        catalog.categoryNames().getOrDefault(entry.getKey(), entry.getKey()),
                        "FILTER", entry.getKey(), entry.getValue()))
                .toList();
    }

    private static List<PendingClarificationOption> priceOptions(
            List<Product> products,
            boolean english
    ) {
        if (products.isEmpty()) return List.of();
        List<DecisionPriceBand> bands = List.of(
                new DecisionPriceBand(
                        "under-2m", english ? "Under 2 million" : "Dưới 2 triệu",
                        null, 2_000_000L, PriceKind.MAX),
                new DecisionPriceBand(
                        "2m-5m", english ? "2–5 million" : "Từ 2 đến 5 triệu",
                        2_000_000L, 5_000_000L, PriceKind.RANGE),
                new DecisionPriceBand(
                        "over-5m", english ? "Over 5 million" : "Trên 5 triệu",
                        5_000_001L, null, PriceKind.MIN));
        return bands.stream()
                .map(band -> new PendingClarificationOption(
                        "price-" + band.id(), band.label(), "FILTER", band.encoded(),
                        products.stream().filter(product -> matchesSellingPrice(
                                product, band.intent())).count()))
                .filter(option -> option.count() != null
                        && option.count() > 0
                        && option.count() < products.size())
                .toList();
    }

    private static PriceIntent priceFromDecisionValue(String value) {
        if (value == null || value.isBlank()) return PriceIntent.none();
        String[] parts = value.split(":", -1);
        if (parts.length != 3) return PriceIntent.none();
        try {
            Long min = parts[0].isBlank() ? null : Long.valueOf(parts[0]);
            Long max = parts[1].isBlank() ? null : Long.valueOf(parts[1]);
            PriceKind kind = PriceKind.valueOf(parts[2]);
            return new PriceIntent(min, max, kind);
        } catch (IllegalArgumentException ignored) {
            return PriceIntent.none();
        }
    }

    private static List<PendingClarificationOption> variantOptions(
            List<Product> products,
            String attribute,
            boolean english
    ) {
        LinkedHashMap<String, VariantChoiceCount> counts = new LinkedHashMap<>();
        for (Product product : products) {
            Set<String> seen = new LinkedHashSet<>();
            for (Map<String, String> combination : normalizedAvailableVariants(product.variants())) {
                String label = combination.get(attribute);
                String value = label == null ? null : normalize(label);
                if (value == null || value.isBlank() || !seen.add(value)) continue;
                VariantChoiceCount current = counts.get(value);
                counts.put(value, new VariantChoiceCount(
                        label, current == null ? 1 : current.count() + 1));
            }
        }
        return counts.entrySet().stream()
                .filter(entry -> entry.getValue().count() > 0
                        && entry.getValue().count() < products.size())
                .sorted(Comparator.<Map.Entry<String, VariantChoiceCount>>comparingLong(
                                entry -> entry.getValue().count()).reversed()
                        .thenComparing(Map.Entry::getKey))
                .limit(6)
                .map(entry -> new PendingClarificationOption(
                        attribute + "-" + safeOptionId(entry.getKey()),
                        entry.getValue().label(), "FILTER", entry.getKey(),
                        entry.getValue().count()))
                .toList();
    }

    private static int filterOptionCount(List<PendingClarificationOption> options) {
        return (int) options.stream().filter(option -> "FILTER".equals(option.kind())).count();
    }

    private static List<PendingClarificationOption> withBypass(
            List<PendingClarificationOption> options,
            boolean english
    ) {
        ArrayList<PendingClarificationOption> result = new ArrayList<>(options);
        if (result.stream().noneMatch(option -> "BYPASS".equals(option.kind()))) {
            result.add(bypassOption(english));
        }
        return result.stream().limit(12).toList();
    }

    private static PendingClarificationOption bypassOption(boolean english) {
        return new PendingClarificationOption(
                "show-all",
                english ? "Show all matching items" : "Cứ cho em xem tất cả",
                "BYPASS", "show-all", null);
    }

    private static String safeOptionId(String value) {
        String result = normalize(value == null ? "" : value)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return result.isBlank() ? "choice" : result.substring(0, Math.min(result.length(), 60));
    }

    private static boolean isDecisionCardEligible(Product product) {
        return product != null
                && isCurrentlySellable(product)
                && hasSellableCurrency(product)
                && effectiveSellingPrice(product) != null
                && effectiveSellingPrice(product).signum() > 0;
    }

    private static Comparator<Product> decisionProductComparator() {
        return Comparator
                .comparing((Product product) -> effectiveSellingPrice(product),
                        Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(product -> normalize(nullToEmpty(product.name())))
                .thenComparing(product -> nullToEmpty(product.id()));
    }

    private static List<Product> representativeProducts(List<Product> products) {
        if (products == null || products.isEmpty()) return List.of();
        BigDecimal median = medianPrice(products);
        return products.stream()
                .sorted(Comparator
                        .comparing((Product product) -> product.homepageBlock()
                                == HomepageBlock.FEATURED_GRID ? 0 : 1)
                        .thenComparing(product -> product.homepageOrder() == null
                                ? Integer.MAX_VALUE : product.homepageOrder())
                        .thenComparing(product -> priceDistance(product, median))
                        .thenComparing(product -> nullToEmpty(product.id())))
                .limit(CLARIFICATION_PREVIEW_LIMIT)
                .toList();
    }

    private DelegatedProduct chooseDelegatedProduct(List<Product> products) {
        try {
            CatalogReadService.AssistantSalesSnapshot sales = catalogReadService
                    .assistantCompletedSales(products.stream().map(Product::id).toList());
            Map<String, CatalogReadService.AssistantProductSale> byKey = sales.products().stream()
                    .collect(java.util.stream.Collectors.toMap(
                            CatalogReadService.AssistantProductSale::productKey,
                            value -> value,
                            (left, right) -> left,
                            LinkedHashMap::new));
            long productsWithSales = products.stream()
                    .filter(product -> byKey.containsKey(product.id()))
                    .filter(product -> byKey.get(product.id()).unitsSold() > 0)
                    .count();
            if (sales.distinctCompletedOrders() >= BESTSELLER_MIN_COMPLETED_ORDERS
                    && productsWithSales >= BESTSELLER_MIN_PRODUCTS) {
                Product best = products.stream()
                        .filter(product -> byKey.containsKey(product.id()))
                        .filter(product -> byKey.get(product.id()).unitsSold() > 0)
                        .sorted(Comparator
                                .comparingLong((Product product) -> byKey.get(product.id()).unitsSold())
                                .reversed()
                                .thenComparing(Comparator.comparingLong(
                                        (Product product) -> byKey.get(product.id()).completedOrderCount())
                                        .reversed())
                                .thenComparing(product -> nullToEmpty(product.id())))
                        .findFirst()
                        .orElse(null);
                if (best != null) return new DelegatedProduct(best, "BEST_SELLER");
            }
        } catch (RuntimeException ignored) {
            // Ranking evidence is optional; the deterministic catalog fallback below remains safe.
        }

        Product featured = products.stream()
                .filter(product -> product.homepageBlock() == HomepageBlock.FEATURED_GRID)
                .sorted(Comparator
                        .comparing((Product product) -> product.homepageOrder() == null
                                ? Integer.MAX_VALUE : product.homepageOrder())
                        .thenComparing(product -> nullToEmpty(product.id())))
                .findFirst()
                .orElse(null);
        if (featured != null) return new DelegatedProduct(featured, "FEATURED");

        BigDecimal median = medianPrice(products);
        Product middle = products.stream()
                .min(Comparator.comparing((Product product) -> priceDistance(product, median))
                        .thenComparing(product -> nullToEmpty(product.id())))
                .orElse(products.get(0));
        return new DelegatedProduct(middle, "MID_PRICE");
    }

    private static BigDecimal medianPrice(List<Product> products) {
        List<BigDecimal> prices = products.stream()
                .map(ChatToolService::effectiveSellingPrice)
                .filter(java.util.Objects::nonNull)
                .sorted()
                .toList();
        if (prices.isEmpty()) return BigDecimal.ZERO;
        int middle = prices.size() / 2;
        if (prices.size() % 2 == 1) return prices.get(middle);
        return prices.get(middle - 1).add(prices.get(middle))
                .divide(BigDecimal.valueOf(2));
    }

    private static BigDecimal priceDistance(Product product, BigDecimal target) {
        BigDecimal price = effectiveSellingPrice(product);
        return price == null ? new BigDecimal("999999999999999999") : price.subtract(target).abs();
    }

    private static String decisionGroupLabel(String group, boolean english) {
        return DECISION_GROUPS.stream()
                .filter(candidate -> candidate.key().equals(group))
                .map(candidate -> candidate.label(english))
                .findFirst()
                .orElse(english ? "this group" : "nhóm này");
    }

    static String measurementForGroup(String group, boolean english) {
        return switch (group) {
            case "helmet" -> english ? "head circumference" : "Số đo vòng đầu";
            case "apparel", "armor", "rain_base" -> english
                    ? "chest circumference" : "Số đo vòng ngực";
            case "gloves" -> english ? "palm circumference" : "Số đo vòng lòng bàn tay";
            case "boots" -> english ? "foot length" : "Chiều dài bàn chân";
            default -> english ? "relevant body measurement" : "Số đo cơ thể phù hợp";
        };
    }

    private static boolean isPersonalSizeQuestion(String normalized) {
        return hasWord(normalized,
                "size nao vua", "size gi vua", "size nao hop", "chon size cho toi",
                "kich co nao vua", "what size fits", "which size fits", "my size");
    }

    private static boolean isShowAllRequest(String normalized) {
        return hasWord(normalized,
                "cu cho xem", "cho xem het", "xem het di", "xem tat ca", "hien het",
                "show all", "show everything", "just show", "let me see them all");
    }

    private static boolean isImpatientShowRequest(String normalized) {
        return hasWord(normalized,
                "hoi nhieu qua", "dung hoi nua", "nhanh len", "xem luon di",
                "too many questions", "stop asking", "show me now", "hurry up");
    }

    private static boolean isDelegatedChoice(String normalized) {
        return hasWord(normalized,
                "tuy em", "gi cung duoc", "em chon di", "em chon giup",
                "you choose", "anything is fine", "anything works", "pick for me");
    }

    private static boolean isGeneralProductAdviceRequest(String normalized) {
        if (normalized == null || normalized.isBlank()) return false;
        String compact = normalized.replaceAll("[^\\p{Alnum}]+", " ").trim();
        return Set.of(
                "tu van giup toi", "tu van giup toi voi", "tu van giup minh",
                "tu van giup minh voi", "tu van giup em", "tu van cho toi",
                "toi muon duoc tu van", "tro giup", "tro giup toi", "goi y giup",
                "goi y giup toi", "recommend", "recommend something", "help me choose",
                "i need advice", "general advice")
                .contains(compact);
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
                    ? comparisonProductOutcome(matches, english, normalized)
                    : ambiguousProductOutcome(matches, english, normalized, context));
        }
        Product product = matches.get(0);

        DeterministicAnswer detail = productDetailAnswer(question, normalized, english, product);
        String answer = detail == null
                ? referencedAvailabilityAnswer(product, english)
                : detail.answer();
        ProductDecisionContext cleared = clearPendingDecision(context.productDecision());
        return Optional.of(ToolOutcome.decided(
                answer,
                List.of(toCard(product)),
                new SearchScope(
                        context.category(), context.brand(), context.minPrice(), context.maxPrice()),
                cleared));
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

    private static ToolOutcome ambiguousProductOutcome(
            List<Product> products,
            boolean english,
            String normalizedQuestion,
            ConversationContext context
    ) {
        List<ChatProductCardResponse> cards = products.stream()
                .limit(8)
                .map(ChatToolService::toCard)
                .toList();
        ProductDetailIntent intent = productDetailIntent(normalizedQuestion);
        List<PendingClarificationOption> options = new ArrayList<>();
        for (int index = 0; index < products.size() && index < 8; index++) {
            Product product = products.get(index);
            options.add(new PendingClarificationOption(
                    "reference-" + (index + 1) + "-" + safeOptionId(product.slug()),
                    referenceOptionLabel(product, intent, english),
                    "FILTER",
                    product.slug(),
                    null));
        }
        options.add(new PendingClarificationOption(
                "reference-all",
                english ? "Show all recent choices" : "Xem tất cả lựa chọn vừa nêu",
                "BYPASS", "show-all", null));
        ProductDecisionContext current = context.productDecision() == null
                ? ProductDecisionContext.empty() : context.productDecision();
        LinkedHashSet<String> asked = new LinkedHashSet<>(current.askedCriteria());
        asked.add("REFERENCE");
        PendingClarification pending = new PendingClarification(
                UUID.randomUUID(), "REFERENCE", options);
        ProductDecisionContext next = new ProductDecisionContext(
                current.group(), current.useCase(), current.typeCategory(),
                current.size(), current.color(), List.copyOf(asked), pending);
        String answer = english
                ? "Your reference could point to more than one recently shown model. Which exact model would you like me to check? Choose one below, or show all recent choices."
                : "Cách gọi của anh/chị có thể trỏ tới nhiều mẫu vừa xem. Anh/chị chọn đúng tên mẫu bên dưới để em kiểm tra, hoặc chọn giữ nguyên danh sách vừa nêu nhé.";
        // The choices are already visible from the preceding turn; do not render duplicates.
        return ToolOutcome.clarification(
                answer,
                List.of(),
                new SearchScope(
                        context.category(), context.brand(), context.minPrice(), context.maxPrice()),
                next);
    }

    private ToolOutcome referenceSelectionOutcome(
            String question,
            String normalized,
            String lang,
            ConversationContext context,
            ProductDecisionContext prior,
            PendingClarificationOption selected
    ) {
        boolean english = "en".equals(lang);
        ProductDecisionContext cleared = clearPendingDecision(prior);
        SearchScope scope = new SearchScope(
                context.category(), context.brand(), context.minPrice(), context.maxPrice());
        if ("BYPASS".equals(selected.kind())) {
            Set<String> recentSlugs = prior.pending().options().stream()
                    .filter(option -> "FILTER".equals(option.kind()))
                    .map(PendingClarificationOption::value)
                    .filter(value -> value != null && !value.isBlank())
                    .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
            List<ChatProductCardResponse> cards = recentSlugs.stream()
                    .map(slug -> loadReferenceProduct(slug, lang))
                    .filter(java.util.Objects::nonNull)
                    .limit(CLARIFICATION_STOP_THRESHOLD)
                    .map(ChatToolService::toCard)
                    .toList();
            String answer = english
                    ? "As requested, I have stopped asking which single model you meant and am showing the recent choices that are in stock below."
                    : "Theo yêu cầu của anh/chị, em dừng hỏi chọn một mẫu và hiển thị các lựa chọn gần đây còn hàng bên dưới.";
            return ToolOutcome.decided(answer, cards, scope, cleared);
        }

        Product product = loadReferenceProduct(selected.value(), lang);
        if (product == null) {
            String answer = english
                    ? "The model you selected is no longer a choice in stock that I can safely show. I will not substitute another model without asking."
                    : "Mẫu anh/chị vừa chọn không còn là lựa chọn còn hàng để em hiển thị an toàn. Em không tự thay bằng mẫu khác khi chưa hỏi anh/chị.";
            return ToolOutcome.decided(answer, List.of(), scope, cleared);
        }
        DeterministicAnswer detail = productDetailAnswer(
                question, normalized, english, product);
        String answer = detail == null
                ? referencedAvailabilityAnswer(product, english)
                : detail.answer();
        return ToolOutcome.decided(answer, List.of(toCard(product)), scope, cleared);
    }

    private Product loadReferenceProduct(String slug, String lang) {
        if (slug == null || slug.isBlank()) return null;
        try {
            Product product = catalogReadService.getProductBySlug(slug, lang);
            return isDecisionCardEligible(product) ? product : null;
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static ProductDecisionContext clearPendingDecision(ProductDecisionContext current) {
        ProductDecisionContext state = current == null
                ? ProductDecisionContext.empty() : current;
        return new ProductDecisionContext(
                state.group(), state.useCase(), state.typeCategory(), state.size(), state.color(),
                state.askedCriteria(), null);
    }

    private static String referenceOptionLabel(
            Product product,
            ProductDetailIntent intent,
            boolean english
    ) {
        String name = plain(product == null ? "" : product.name(), 160);
        if (intent == null) return name;
        if (intent.technical()) return (english ? "Specifications: " : "Thông số: ") + name;
        if (intent.size()) return "Size: " + name;
        if (intent.color()) return (english ? "Colours: " : "Màu: ") + name;
        if (intent.price()) return (english ? "Price: " : "Giá: ") + name;
        if (intent.suitability()) return (english ? "Suitability: " : "Phù hợp: ") + name;
        if (intent.warranty()) return (english ? "Warranty: " : "Bảo hành: ") + name;
        return name;
    }

    private static ToolOutcome comparisonProductOutcome(
            List<Product> products,
            boolean english,
            String normalizedQuestion
    ) {
        int requestedCount = hasWord(normalizedQuestion,
                "2", "hai mau", "hai san pham", "two models", "two products") ? 2 : 3;
        List<Product> candidates = products.stream().filter(java.util.Objects::nonNull).toList();
        String type = candidates.isEmpty() ? "" : comparisonType(candidates.get(0));
        List<Product> selected = candidates.stream()
                .filter(product -> type.equals(comparisonType(product)))
                .limit(requestedCount)
                .toList();
        List<ChatProductCardResponse> cards = selected.stream()
                .map(ChatToolService::toCard)
                .toList();
        return ToolOutcome.local(
                comparisonAnswer(selected, english), "TOOL", false, false, List.of(), cards);
    }

    /**
     * Comparison follows the immediately preceding verified product cards. Every displayed
     * value is read from the selected product records; a missing value stays explicitly missing.
     */
    private static String comparisonType(Product product) {
        String name = normalize(product.name());
        if (hasWord(name, "bo phu kien", "accessory kit")) return "accessory";
        String category = product.category() == null ? "" : product.category().slug();
        return categoryProductFamily(category == null ? "" : category);
    }

    private static String comparisonAnswer(List<Product> products, boolean english) {
        List<ComparisonView> views = products.stream().map(product -> comparisonView(product, english)).toList();
        boolean showPrices = views.stream().anyMatch(view -> !view.prices().isEmpty());
        boolean showSizes = views.stream().anyMatch(view -> !view.sizes().isEmpty());
        boolean showColors = views.stream().anyMatch(view -> !view.colors().isEmpty());
        boolean showFacts = views.stream().anyMatch(view -> !view.facts().isEmpty());
        boolean showWarnings = views.stream().anyMatch(view -> !view.warnings().isEmpty());
        List<String> blocks = new ArrayList<>();
        for (ComparisonView view : views) {
            List<String> lines = new ArrayList<>();
            lines.add("**" + view.name() + "**");
            if (showPrices && !view.prices().isEmpty()) {
                lines.add((english ? "- Price: " : "- Giá: ") + String.join("; ", view.prices()));
            }
            if (showSizes && !view.sizes().isEmpty()) {
                lines.add((english ? "- Sizes: " : "- Size: ") + String.join(", ", view.sizes()));
            }
            if (showColors && !view.colors().isEmpty()) {
                lines.add((english ? "- Colours: " : "- Màu: ") + String.join(", ", view.colors()));
            }
            if (showFacts && !view.facts().isEmpty()) {
                lines.add((english ? "- Key details: " : "- Điểm chính: ")
                        + String.join("; ", view.facts()));
            }
            if (showWarnings && !view.warnings().isEmpty()) {
                lines.add((english ? "- Safety note: " : "- Lưu ý an toàn: ")
                        + view.warnings().get(0));
            }
            blocks.add(String.join("\n", lines));
        }
        String recommendation = english
                ? "Which matters most for this purchase: budget, available size/colour choices, or the saved specifications? I will then choose one of these models for you."
                : "Với lần mua này, anh/chị ưu tiên nhất ngân sách, lựa chọn size/màu đang có hay thông số đã lưu? Em sẽ chốt giúp mẫu phù hợp nhất trong các mẫu vừa so sánh.";
        String intro = english
                ? "Here is a direct comparison of the requested verified models:"
                : "Em so sánh trực tiếp các mẫu anh/chị yêu cầu như sau:";
        return truncateCustomerAnswer(intro + "\n\n" + String.join("\n\n", blocks)
                + "\n\n" + recommendation, 1_950);
    }

    private static ComparisonView comparisonView(Product product, boolean english) {
        String name = plain(product.name(), 160);
        Map<String, List<String>> options = normalizedAvailableOptions(product.variants());
        List<String> sizes = sortSizes(options.getOrDefault("size", List.of())).stream()
                .limit(8).toList();
        List<String> colors = options.getOrDefault("color", List.of()).stream()
                .limit(8).toList();
        List<String> prices = availableVariantPriceLabels(product, english).stream()
                .limit(4).toList();
        List<String> facts = technicalFacts(product).stream().limit(2).toList();
        List<String> warnings = safetyWarnings(product).stream().limit(1).toList();
        return new ComparisonView(name, prices, sizes, colors, facts, warnings);
    }

    private static String comparisonRecommendation(List<Product> products, boolean english) {
        if (products.isEmpty()) return english
                ? "Tell me your priority and I will narrow the choice."
                : "Anh/chị cho em ưu tiên chính để em thu hẹp lựa chọn nhé.";
        Product budget = products.stream()
                .filter(product -> minimumEffectivePrice(product) != null)
                .min(Comparator.comparing(ChatToolService::minimumEffectivePrice))
                .orElse(products.get(0));
        Product flexible = products.stream()
                .max(Comparator.comparingInt(product -> normalizedAvailableOptions(product.variants())
                        .values().stream().mapToInt(List::size).sum()))
                .orElse(products.get(0));
        if (budget == flexible) {
            return english
                    ? "Choose " + plain(budget.name(), 160)
                            + " if its available size and colour suit you; it is the clearest value choice in this comparison."
                    : "Nên chọn " + plain(budget.name(), 160)
                            + " nếu size và màu hiện có phù hợp; đây là lựa chọn dễ cân đối chi phí nhất trong nhóm so sánh.";
        }
        return english
                ? "Choose " + plain(budget.name(), 160) + " to prioritise budget; choose "
                        + plain(flexible.name(), 160) + " to prioritise more current size/colour choices."
                : "Nên chọn " + plain(budget.name(), 160) + " nếu ưu tiên ngân sách; chọn "
                        + plain(flexible.name(), 160) + " nếu ưu tiên nhiều lựa chọn size/màu hiện có hơn.";
    }

    private static BigDecimal minimumEffectivePrice(Product product) {
        List<BigDecimal> prices = new ArrayList<>();
        BigDecimal main = effectivePrice(product.price());
        if (main != null) prices.add(main);
        if (product.variants() != null) product.variants().stream()
                .filter(variant -> variant != null && variant.isAvailable())
                .map(variant -> effectivePrice(variant.price()))
                .filter(java.util.Objects::nonNull)
                .forEach(prices::add);
        return prices.stream().min(BigDecimal::compareTo).orElse(null);
    }

    private record ComparisonView(
            String name,
            List<String> prices,
            List<String> sizes,
            List<String> colors,
            List<String> facts,
            List<String> warnings
    ) {}

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
                : "Em đã tìm thấy " + name + " và mẫu này hiện còn hàng tại BigBike. "
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
                    .filter(product -> matchesBudgetedProductType(product, category, requested))
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
                        .filter(product -> matchesBudgetedProductType(product, category, requested))
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
                        .filter(product -> matchesBudgetedProductType(product, category, requested))
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
                            : "Shop hiện chưa có đúng mẫu anh/chị vừa hỏi. Em không đổi sang sản phẩm khác hoặc đưa lựa chọn ngẫu nhiên; anh/chị cho em loại hàng và tầm giá mong muốn để em tra mẫu tương đương đang bán nhé.")
                            : (english
                            ? "I could not find a currently sold BigBike product matching that request. Tell me the product type or budget you prefer so I can search again without guessing."
                            : "Em chưa tìm thấy sản phẩm đang bán phù hợp với yêu cầu này. Anh/chị cho em loại hàng hoặc tầm giá mong muốn để em tra lại, em sẽ không đoán sản phẩm nhé."),
                    "TOOL", false, false);
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
                searchIntent, query, used, usedSearch, color, lang, matchingProducts.size());
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
                        "TOOL", false, true);
            }
            if (detail == null) {
                return ToolOutcome.local(
                        english
                                ? "I found a matching product, but its detailed information is not available right now. I won’t guess the size, specifications or stock options. Please open the product page later or choose Talk to staff."
                                : "Em đã tìm thấy sản phẩm phù hợp nhưng thông tin chi tiết hiện chưa sẵn sàng. Em không đoán size, thông số hoặc lựa chọn tồn kho. Anh/chị thử mở trang sản phẩm sau hoặc bấm Gặp nhân viên giúp em nhé.",
                        "TOOL", false, true);
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
                    "TOOL", false, false, List.of(), cards));
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
                "TOOL", false, false, List.of(), cards));
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
            case ChatToolRegistry.SEARCH_ARTICLES -> executeArticleSearch(call, context);
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
                : "Anh/chị cho em biết loại hàng, thương hiệu, mẫu, màu, size hoặc tầm giá trước khi tìm nhé. Em sẽ chỉ kiểm tra các sản phẩm BigBike đang bán, không đoán thay mình.";
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
                new DeterministicAnswer(answer, false, false),
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
                ? comparisonProductOutcome(selection.get(), english, normalized)
                : ambiguousProductOutcome(
                        selection.get(), english, normalized, context.conversationContext());
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
                new DeterministicAnswer(answer, false, false),
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
                : "Bộ lọc đã nêu ở lượt trước không có kết quả phù hợp nên em đã bỏ riêng bộ lọc cũ và tìm lại yêu cầu này."
                + retainedPriceScope + " Các sản phẩm bên dưới là kết quả đang bán sau lần tìm lại. "
                + "Anh/chị có thể gửi tầm giá mới để em lọc hẹp lại nhé.";
        return new DeterministicAnswer(answer, false, false);
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
                ? "Trong tầm giá anh/chị hỏi, shop có " + total + " mẫu " + group + "."
                : "Shop hiện có " + total + " mẫu " + group + " phù hợp.");

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
        return new DeterministicAnswer(String.join(" ", sentences), false, false);
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
                : "Em đã tìm thấy " + name + " và mẫu này hiện còn hàng tại BigBike. "
                        + "Anh/chị mở sản phẩm bên dưới để xem lựa chọn và thông tin hiện có nhé.";
        return new DeterministicAnswer(answer, false, false);
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
            String boundaryDisclosure = priceAlternativeBoundaryDisclosure(
                    price, outcome.products(), english);
            return new DeterministicAnswer(
                    english
                            ? (inheritedScope == null
                            ? "I could not find a currently sold product in the price range you requested. "
                            : inheritedScope + " but I could not find a currently sold product in that range. ")
                                    + boundaryDisclosure
                                    + " Please tell me if you want a different range."
                                    + (broadened
                                    ? " This list is broader than your original wording; share a more specific name or category if you want to narrow it."
                                    : "")
                            : (inheritedScope == null
                            ? "Em chưa tìm thấy sản phẩm đang bán trong tầm giá anh/chị hỏi. "
                            : inheritedScope + " nhưng chưa tìm thấy sản phẩm đang bán phù hợp. ")
                                    + boundaryDisclosure
                                    + " Anh/chị cho em biết tầm giá khác nếu muốn em lọc tiếp nhé."
                                    + (broadened
                                    ? " Danh sách này cũng rộng hơn cách hỏi ban đầu; anh/chị cho em tên hoặc loại hàng cụ thể hơn để em thu hẹp lại nhé."
                                    : ""),
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
                                    ? "Các sản phẩm bên dưới đang rộng hơn yêu cầu ban đầu của anh/chị. "
                                    : inheritedScope + ". Các sản phẩm bên dưới đang rộng hơn yêu cầu ban đầu của anh/chị. ")
                                    + "Anh/chị cho em tên mẫu, loại hàng hoặc tầm giá cụ thể hơn để em lọc lại nhé.",
                    false,
                    false);
        }
        return null;
    }

    private static String priceAlternativeBoundaryDisclosure(
            PriceIntent price,
            List<ChatProductCardResponse> products,
            boolean english
    ) {
        if (price == null || products == null || products.isEmpty()) {
            return english
                    ? "The products below are the closest available options."
                    : "Các sản phẩm bên dưới là phương án gần nhất đang có.";
        }
        List<BigDecimal> prices = products.stream()
                .map(product -> product.salePrice() != null
                        ? product.salePrice() : product.retailPrice())
                .filter(value -> value != null && value.signum() > 0)
                .toList();
        boolean below = price.min() != null && prices.stream()
                .anyMatch(value -> value.compareTo(BigDecimal.valueOf(price.min())) < 0);
        boolean above = price.max() != null && prices.stream()
                .anyMatch(value -> value.compareTo(BigDecimal.valueOf(price.max())) > 0);
        if (below && above) {
            return english
                    ? "The products below are the closest verified options on each side of that range."
                    : "Các sản phẩm bên dưới là phương án đã xác minh sát mép dưới và mép trên của tầm giá đó.";
        }
        if (above) {
            return english
                    ? "The products below are the closest verified options above your price range."
                    : "Các sản phẩm bên dưới là phương án đã xác minh gần nhất nhưng cao hơn tầm giá anh/chị hỏi.";
        }
        if (below) {
            return english
                    ? "The products below are the closest verified options below your price range."
                    : "Các sản phẩm bên dưới là phương án đã xác minh gần nhất nhưng thấp hơn tầm giá anh/chị hỏi.";
        }
        return english
                ? "The products below are the closest available options."
                : "Các sản phẩm bên dưới là phương án gần nhất đang có.";
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
        return new DeterministicAnswer(answer, false, false);
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
                    : "Em chưa tìm thấy sản phẩm đang bán phù hợp với yêu cầu này. Anh/chị thử đổi tầm giá hoặc bấm Gặp nhân viên để BigBike kiểm tra thêm nhé.";
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
                : "Em đang lọc theo " + scope + " mà anh/chị đã nêu trước đó";
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
                    ? "Shop chưa cập nhật thông số kỹ thuật cho " + name + "."
                    : "Thông số kỹ thuật của " + name + ": "
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
            String requestedSize = extractRequestedOption(normalized, SIZE_REQUEST);
            String sellableSizes = sizes.isEmpty()
                    ? (english ? "no currently available size is listed" : "chưa có size đang bán được ghi nhận")
                    : String.join(", ", sizes);
            if (requestedSize != null) {
                String requested = requestedSize.toUpperCase(Locale.ROOT);
                boolean available = sizes.stream().anyMatch(size -> size.equalsIgnoreCase(requested));
                BigDecimal sizePrice = availableVariantPrice(product, "size", requested);
                sentences.add(english
                        ? name + " size " + requested + (available
                        ? " is currently available" + (sizePrice == null ? "" : " at " + money(sizePrice, true)) + "."
                        : " is not currently available.")
                        : name + " size " + requested + (available
                        ? " hiện còn hàng" + (sizePrice == null ? "" : ", giá " + money(sizePrice, false)) + "."
                        : " hiện không còn hàng."));
                if (!available && !sizes.isEmpty()) {
                    sentences.add(english
                            ? "The available sizes are " + sellableSizes + "."
                            : "Các size hiện còn là " + sellableSizes + ".");
                }
            } else if (isDetailConfirmation(normalized)) {
                sentences.add(english
                        ? "Yes, " + name + " currently has these sellable sizes: " + sellableSizes + "."
                        : "Dạ, đúng rồi: " + name + " hiện có các size đang bán là " + sellableSizes + ".");
                sentences.add(english
                        ? (guideRows.isEmpty()
                        ? "BigBike does not have a saved measurement size chart for this model."
                        : "The saved size guide is " + String.join("; ", guideRows) + ".")
                        : (guideRows.isEmpty()
                        ? "Shop chưa cập nhật bảng size theo số đo cho mẫu này."
                        : "Bảng size của mẫu này: " + String.join("; ", guideRows) + "."));
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
                        : " Bảng size của mẫu này: " + String.join("; ", guideRows) + "."));
                if (guideRows.isEmpty()) {
                    sentences.add("Shop chưa cập nhật bảng size theo số đo cho mẫu này.");
                }
            }
        }
        if (detailIntent.color()) {
            sentences.add(english
                    ? (colors.isEmpty()
                    ? "BigBike has not updated the current colour names for this model yet."
                    : "The currently sellable colours are " + String.join(", ", colors) + ".")
                    : (colors.isEmpty()
                    ? "Shop chưa cập nhật tên màu hiện có của mẫu này."
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
                    : "Giá hiện tại của " + name + " theo từng lựa chọn: "
                            + String.join("; ", prices) + "."));
        }
        if (detailIntent.suitability()) {
            List<String> advice = suitabilityFacts(product);
            sentences.add(english
                    ? (advice.isEmpty()
                    ? "The product page does not currently contain enough saved suitability guidance for this model."
                    : "The saved product guidance says: " + String.join("; ", advice) + ".")
                    : (advice.isEmpty()
                    ? "Trang sản phẩm hiện chưa có đủ thông tin để kết luận mẫu này phù hợp với ai."
                    : "Theo hướng dẫn trên trang sản phẩm: " + String.join("; ", advice) + "."));
        }
        if (detailIntent.warranty()) {
            List<String> warranty = warrantyFacts(product);
            sentences.add(english
                    ? (warranty.isEmpty()
                    ? "This product page does not currently state an exact saved warranty period, so I will not infer one."
                    : "The saved warranty information is: " + String.join("; ", warranty) + ".")
                    : (warranty.isEmpty()
                    ? "Trang sản phẩm hiện chưa ghi thời hạn bảo hành cụ thể, nên em không tự suy đoán."
                    : "Thông tin bảo hành của mẫu này: " + String.join("; ", warranty) + "."));
        }
        if (detailIntent.comparison()) {
            sentences.add(english
                    ? "I have identified " + name
                            + "; please name the other model so I can compare only verified product data."
                    : "Em đã xác định mẫu " + name
                            + "; anh/chị cho em tên mẫu còn lại để em so sánh theo thông tin shop đã xác nhận nhé.");
        }
        if (sentences.size() > 4) {
            sentences = new ArrayList<>(sentences.subList(0, 4));
        }
        boolean exactSizeRequested = detailIntent.size()
                && extractRequestedOption(normalized, SIZE_REQUEST) != null;
        sentences.add(english
                ? (exactSizeRequested
                ? "Choose Buy if this size suits you, or choose Talk to staff if you would like a fit check."
                : detailIntent.size()
                ? "Measure your head circumference first, then choose Talk to staff if you would like size advice."
                : "Open the product page for the complete saved information, or choose Talk to staff if you need confirmation.")
                : (exactSizeRequested
                ? "Anh/chị có thể bấm Chọn mua nếu size này phù hợp, hoặc bấm Gặp nhân viên nếu muốn shop kiểm tra độ vừa đầu nhé."
                : detailIntent.size()
                ? "Anh/chị nên đo vòng đầu trước, rồi bấm Gặp nhân viên nếu cần tư vấn chọn cỡ nhé."
                : "Anh/chị có thể mở trang sản phẩm để xem đầy đủ thông tin, hoặc bấm Gặp nhân viên nếu cần shop xác nhận thêm nhé."));
        return new DeterministicAnswer(String.join(" ", sentences), false, false);
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

    private static BigDecimal availableVariantPrice(
            Product product,
            String attribute,
            String requestedValue
    ) {
        if (product.variants() != null) {
            for (var variant : product.variants()) {
                if (variant == null || !variant.isAvailable()
                        || variant.stockState()
                        != com.bigbike.bigbike_backend.domain.catalog.ProductStockState.IN_STOCK
                        || variant.options() == null) {
                    continue;
                }
                boolean matches = variant.options().stream().anyMatch(option -> option != null
                        && attribute.equals(canonicalAttribute(option.name()))
                        && requestedValue.equalsIgnoreCase(
                        displayableOptionValue(attribute, option.value())));
                if (matches) {
                    BigDecimal variantPrice = effectivePrice(variant.price());
                    return variantPrice == null ? effectivePrice(product.price()) : variantPrice;
                }
            }
        }
        return effectivePrice(product.price());
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
                true);
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
        if (category != null) {
            // All matching aliases for the accepted category describe product type, not a
            // concrete model. This is essential for natural bilingual phrases such as
            // "bluetooth intercom headsets", where keeping either word as a model identifier
            // would collapse a category search into one accidental title match.
            String acceptedCategory = category;
            CATEGORY_KEYWORDS.entrySet().stream()
                    .filter(entry -> acceptedCategory.equals(entry.getValue()))
                    .filter(entry -> phraseMatches(normalized, entry.getKey()))
                    .forEach(entry -> addPhraseTokens(metadataTokens, entry.getKey()));
            addPhraseTokens(metadataTokens, category);
        }

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
        return recordConversationContext(previous, question, lang, products, actions, null, null);
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
        return recordConversationContext(
                previous, question, lang, products, actions, acceptedSearchScope, null);
    }

    public ConversationContext recordConversationContext(
            ConversationContext previous,
            String question,
            String lang,
            List<ChatProductCardResponse> products,
            List<ChatActionResponse> actions,
            SearchScope acceptedSearchScope,
            ProductDecisionContext nextProductDecision
    ) {
        ConversationContext prior = previous == null ? ConversationContext.empty() : previous;
        if (isNeedPrompt(normalizeIntent(question)) && nextProductDecision == null) {
            return ConversationContext.empty();
        }
        boolean verifiedSearch = acceptedSearchScope != null
                && ((products != null && !products.isEmpty()) || nextProductDecision != null);
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
        ProductDecisionContext productDecision = nextProductDecision != null
                ? nextProductDecision
                : verifiedSearch ? null : prior.productDecision();
        return new ConversationContext(
                category, brand, minPrice, maxPrice, slugs, awaitingOrderLogin, productDecision);
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
            case "privacy" -> "privacy";
            default -> throw new IllegalArgumentException("Unsupported policy topic");
        };
        ToolOutcome policy = policyOutcome(
                policyQuestion, "en".equals(context.lang()), context.settings());
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
        summary.put("items", order.items() == null ? List.of() : order.items().stream()
                .limit(5)
                .map(item -> Map.of(
                        "productName", nullToEmpty(item.productName()),
                        "variantName", nullToEmpty(item.variantName())))
                .toList());
        return Map.copyOf(summary);
    }

    /**
     * Ordered search attempts, narrowest first. CHAT_RULE_018: an attempt that drops the
     * price filter or widens the keyword is flagged so BigBike Assistant has to admit it to the customer;
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
        // still broader than the original request. Flag it so BigBike Assistant keeps useful cards while
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

    private ToolExecution executeArticleSearch(
            ChatToolRegistry.ValidatedCall call, ToolContext context) {
        String query = (String) call.arguments().get("query");
        String lang = (String) call.arguments().get("lang");
        List<String> tokens = normalize(query).split("\\s+").length == 0
                ? List.of()
                : java.util.Arrays.stream(normalize(query).split("\\s+"))
                        .filter(token -> token.length() >= 2)
                        .distinct()
                        .limit(6)
                        .toList();
        if (tokens.isEmpty() || !tokens.stream().anyMatch(
                token -> containsWholePhrase(normalize(context.question()), token))) {
            throw new IllegalArgumentException("Article search is not grounded in the question");
        }
        List<Map<String, Object>> articles = (contentReadRepository == null
                ? java.util.stream.Stream.<ContentReadRepository.ArticleKnowledge>empty()
                : contentReadRepository.searchPublishedArticleKnowledge(tokens, lang, 3).stream())
                .map(article -> {
                    Map<String, Object> value = new LinkedHashMap<>();
                    value.put("title", sanitizeArticleText(article.title(), 180));
                    value.put("content", sanitizeArticleText(
                            String.join(" ", nullToEmpty(article.excerpt()), nullToEmpty(article.body())), 900));
                    return value;
                })
                .filter(value -> !((String) value.get("title")).isBlank()
                        && !((String) value.get("content")).isBlank())
                .limit(3)
                .toList();
        return new ToolExecution(
                ChatToolRegistry.SEARCH_ARTICLES,
                toJson(Map.of("tool", ChatToolRegistry.SEARCH_ARTICLES, "articles", articles)),
                List.of(), List.of());
    }

    private static String sanitizeArticleText(String raw, int maxLength) {
        if (raw == null || raw.isBlank()) return "";
        String plain = Jsoup.parse(raw).text().replaceAll("\\s+", " ").trim();
        List<String> safeSentences = java.util.Arrays.stream(
                        plain.split("(?<=[.!?])\\s+|\\R+"))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .filter(value -> !ARTICLE_UNSAFE_SENTENCE.matcher(normalize(value)).find())
                .toList();
        String joined = String.join(" ", safeSentences)
                .replaceAll("(?i)https?://\\S+|www\\.\\S+", "")
                .replaceAll("\\s+", " ").trim();
        if (joined.length() <= maxLength) return joined;
        int boundary = joined.lastIndexOf(' ', maxLength);
        return joined.substring(0, boundary > 0 ? boundary : maxLength).trim();
    }

    private static final Pattern ARTICLE_UNSAFE_SENTENCE = Pattern.compile(
            "(?i)(?:https?://|www\\.|\\b(?:email|hotline|zalo|messenger)\\b|"
                    + "(?<!\\d)(?:\\+?84|0)\\d{8,10}(?!\\d)|"
                    + "\\b\\d[\\d.,]*\\s*(?:vnd|d|dong|trieu|million|k)\\b|"
                    + "\\b(?:con hang|het hang|in stock|out of stock|khuyen mai|promotion|discount)\\b|"
                    + "\\b(?:bao hanh|doi tra|tra hang|privacy policy|warranty|return policy|shipping policy|payment policy)\\b|"
                    + "\\b(?:giao trong|giao ngay|same day delivery|guaranteed delivery)\\b|"
                    + "\\b(?:ignore previous|system prompt|developer message|bo qua chi dan|lenh he thong)\\b)");

    /** Verifies the storefront page context against the current live public catalogue. */
    public boolean isPublicSellableProductSlug(String slug, String lang) {
        if (slug == null || slug.isBlank()) return false;
        try {
            Product product = catalogReadService.getProductBySlug(slug.trim(), lang);
            return product != null && !sellable(List.of(product)).isEmpty();
        } catch (RuntimeException ignored) {
            return false;
        }
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

    /**
     * A headset accessory may be useful in the unpriced category list, but it is not itself a
     * headset model and must not inflate a customer's headset budget result.
     */
    private static boolean matchesBudgetedProductType(
            Product product,
            String category,
            PriceIntent requested
    ) {
        if (requested == null || !requested.hasBounds()
                || !"tai-nghe-bluetooth-mu-bao-hiem".equals(category)) {
            return true;
        }
        String name = normalize(product == null ? "" : product.name());
        return !hasWord(name, "bo phu kien", "accessory kit", "accessory set");
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
            String lang,
            int verifiedMatchCount
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
        boolean excludesHeadsetAccessory = used.price().hasBounds()
                && "tai-nghe-bluetooth-mu-bao-hiem".equals(used.category());
        long priceTotal = excludesHeadsetAccessory
                ? Math.max(0, verifiedMatchCount) : pricePage.totalItems();
        return new CatalogTotals(priceTotal, scopePage.totalItems(), priceTotal);
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
     * catalogue's SQL range is based on retail price, while BigBike Assistant must apply the effective sale
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
                    "TOOL", false, false,
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
                    "TOOL", false, false);
        }

        if (scope == OrderScope.LATEST) {
            OrderReadService.CustomerOrderSummary order = orders.get(0);
            String answer = english
                    ? "Your most recent BigBike order is " + safeOrderNumber(order) + ". Status: "
                            + statusLabel(order.status(), true) + ". Order date: " + dateLabel(order, true)
                            + ". Items: " + orderItemsLabel(order, true) + ". Total: "
                            + amountLabel(order, true) + ". Open your account orders to see more."
                    : "Dạ, em đã kiểm tra: đơn hàng gần đây nhất của anh/chị là " + safeOrderNumber(order) + ". Trạng thái: "
                            + statusLabel(order.status(), false) + ". Ngày đặt: " + dateLabel(order, false)
                            + ". Sản phẩm: " + orderItemsLabel(order, false) + ". Tổng tiền: "
                            + amountLabel(order, false) + ". Anh/chị mở mục Đơn hàng trong tài khoản để xem thêm.";
            return ToolOutcome.local(answer, "TOOL", false, false,
                    List.of(new ChatActionResponse("ORDER_HISTORY")));
        }

        List<String> lines = orders.stream().map(order ->
                safeOrderNumber(order) + " — " + statusLabel(order.status(), english)
                        + " — " + orderItemsLabel(order, english)
                        + " — " + dateLabel(order, english) + " — " + amountLabel(order, english)).toList();
        String answer = english
                ? "Here are the recent orders from your signed-in account: " + String.join("; ", lines)
                        + ". I’m showing only the order number, status, order date and total. Open your account orders to see more."
                : "Đây là các đơn hàng gần đây của tài khoản đang đăng nhập: " + String.join("; ", lines)
                        + ". Em chỉ hiển thị mã đơn, trạng thái, ngày đặt và tổng tiền. Anh/chị mở mục Đơn hàng trong tài khoản để xem thêm.";
        return ToolOutcome.local(answer, "TOOL", false, false,
                List.of(new ChatActionResponse("ORDER_HISTORY")));
    }

    private static String safeOrderNumber(OrderReadService.CustomerOrderSummary order) {
        return order.orderNumber() == null || order.orderNumber().isBlank()
                ? "đơn hàng" : order.orderNumber();
    }

    private static String orderItemsLabel(
            OrderReadService.CustomerOrderSummary order, boolean english) {
        if (order.items() == null || order.items().isEmpty()) {
            return english ? "item details unavailable" : "chưa có chi tiết món";
        }
        return order.items().stream().limit(5).map(item -> {
            String product = nullToEmpty(item.productName());
            String variant = nullToEmpty(item.variantName());
            return variant.isBlank() ? product : product + " (" + variant + ")";
        }).filter(value -> !value.isBlank()).reduce((left, right) -> left + ", " + right)
                .orElse(english ? "item details unavailable" : "chưa có chi tiết món");
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
                ? (english ? "contact details are being updated" : "thông tin liên hệ đang được cập nhật")
                : String.join("; ", parts);
        return ToolOutcome.local(
                english
                        ? "BigBike’s current contact information is: " + details
                                + ". Please choose Talk to staff for a direct conversation. Your contact options remain available below."
                        : "Thông tin liên hệ hiện có của BigBike: " + details
                                + ". Anh/chị có thể bấm Gặp nhân viên để trao đổi trực tiếp. Các kênh liên hệ vẫn được giữ sẵn bên dưới.",
                "RULE", false, false);
    }

    private ToolOutcome promotionOutcome(String lang, boolean english) {
        List<Product> saleProducts = sellable(catalogReadService.listProducts(
                        0, 100, "createdAt:desc", null, List.of(), null,
                        List.of(), List.of(), List.of(), List.of(),
                        null, null, true, null, lang).items()).stream()
                .filter(product -> product.price() != null
                        && product.price().salePrice() != null
                        && product.price().retailPrice() != null
                        && product.price().salePrice().signum() > 0
                        && product.price().salePrice().compareTo(product.price().retailPrice()) < 0)
                .toList();
        if (saleProducts.isEmpty()) {
            return ToolOutcome.local(
                    english
                            ? "BigBike does not have a currently available sale product at the moment. You can keep asking about another product type or budget."
                            : "Hiện BigBike chưa có sản phẩm còn hàng nào đang giảm giá. Anh/chị vẫn có thể cho em loại hàng hoặc tầm giá khác để em tìm tiếp nhé.",
                    "TOOL", false, false);
        }
        List<ChatProductCardResponse> cards = saleProducts.stream().limit(8)
                .map(ChatToolService::toCard).toList();
        String answer = english
                ? "BigBike currently has " + saleProducts.size()
                        + " available sale product" + (saleProducts.size() == 1 ? "" : "s")
                        + ". The current sale price is shown with the product below."
                : "BigBike hiện có " + saleProducts.size()
                        + " sản phẩm còn hàng đang giảm giá. Giá ưu đãi hiện tại được hiển thị cùng sản phẩm bên dưới.";
        return ToolOutcome.local(answer, "TOOL", false, false, List.of(), cards);
    }

    private ToolOutcome safetyHelmetAdviceOutcome(String lang, boolean english) {
        List<ChatProductCardResponse> cards = sellable(catalogReadService.listProducts(
                        0, 100, "createdAt:desc", "mu-bao-hiem", List.of(), null,
                        List.of(), List.of(), List.of(), List.of(),
                        null, null, true, null, lang).items()).stream()
                .limit(3)
                .map(ChatToolService::toCard)
                .toList();
        String answer = english
                ? "No helmet can prevent every injury. For road protection, prioritise a correctly fitted helmet with a safety standard stated on its product page and the coverage suitable for your riding. The models below are currently sold by BigBike; open each one to check its verified standard and fit."
                : "Không mũ nào ngăn được mọi chấn thương. Khi đi đường, anh/chị nên ưu tiên mũ vừa đầu, có chuẩn an toàn ghi rõ trên trang sản phẩm và độ che phủ phù hợp cách sử dụng. Các mẫu bên dưới đang được BigBike bán; anh/chị mở từng mẫu để kiểm tra chuẩn và size đã xác minh.";
        return ToolOutcome.local(answer, "TOOL", false, false, List.of(), cards);
    }

    private static ToolOutcome bankTransferOutcome(
            ChatAssistantSettings.Snapshot settings,
            boolean english
    ) {
        ChatAssistantSettings.BankDetails bank = settings == null
                ? ChatAssistantSettings.BankDetails.empty() : settings.bankDetails();
        if (!bank.complete()) {
            return ToolOutcome.local(
                    english
                            ? "Please choose Talk to staff so BigBike can confirm the current bank-transfer details before you pay."
                            : "Anh/chị vui lòng bấm Gặp nhân viên để BigBike xác nhận thông tin chuyển khoản hiện hành trước khi thanh toán nhé.",
                    "RULE", false, true);
        }
        String answer = english
                ? "BigBike bank transfer details — Bank: " + bank.bankName()
                        + "; Account number: " + bank.accountNumber()
                        + "; Account holder: " + bank.accountHolder()
                        + "; Branch: " + bank.branch()
                        + ". Please transfer only after BigBike has confirmed your order."
                : "Thông tin chuyển khoản BigBike — Ngân hàng: " + bank.bankName()
                        + "; Số tài khoản: " + bank.accountNumber()
                        + "; Chủ tài khoản: " + bank.accountHolder()
                        + "; Chi nhánh: " + bank.branch()
                        + ". Anh/chị chỉ chuyển khoản sau khi BigBike đã xác nhận đơn hàng nhé.";
        return ToolOutcome.local(plain(answer, 900), "RULE", false, false);
    }

    private static ToolOutcome policyOutcome(
            String normalized,
            boolean english,
            ChatAssistantSettings.Snapshot settings
    ) {
        String answer;
        if (hasWord(normalized, "doi tra", "return", "returns", "exchange")) {
            ChatAssistantSettings.PolicyText policy = settings == null
                    ? ChatAssistantSettings.PolicyText.empty() : settings.returnExchangePolicy();
            answer = policy.available()
                    ? plain(policy.title() + ". " + policy.text(), 1800)
                    : (english
                    ? "Please open BigBike’s Returns and Exchanges Policy or choose Talk to staff before sending a product back."
                    : "Anh/chị vui lòng mở Chính sách đổi trả của BigBike hoặc bấm Gặp nhân viên trước khi gửi sản phẩm về nhé.");
        } else if (hasWord(normalized, "bao hanh", "warranty")) {
            ChatAssistantSettings.PolicyText policy = settings == null
                    ? ChatAssistantSettings.PolicyText.empty() : settings.warrantyPolicy();
            answer = policy.available()
                    ? plain(policy.title() + ". " + policy.text(), 1800)
                    : (english
                    ? "Please open BigBike’s Warranty Policy or choose Talk to staff so the current terms can be checked."
                    : "Anh/chị vui lòng mở Chính sách bảo hành của BigBike hoặc bấm Gặp nhân viên để kiểm tra điều kiện hiện hành nhé.");
        } else if (hasWord(normalized, "privacy", "rieng tu", "du lieu ca nhan")) {
            answer = english
                    ? "BigBike’s published Privacy Policy explains what customer information the store collects, why it is used and how customers can contact staff about their data. I will not infer legal rights or handling details that are not present in the current policy; please choose Talk to staff for a case-specific request."
                    : "Chính sách riêng tư đã công bố của BigBike nêu loại thông tin khách hàng được thu thập, mục đích sử dụng và cách liên hệ shop về dữ liệu cá nhân. Em không tự suy diễn quyền hoặc cách xử lý ngoài nội dung chính sách hiện hành; anh/chị bấm Gặp nhân viên nếu có yêu cầu cụ thể.";
        } else if (hasWord(normalized, "size", "sizes", "kich co", "do size", "size guide")) {
            answer = english
                    ? "Please use the helmet or protective-clothing size guide and compare your actual measurement with the product’s own size table when available. Some products do not yet have a size table, so I won’t infer a size from height or weight alone. Choose Talk to staff if you want BigBike to confirm the fit."
                    : "Anh/chị dùng hướng dẫn đo size mũ hoặc trang phục và đối chiếu số đo thật với bảng size riêng của sản phẩm nếu có. Một số sản phẩm chưa nhập bảng size nên em không suy ra size chỉ từ chiều cao/cân nặng. Anh/chị bấm Gặp nhân viên nếu muốn BigBike xác nhận thêm.";
        } else if (hasWord(normalized, "thanh toan", "payment")) {
            answer = english
                    ? "BigBike currently supports two manual payment methods: cash on delivery (COD) and bank transfer. BigBike Assistant cannot take payment or place an order on your behalf. Please continue through the cart to choose a method and review the order before confirming."
                    : "BigBike hiện hỗ trợ hai hình thức thanh toán thủ công: nhận hàng trả tiền (COD) và chuyển khoản ngân hàng. Em không nhận tiền và không chốt đơn thay anh/chị. Anh/chị vui lòng đi qua Giỏ hàng để chọn hình thức và kiểm tra lại trước khi xác nhận.";
        } else {
            answer = english
                    ? "BigBike provides free delivery for purchase orders. Delivery time depends on the destination; choose Talk to staff and share the delivery area if you need an estimate. Return or exchange shipping follows the separate Returns and Exchanges Policy."
                    : "BigBike miễn phí giao hàng cho đơn mua. Thời gian giao tùy khu vực; anh/chị bấm Gặp nhân viên và cho biết nơi nhận nếu cần shop ước tính. Phí gửi hàng đổi/trả áp dụng theo Chính sách đổi trả riêng.";
        }
        return ToolOutcome.local(answer, "RULE", false, false);
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
     * Variant options are admin data, not display copy. Colour values are humanized here and
     * slug-like model values are omitted, so an internal code cannot enter a chat tool payload.
     */
    private static String displayableOptionValue(String key, String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim();
        if ("color".equals(key)) return normalizeColorForDisplay(value);
        if ("model".equals(key) && (value.length() > 80
                || UNSAFE_OPTION_VALUE.matcher(value).find()
                || RAW_OPTION_SLUG.matcher(value).matches())) return null;
        return value;
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
        LinkedHashSet<String> words = new LinkedHashSet<>();
        for (String token : separated.split(" ")) {
            if (!token.matches("[\\p{L}\\p{N}]{1,20}")) return null;
            // Partial translation is unsafe: ronin-red may denote a named paint, not plain red.
            // Every token must be an approved human-readable colour/finish word.
            if (token.matches("(?=.*[\\p{L}])(?=.*\\d).*")
                    || token.matches("\\d+")) return null;
            String display = displayColorWord(token);
            if (display == null) return null;
            words.add(display);
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
            case "black" -> "Black";
            case "white" -> "White";
            case "grey", "gray" -> "Gray";
            case "red" -> "Red";
            case "blue" -> "Blue";
            case "green" -> "Green";
            case "yellow" -> "Yellow";
            case "silver" -> "Silver";
            case "gold" -> "Gold";
            case "orange" -> "Orange";
            case "purple" -> "Purple";
            case "pink" -> "Pink";
            case "brown" -> "Brown";
            case "navy" -> "Navy";
            case "army" -> "Army";
            case "matte", "matt" -> "Matte";
            case "gloss", "glossy" -> "Gloss";
            case "carbon" -> "Carbon";
            case "titan", "titanium" -> "Titan";
            case "neon", "fluo", "fluorescent" -> "Neon";
            case "multicolor", "rainbow" -> "Nhiều màu";
            default -> null;
        };
    }

    private static String canonicalAttribute(String raw) {
        String original = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        // Vietnamese "Mẫu" and "Màu" both become "mau" after accent removal. Preserve the
        // original spelling so a raw model code is not misclassified as a colour.
        if (original.equals("mẫu") || original.equals("mẫu mã") || original.equals("model")) {
            return "model";
        }
        String normalized = normalize(raw);
        if (normalized.equals("mau") || normalized.equals("mau sac") || normalized.equals("color")) {
            return "color";
        }
        if (normalized.equals("size") || normalized.equals("kich co")) return "size";
        if (normalized.equals("model")) return "model";
        return normalized;
    }

    static ChatProductCardResponse toCard(Product product) {
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
                        + "|(?:gio (?:minh )?)?(?:chuyen sang|doi sang|doi qua)"
                        + "|gio (?:minh )?(?:tim|xem)|switch to|change to)\\b", " ")
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
                .replaceAll("(?iU)\\b(?:vnd|vnđ|dong)\\b", " ")
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

    private static boolean containsWholePhrase(String value, String phrase) {
        return (" " + value + " ").contains(" " + phrase + " ");
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
        boolean capabilityQuestion = hasWord(value,
                "ban co the giup", "ban lam duoc gi", "what can you help", "what do you do");
        return (shortGreeting || capabilityQuestion) && !hasTaskCue(value);
    }

    private static boolean isThanks(String value) {
        return hasWord(value, "cam on", "xin cam on", "thank you", "thanks")
                && !hasTaskCue(value);
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

    private static boolean isBankDetailsQuestion(String value) {
        return hasWord(value,
                "so tai khoan", "tai khoan ngan hang", "thong tin chuyen khoan",
                "chuyen khoan vao dau", "bank account", "bank details", "transfer details");
    }

    private static boolean isPromotionLookup(String value) {
        return hasWord(value,
                "chuong trinh giam gia", "san pham giam gia", "mau giam gia",
                "dang giam gia", "dang sale", "khuyen mai nao", "sale products",
                "products on sale", "current promotion", "any promotions", "any discounts");
    }

    private static boolean isLightestQuestion(String value) {
        return hasWord(value, "nhe nhat", "mau nao nhe nhat", "lightest", "lowest weight");
    }

    private static boolean isSafetyHelmetAdvice(String value) {
        boolean helmet = hasWord(value, "mu", "non", "mu bao hiem", "helmet", "helmets");
        boolean accident = hasWord(value, "tai nan", "va cham", "dam xe", "crash", "accident", "collision");
        return helmet && accident;
    }

    private static boolean isSizePolicyQuestion(String value) {
        return hasWord(value, "chon size", "do size", "kich co", "size", "sizes", "size guide");
    }

    private static boolean isPolicyQuestion(String value) {
        return hasWord(value, "bao hanh", "doi tra", "doi hang", "tra hang", "phi ship", "ship",
                "giao hang", "van chuyen", "thanh toan", "chon size", "do size", "kich co",
                "warranty", "return", "returns", "exchange", "shipping", "delivery", "payment",
                "size guide", "rieng tu", "du lieu ca nhan", "privacy", "personal data");
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
            case "privacy" -> hasWord(
                    value, "rieng tu", "du lieu ca nhan", "privacy", "personal data");
            default -> false;
        };
    }

    private static boolean isHumanHandoff(String value) {
        return hasWord(value, "khieu nai", "complaint", "complaints", "thuong luong",
                "giam duoc khong", "bot gia", "xin giam gia", "giam them", "negotiate", "negotiation",
                "discount this", "lower the price", "deal gia", "bao hanh phuc tap", "tu choi bao hanh", "warranty claim",
                "loi san pham", "hang loi", "product complaint",
                "gap nhan vien", "noi chuyen voi nhan vien", "can nhan vien", "nguoi that",
                "talk to staff", "human agent", "speak to a person", "real person");
    }

    private static boolean isKnownOffTopic(String value) {
        boolean motorcycleTopic = hasWord(value, "xe may", "motorcycle", "motorcycles", "motorbike",
                "motorbikes");
        boolean productContext = matchKeyword(value, CATEGORY_KEYWORDS) != null
                || matchKeyword(value, BRAND_KEYWORDS) != null
                || hasWord(value, "san pham", "product", "products", "phu kien", "accessory");
        return hasWord(value, "chinh tri", "politic", "politics", "bau cu", "election", "elections",
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
                    : "Anh/chị đang cần loại sản phẩm nào hoặc muốn dùng cho nhu cầu gì ạ? Cho em biết loại hàng và tầm giá để em kiểm tra đúng sản phẩm đang bán nhé.";
        } else {
            String choices = String.join(", ", names);
            answer = english
                    ? "BigBike’s main product groups include " + choices + ". Which group or riding need would you like help with?"
                    : "Một số nhóm hàng chính của BigBike gồm " + choices + ". Anh/chị đang cần nhóm nào hoặc muốn dùng cho nhu cầu gì ạ?";
        }
        return ToolOutcome.local(answer, "RULE", false, false);
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

    private static String truncateCustomerAnswer(String value, int max) {
        if (value == null || value.length() <= max) return value == null ? "" : value;
        int cut = value.lastIndexOf(' ', max - 1);
        return value.substring(0, cut > 0 ? cut : max).trim();
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
    private static List<DecisionGroup> decisionGroups() {
        return List.of(
                new DecisionGroup(
                        "apparel", "Áo quần mô tô", "Motorcycle apparel",
                        "ao-quan-bao-ho", List.of("ao-quan-bao-ho")),
                new DecisionGroup(
                        "bags", "Balo – Túi đeo – Túi treo xe", "Backpacks and motorcycle bags",
                        "balo-tui-deo-tui-treo-xe", List.of("balo-tui-deo-tui-treo-xe")),
                new DecisionGroup(
                        "gloves", "Găng tay mô tô", "Motorcycle gloves",
                        "gang-tay-xe-may-moto", List.of("gang-tay-xe-may-moto")),
                new DecisionGroup(
                        "helmet", "Mũ bảo hiểm", "Helmets",
                        "mu-bao-hiem", List.of("mu-bao-hiem", "mu-bao-hiem-3-4")),
                new DecisionGroup(
                        "rain_base", "Đồ mưa, đồ lót giáp và phụ kiện", "Rainwear, base layers and accessories",
                        "phu-kien-do-lot-do-mua-moto", List.of("phu-kien-do-lot-do-mua-moto")),
                new DecisionGroup(
                        "boots", "Giày bảo hộ mô tô", "Motorcycle protective boots",
                        "giay-bao-ho-moto-phuot", List.of("giay-bao-ho-moto-phuot")),
                new DecisionGroup(
                        "headset", "Tai nghe Bluetooth", "Bluetooth headsets",
                        "tai-nghe-bluetooth-mu-bao-hiem", List.of("tai-nghe-bluetooth-mu-bao-hiem")),
                new DecisionGroup(
                        "armor", "Giáp bảo hộ tay chân", "Protective limb armor",
                        "giap-bao-ho-tay-chan", List.of("giap-bao-ho-tay-chan")),
                new DecisionGroup(
                        "mount_camera", "Giá đỡ điện thoại và phụ kiện camera", "Phone mounts and camera accessories",
                        "gia-do-dien-thoai-phu-kien-camera", List.of("gia-do-dien-thoai-phu-kien-camera")));
    }

    private static Map<String, List<UseCaseChoice>> useCaseChoices() {
        Map<String, List<UseCaseChoice>> map = new LinkedHashMap<>();
        map.put("helmet", List.of(
                use("city", "Đi phố hằng ngày", "Daily city riding",
                        List.of("di pho", "hang ngay", "daily", "city", "commute"),
                        List.of("pho", "do thi", "daily", "city", "commute", "nua dau", "3 4")),
                use("long-tour", "Đi tour đường dài", "Long distance touring",
                        List.of("tour duong dai", "di tour", "duong dai", "long tour", "touring"),
                        List.of("tour", "touring", "duong dai", "duong truong", "adventure")),
                use("mixed-dirt", "Chạy đường đất địa hình", "Paved and dirt routes",
                        List.of("duong dat", "dia hinh", "off road", "offroad", "paved and dirt"),
                        List.of("dual sport", "adventure", "off road", "offroad", "dia hinh", "duong dat"))));
        map.put("apparel", List.of(
                use("daily-hot", "Hằng ngày hoặc trời nóng", "Daily or hot weather riding",
                        List.of("hang ngay", "troi nong", "mua he", "daily", "hot weather", "summer"),
                        List.of("mua he", "thoang", "thong gio", "summer", "mesh", "daily")),
                use("tour-rain", "Tour dài, có thể gặp mưa", "Long tours with possible rain",
                        List.of("tour dai", "gap mua", "di mua", "long tour", "rain"),
                        List.of("tour", "touring", "chong nuoc", "waterproof", "rain", "duong dai")),
                use("dirt", "Chạy phượt địa hình", "Dirt and adventure riding",
                        List.of("phuot dia hinh", "dia hinh", "duong dat", "dirt", "off road"),
                        List.of("adventure", "dia hinh", "off road", "offroad", "duong dat"))));
        map.put("gloves", List.of(
                use("city-hot", "Đi phố quãng ngắn, trời nóng", "Short hot weather city rides",
                        List.of("di pho", "quang ngan", "troi nong", "city", "short ride", "hot weather"),
                        List.of("pho", "mua he", "thong gio", "thoang", "city", "summer", "mesh")),
                use("tour-rain", "Đi đường dài hoặc hay gặp mưa", "Long or rainy rides",
                        List.of("duong dai", "gap mua", "di mua", "long ride", "rain"),
                        List.of("tour", "touring", "chong nuoc", "waterproof", "rain", "duong dai")),
                use("sport", "Chạy thiên về thể thao", "Sport riding",
                        List.of("the thao", "sport", "racing"),
                        List.of("sport", "racing", "carbon", "bao ve khop"))));
        map.put("boots", List.of(
                use("daily-light", "Hằng ngày, nhẹ và thoáng", "Light and breathable daily wear",
                        List.of("hang ngay", "troi nong", "nhe", "thoang", "daily", "hot weather"),
                        List.of("mua he", "sneaker", "thoang", "nhe", "daily", "casual", "low")),
                use("tour-rain", "Tour dài, có thể gặp mưa", "Long or rainy tours",
                        List.of("tour dai", "gap mua", "di mua", "long tour", "rain"),
                        List.of("tour", "touring", "chong nuoc", "waterproof", "rain")),
                use("high-protection", "Cổ cao, bảo vệ chắc chân", "Higher cut protection",
                        List.of("co cao", "chac chan", "bao ve", "high cut", "protection"),
                        List.of("co cao", "high", "bao ve", "ankle", "shin"))));
        map.put("bags", List.of(
                use("backpack", "Đeo lưng", "Backpack",
                        List.of("deo lung", "balo", "backpack"),
                        List.of("balo", "backpack", "deo lung", "laptop")),
                use("waist-thigh", "Đeo hông hoặc đùi", "Waist or thigh bag",
                        List.of("deo hong", "deo dui", "waist", "thigh"),
                        List.of("deo hong", "deo dui", "waist", "thigh", "hip")),
                use("bike-mounted", "Gắn lên xe", "Bike mounted bag",
                        List.of("gan len xe", "treo xe", "gan xe", "bike mounted", "tank bag"),
                        List.of("treo xe", "hit binh xang", "gan xe", "tank", "saddle", "tail bag"))));
        map.put("headset", List.of(
                use("solo", "Dùng một mình", "Solo use",
                        List.of("mot minh", "solo", "nghe nhac", "xem chi duong"),
                        List.of("solo", "nghe nhac", "chi duong", "music", "navigation")),
                use("pair", "Nói chuyện với một bạn", "Talk with one companion",
                        List.of("mot ban", "hai nguoi", "2 nguoi", "cap doi", "one companion", "two riders"),
                        List.of("2 nguoi", "hai nguoi", "cap doi", "pair", "rider to passenger", "two riders")),
                use("group", "Đi nhóm từ bốn người", "Group of four or more",
                        List.of("nhom bon", "4 nguoi", "di doan", "group of four", "group ride"),
                        List.of("4 nguoi", "6 nguoi", "8 nguoi", "mesh", "group", "conference")),
                use("camera", "Cần quay video", "Video recording",
                        List.of("quay video", "camera", "record video"),
                        List.of("camera", "quay", "video", "record")),
                use("accessory", "Chỉ cần phụ kiện", "Accessory only",
                        List.of("phu kien", "accessory"),
                        List.of("phu kien", "accessory", "kep", "day", "micro", "loa"))));
        map.put("armor", List.of(
                use("external", "Mặc ra ngoài áo", "Wear outside clothing",
                        List.of("ngoai ao", "mac ngoai", "outside"),
                        List.of("ngoai", "external", "day deo", "strap")),
                use("insert", "Mặc lót bên trong", "Wear as an insert",
                        List.of("lot ben trong", "mac trong", "insert", "underneath"),
                        List.of("lot", "insert", "ben trong", "pocket"))));
        map.put("rain_base", List.of(
                use("rainwear", "Đồ đi mưa", "Rainwear",
                        List.of("do mua", "di mua", "rainwear"),
                        List.of("ao mua", "do mua", "chong nuoc", "rain")),
                use("base-head", "Lớp mặc trong hoặc trùm đầu", "Inner or head layer",
                        List.of("mac trong", "trum dau", "ao lot", "base layer", "balaclava"),
                        List.of("ao lot", "trum dau", "balaclava", "base layer", "inner")),
                use("accessory", "Phụ kiện nhỏ khác", "Other small accessory",
                        List.of("phu kien", "accessory"),
                        List.of("phu kien", "accessory", "tui", "day", "mieng"))));
        map.put("mount_camera", List.of(
                use("phone-nav", "Gắn điện thoại xem đường", "Phone mount for navigation",
                        List.of("dien thoai", "xem duong", "chi duong", "phone", "navigation"),
                        List.of("dien thoai", "phone", "chi duong", "navigation", "gps")),
                use("action-camera", "Gắn camera hành trình", "Action camera mount",
                        List.of("camera hanh trinh", "action camera", "camera"),
                        List.of("camera", "action cam", "gopro", "hanh trinh")),
                use("other", "Phụ kiện khác trên xe", "Other bike accessory",
                        List.of("phu kien khac", "other accessory"),
                        List.of("phu kien", "accessory", "kep", "adapter"))));
        return java.util.Collections.unmodifiableMap(map);
    }

    private static UseCaseChoice use(
            String key,
            String labelVi,
            String labelEn,
            List<String> customerAliases,
            List<String> productKeywords
    ) {
        return new UseCaseChoice(key, labelVi, labelEn, customerAliases, productKeywords);
    }

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
        map.put("tai nghe gan mu bao hiem", "tai-nghe-bluetooth-mu-bao-hiem");
        map.put("tai nghe gan mu", "tai-nghe-bluetooth-mu-bao-hiem");
        map.put("tai nghe mu bao hiem", "tai-nghe-bluetooth-mu-bao-hiem");
        map.put("bluetooth intercom headsets", "tai-nghe-bluetooth-mu-bao-hiem");
        map.put("intercom headsets", "tai-nghe-bluetooth-mu-bao-hiem");
        map.put("tai nghe", "tai-nghe-bluetooth-mu-bao-hiem");
        map.put("headsets", "tai-nghe-bluetooth-mu-bao-hiem");
        map.put("headset", "tai-nghe-bluetooth-mu-bao-hiem");
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

    private record DecisionGroup(
            String key,
            String labelVi,
            String labelEn,
            String genericRoot,
            List<String> roots
    ) {
        String label(boolean english) {
            return english ? labelEn : labelVi;
        }
    }

    private record UseCaseChoice(
            String key,
            String labelVi,
            String labelEn,
            List<String> customerAliases,
            List<String> productKeywords
    ) {
        String label(boolean english) {
            return english ? labelEn : labelVi;
        }
    }

    private record DecisionCatalog(
            List<Product> products,
            List<Category> categories,
            Map<String, Set<String>> descendantsBySlug,
            Map<String, Set<String>> groupSlugs,
            Map<String, String> categoryNames
    ) {}

    private record GroupCount(DecisionGroup group, long count) {}

    private record VariantChoiceCount(String label, long count) {}

    private record DelegatedProduct(Product product, String basis) {}

    private record DecisionPriceBand(
            String id,
            String label,
            Long min,
            Long max,
            PriceKind kind
    ) {
        PriceIntent intent() {
            return new PriceIntent(min, max, kind);
        }

        String encoded() {
            return (min == null ? "" : min) + ":" + (max == null ? "" : max) + ":" + kind;
        }
    }

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
            boolean awaitingOrderLogin,
            ProductDecisionContext productDecision
    ) {
        public ConversationContext(
                String category,
                String brand,
                Long minPrice,
                Long maxPrice,
                List<String> productSlugs,
                boolean awaitingOrderLogin
        ) {
            this(category, brand, minPrice, maxPrice, productSlugs, awaitingOrderLogin, null);
        }

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
            return new ConversationContext(null, null, null, null, List.of(), false, null);
        }

        boolean hasCatalogScope() {
            return category != null || brand != null;
        }

        private static String trimScope(String value) {
            return value == null || value.isBlank() ? null : value.trim();
        }
    }

    /** Server-owned, PII-free state for one or more deterministic clarification rounds. */
    public record ProductDecisionContext(
            String group,
            String useCase,
            String typeCategory,
            String size,
            String color,
            List<String> askedCriteria,
            PendingClarification pending
    ) {
        public ProductDecisionContext {
            group = ConversationContext.trimScope(group);
            useCase = ConversationContext.trimScope(useCase);
            typeCategory = ConversationContext.trimScope(typeCategory);
            size = ConversationContext.trimScope(size);
            color = ConversationContext.trimScope(color);
            askedCriteria = askedCriteria == null ? List.of() : askedCriteria.stream()
                    .filter(value -> value != null && !value.isBlank())
                    .map(String::trim)
                    .distinct()
                    .limit(8)
                    .toList();
        }

        static ProductDecisionContext empty() {
            return new ProductDecisionContext(null, null, null, null, null, List.of(), null);
        }
    }

    public record PendingClarification(
            UUID id,
            String criterion,
            List<PendingClarificationOption> options
    ) {
        public PendingClarification {
            options = options == null ? List.of() : options.stream().limit(12).toList();
        }
    }

    public record PendingClarificationOption(
            String id,
            String label,
            String kind,
            String value,
            Long count
    ) {}

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
            boolean handoffRecommended
    ) {
        static DeterministicAnswer from(ToolOutcome outcome) {
            return new DeterministicAnswer(
                    outcome.localAnswer(),
                    outcome.offTopic(),
                    outcome.handoffRecommended());
        }

        static DeterministicAnswer from(ToolOutcome outcome, String question) {
            return new DeterministicAnswer(
                    outcome.localAnswer(),
                    outcome.offTopic(),
                    outcome.handoffRecommended());
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
            List<ChatActionResponse> actions,
            Set<RequiredDisclosure> requiredDisclosures,
            boolean inheritedPrice,
            CatalogTotals catalogTotals,
            List<String> matchingProductNames,
            SearchScope effectiveSearchScope,
            ChatClarificationResponse clarification,
            ProductDecisionContext nextProductDecision
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
                    true, null, "AI", toolJson, List.copyOf(products), false, false,
                    List.of(), Set.copyOf(requiredDisclosures), inheritedPrice, catalogTotals,
                    matchingProductNames == null ? List.of() : List.copyOf(matchingProductNames),
                    effectiveSearchScope, null, null);
        }

        static ToolOutcome local(
                String answer, String source, boolean offTopic, boolean handoff) {
            return local(answer, source, offTopic, handoff, List.of());
        }

        static ToolOutcome local(
                String answer,
                String source,
                boolean offTopic,
                boolean handoff,
                List<ChatActionResponse> actions) {
            return local(answer, source, offTopic, handoff, actions, List.of());
        }

        static ToolOutcome local(
                String answer,
                String source,
                boolean offTopic,
                boolean handoff,
                List<ChatActionResponse> actions,
                List<ChatProductCardResponse> products) {
            return new ToolOutcome(false, answer, source, "{}",
                    products == null ? List.of() : List.copyOf(products), offTopic, handoff,
                    List.copyOf(actions), Set.of(), false, null, List.of(), null, null, null);
        }

        static ToolOutcome clarification(
                String answer,
                List<ChatProductCardResponse> products,
                SearchScope searchScope,
                ProductDecisionContext decision
        ) {
            PendingClarification pending = decision == null ? null : decision.pending();
            ChatClarificationResponse response = pending == null ? null : new ChatClarificationResponse(
                    pending.id(),
                    pending.criterion(),
                    pending.options().stream()
                            .map(option -> new ChatClarificationOptionResponse(
                                    option.id(), option.label(), option.count(), option.kind()))
                            .toList());
            return new ToolOutcome(
                    false, answer, "TOOL", "{}",
                    products == null ? List.of() : List.copyOf(products),
                    false, false, List.of(), Set.of(), false, null, List.of(),
                    searchScope, response, decision);
        }

        static ToolOutcome decided(
                String answer,
                List<ChatProductCardResponse> products,
                SearchScope searchScope,
                ProductDecisionContext decision
        ) {
            return new ToolOutcome(
                    false, answer, "TOOL", "{}",
                    products == null ? List.of() : List.copyOf(products),
                    false, false, List.of(), Set.of(), false, null, List.of(),
                    searchScope, null, decision);
        }
    }
}
