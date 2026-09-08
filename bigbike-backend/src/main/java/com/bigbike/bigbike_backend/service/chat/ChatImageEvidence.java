package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatClarificationOptionResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatClarificationResponse;
import java.util.List;
import java.util.UUID;

/** Bounded observations only; no customer text, private document text, bytes or identity. */
public record ChatImageEvidence(String group, String brand, String brandName,
        List<String> matchedSlugs, List<Choice> choices, UUID clarificationId) {
    public ChatImageEvidence {
        matchedSlugs = matchedSlugs == null ? List.of() : List.copyOf(matchedSlugs).stream().limit(3).toList();
        choices = choices == null ? List.of() : List.copyOf(choices).stream().limit(3).toList();
    }
    public ChatImageEvidence(String group, String brand, String brandName, List<String> matchedSlugs) {
        this(group, brand, brandName, matchedSlugs, List.of(), null);
    }
    public boolean ambiguous() { return choices.size() > 1; }
    public boolean hasScope() { return group != null || brandName != null; }
    public ChatClarificationResponse clarification(String lang) {
        if (!ambiguous() || clarificationId == null) return null;
        return new ChatClarificationResponse(clarificationId, "IMAGE", choices.stream()
                .map(choice -> new ChatClarificationOptionResponse("image-" + choice.position(),
                        ("en".equals(lang) ? "Image " : "Ảnh ") + choice.position(), null, "FILTER"))
                .toList());
    }
    public ChatImageEvidence select(String option) {
        return choices.stream().filter(choice -> ("image-" + choice.position()).equals(option))
                .map(choice -> new ChatImageEvidence(choice.group(), choice.brand(), choice.brandName(), choice.matchedSlugs()))
                .findFirst().orElse(this);
    }
    public record Choice(int position, String group, String brand, String brandName, List<String> matchedSlugs) {}
}
