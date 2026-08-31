package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Final customer-facing safety gate for both template and model answers.
 * Internal tool payloads and database enums must never be allowed to cross
 * this boundary accidentally.
 */
@Component
public class ChatResponseGuard {

    private static final Pattern TECHNICAL_TERMS = Pattern.compile(
                    "(?i)(?<![\\p{L}])(api|endpoint|database|session|quota|gemini|json|tool|sql"
                    + "|function\\s*call|functioncall|stack\\s*trace|exception|error(?:\\s*(?:code|id|message))?)"
                    + "(?![\\p{L}])");
    private static final Pattern RAW_INTERNAL_CODES = Pattern.compile(
                    "\\b(?:CANCELLED|COMPLETED|PENDING|PROCESSING|IN_STOCK|OUT_OF_STOCK"
                    + "|AI_UNAVAILABLE|CONTACT_FALLBACK|NO_MATCH_IN_REQUESTED_PRICE_RANGE"
                    + "|SEARCH_WAS_BROADENED)\\b");
    /** Lowercase hyphenated values are catalog/admin slugs, never customer-facing colour names. */
    private static final Pattern RAW_INTERNAL_SLUG = Pattern.compile(
            "(?<![\\p{L}\\p{N}])(?:[a-z0-9]{2,}(?:-[a-z0-9]{2,})+)(?![\\p{L}\\p{N}])");
    /**
     * Customer copy legitimately uses a small number of standard English compounds. Keep the
     * allow-list exact so catalogue values such as {@code ronin-red} remain blocked.
     */
    private static final Set<String> SAFE_ENGLISH_HYPHENATED_TERMS = Set.of(
            "40-question",
            "automated-chat",
            "destination-specific",
            "product-condition",
            "shipping-method",
            "signed-in");
    private static final Pattern RAW_CURRENCY = Pattern.compile(
            "(?i)(?:\\b\\d[\\d.,]*\\s*(?:VND|VNĐ)\\b|\\b(?:VND|VNĐ)\\b"
                    + "|\\b\\d[\\d.,]*[.,]\\d{1,2}\\s*₫)");
    private static final Pattern URL = Pattern.compile("(?i)(?:https?://|www\\.|/(?:product|san-pham)/)");
    private static final Pattern FORBIDDEN_RICH_CONTENT = Pattern.compile(
            "(?s)(?:<[^>]+>|```|`[^`]*`|!\\[[^]]*]|\\[[^]]+]\\([^)]*\\))");
    private static final Pattern EMAIL = Pattern.compile(
            "(?i)(?<![\\p{Alnum}._%+-])[\\p{Alnum}._%+-]+@[\\p{Alnum}.-]+\\.[a-z]{2,}(?![\\p{Alnum}])");
    private static final Pattern PRIVATE_PHONE = Pattern.compile(
            "(?<![\\p{Alnum}])(?:\\+?84|0)(?:[ .()\\-]*\\d){8,10}(?!\\d)");
    private static final Pattern FALSE_URGENCY_OR_SOCIAL_PROOF = Pattern.compile(
            "\\b(?:sap\\s+het\\s+hang|chi\\s+con\\s+(?:vai|mot|hai|ba|\\d+)\\s+(?:cai|chiec|mon)|"
                    + "nhieu\\s+nguoi\\s+(?:dang\\s+)?(?:xem|mua)|khach\\s+(?:hang\\s+)?(?:khac\\s+)?danh\\s+gia|"
                    + "da\\s+ban\\s+(?:duoc\\s+)?\\d+|ban\\s+chay|chi\\s+hom\\s+nay|co\\s+hoi\\s+cuoi|"
                    + "only\\s+(?:a\\s+)?few\\s+left|only\\s+\\d+\\s+left|selling\\s+fast|limited\\s+stock|"
                    + "many\\s+people\\s+are\\s+(?:viewing|buying)|customers?\\s+love|reviewers?\\s+say|"
                    + "best[-\\s]?sell(?:er|ing)|ends\\s+today|last\\s+chance|countdown)\\b",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern UNSUPPORTED_PERSONAL_PROMISE = Pattern.compile(
            "\\b(?:em\\s+(?:se|co\\s+the)\\s+(?:giam|tang|mien\\s+phi)|"
                    + "giao\\s+(?:chac\\s+chan|dung|vao\\s+ngay|truoc\\s+ngay)|"
                    + "i\\s+(?:will|can)\\s+(?:discount|give|include|offer\\s+free\\s+shipping)|"
                    + "free\\s+shipping\\s+for\\s+you|guaranteed\\s+delivery|arrive\\s+(?:on|by)\\s+)\\b",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern VIETNAMESE_TEXT = Pattern.compile("[à-ỹÀ-ỸđĐ]");
    private static final Pattern VI_PRONOUNS = Pattern.compile("(?i)(?:\\bem\\b|anh/chị|anh chi)");
    private static final Pattern CUSTOMER_ADDRESSED_AS_EM = Pattern.compile(
            "(?:^|\\s)(?:xin\\s+)?chao\\s+em(?:\\s|$)"
                    + "|(?:^|\\s)thua\\s+em(?:\\s|$)"
                    + "|(?:^|\\s)em\\s+(?:hay|vui\\s+long|cho\\s+em\\s+biet|"
                    + "noi\\s+(?:ro|them)|tham\\s+khao|chon|bam|mo|xem)(?:\\s|$)"
                    // This is a customer-directed recommendation form. Keep the list narrow
                    // so valid self-references such as “em có thể hỗ trợ anh/chị” stay valid.
                    + "|(?:^|\\s)em\\s+co\\s+the\\s+(?:tham\\s+khao|chon|bam|xem)(?:\\s|$)");
    /** Keep this deliberately narrow: factual short answers must not be mistaken for rude copy. */
    private static final Pattern DISMISSIVE_TONE = Pattern.compile(
            "(?:^|\\s)tu\\s+(?:xem|tim)(?:\\s+di)?(?:\\s+(?:nhe|thoi))?$"
                    + "|(?:^|\\s)(?:dung\\s+hoi(?:\\s+nua)?|ke\\s+di|bo\\s+qua\\s+di|"
                    + "khong\\s+lien\\s+quan)(?:\\s|$)");
    private static final String COUNT_WORD = "(?:mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)";
    private static final String COUNT_VALUE = "(?:\\d+|" + COUNT_WORD + ")";
    private static final String VI_CATALOG_UNIT =
            "(?:mau|san\\s+pham|mat\\s+hang|loai|tai\\s+nghe|mu|hang)";
    private static final String EN_CATALOG_UNIT =
            "(?:models?|products?|items?|helmets?|headsets?)";
    /** A written numeric price scope also binds a nearby catalogue count to the range total. */
    private static final Pattern PRICE_AMOUNT_REFERENCE = Pattern.compile(
            "(?<![a-z0-9])(?:\\d+(?:[.,]\\d+)?|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|"
                    + "one|two|three|four|five|six|seven|eight|nine|ten)\\s*"
                    + "(?:trieu|tr|million|nghin|ngan|k|cu|lit)(?![a-z0-9])");
    /** Assertions of completeness remain unsupported even when one count was supplied. */
    private static final Pattern VI_ABSOLUTE_CATALOG_CLAIM = Pattern.compile(
            "\\b(?:tat\\s+ca|toan\\s+bo|duy\\s+nhat)\\b");
    private static final Pattern EN_ABSOLUTE_CATALOG_CLAIM = Pattern.compile(
            "\\b(?:all\\s+(?:products|items|helmets|models|headsets)|the\\s+only)\\b");
    /** A number plus a product unit is a catalogue statement unless it is explicitly a card count. */
    private static final Pattern VI_CATALOG_COUNT_CLAIM = Pattern.compile(
            "\\b(" + COUNT_VALUE + ")\\s+" + VI_CATALOG_UNIT + "\\b");
    private static final Pattern EN_CATALOG_COUNT_CLAIM = Pattern.compile(
            "\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s+"
                    + EN_CATALOG_UNIT + "\\b");
    private static final Pattern VI_DISPLAY_CARD_COUNT_CLAIM = Pattern.compile(
            "\\b(" + COUNT_VALUE + ")\\s+(?:the(?:\\s+san\\s+pham)?"
                    + "|(?:san\\s+pham|mau)(?:\\s+(?:phu\\s+hop|tieu\\s+bieu))?\\s+ben\\s+duoi)\\b");
    private static final Pattern EN_DISPLAY_CARD_COUNT_CLAIM = Pattern.compile(
            "\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s+"
                    + "(?:(?:product\\s+)?cards?|(?:matching\\s+|representative\\s+)?products?\\s+below)\\b");
    private static final Pattern VI_UNSCOPED_ABSENCE_CLAIM = Pattern.compile(
            "\\b(?:bigbike\\s+(?:hien\\s+)?(?:khong\\s+co|chua\\s+co|khong\\s+tim\\s+thay)\\s+"
                    + "(?:bat\\s+ky\\s+)?(?:san\\s+pham|mau|mu|mat\\s+hang|hang)"
                    + "|bigbike\\s+(?:hien\\s+)?(?:khong|chua)\\s+(?:ban|kinh\\s+doanh)"
                    + "|(?:khong|chua)\\s+tim\\s+thay\\s+(?:bat\\s+ky\\s+)?(?:san\\s+pham|mau|mu|hang))\\b");
    private static final Pattern EN_UNSCOPED_ABSENCE_CLAIM = Pattern.compile(
            "\\b(?:bigbike\\s+(?:does\\s+not|doesn't)\\s+(?:have|stock|sell|carry|offer|show)"
                    + "|bigbike\\s+has\\s+no\\s+(?:products?|items?|helmets?|models?|headsets?|stock)"
                    + "|(?:could\\s+not|cannot|can't)\\s+find\\s+(?:any\\s+)?(?:product|item|helmet|model))\\b");
    private static final Pattern SENTENCE_END = Pattern.compile("[.!?。！？]+(?=\\s|$)");
    private static final int MIN_SENTENCES = 1;
    private static final int MAX_SENTENCES = 10;
    private static final int MAX_ANSWER_CHARS = 2_000;
    private static final int MAX_PRODUCTS = 8;

    public Optional<CheckedAnswer> check(
            String answer,
            List<ChatProductCardResponse> products,
            String lang
    ) {
        return check(answer, products, lang, Set.of(), null);
    }

    /**
     * Used by backend-written terminal answers as well as model answers. Required disclosures
     * and count evidence must survive both paths; otherwise a deterministic response could
     * silently hide a carried price range or assert an unsupported catalogue total.
     */
    public Optional<CheckedAnswer> check(
            String answer,
            List<ChatProductCardResponse> products,
            String lang,
            Set<ChatToolService.RequiredDisclosure> requiredDisclosures,
            ChatToolService.CatalogTotals catalogTotals
    ) {
        String content = trimToSentenceLimit(answer);
        if (!isSafeCustomerText(content, lang)
                || !hasSafeAssistantTone(content, lang)
                || !containsRequiredDisclosures(content, lang, requiredDisclosures)
                || hasUnsupportedWarehouseWideClaim(content, lang, catalogTotals, products)) {
            return Optional.empty();
        }
        // CHAT_RULE_007: floor lowered to 2 on 2026-08-10. The prompt still aims for 3-5,
        // but a correct short answer must reach the customer instead of becoming fallback.
        int sentences = sentenceCount(content);
        if (sentences < MIN_SENTENCES) return Optional.empty();
        if (products == null || products.size() > MAX_PRODUCTS) return Optional.empty();
        if (products.stream().anyMatch(product -> !isSafeProduct(product))) return Optional.empty();
        return Optional.of(new CheckedAnswer(content, List.copyOf(products)));
    }

    /**
     * Why a reply was rejected, as a fixed code for operational logging. Never returns
     * customer text, the answer itself or any PII — only which rule closed the gate.
     */
    public String rejectionReason(
            String answer,
            List<ChatProductCardResponse> products,
            String lang,
            List<String> publicShopPhoneSources,
            Set<ChatToolService.RequiredDisclosure> requiredDisclosures
    ) {
        return rejectionReason(
                answer, products, lang, publicShopPhoneSources, requiredDisclosures, null);
    }

    public String rejectionReason(
            String answer,
            List<ChatProductCardResponse> products,
            String lang,
            List<String> publicShopPhoneSources,
            Set<ChatToolService.RequiredDisclosure> requiredDisclosures,
            ChatToolService.CatalogTotals catalogTotals
    ) {
        if (answer == null || answer.isBlank()) return "EMPTY_ANSWER";
        if (EMAIL.matcher(answer).find()) return "EMAIL_ECHO";
        Set<String> allowedPhones = extractPhones(publicShopPhoneSources);
        Matcher phones = PRIVATE_PHONE.matcher(answer);
        while (phones.find()) {
            if (!allowedPhones.contains(canonicalPhone(phones.group()))) return "PHONE_ECHO";
        }
        if (!containsRequiredDisclosures(answer, lang, requiredDisclosures)) {
            return "DISCLOSURE_MISSING";
        }
        String content = trimToSentenceLimit(answer);
        if (TECHNICAL_TERMS.matcher(content).find()) return "TECHNICAL_TERM";
        if (RAW_INTERNAL_CODES.matcher(content).find() || containsRawInternalSlug(content, lang)) {
            return "INTERNAL_CODE";
        }
        if (RAW_CURRENCY.matcher(content).find()) return "RAW_CURRENCY";
        if (URL.matcher(content).find()) return "URL";
        String normalizedSalesCopy = ChatToolService.normalize(content);
        if (FALSE_URGENCY_OR_SOCIAL_PROOF.matcher(normalizedSalesCopy).find()
                || UNSUPPORTED_PERSONAL_PROMISE.matcher(normalizedSalesCopy).find()) {
            return "UNSUPPORTED_SALES_CLAIM";
        }
        if (!isSafeCustomerText(content, lang)) return "WRONG_LANGUAGE";
        if (hasUnsupportedWarehouseWideClaim(content, lang, catalogTotals, products)) {
            return "UNSUPPORTED_CATALOG_CLAIM";
        }
        if (!hasSafeAssistantTone(content, lang)) return "WRONG_TONE";
        int sentences = sentenceCount(content);
        if (sentences < MIN_SENTENCES) {
            return "SENTENCE_COUNT_" + sentences;
        }
        if (products == null || products.size() > MAX_PRODUCTS) return "TOO_MANY_PRODUCTS";
        if (products.stream().anyMatch(product -> !isSafeProduct(product))) return "UNSAFE_PRODUCT";
        return "NONE";
    }

    /**
     * Structured diagnostics for operational logs. Deliberately excludes customer/assistant
     * content, product names, slugs, prices and any identity data.
     */
    public GuardDiagnostic rejectionDiagnostic(
            String answer,
            List<ChatProductCardResponse> products,
            String lang,
            List<String> publicShopPhoneSources,
            Set<ChatToolService.RequiredDisclosure> requiredDisclosures,
            ChatToolService.CatalogTotals catalogTotals
    ) {
        return new GuardDiagnostic(
                rejectionReason(answer, products, lang, publicShopPhoneSources,
                        requiredDisclosures, catalogTotals),
                products == null ? 0 : products.size(),
                catalogTotals != null,
                catalogTotals != null && catalogTotals.priceRangeTotalItems() != null,
                requiredDisclosures == null ? 0 : requiredDisclosures.size());
    }

    /** Model-only boundary: do not let it echo customer PII from the current question. */
    public Optional<CheckedAnswer> checkModel(
            String answer,
            List<ChatProductCardResponse> products,
            String lang,
            List<String> publicShopPhoneSources
    ) {
        return checkModel(answer, products, lang, publicShopPhoneSources, Set.of(), null);
    }

    public Optional<CheckedAnswer> checkModel(
            String answer,
            List<ChatProductCardResponse> products,
            String lang,
            List<String> publicShopPhoneSources,
            Set<ChatToolService.RequiredDisclosure> requiredDisclosures
    ) {
        return checkModel(answer, products, lang, publicShopPhoneSources, requiredDisclosures, null);
    }

    public Optional<CheckedAnswer> checkModel(
            String answer,
            List<ChatProductCardResponse> products,
            String lang,
            List<String> publicShopPhoneSources,
            Set<ChatToolService.RequiredDisclosure> requiredDisclosures,
            ChatToolService.CatalogTotals catalogTotals
    ) {
        return checkModel(
                answer,
                products,
                lang,
                publicShopPhoneSources,
                requiredDisclosures,
                catalogTotals,
                List.of("legacy-current-turn-evidence"));
    }

    /** Model prose may use RECENT_TURNS only after a current-turn tool supplied evidence. */
    public Optional<CheckedAnswer> checkModel(
            String answer,
            List<ChatProductCardResponse> products,
            String lang,
            List<String> publicShopPhoneSources,
            Set<ChatToolService.RequiredDisclosure> requiredDisclosures,
            ChatToolService.CatalogTotals catalogTotals,
            List<String> currentTurnTools
    ) {
        if (currentTurnTools == null || currentTurnTools.isEmpty()) return Optional.empty();
        if (answer == null || EMAIL.matcher(answer).find()) return Optional.empty();
        String normalizedSalesCopy = ChatToolService.normalize(answer);
        if (FALSE_URGENCY_OR_SOCIAL_PROOF.matcher(normalizedSalesCopy).find()
                || UNSUPPORTED_PERSONAL_PROMISE.matcher(normalizedSalesCopy).find()) {
            return Optional.empty();
        }
        Set<String> allowedPhones = extractPhones(publicShopPhoneSources);
        Matcher phones = PRIVATE_PHONE.matcher(answer);
        while (phones.find()) {
            if (!allowedPhones.contains(canonicalPhone(phones.group()))) return Optional.empty();
        }
        if (!containsRequiredDisclosures(answer, lang, requiredDisclosures)) {
            return Optional.empty();
        }
        if (hasUnsupportedWarehouseWideClaim(answer, lang, catalogTotals, products)) return Optional.empty();
        return check(answer, products, lang, requiredDisclosures, catalogTotals);
    }

    /**
     * Drops only unsupported numeric catalogue clauses and replaces them with an explicit card
     * display statement. It is intentionally unavailable for unsupported absence/absolute claims:
     * those have no safe local interpretation. The repaired prose must pass the full guard again.
     */
    public Optional<CheckedAnswer> repairUnsupportedCountClauses(
            String answer,
            List<ChatProductCardResponse> products,
            String lang,
            Set<ChatToolService.RequiredDisclosure> requiredDisclosures,
            ChatToolService.CatalogTotals catalogTotals
    ) {
        if (answer == null || answer.isBlank() || products == null || products.isEmpty()) {
            return Optional.empty();
        }
        if (!hasUnsupportedWarehouseWideClaim(answer, lang, catalogTotals, products)) {
            return Optional.empty();
        }

        List<String> repaired = new java.util.ArrayList<>();
        Matcher sentences = Pattern.compile("[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$").matcher(answer.trim());
        boolean changed = false;
        while (sentences.find()) {
            String sentence = sentences.group().trim();
            if (sentence.isBlank()) continue;
            if (hasUnsupportedWarehouseWideClaim(sentence, lang, catalogTotals, products)) {
                String normalized = ChatToolService.normalize(sentence);
                Pattern countPattern = "en".equals(lang) ? EN_CATALOG_COUNT_CLAIM : VI_CATALOG_COUNT_CLAIM;
                if (!countPattern.matcher(normalized).find()) return Optional.empty();
                repaired.add(displayedCardSentence(products.size(), lang));
                changed = true;
            } else {
                repaired.add(sentence);
            }
        }
        if (!changed) return Optional.empty();
        if (repaired.size() < MIN_SENTENCES) {
            repaired.add("en".equals(lang)
                    ? "Please open the products below, or tell me a different budget so I can filter again."
                    : "Anh/chị có thể xem từng sản phẩm bên dưới hoặc cho em biết tầm giá khác để em lọc lại nhé.");
        }
        return check(String.join(" ", repaired), products, lang, requiredDisclosures, catalogTotals);
    }

    private static String displayedCardSentence(int cardCount, String lang) {
        if ("en".equals(lang)) {
            return "I am showing " + cardCount + " matching product"
                    + (cardCount == 1 ? " below." : "s below.");
        }
        return "Dạ, em đang hiển thị " + cardCount + " sản phẩm phù hợp bên dưới.";
    }

    private static boolean containsRequiredDisclosures(
            String answer,
            String lang,
            Set<ChatToolService.RequiredDisclosure> requiredDisclosures
    ) {
        if (requiredDisclosures == null || requiredDisclosures.isEmpty()) return true;
        String normalized = ChatToolService.normalize(answer);
        boolean english = "en".equals(lang);
        for (ChatToolService.RequiredDisclosure disclosure : requiredDisclosures) {
            boolean present = switch (disclosure) {
                case INHERITED_PRICE_RANGE -> hasInheritedPriceRangeDisclosure(normalized, english);
                case INHERITED_FILTER_DROPPED -> hasInheritedFilterDroppedDisclosure(normalized, english);
                case PRICE_RANGE_MISS -> hasPriceRangeMissDisclosure(normalized, english);
                case BROADENED_SEARCH -> hasBroadenedSearchDisclosure(normalized, english);
            };
            if (!present) return false;
        }
        return true;
    }

    private static boolean hasInheritedPriceRangeDisclosure(String value, boolean english) {
        if (english) {
            return containsAny(value, "previous product request", "previous price range", "previous range")
                    && containsAny(value, "filter", "range", "price");
        }
        return containsAny(value, "truoc do", "luot truoc", "da neu truoc")
                && containsAny(value, "dang loc", "loc theo", "tam gia");
    }

    private static boolean hasInheritedFilterDroppedDisclosure(String value, boolean english) {
        if (english) {
            return containsAny(value, "previous product request", "previous price filter", "older filter")
                    && containsAny(value, "removed", "remove")
                    && containsAny(value, "searched", "search", "retry");
        }
        return containsAny(value, "luot truoc", "da neu truoc", "bo loc cu", "ke thua")
                && containsAny(value, "bo rieng", "bo loc", "da bo")
                && containsAny(value, "tim lai", "loc lai");
    }

    private static boolean hasPriceRangeMissDisclosure(String value, boolean english) {
        if (english) {
            boolean admitsMiss = containsAny(value,
                    "no product", "no item", "could not find", "couldn't find", "nothing")
                    && containsAny(value, "price range", "requested range", "your range");
            boolean labelsAlternatives = containsAny(value,
                    "closest", "nearest", "outside the range", "outside your range");
            return admitsMiss && labelsAlternatives;
        }
        boolean admitsMiss = containsAny(value,
                "khong co", "chua co", "khong tim thay", "chua tim thay")
                && containsAny(value, "tam gia", "muc gia", "khoang gia");
        boolean labelsAlternatives = containsAny(value,
                "gan nhat", "gan voi", "phuong an gan", "lua chon gan", "ngoai tam gia");
        return admitsMiss && labelsAlternatives;
    }

    private static boolean hasBroadenedSearchDisclosure(String value, boolean english) {
        if (english) {
            boolean admitsWidening = containsAny(value, "broader", "wider", "expanded")
                    && containsAny(value, "list", "result", "search", "request");
            boolean invitesNarrowing = containsAny(value,
                    "more specific", "narrow", "refine", "tell me more");
            return admitsWidening && invitesNarrowing;
        }
        boolean admitsWidening = containsAny(value, "rong hon", "mo rong")
                && containsAny(value, "danh sach", "ket qua", "tim kiem", "yeu cau");
        boolean invitesNarrowing = containsAny(value,
                "cu the hon", "noi ro hon", "thu hep", "loc lai");
        return admitsWidening && invitesNarrowing;
    }

    private static boolean containsAny(String value, String... fragments) {
        for (String fragment : fragments) {
            if (value.contains(fragment)) return true;
        }
        return false;
    }

    private static Set<String> extractPhones(List<String> sources) {
        if (sources == null || sources.isEmpty()) return Set.of();
        Set<String> phones = new LinkedHashSet<>();
        for (String source : sources) {
            if (source == null || source.isBlank()) continue;
            Matcher matcher = PRIVATE_PHONE.matcher(source);
            while (matcher.find()) phones.add(canonicalPhone(matcher.group()));
        }
        return Set.copyOf(phones);
    }

    private static String canonicalPhone(String value) {
        String digits = value == null ? "" : value.replaceAll("\\D", "");
        return digits.startsWith("84") ? "0" + digits.substring(2) : digits;
    }

    /** Shared guard for customer-visible assistant copy. */
    public boolean isSafeCustomerText(String value, String lang) {
        if (value == null || value.isBlank()) return false;
        String content = value.trim();
        if (TECHNICAL_TERMS.matcher(content).find()
                || RAW_INTERNAL_CODES.matcher(content).find()
                || containsRawInternalSlug(content, lang)
                || RAW_CURRENCY.matcher(content).find()
                || URL.matcher(content).find()
                || FORBIDDEN_RICH_CONTENT.matcher(content).find()
                || FALSE_URGENCY_OR_SOCIAL_PROOF.matcher(
                        ChatToolService.normalize(content)).find()
                || UNSUPPORTED_PERSONAL_PROMISE.matcher(
                        ChatToolService.normalize(content)).find()) {
            return false;
        }
        return !"en".equals(lang)
                || (!VIETNAMESE_TEXT.matcher(content).find()
                && !VI_PRONOUNS.matcher(content).find());
    }

    /** Vietnamese assistant copy must never address the customer as "em". */
    public boolean hasSafeAssistantTone(String value, String lang) {
        if (value == null || value.isBlank()) return false;
        if ("en".equals(lang)) return isSafeCustomerText(value, lang);
        String normalized = ChatToolService.normalize(value)
                .replaceAll("[^\\p{Alnum}]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (CUSTOMER_ADDRESSED_AS_EM.matcher(normalized).find()) return false;
        for (String sentence : value.split("[.!?。！？]+")) {
            String normalizedSentence = ChatToolService.normalize(sentence)
                    .replaceAll("[^\\p{Alnum}]+", " ")
                    .replaceAll("\\s+", " ")
                    .trim();
            if (DISMISSIVE_TONE.matcher(normalizedSentence).find()) return false;
        }
        return true;
    }

    /**
     * Product cards are intentionally limited, so a response must not turn them into a
     * catalogue conclusion. CHAT_RULE_020 opens one narrow exception: a current search may carry
     * exact backend totals for its verified scope and, separately, its applied price range.
     */
    private static boolean hasUnsupportedWarehouseWideClaim(
            String value,
            String lang,
            ChatToolService.CatalogTotals catalogTotals,
            List<ChatProductCardResponse> products
    ) {
        String normalized = ChatToolService.normalize(value).replaceAll("\\s+", " ").trim();
        if (normalized.isBlank()) return false;
        boolean english = "en".equals(lang);
        if ((english ? EN_ABSOLUTE_CATALOG_CLAIM : VI_ABSOLUTE_CATALOG_CLAIM)
                .matcher(normalized).find()) {
            return true;
        }
        boolean priceScoped = isPriceScoped(normalized, lang);
        if ((english ? EN_UNSCOPED_ABSENCE_CLAIM : VI_UNSCOPED_ABSENCE_CLAIM)
                .matcher(normalized).find() && !priceScoped) {
            return true;
        }

        List<CatalogCountClaim> claims = catalogCountClaims(normalized, english);
        if (claims.isEmpty()) return false;
        for (CatalogCountClaim claim : claims) {
            if (claim.displayedCards()) {
                if (products == null || products.size() != claim.value()) return true;
                continue;
            }
            if (catalogTotals == null) return true;
            Long expected = claim.priceScoped()
                    ? catalogTotals.priceRangeTotalItems()
                    : Long.valueOf(catalogTotals.scopeTotalItems());
            if (expected == null || expected.longValue() != claim.value()) return true;
        }
        return false;
    }

    private static List<CatalogCountClaim> catalogCountClaims(String normalized, boolean english) {
        Pattern pattern = english ? EN_CATALOG_COUNT_CLAIM : VI_CATALOG_COUNT_CLAIM;
        Matcher matcher = pattern.matcher(normalized);
        List<CatalogCountCandidate> candidates = new java.util.ArrayList<>();
        while (matcher.find()) {
            Long value = catalogCountValue(matcher.group(1), english);
            if (value == null) continue;
            candidates.add(new CatalogCountCandidate(value, matcher.start(), matcher.end(), false));
        }
        Pattern displayPattern = english ? EN_DISPLAY_CARD_COUNT_CLAIM : VI_DISPLAY_CARD_COUNT_CLAIM;
        Matcher displays = displayPattern.matcher(normalized);
        while (displays.find()) {
            Long value = catalogCountValue(displays.group(1), english);
            if (value == null) continue;
            candidates.removeIf(candidate -> candidate.start() == displays.start()
                    && candidate.value() == value.longValue());
            candidates.add(new CatalogCountCandidate(value, displays.start(), displays.end(), true));
        }
        candidates.sort(java.util.Comparator.comparingInt(CatalogCountCandidate::start)
                .thenComparing(java.util.Comparator.comparing(
                        CatalogCountCandidate::explicitDisplay).reversed()));
        List<CatalogCountClaim> claims = new java.util.ArrayList<>();
        for (int index = 0; index < candidates.size(); index++) {
            CatalogCountCandidate candidate = candidates.get(index);
            int sentenceStart = Math.max(
                    Math.max(normalized.lastIndexOf('.', candidate.start()), normalized.lastIndexOf('!', candidate.start())),
                    normalized.lastIndexOf('?', candidate.start())) + 1;
            int sentenceEnd = sentenceEnd(normalized, candidate.end());
            int nextCountStart = index + 1 < candidates.size()
                    && candidates.get(index + 1).start() < sentenceEnd
                    ? candidates.get(index + 1).start() : sentenceEnd;
            int clauseEnd = firstClauseEnd(normalized, candidate.end(), nextCountStart);
            String beforeClaim = normalized.substring(sentenceStart, candidate.end());
            String afterClaim = normalized.substring(candidate.end(), clauseEnd);
            String sentence = normalized.substring(sentenceStart, sentenceEnd);
            if (isSelectionCountQuestion(sentence, english)) continue;
            boolean priceScoped = isPriceScoped(beforeClaim, english ? "en" : "vi")
                    || isPriceScoped(afterClaim, english ? "en" : "vi")
                    // A one-sided phrase such as “trên 3tr … có 5 mẫu” may have punctuation
                    // between its range and count. The entire sentence still binds the count to
                    // the verified price-range total; it is not a warehouse-wide claim.
                    || isPriceScoped(sentence, english ? "en" : "vi")
                    // “... trong tầm giá ... có 5 mẫu. Em đang hiển thị 3 thẻ trong tổng
                    // 5 mẫu ...” refers to the immediately preceding verified range total.
                    // It must stay a catalogue count, not be mistaken for the three cards.
                    || referencesPreviousPriceScope(normalized, sentenceStart, beforeClaim,
                    english ? "en" : "vi");
            // The explicit card-count grammar is the only safe way to treat a number as a
            // visible-card claim. A nearby word such as “thẻ” must not turn “tổng 5 mẫu” into
            // an assertion that five cards were rendered.
            boolean displayedCards = candidate.explicitDisplay();
            claims.add(new CatalogCountClaim(candidate.value(), priceScoped, displayedCards));
        }
        return List.copyOf(claims);
    }

    private static boolean referencesPreviousPriceScope(
            String normalized,
            int sentenceStart,
            String beforeClaim,
            String lang
    ) {
        if (sentenceStart <= 0 || !containsAny(beforeClaim, "tong", "total")) return false;
        int previousEnd = sentenceStart - 1;
        while (previousEnd >= 0 && (Character.isWhitespace(normalized.charAt(previousEnd))
                || normalized.charAt(previousEnd) == '.'
                || normalized.charAt(previousEnd) == '!'
                || normalized.charAt(previousEnd) == '?')) {
            previousEnd--;
        }
        if (previousEnd < 0) return false;
        int previousStart = Math.max(
                Math.max(normalized.lastIndexOf('.', previousEnd), normalized.lastIndexOf('!', previousEnd)),
                normalized.lastIndexOf('?', previousEnd)) + 1;
        return isPriceScoped(normalized.substring(previousStart, previousEnd + 1), lang);
    }

    private static int sentenceEnd(String value, int from) {
        Matcher matcher = SENTENCE_END.matcher(value);
        return matcher.find(from) ? matcher.start() : value.length();
    }

    /** A following range belongs to this count only before the next clause or count begins. */
    private static int firstClauseEnd(String value, int from, int limit) {
        int end = limit;
        for (char delimiter : new char[]{',', ';', ':'}) {
            int found = value.indexOf(delimiter, from);
            if (found >= 0 && found < end) end = found;
        }
        return end;
    }

    private static Long catalogCountValue(String raw, boolean english) {
        if (raw == null || raw.isBlank()) return null;
        if (raw.matches("\\d+")) {
            try {
                return Long.parseLong(raw);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return switch (raw) {
            case "mot", "one" -> 1L;
            case "hai", "two" -> 2L;
            case "ba", "three" -> 3L;
            case "bon", "four" -> 4L;
            case "nam", "five" -> 5L;
            case "sau", "six" -> 6L;
            case "bay", "seven" -> 7L;
            case "tam", "eight" -> 8L;
            case "chin", "nine" -> 9L;
            case "muoi", "ten" -> 10L;
            default -> null;
        };
    }

    /** Numbers in a choice/clarification question are not catalogue-total assertions. */
    private static boolean isSelectionCountQuestion(String sentence, boolean english) {
        if (english) {
            return hasWholeWord(sentence, "which")
                    && containsAny(sentence, "model", "models", "product", "products", "item", "items")
                    && containsAny(sentence, "compare", "choose", "want", "select");
        }
        return containsAny(sentence, "mau nao", "san pham nao", "mat hang nao", "loai nao")
                && containsAny(sentence, "so sanh", "chon", "muon", "can xem", "can tim");
    }

    private static boolean isPriceScoped(String normalized, String lang) {
        return "en".equals(lang)
                ? containsAny(normalized, "price range", "requested range", "your range", "within the range")
                        || PRICE_AMOUNT_REFERENCE.matcher(normalized).find()
                : containsAny(normalized, "tam gia", "muc gia", "khoang gia", "trong tam", "trong khoang")
                        || PRICE_AMOUNT_REFERENCE.matcher(normalized).find();
    }

    private static boolean hasWholeWord(String value, String word) {
        return (" " + value.replaceAll("[^\\p{Alnum}]+", " ").trim() + " ")
                .contains(" " + word + " ");
    }

    private static boolean containsRawInternalSlug(String content, String lang) {
        Matcher matcher = RAW_INTERNAL_SLUG.matcher(content);
        while (matcher.find()) {
            String candidate = matcher.group().toLowerCase(Locale.ROOT);
            if ("en".equals(lang) && SAFE_ENGLISH_HYPHENATED_TERMS.contains(candidate)) continue;
            return true;
        }
        return false;
    }

    private static boolean isSafeProduct(ChatProductCardResponse product) {
        if (product == null || blank(product.slug()) || blank(product.name())) return false;
        if (!"IN_STOCK".equals(product.stockState())) return false;
        BigDecimal sale = product.salePrice();
        BigDecimal retail = product.retailPrice();
        if (retail == null || retail.signum() <= 0) return false;
        if (sale != null && sale.signum() > 0 && sale.compareTo(retail) >= 0) return false;
        BigDecimal effective = sale != null && sale.signum() > 0 ? sale : retail;
        return effective != null && effective.signum() > 0;
    }

    /** Retains only cards that are independently safe to expose, capped by CHAT_RULE_007. */
    public List<ChatProductCardResponse> retainSafeProducts(List<ChatProductCardResponse> products) {
        if (products == null || products.isEmpty()) return List.of();
        return products.stream()
                .filter(ChatResponseGuard::isSafeProduct)
                .limit(MAX_PRODUCTS)
                .toList();
    }

    private static int sentenceCount(String value) {
        if (value.isBlank()) return 0;
        return (int) SENTENCE_END.matcher(value).results().count();
    }

    /** Keep complete sentences only; every remaining guard runs on the returned text. */
    private static String trimToSentenceLimit(String value) {
        if (value == null) return null;
        String content = value.trim();
        Matcher matcher = SENTENCE_END.matcher(content);
        int count = 0;
        int safeEnd = -1;
        while (matcher.find()) {
            count++;
            if (count <= MAX_SENTENCES && matcher.end() <= MAX_ANSWER_CHARS) safeEnd = matcher.end();
            if (count > MAX_SENTENCES || matcher.end() > MAX_ANSWER_CHARS) {
                return safeEnd < 0 ? "" : content.substring(0, safeEnd).trim();
            }
        }
        if (content.length() <= MAX_ANSWER_CHARS) return content;
        return safeEnd < 0 ? "" : content.substring(0, safeEnd).trim();
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private record CatalogCountCandidate(long value, int start, int end, boolean explicitDisplay) {}

    private record CatalogCountClaim(long value, boolean priceScoped, boolean displayedCards) {}

    public record CheckedAnswer(String answer, List<ChatProductCardResponse> products) {}

    public record GuardDiagnostic(
            String reason,
            int productCount,
            boolean hasScopeTotal,
            boolean hasPriceRangeTotal,
            int requiredDisclosureCount
    ) {}
}
