package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.ManualFieldOverride;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.ProductInference;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.ProductInferencePlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.Snapshot;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetBrand;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Applies only the controlled inference rules explicitly approved by the owner. */
final class LiveProductInferencePlanner {

    private static final Pattern MODEL_TOKEN = Pattern.compile(
            "(?iu)(?<![\\p{L}\\p{N}])([a-z0-9]+(?:[-/][a-z0-9]+)*)(?![\\p{L}\\p{N}])");
    private static final Pattern LETTER = Pattern.compile(".*[A-Za-z].*");
    private static final Pattern DIGIT = Pattern.compile(".*[0-9].*");

    private final ProductInference policy;
    private final LiveWordPressSnapshotReader.Snapshot source;
    private final Snapshot target;
    private final Map<String, TargetBrand> brandsBySlug;
    private final Map<String, String> brandTokenToSlug;
    private final Map<String, ManualFieldOverride> manualOverrides;
    private final Set<String> ignoredSkuTokens;
    private final Map<Long, Set<String>> modelCandidatesByProduct;
    private final Map<String, Integer> sourceSkuOccurrences;
    private final Map<String, Integer> targetSkuOccurrences;

    LiveProductInferencePlanner(
            ProductInference policy,
            LiveWordPressSnapshotReader.Snapshot source,
            Snapshot target,
            Collection<WpPost> selectedProducts) {
        this.policy = policy;
        this.source = source;
        this.target = target;
        String fallbackSlug = LiveMigrationPreflightService.normalizeSlug(policy.brandFallbackSlug());
        this.brandsBySlug = target.brands().stream()
                .filter(brand -> brand.visible()
                        || java.util.Objects.equals(
                                fallbackSlug,
                                LiveMigrationPreflightService.normalizeSlug(brand.slug())))
                .filter(brand -> LiveMigrationPreflightService.normalizeSlug(brand.slug()) != null)
                .collect(Collectors.toMap(
                        brand -> LiveMigrationPreflightService.normalizeSlug(brand.slug()),
                        Function.identity(), (a, b) -> a, LinkedHashMap::new));
        this.brandTokenToSlug = buildBrandTokens();
        this.manualOverrides = safe(policy.manualFieldOverrides()).stream()
                .collect(Collectors.toMap(
                        value -> overrideKey(value.sourceId(), value.field()), Function.identity(),
                        (a, b) -> {
                            throw new IllegalArgumentException(
                                    "Duplicate manual inference override for " + overrideKey(a.sourceId(), a.field()));
                        }, LinkedHashMap::new));
        LinkedHashSet<String> ignoredTokens = safe(policy.skuIgnoredTokens()).stream()
                .map(LiveMigrationPreflightService::normalizeSku)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        brandTokenToSlug.keySet().stream()
                .map(LiveMigrationPreflightService::normalizeSku)
                .filter(java.util.Objects::nonNull)
                .forEach(ignoredTokens::add);
        this.ignoredSkuTokens = Set.copyOf(ignoredTokens);
        this.modelCandidatesByProduct = new LinkedHashMap<>();
        for (WpPost post : selectedProducts) {
            modelCandidatesByProduct.put(post.id(), modelCandidates(post.postTitle()));
        }
        this.sourceSkuOccurrences = sourceSkuOccurrences(selectedProducts);
        this.targetSkuOccurrences = targetSkuOccurrences(target);
    }

    Result infer(
            WpPost post,
            String directSku,
            List<String> sourceBrandSlugs,
            List<String> directlyMappedBrandSlugs,
            String directGender,
            List<String> sourceGenderSlugs,
            List<String> sourceCategorySlugs) {
        List<ProductInferencePlan> plans = new ArrayList<>();
        List<String> manualFields = new ArrayList<>();

        String sku = trimToNull(directSku);
        if (sku == null) {
            FieldResult result = inferSku(post);
            plans.add(result.plan());
            sku = result.value();
            if (result.manualReview()) manualFields.add("sku");
        }

        String brandSlug = directlyMappedBrandSlugs.size() == 1
                ? directlyMappedBrandSlugs.get(0) : null;
        if (brandSlug == null) {
            FieldResult result = inferBrand(post, sourceBrandSlugs, sourceCategorySlugs);
            plans.add(result.plan());
            brandSlug = result.value();
            if (result.manualReview()) manualFields.add("brandId");
        }

        String gender = trimToNull(directGender);
        if (gender == null) {
            FieldResult result = inferGender(post, sourceCategorySlugs, sourceGenderSlugs);
            plans.add(result.plan());
            gender = result.value();
            if (result.manualReview()) manualFields.add("gender");
        }

        return new Result(sku, brandSlug, gender, List.copyOf(plans), List.copyOf(manualFields));
    }

