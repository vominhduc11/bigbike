package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
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
    private static final Pattern RAW_CURRENCY = Pattern.compile(
            "(?i)(?:\\b\\d[\\d.,]*\\s*(?:VND|VNĐ)\\b|\\b(?:VND|VNĐ)\\b"
                    + "|\\b\\d[\\d.,]*[.,]\\d{1,2}\\s*₫)");
    private static final Pattern URL = Pattern.compile("(?i)(?:https?://|www\\.|/(?:product|san-pham)/)");
    private static final Pattern EMAIL = Pattern.compile(
            "(?i)(?<![\\p{Alnum}._%+-])[\\p{Alnum}._%+-]+@[\\p{Alnum}.-]+\\.[a-z]{2,}(?![\\p{Alnum}])");
    private static final Pattern PRIVATE_PHONE = Pattern.compile(
            "(?<![\\p{Alnum}])(?:\\+?84|0)(?:[ .()\\-]*\\d){8,10}(?!\\d)");
    private static final Pattern VIETNAMESE_TEXT = Pattern.compile("[à-ỹÀ-ỸđĐ]");
    private static final Pattern VI_PRONOUNS = Pattern.compile("(?i)(?:\\bem\\b|anh/chị|anh chi)");
    private static final Pattern CUSTOMER_ADDRESSED_AS_EM = Pattern.compile(
            "(?:^|\\s)(?:xin\\s+)?chao\\s+em(?:\\s|$)"
                    + "|(?:^|\\s)thua\\s+em(?:\\s|$)"
                    + "|(?:^|\\s)em\\s+(?:dang\\s+)?(?:tim|can|muon|hay|vui\\s+long|"
                    + "cho\\s+em\\s+biet|noi\\s+(?:ro|them)|tham\\s+khao|chon|bam|mo)(?:\\s|$)"
                    // This is a customer-directed recommendation form. Keep the list narrow
                    // so valid self-references such as “em có thể hỗ trợ anh/chị” stay valid.
                    + "|(?:^|\\s)em\\s+co\\s+the\\s+(?:tham\\s+khao|chon|bam|xem)(?:\\s|$)");
    private static final Pattern VI_WAREHOUSE_WIDE_CLAIM = Pattern.compile(
            "\\b(?:tat\\s+ca|toan\\s+bo|duy\\s+nhat|chi\\s+co\\s+(?:\\d+|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)"
                    + "|bigbike\\s+(?:hien\\s+)?(?:khong\\s+co|chua\\s+co|khong\\s+tim\\s+thay)"
                    + "|(?:khong|chua)\\s+tim\\s+thay\\s+(?:bat\\s+ky\\s+)?(?:san\\s+pham|mau|mu|hang)"
                    + "|bigbike\\s+co\\s+(?:\\d+|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\\s+(?:san\\s+pham|mau|mu|hang))\\b");
    private static final Pattern EN_WAREHOUSE_WIDE_CLAIM = Pattern.compile(
            "\\b(?:all\\s+(?:products|items|helmets|models)|only\\s+\\d+|the\\s+only|"
                    + "bigbike\\s+(?:does\\s+not|doesn't|has\\s+no)|"
                    + "(?:could\\s+not|cannot|can't)\\s+find\\s+(?:any\\s+)?(?:product|item|helmet|model))\\b");
    private static final Pattern SENTENCE_END = Pattern.compile("[.!?。！？]+(?=\\s|$)");
    private static final int MIN_SENTENCES = 2;
    private static final int MAX_SENTENCES = 5;

    public Optional<CheckedAnswer> check(
            String answer,
            List<ChatProductCardResponse> products,
            String lang
    ) {
        if (!isSafeCustomerText(answer, lang)
                || !hasSafeAssistantTone(answer, lang)
                || hasUnsupportedWarehouseWideClaim(answer, lang)) {
            return Optional.empty();
        }
        String content = answer.trim();
        // CHAT_RULE_007: floor lowered to 2 on 2026-08-10. The prompt still aims for 3-5,
        // but a correct short answer must reach the customer instead of becoming fallback.
        int sentences = sentenceCount(content);
        if (sentences < MIN_SENTENCES || sentences > MAX_SENTENCES) return Optional.empty();
        if (products == null || products.size() > 3) return Optional.empty();
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
        String content = answer.trim();
        if (TECHNICAL_TERMS.matcher(content).find()) return "TECHNICAL_TERM";
        if (RAW_INTERNAL_CODES.matcher(content).find()) return "INTERNAL_CODE";
        if (RAW_CURRENCY.matcher(content).find()) return "RAW_CURRENCY";
        if (URL.matcher(content).find()) return "URL";
        if (!isSafeCustomerText(content, lang)) return "WRONG_LANGUAGE";
        if (hasUnsupportedWarehouseWideClaim(content, lang)) return "UNSUPPORTED_CATALOG_CLAIM";
        if (!hasSafeAssistantTone(content, lang)) return "WRONG_TONE";
        int sentences = sentenceCount(content);
        if (sentences < MIN_SENTENCES || sentences > MAX_SENTENCES) {
            return "SENTENCE_COUNT_" + sentences;
        }
        if (products == null || products.size() > 3) return "TOO_MANY_PRODUCTS";
        if (products.stream().anyMatch(product -> !isSafeProduct(product))) return "UNSAFE_PRODUCT";
        return "NONE";
    }

    /** Model-only boundary: do not let it echo customer PII from the current question. */
    public Optional<CheckedAnswer> checkModel(
            String answer,
            List<ChatProductCardResponse> products,
            String lang,
            List<String> publicShopPhoneSources
    ) {
        return checkModel(answer, products, lang, publicShopPhoneSources, Set.of());
    }

    public Optional<CheckedAnswer> checkModel(
            String answer,
            List<ChatProductCardResponse> products,
            String lang,
            List<String> publicShopPhoneSources,
            Set<ChatToolService.RequiredDisclosure> requiredDisclosures
    ) {
        if (answer == null || EMAIL.matcher(answer).find()) return Optional.empty();
        Set<String> allowedPhones = extractPhones(publicShopPhoneSources);
        Matcher phones = PRIVATE_PHONE.matcher(answer);
        while (phones.find()) {
            if (!allowedPhones.contains(canonicalPhone(phones.group()))) return Optional.empty();
        }
        if (!containsRequiredDisclosures(answer, lang, requiredDisclosures)) {
            return Optional.empty();
        }
        if (hasUnsupportedWarehouseWideClaim(answer, lang)) return Optional.empty();
        return check(answer, products, lang);
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
                case PRICE_RANGE_MISS -> hasPriceRangeMissDisclosure(normalized, english);
                case BROADENED_SEARCH -> hasBroadenedSearchDisclosure(normalized, english);
            };
            if (!present) return false;
        }
        return true;
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

    /** Shared guard for greeting, quick-prompt and other widget copy. */
    public boolean isSafeCustomerText(String value, String lang) {
        if (value == null || value.isBlank()) return false;
        String content = value.trim();
        if (TECHNICAL_TERMS.matcher(content).find()
                || RAW_INTERNAL_CODES.matcher(content).find()
                || RAW_CURRENCY.matcher(content).find()
                || URL.matcher(content).find()) {
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
        return hasWholeWord(normalized, "em")
                && normalized.contains("anh chi")
                && !CUSTOMER_ADDRESSED_AS_EM.matcher(normalized).find();
    }

    /**
     * Product cards are intentionally limited to three, so a model must not turn that page into
     * a claim about the whole warehouse. A price-range disclosure remains valid because it is
     * explicitly scoped by backend-controlled tool data.
     */
    private static boolean hasUnsupportedWarehouseWideClaim(String value, String lang) {
        String normalized = ChatToolService.normalize(value)
                .replaceAll("[^\\p{Alnum}]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.isBlank() || isPriceScoped(normalized, lang)) return false;
        return "en".equals(lang)
                ? EN_WAREHOUSE_WIDE_CLAIM.matcher(normalized).find()
                : VI_WAREHOUSE_WIDE_CLAIM.matcher(normalized).find();
    }

    private static boolean isPriceScoped(String normalized, String lang) {
        return "en".equals(lang)
                ? containsAny(normalized, "price range", "requested range", "your range")
                : containsAny(normalized, "tam gia", "muc gia", "khoang gia");
    }

    /** Settings greeting is assistant output too; quick prompts intentionally are not. */
    public boolean isSafeGreeting(String value, String lang) {
        return isSafeCustomerText(value, lang) && hasSafeAssistantTone(value, lang);
    }

    private static boolean hasWholeWord(String value, String word) {
        return (" " + value.replaceAll("[^\\p{Alnum}]+", " ").trim() + " ")
                .contains(" " + word + " ");
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

    private static int sentenceCount(String value) {
        if (value.isBlank()) return 0;
        return (int) SENTENCE_END.matcher(value).results().count();
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    public record CheckedAnswer(String answer, List<ChatProductCardResponse> products) {}
}
