package com.bigbike.bigbike_backend.service.chat;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** Stable, owner-facing violation codes. Content is reported, never rewritten. */
public final class ChatTemplatePolicy {
    private ChatTemplatePolicy() {}

    private static final Pattern URL = Pattern.compile(
            "(?i)(?:https?://|www\\.|(?:zalo|facebook|messenger)\\.me)");
    private static final Pattern PHONE = Pattern.compile("(?<!\\d)(?:\\+?84|0)\\d{8,10}(?!\\d)");
    private static final Pattern PRICE = Pattern.compile(
            "(?i)\\b\\d[\\d.,]*\\s*(?:vnd|đ|dong|triệu|trieu|million|k)\\b");
    private static final Pattern TECHNICAL = Pattern.compile("\\b[A-Z]{2,}[A-Z0-9-]*\\d{2,}\\b");
    private static final Pattern DISCOUNT = Pattern.compile(
            "(?i)(?:giảm giá|discount|free shipping|miễn phí ship|tặng quà|free gift)");
    private static final Pattern DELIVERY = Pattern.compile(
            "(?i)(?:giao|delivery|arrive).{0,24}(?:ngày mai|tomorrow|\\d{1,2}[/-]\\d{1,2}|\\d+\\s*(?:ngày|days?))");

    public static List<String> violations(String answer) {
        List<String> result = new ArrayList<>();
        String value = answer == null ? "" : answer.trim();
        if (value.isBlank()) result.add("ANSWER_REQUIRED");
        if (value.length() > 2_000) result.add("ANSWER_TOO_LONG");
        if (URL.matcher(value).find()) result.add("URL_NOT_ALLOWED");
        if (PHONE.matcher(value).find()) result.add("CONTACT_NOT_ALLOWED");
        if (PRICE.matcher(value).find()) result.add("DYNAMIC_PRICE_NOT_ALLOWED");
        if (TECHNICAL.matcher(value).find()) result.add("TECHNICAL_CODE_NOT_ALLOWED");
        if (DISCOUNT.matcher(value).find()) result.add("DISCOUNT_PROMISE");
        if (DELIVERY.matcher(value).find()) result.add("DELIVERY_DATE_PROMISE");
        return List.copyOf(result);
    }

    /** Matcher normalization shared by the owner preview and the customer fast path. */
    static String normalizeMatchText(String value) {
        return ChatToolService.normalize(value)
                .replaceAll("[^\\p{Alnum}]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