    private FieldResult inferSku(WpPost post) {
        ManualFieldOverride manual = manualOverride(post.id(), "sku");
        if (manual != null) return manualOverrideResult(post, manual, true);

        List<String> candidates = modelCandidatesByProduct.getOrDefault(post.id(), Set.of()).stream()
                .sorted().toList();
        List<String> unique = candidates.stream().filter(candidate ->
                sourceSkuOccurrences.getOrDefault(candidate, 0) == 1
                        && targetSkuOccurrences.getOrDefault(candidate, 0) == 0).toList();
        if (candidates.size() == 1 && unique.size() == 1) {
            String value = unique.get(0);
            String uniqueness = uniqueness(value);
            return applied(post.id(), "sku", post.postTitle(), value,
                    "Title contains exactly one clear model-code candidate: " + value,
                    policy.skuRuleId(), "HIGH", uniqueness, false);
        }
        String evidence = candidates.isEmpty()
                ? "Title has no clear model-code candidate"
                : "Title model-code candidates are not unique/safe: " + candidates;
        String uniqueness = candidates.stream().map(this::uniqueness)
                .collect(Collectors.joining("; "));
        return manual(post.id(), "sku", post.postTitle(), evidence,
                policy.skuRuleId(), uniqueness);
    }

    private FieldResult inferBrand(
            WpPost post, List<String> sourceBrandSlugs, List<String> sourceCategorySlugs) {
        ManualFieldOverride manual = manualOverride(post.id(), "brandId");
        if (manual != null) return manualOverrideResult(post, manual, false);

        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        String titleToken = slugToken(post.postTitle());
        for (Map.Entry<String, String> entry : brandTokenToSlug.entrySet()) {
            String token = entry.getKey();
            if (containsSlugToken(titleToken, token)
                    || safe(sourceBrandSlugs).stream().map(LiveProductInferencePlanner::slugToken)
                            .anyMatch(token::equals)
                    || safe(sourceCategorySlugs).stream().map(LiveProductInferencePlanner::slugToken)
                            .anyMatch(token::equals)) {
                candidates.add(entry.getValue());
            }
        }
        List<String> orderedCandidates = candidates.stream().sorted().toList();
        if (orderedCandidates.size() == 1) {
            String value = orderedCandidates.get(0);
            return applied(post.id(), "brandId", post.postTitle(), value,
                    "Exactly one normalized target brand token matched; sourceBrands="
                            + safe(sourceBrandSlugs) + ", sourceCategories="
                            + safe(sourceCategorySlugs) + ", matchedTarget=" + value,
                    policy.brandRuleId(), "HIGH", "targetBrandMatches=1", false);
        }

        String fallback = LiveMigrationPreflightService.normalizeSlug(policy.brandFallbackSlug());
        if (fallback != null && brandsBySlug.containsKey(fallback)) {
            String evidence = orderedCandidates.isEmpty()
                    ? "No exact normalized brand token matched; sourceBrands="
                            + safe(sourceBrandSlugs) + ", sourceCategories="
                            + safe(sourceCategorySlugs)
                    : "Multiple target brands matched; candidates=" + orderedCandidates
                            + ", sourceBrands=" + safe(sourceBrandSlugs)
                            + ", sourceCategories=" + safe(sourceCategorySlugs);
            ProductInferencePlan plan = new ProductInferencePlan(
                    post.id(), "brandId", post.postTitle(), fallback, evidence,
                    policy.brandRuleId(), "LOW", "fallbackTargetMatches=1",
                    "FALLBACK_APPLIED", true);
            return new FieldResult(fallback, plan, false);
        }
        return manual(post.id(), "brandId", post.postTitle(),
                "Brand fallback is not uniquely present in target; sourceBrands="
                        + safe(sourceBrandSlugs) + ", sourceCategories="
                        + safe(sourceCategorySlugs),
                policy.brandRuleId(), "fallbackTargetMatches=0");
    }

