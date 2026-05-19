package com.bigbike.bigbike_backend.domain.catalog;

/**
 * A single product FAQ entry — question/answer pair rendered in the PDP FAQ section.
 *
 * <p>{@code question}/{@code answer} carry the resolved content for the requested
 * locale. The {@code *En} fields carry the raw English values and are populated
 * only on admin reads; they are {@code null} on public reads.
 */
public record ProductFaq(
        String question,
        String answer,
        String questionEn,
        String answerEn
) {
}
