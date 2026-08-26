package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.service.ws.ChatHandoffWsEvent;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;

public final class ChatHandoffProductJson {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ChatHandoffProductJson() {}

    public static String write(List<ChatProductCardResponse> products) {
        if (products == null || products.isEmpty()) return null;
        List<ProductReference> references = products.stream()
                .filter(product -> product != null && product.slug() != null && product.name() != null)
                .map(product -> new ProductReference(product.slug(), product.name()))
                .limit(8)
                .toList();
        if (references.isEmpty()) return null;
        try {
            return MAPPER.writeValueAsString(references);
        } catch (Exception ignored) {
            return null;
        }
    }

    public static List<ProductReference> read(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        try {
            List<ProductReference> values = MAPPER.readValue(raw, new TypeReference<>() {});
            return values == null ? List.of() : values.stream().limit(8).toList();
        } catch (Exception ignored) {
            return List.of();
        }
    }

    public static List<ChatHandoffWsEvent.ProductReference> readWs(String raw) {
        return read(raw).stream()
                .map(item -> new ChatHandoffWsEvent.ProductReference(item.slug(), item.name()))
                .toList();
    }

    public record ProductReference(String slug, String name) {}
}
