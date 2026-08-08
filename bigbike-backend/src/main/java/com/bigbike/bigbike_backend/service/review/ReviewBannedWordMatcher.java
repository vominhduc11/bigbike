package com.bigbike.bigbike_backend.service.review;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Local banned-word layer (REVIEW_RULE_013). Runs before the AI so an obvious hit costs
 * nothing and needs no network.
 *
 * <p>Matching is deliberately narrow: normalise away Vietnamese diacritics and characters
 * inserted to dodge a filter, then compare <em>whole words</em>. Substring matching would
 * make a two-letter entry like {@code dm} block "admin", so a token must equal the term
 * rather than merely contain it. Multi-word terms match a consecutive run of tokens.
 */
public final class ReviewBannedWordMatcher {

    /** Below two characters a term matches so much ordinary text it is not usable. */
    private static final int MIN_TERM_LENGTH = 2;

    /** Bound on how much work one review can trigger, whatever the shop pastes in. */
    private static final int MAX_TERMS = 500;

    private static final Pattern TERM_SEPARATOR = Pattern.compile("[,\\n\\r;]+");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final Pattern COMBINING_MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^\\p{L}\\p{N}]+");

    private final List<List<String>> terms;
    private final List<String> displayTerms;

    private ReviewBannedWordMatcher(List<List<String>> terms, List<String> displayTerms) {
        this.terms = terms;
        this.displayTerms = displayTerms;
    }

    /**
     * Builds a matcher from the raw settings value (comma- or newline-separated). Blank,
     * too-short and duplicate entries are dropped; the list is capped at {@value #MAX_TERMS}.
     */
    public static ReviewBannedWordMatcher fromSettingValue(String rawValue) {
        List<List<String>> parsed = new ArrayList<>();
        List<String> display = new ArrayList<>();
        if (rawValue == null || rawValue.isBlank()) {
            return new ReviewBannedWordMatcher(List.of(), List.of());
        }

        for (String candidate : TERM_SEPARATOR.split(rawValue)) {
            String trimmed = candidate.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            List<String> tokens = tokenize(trimmed);
            if (tokens.isEmpty()) {
                continue;
            }
            // Length is judged on the normalised form so "đ.m" counts as the 2-char "dm".
            int normalizedLength = tokens.stream().mapToInt(String::length).sum();
            if (normalizedLength < MIN_TERM_LENGTH || parsed.contains(tokens)) {
                continue;
            }
            parsed.add(tokens);
            display.add(trimmed);
            if (parsed.size() >= MAX_TERMS) {
                break;
            }
        }
        return new ReviewBannedWordMatcher(List.copyOf(parsed), List.copyOf(display));
    }

    public boolean isEmpty() {
        return terms.isEmpty();
    }

    /**
     * @return the original spelling of the first banned term found in {@code text}, or empty
     *         when the text is clean. Returning the shop's own spelling (not the normalised
     *         form) keeps the admin-facing reason recognisable.
     */
    public Optional<String> firstMatch(String text) {
        if (terms.isEmpty() || text == null || text.isBlank()) {
            return Optional.empty();
        }
        List<String> tokens = tokenize(text);
        if (tokens.isEmpty()) {
            return Optional.empty();
        }
        for (int termIndex = 0; termIndex < terms.size(); termIndex++) {
            if (containsSequence(tokens, terms.get(termIndex))) {
                return Optional.of(displayTerms.get(termIndex));
            }
        }
        return Optional.empty();
    }

    private static boolean containsSequence(List<String> tokens, List<String> term) {
        if (term.size() > tokens.size()) {
            return false;
        }
        for (int start = 0; start <= tokens.size() - term.size(); start++) {
            boolean matched = true;
            for (int offset = 0; offset < term.size(); offset++) {
                if (!tokens.get(start + offset).equals(term.get(offset))) {
                    matched = false;
                    break;
                }
            }
            if (matched) {
                return true;
            }
        }
        return false;
    }

    /**
     * Splits on whitespace only, then strips punctuation <em>inside</em> each token. Splitting
     * on punctuation instead would turn "đ.m" into two tokens and lose the evasion; stripping
     * it inside the token collapses "đ.m", "d-m" and "đm" onto the same "dm".
     */
    private static List<String> tokenize(String value) {
        List<String> tokens = new ArrayList<>();
        for (String rawToken : WHITESPACE.split(value.trim())) {
            String normalized = normalize(rawToken);
            if (!normalized.isEmpty()) {
                tokens.add(normalized);
            }
        }
        return tokens;
    }

    private static String normalize(String value) {
        String lowered = value.toLowerCase(Locale.ROOT);
        // NFD splits most Vietnamese vowels into base letter + combining mark, but leaves
        // "đ" intact because it is a distinct letter rather than a decorated "d".
        String decomposed = Normalizer.normalize(lowered, Normalizer.Form.NFD);
        String withoutMarks = COMBINING_MARKS.matcher(decomposed).replaceAll("");
        String withoutStroke = withoutMarks.replace('đ', 'd');
        return NON_ALPHANUMERIC.matcher(withoutStroke).replaceAll("");
    }
}
