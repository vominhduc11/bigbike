package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class ChatActionCatalog {

    private static final Set<String> ALLOWED = Set.of(
            "COMPARE_PRODUCTS", "CHECK_SIZE", "CHECK_STOCK", "CHANGE_BUDGET",
            "FIND_SIMILAR", "VIEW_POLICY", "FIND_PRODUCTS", "RELATED_ARTICLE_QUESTION",
            "CHANGE_NEEDS", "LOGIN", "ORDER_HISTORY", "ORDER_LOOKUP",
            "CALL_HOTLINE", "OPEN_ZALO", "OPEN_MESSENGER");

    private ChatActionCatalog() {}

    static boolean isAllowed(String type) {
        return type != null && ALLOWED.contains(type);
    }

    static List<ChatActionResponse> choose(
            String question,
            String resultKind,
            List<ChatProductCardResponse> products,
            List<ChatActionResponse> existing,
            ChatContactResponse contacts
    ) {
        LinkedHashSet<String> types = new LinkedHashSet<>();
        if (existing != null) {
            existing.stream().map(ChatActionResponse::type).filter(ChatActionCatalog::isAllowed)
                    .forEach(types::add);
        }
        if (!types.isEmpty()) return responses(types, 3);

        String normalized = ChatToolService.normalize(question == null ? "" : question);
        int productCount = products == null ? 0 : products.size();
        if ("CONTACT".equals(resultKind)) {
            addConfiguredContacts(types, contacts);
        } else if ("OUT_OF_SCOPE".equals(resultKind) || "REFUSAL".equals(resultKind)) {
            add(types, "FIND_PRODUCTS", "VIEW_POLICY");
            addConfiguredContacts(types, contacts);
        } else if (productCount > 1) {
            add(types, "COMPARE_PRODUCTS", "CHECK_SIZE", "CHANGE_BUDGET");
        } else if (productCount == 1) {
            add(types, "CHECK_SIZE", "CHECK_STOCK", "FIND_SIMILAR");
        } else if (containsAny(normalized, "bao hanh", "doi tra", "giao hang", "thanh toan", "privacy", "chinh sach")) {
            add(types, "VIEW_POLICY", "FIND_PRODUCTS");
            addConfiguredContacts(types, contacts);
        } else if (containsAny(normalized, "chon size", "huong dan size", "size nao")) {
            add(types, "FIND_PRODUCTS", "VIEW_POLICY");
            addConfiguredContacts(types, contacts);
        } else if (containsAny(normalized, "bai viet", "tin tuc", "huong dan")) {
            add(types, "FIND_PRODUCTS", "RELATED_ARTICLE_QUESTION");
            addConfiguredContacts(types, contacts);
        } else {
            add(types, "CHANGE_NEEDS", "CHANGE_BUDGET");
            addConfiguredContacts(types, contacts);
        }
        return responses(types, 3);
    }

    private static void addConfiguredContacts(LinkedHashSet<String> types, ChatContactResponse contacts) {
        if (contacts == null) return;
        if (hasText(contacts.hotline())) types.add("CALL_HOTLINE");
        if (hasText(contacts.zaloUrl())) types.add("OPEN_ZALO");
        if (hasText(contacts.messengerUrl())) types.add("OPEN_MESSENGER");
    }

    private static void add(LinkedHashSet<String> target, String... values) {
        for (String value : values) target.add(value);
    }

    private static List<ChatActionResponse> responses(LinkedHashSet<String> types, int limit) {
        List<ChatActionResponse> responses = new ArrayList<>();
        for (String type : types) {
            if (isAllowed(type)) responses.add(new ChatActionResponse(type));
            if (responses.size() == limit) break;
        }
        return List.copyOf(responses);
    }

    private static boolean containsAny(String value, String... needles) {
        for (String needle : needles) if (value.contains(needle)) return true;
        return false;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