    private FieldResult inferGender(
            WpPost post,
            List<String> sourceCategorySlugs,
            List<String> sourceGenderSlugs) {
        ManualFieldOverride manual = manualOverride(post.id(), "gender");
        if (manual != null) return manualOverrideResult(post, manual, false);

        if (!safe(sourceGenderSlugs).isEmpty()) {
            boolean allKnown = sourceGenderSlugs.stream().allMatch(slug -> {
                String normalized = LiveMigrationPreflightService.normalizeSlug(slug);
                return LiveMigrationPreflightService.mapDirectGender(normalized) != null
                        || "unisex".equals(normalized);
            });
            if (allKnown) {
                return applied(post.id(), "gender", String.join(",", sourceGenderSlugs), null,
                        "Structured source gender is a legacy neutral or combined value; resolved gender=NULL",
                        policy.genderTokenRuleId(), "MEDIUM", null, false);
            }
            return manual(post.id(), "gender", String.join(",", sourceGenderSlugs),
                    "Structured source gender exists but has no unique direct target mapping: "
                            + sourceGenderSlugs,
                    policy.genderTokenRuleId(), null);
        }

        Set<String> tokens = wordTokens(post.postTitle());
        boolean female = intersects(tokens, policy.femaleTokens());
        boolean male = intersects(tokens, policy.maleTokens());
        boolean unisex = intersects(tokens, policy.unisexTokens());
        int groups = (female ? 1 : 0) + (male ? 1 : 0) + (unisex ? 1 : 0);
        if (groups == 1) {
            String value = unisex ? null : female ? "Nữ" : "Nam";
            return applied(post.id(), "gender", post.postTitle(), value,
                    "Title contains one approved exact gender-token group; resolved gender=" + value
                            + "; sourceCategories=" + safe(sourceCategorySlugs),
                    policy.genderTokenRuleId(), "HIGH", null, false);
        }
        if (groups > 1) {
            return manual(post.id(), "gender", post.postTitle(),
                    "Title contains conflicting approved gender-token groups; sourceCategories="
                            + safe(sourceCategorySlugs),
                    policy.genderTokenRuleId(), null);
        }

        Set<String> whitelist = safe(policy.unisexNeutralSourceCategorySlugs()).stream()
                .map(LiveMigrationPreflightService::normalizeSlug)
                .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        List<String> evidence = safe(sourceCategorySlugs).stream()
                .map(LiveMigrationPreflightService::normalizeSlug)
                .filter(whitelist::contains).distinct().toList();
        if (!evidence.isEmpty()) {
            return applied(post.id(), "gender", post.postTitle(), null,
                    "Source category is in the exact neutral equipment/accessory whitelist: "
                            + evidence + "; allSourceCategories=" + safe(sourceCategorySlugs),
                    policy.neutralCategoryRuleId(), "MEDIUM", null, false);
        }
        return manual(post.id(), "gender", post.postTitle(),
                "No structured gender, approved exact title token, or exact neutral-category whitelist match; "
                        + "sourceCategories=" + safe(sourceCategorySlugs),
                policy.genderTokenRuleId(), null);
    }

    private FieldResult manualOverrideResult(
            WpPost post, ManualFieldOverride override, boolean requireSkuUniqueness) {
        String value = trimToNull(override.value());
        String uniqueness = null;
        if (requireSkuUniqueness && value != null) {
            String normalized = LiveMigrationPreflightService.normalizeSku(value);
            uniqueness = uniqueness(normalized);
            if (sourceSkuOccurrences.getOrDefault(normalized, 0) != 1
                    || targetSkuOccurrences.getOrDefault(normalized, 0) != 0) {
                return manual(post.id(), override.field(), post.postTitle(),
                        "Owner SKU override không đạt uniqueness gate: " + override.evidence(),
                        override.ruleId(), uniqueness);
            }
        }
        if (value == null) {
            if ("gender".equals(override.field())) {
                return applied(post.id(), override.field(), post.postTitle(), null,
                        override.evidence(), override.ruleId(), override.confidence(), uniqueness, false);
            }
            return manual(post.id(), override.field(), post.postTitle(),
                    "Owner manual override không có value", override.ruleId(), uniqueness);
        }
        return applied(post.id(), override.field(), post.postTitle(), value, override.evidence(),
                override.ruleId(), override.confidence(), uniqueness, false);
    }

