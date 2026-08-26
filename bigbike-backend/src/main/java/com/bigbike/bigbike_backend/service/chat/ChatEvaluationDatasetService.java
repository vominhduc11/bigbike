package com.bigbike.bigbike_backend.service.chat;

import tools.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ChatEvaluationDatasetService {

    private static final List<String> RESOURCES = List.of(
            "chat-evaluations/phase4-acceptance-v1.json");

    private final ObjectMapper objectMapper;

    public List<Dataset> datasets() {
        return RESOURCES.stream().map(this::read).toList();
    }

    public Dataset require(String version) {
        return datasets().stream()
                .filter(item -> item.version().equals(version))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown evaluation dataset"));
    }

    private Dataset read(String resourcePath) {
        try (InputStream stream = new ClassPathResource(resourcePath).getInputStream()) {
            byte[] bytes = stream.readAllBytes();
            DatasetFile source = objectMapper.readValue(bytes, DatasetFile.class);
            List<String> coverage = new ArrayList<>();
            if (source.coverageRanges() != null) {
                for (CoverageRange range : source.coverageRanges()) {
                    for (int number = range.from(); number <= range.to(); number++) {
                        coverage.add("PHASE" + range.phase() + "-" + String.format("%02d", number));
                    }
                }
            }
            String checksum = HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(bytes));
            return new Dataset(
                    source.version(), source.descriptionVi(), source.descriptionEn(),
                    source.sourceSummary(), Math.max(0, source.realConversationCaseCount()),
                    checksum, source.cases() == null ? List.of() : List.copyOf(source.cases()),
                    List.copyOf(coverage));
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot load evaluation dataset " + resourcePath, exception);
        }
    }

    public String draftFromQuestions(List<String> rawQuestions) {
        try {
            List<java.util.Map<String, Object>> cases = new ArrayList<>();
            int index = 1;
            for (String raw : rawQuestions == null ? List.<String>of() : rawQuestions) {
                String sanitized = ChatHistorySanitizer.sanitize(raw == null ? "" : raw).trim();
                if (sanitized.isBlank()) continue;
                java.util.Map<String, Object> item = new java.util.LinkedHashMap<>();
                item.put("id", "REAL_DRAFT_" + String.format("%03d", index++));
                item.put("verificationStatus", "DRAFT_REQUIRES_HUMAN_VERIFICATION");
                item.put("locale", inferLocale(sanitized));
                item.put("topic", inferTopic(sanitized));
                item.put("question", sanitized);
                item.put("sourceClass", "REAL_CONVERSATION_SANITIZED");
                item.put("requiredTools", List.of());
                item.put("expectedOffTopic", false);
                item.put("expectedHandoff", false);
                item.put("requireProducts", false);
                item.put("expectedNumbers", List.of());
                item.put("expectedAnswerTerms", List.of());
                item.put("expectedProductSlugs", List.of());
                item.put("forbiddenTerms", List.of());
                item.put("verifiedGroundTruth", "");
                cases.add(item);
            }
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(
                    java.util.Map.of(
                            "notice", "PII đã che tự động; owner vẫn phải kiểm tra và điền đáp án đúng từ dữ liệu thật trước khi chạy.",
                            "requiredTopics", List.of(
                                    "CATALOG", "PRODUCT_DETAIL", "SIZE", "POLICY", "ORDER",
                                    "AMBIGUOUS", "OUT_OF_SCOPE", "OTHER"),
                            "cases", cases));
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot create sanitized evaluation draft", exception);
        }
    }

    private static String inferLocale(String question) {
        String normalized = ChatToolService.normalize(question);
        return normalized.matches(".*\\b(what|which|show|find|order|return|warranty|size|price|help)\\b.*")
                ? "en" : "vi";
    }

    private static String inferTopic(String question) {
        String value = ChatToolService.normalize(question);
        if (containsAny(value, "size", "kich co", "vong dau", "co vua")) return "SIZE";
        if (containsAny(value, "bao hanh", "doi tra", "chinh sach", "warranty", "return policy")) {
            return "POLICY";
        }
        if (containsAny(value, "don hang", "ma don", "tra don", "order", "tracking")) return "ORDER";
        if (containsAny(value, "chi tiet", "thong so", "chat lieu", "product detail", "specification")) {
            return "PRODUCT_DETAIL";
        }
        if (containsAny(value, "gia", "trieu", "thuong hieu", "hang nao", "loai nao",
                "price", "budget", "brand", "show me", "find me")) return "CATALOG";
        if (containsAny(value, "bai luan", "lich su the gioi", "du bao thoi tiet",
                "school essay", "world history", "weather forecast")) return "OUT_OF_SCOPE";
        if (value.length() < 32 || containsAny(value, "cai nao", "mau nao", "on khong", "which one")) {
            return "AMBIGUOUS";
        }
        return "OTHER";
    }

    private static boolean containsAny(String value, String... needles) {
        for (String needle : needles) if (value.contains(needle)) return true;
        return false;
    }

    public record Dataset(
            String version,
            String descriptionVi,
            String descriptionEn,
            String sourceSummary,
            int realConversationCaseCount,
            String checksum,
            List<EvaluationCase> cases,
            List<String> acceptanceCoverage
    ) {}

    public record EvaluationCase(
            String id,
            String locale,
            String question,
            String sourceClass,
            String verificationStatus,
            List<String> requiredTools,
            boolean expectedOffTopic,
            boolean expectedHandoff,
            boolean requireProducts,
            List<String> expectedNumbers,
            List<String> expectedAnswerTerms,
            List<String> expectedProductSlugs,
            List<String> forbiddenTerms,
            String verifiedGroundTruth
    ) {
        public EvaluationCase {
            locale = "en".equals(locale) ? "en" : "vi";
            verificationStatus = verificationStatus == null || verificationStatus.isBlank()
                    ? ("CANONICAL_ACCEPTANCE".equals(sourceClass)
                            ? "VERIFIED_CANONICAL" : "DRAFT_REQUIRES_HUMAN_VERIFICATION")
                    : verificationStatus.trim();
            requiredTools = requiredTools == null ? List.of() : List.copyOf(requiredTools);
            expectedNumbers = expectedNumbers == null ? List.of() : List.copyOf(expectedNumbers);
            expectedAnswerTerms = expectedAnswerTerms == null
                    ? List.of() : List.copyOf(expectedAnswerTerms);
            expectedProductSlugs = expectedProductSlugs == null
                    ? List.of() : List.copyOf(expectedProductSlugs);
            forbiddenTerms = forbiddenTerms == null ? List.of() : List.copyOf(forbiddenTerms);
            verifiedGroundTruth = verifiedGroundTruth == null ? "" : verifiedGroundTruth.trim();
        }

        public EvaluationCase(
                String id,
                String locale,
                String question,
                String sourceClass,
                List<String> requiredTools,
                boolean expectedOffTopic,
                boolean expectedHandoff,
                boolean requireProducts,
                List<String> expectedNumbers,
                List<String> forbiddenTerms
        ) {
            this(id, locale, question, sourceClass, null, requiredTools, expectedOffTopic,
                    expectedHandoff, requireProducts, expectedNumbers, List.of(), List.of(),
                    forbiddenTerms, "");
        }

        public boolean verified() {
            return "VERIFIED_CANONICAL".equals(verificationStatus)
                    || "VERIFIED_BY_OWNER".equals(verificationStatus);
        }
    }

    private record DatasetFile(
            String version,
            String descriptionVi,
            String descriptionEn,
            String sourceSummary,
            int realConversationCaseCount,
            List<CoverageRange> coverageRanges,
            List<EvaluationCase> cases
    ) {}

    private record CoverageRange(int phase, int from, int to) {}
}