    private FieldResult applied(
            long sourceId, String field, String sourceValue, String value,
            String evidence, String ruleId, String confidence, String uniqueness,
            boolean followUp) {
        return new FieldResult(value, new ProductInferencePlan(
                sourceId, field, sourceValue, value, evidence, ruleId, confidence,
                uniqueness, "APPLIED", followUp), false);
    }

    private FieldResult manual(
            long sourceId, String field, String sourceValue, String evidence,
            String ruleId, String uniqueness) {
        return new FieldResult(null, new ProductInferencePlan(
                sourceId, field, sourceValue, null, evidence, ruleId, "UNRESOLVED",
                uniqueness, "MANUAL_REVIEW", true), true);
    }

    private Map<String, String> buildBrandTokens() {
        Map<String, String> tokens = new LinkedHashMap<>();
        for (TargetBrand brand : brandsBySlug.values()) {
            addUniqueBrandToken(tokens, slugToken(brand.slug()), brand.slug());
            addUniqueBrandToken(tokens, slugToken(brand.name()), brand.slug());
        }
        if (policy.brandAliases() != null) {
            policy.brandAliases().forEach((alias, targetSlug) -> {
                String normalizedTarget = LiveMigrationPreflightService.normalizeSlug(targetSlug);
                if (normalizedTarget == null || !brandsBySlug.containsKey(normalizedTarget)) {
                    throw new IllegalArgumentException("Brand alias points to an unknown target: " + targetSlug);
                }
                addUniqueBrandToken(tokens, slugToken(alias), normalizedTarget);
            });
        }
        return Map.copyOf(tokens);
    }

    private void addUniqueBrandToken(Map<String, String> tokens, String token, String targetSlug) {
        if (token == null || token.isBlank() || "uncategorized-brand".equals(token)) return;
        String previous = tokens.putIfAbsent(token, targetSlug);
        if (previous != null && !previous.equals(targetSlug)) {
            tokens.remove(token); // Ambiguous tokens are intentionally unusable.
        }
    }

    private Map<String, Integer> sourceSkuOccurrences(Collection<WpPost> selectedProducts) {
        Map<String, Set<Long>> idsBySku = new HashMap<>();
        for (WpPost post : source.postsOfType("product")) {
            String direct = LiveMigrationPreflightService.normalizeSku(source.meta(post.id()).get("_sku"));
            if (direct != null) idsBySku.computeIfAbsent(direct, ignored -> new LinkedHashSet<>()).add(post.id());
        }
        for (WpPost post : source.postsOfType("product_variation")) {
            String direct = LiveMigrationPreflightService.normalizeSku(source.meta(post.id()).get("_sku"));
            if (direct != null) idsBySku.computeIfAbsent(direct, ignored -> new LinkedHashSet<>()).add(post.id());
        }
        for (WpPost post : selectedProducts) {
            for (String candidate : modelCandidatesByProduct.getOrDefault(post.id(), Set.of())) {
                idsBySku.computeIfAbsent(candidate, ignored -> new LinkedHashSet<>()).add(post.id());
            }
        }
        Map<String, Integer> result = new HashMap<>();
        idsBySku.forEach((sku, ids) -> result.put(sku, ids.size()));
        return Map.copyOf(result);
    }

    private Map<String, Integer> targetSkuOccurrences(Snapshot target) {
        Map<String, Integer> result = new HashMap<>();
        target.products().forEach(product -> increment(result,
                LiveMigrationPreflightService.normalizeSku(product.sku())));
        target.variants().forEach(variant -> increment(result,
                LiveMigrationPreflightService.normalizeSku(variant.sku())));
        return Map.copyOf(result);
    }

    private void increment(Map<String, Integer> result, String key) {
        if (key != null) result.merge(key, 1, Integer::sum);
    }

    private Set<String> modelCandidates(String title) {
        if (title == null || title.isBlank()) return Set.of();
        List<RawToken> rawTokens = rawTokens(title);
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (int i = 0; i < rawTokens.size(); i++) {
            RawToken raw = rawTokens.get(i);
            addModelCandidate(result, raw.value());
            if (containsLetterAndDigit(raw.value()) && i + 1 < rawTokens.size()) {
                RawToken next = rawTokens.get(i + 1);
                if (next.original().matches("[A-Z]{1,4}")) {
                    addModelCandidate(result, raw.value() + "-" + next.value());
                    result.remove(LiveMigrationPreflightService.normalizeSku(raw.value()));
                }
            }
            if (i + 1 < rawTokens.size()
                    && raw.original().matches("[A-Z]{1,5}")
                    && rawTokens.get(i + 1).original().matches("[0-9]{2,6}[A-Z]?") ) {
                addModelCandidate(result, raw.value() + "-" + rawTokens.get(i + 1).value());
            }
        }
        return Set.copyOf(result);
    }

    private List<RawToken> rawTokens(String title) {
        List<RawToken> result = new ArrayList<>();
        Matcher matcher = MODEL_TOKEN.matcher(title);
        while (matcher.find()) {
            String original = matcher.group(1);
            result.add(new RawToken(original.toUpperCase(Locale.ROOT), original));
        }
        return result;
    }

    private void addModelCandidate(Set<String> result, String raw) {
        String normalized = LiveMigrationPreflightService.normalizeSku(raw);
        if (normalized == null || normalized.length() < 3 || normalized.length() > 32
                || ignoredSkuTokens.contains(normalized) || !containsLetterAndDigit(normalized)) return;
        result.add(normalized);
    }

    private boolean containsLetterAndDigit(String value) {
        return value != null && LETTER.matcher(value).matches() && DIGIT.matcher(value).matches();
    }

    private String uniqueness(String normalizedSku) {
        if (normalizedSku == null) return "candidate=null";
        return "sourceNormalizedOccurrences=" + sourceSkuOccurrences.getOrDefault(normalizedSku, 0)
                + ",targetNormalizedOccurrences=" + targetSkuOccurrences.getOrDefault(normalizedSku, 0);
    }

    private ManualFieldOverride manualOverride(long sourceId, String field) {
        return manualOverrides.get(overrideKey(sourceId, field));
    }

    private static String overrideKey(long sourceId, String field) {
        return sourceId + ":" + (field == null ? "" : field.trim());
    }

    private static boolean intersects(Set<String> titleTokens, List<String> approvedTokens) {
        for (String token : safe(approvedTokens)) {
            if (titleTokens.contains(wordToken(token))) return true;
        }
        return false;
    }

    private static Set<String> wordTokens(String value) {
        String normalized = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFC)
                .toLowerCase(Locale.ROOT);
        Set<String> result = new LinkedHashSet<>();
        for (String token : normalized.split("[^\\p{L}\\p{N}]+")) {
            if (!token.isBlank()) result.add(token);
        }
        return Set.copyOf(result);
    }

    private static String wordToken(String value) {
        return Normalizer.normalize(value == null ? "" : value.trim(), Normalizer.Form.NFC)
                .toLowerCase(Locale.ROOT);
    }

    private static String slugToken(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replace('đ', 'd')
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return normalized.isBlank() ? null : normalized;
    }

    private static boolean containsSlugToken(String text, String token) {
        return text != null && token != null && ("-" + text + "-").contains("-" + token + "-");
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static <T> List<T> safe(List<T> values) {
        return values == null ? List.of() : values;
    }

    record Result(
            String sku,
            String brandSlug,
            String gender,
            List<ProductInferencePlan> plans,
            List<String> manualFields) {}

    private record FieldResult(String value, ProductInferencePlan plan, boolean manualReview) {}
    private record RawToken(String value, String original) {}
}
