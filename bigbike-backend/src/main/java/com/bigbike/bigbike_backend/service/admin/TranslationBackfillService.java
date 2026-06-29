package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.TranslationBackfillResponse;
import com.bigbike.bigbike_backend.api.admin.dto.TranslationBackfillResponse.FieldPreview;
import com.bigbike.bigbike_backend.api.admin.dto.TranslationBackfillResponse.Sample;
import com.bigbike.bigbike_backend.api.admin.dto.TranslationBackfillResponse.TypeResult;
import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.persistence.converter.DescriptionBlocksConverter;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductCommitmentEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductFaqEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductHighlightEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSpecStatEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSpecificationEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductTrustBadgeEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.service.integration.GeminiTranslationService;
import com.bigbike.bigbike_backend.service.integration.GeminiTranslationService.GenerationOptions;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;
import org.springframework.stereotype.Service;

/**
 * One-time operational VI→EN backfill (Phase 2). Reuses {@link GeminiTranslationService} to fill the
 * English ({@code *_en}) columns of every product / category / brand / article that has Vietnamese
 * content but a blank English target in ANY translatable field, so the storefront's per-field VI
 * fallback can later be removed (Phase 3 — out of scope here).
 *
 * <p>Design guarantees:
 * <ul>
 *   <li><b>Never touches Vietnamese.</b> Only {@code *_en} columns / {@code description_blocks_en} are written.</li>
 *   <li><b>Fill-if-empty.</b> A field is translated only when its English target is blank, so existing
 *       English (manual or earlier backfill) is never clobbered.</li>
 *   <li><b>Field-level selection.</b> A record is a candidate while ANY field this tool fills still has
 *       a blank {@code _en} over non-blank Vietnamese — not merely an empty anchor ({@code name_en}/
 *       {@code title_en}). This re-picks anchor-done records whose sub-fields a prior pass left blank,
 *       so the backlog can actually reach field-level zero (see {@link #whereClause}).</li>
 *   <li><b>Idempotent / resumable.</b> A fully-translated record is skipped; a record whose Gemini call
 *       fails (or stays incomplete) is left untouched and re-tried on the next run.</li>
 *   <li><b>No slug, no overrides.</b> {@code slug_en} is left null (avoids unique-constraint clashes,
 *       PRODUCT_RULE_003) and {@code en_overrides} stays NULL (pure machine output, nothing locked).</li>
 * </ul>
 *
 * <p>Field set mirrors the admin auto-translate (admin {@code src/lib/geminiTranslate.js}) plus spec
 * {@code group_name}. {@code promotion_content} / {@code installation_guide} are NOT translated (and are
 * deliberately excluded from selection so a record is never re-picked for a field this tool cannot fill).
 * See {@code API_CONTRACT.md} §"VI→EN backfill".
 */
@Service
@Slf4j
public class TranslationBackfillService {

    private static final long PAUSE_BETWEEN_RECORDS_MS = 200L;
    private static final int PREVIEW_MAX_CHARS = 220;
    // Gemini occasionally stops early on long HTML (non-deterministic), yielding a valid-JSON but
    // INCOMPLETE translation. Retry a record up to this many times until the output looks complete.
    private static final int MAX_TRANSLATE_ATTEMPTS = 4;
    // A substantial HTML field's output must keep >= this fraction of the source HTML tags, else the
    // translation is deemed truncated. Complete runs measure 0.98–1.00; truncated ones ~0.50.
    private static final double MIN_TAG_RATIO = 0.80;
    private static final int TAG_CHECK_MIN = 15;     // only check fields with >= this many '<'
    private static final int LEN_CHECK_MIN = 400;    // long plain-text fields checked by length
    private static final double MIN_LEN_RATIO = 0.45;
    // Long article bodies (up to ~36k chars) must not truncate; thinking disabled frees the budget.
    // structuredStringSchema=true forces valid escaped JSON (quote-heavy HTML otherwise breaks parsing).
    private static final GenerationOptions BACKFILL_OPTS = new GenerationOptions(65536, 0, true);

    private final GeminiTranslationService gemini;
    private final TransactionTemplate txWrite;
    private final TransactionTemplate txRead;
    private final DescriptionBlocksConverter blocksCodec = new DescriptionBlocksConverter();
    private final ObjectMapper json = new ObjectMapper();

    @PersistenceContext
    private EntityManager em;

    public TranslationBackfillService(GeminiTranslationService gemini, PlatformTransactionManager txManager) {
        this.gemini = gemini;
        this.txWrite = new TransactionTemplate(txManager);
        this.txRead = new TransactionTemplate(txManager);
        this.txRead.setReadOnly(true);
    }

    private static final List<String> ALL_TYPES = List.of("product", "category", "brand", "article");

    public TranslationBackfillResponse run(String type, boolean dryRun, int limit, int sampleSize,
                                           boolean includeTrashed) {
        List<String> types = "all".equalsIgnoreCase(type)
                ? ALL_TYPES
                : List.of(type.toLowerCase());
        int safeLimit = Math.max(1, Math.min(limit, 500));
        int safeSample = Math.max(1, Math.min(sampleSize, 25));

        List<TypeResult> results = new ArrayList<>();
        for (String t : types) {
            if (!ALL_TYPES.contains(t)) {
                throw new IllegalArgumentException("Unknown type '" + t + "'. Use product|category|brand|article|all.");
            }
            results.add(processType(t, dryRun, safeLimit, safeSample, includeTrashed));
        }
        long totalTranslated = results.stream().mapToLong(TypeResult::translated).sum();
        long totalRemaining = results.stream().mapToLong(TypeResult::remainingAfter).sum();
        return new TranslationBackfillResponse(dryRun, includeTrashed, safeLimit, safeSample,
                totalTranslated, totalRemaining, results);
    }

    private TypeResult processType(String type, boolean dryRun, int limit, int sampleSize,
                                   boolean includeTrashed) {
        int candidatesTotal = countMissing(type, includeTrashed);
        if (!gemini.isEnabled()) {
            log.warn("Backfill[{}]: Gemini disabled (no server key) — nothing translated.", type);
            return new TypeResult(type, false, candidatesTotal, 0, 0, 0, candidatesTotal, List.of(), List.of());
        }

        int take = dryRun ? Math.min(sampleSize, candidatesTotal) : limit;
        List<String> ids = selectMissingIds(type, includeTrashed, take);

        int translated = 0;
        int failed = 0;
        List<String> failedIds = new ArrayList<>();
        List<Sample> samples = new ArrayList<>();

        for (String id : ids) {
            try {
                if (dryRun) {
                    Sample s = txRead.execute(status -> buildSample(type, id));
                    if (s != null) {
                        samples.add(s);
                    } else {
                        failed++;
                        failedIds.add(id);
                    }
                } else {
                    Boolean ok = txWrite.execute(status -> translateAndApply(type, id));
                    if (Boolean.TRUE.equals(ok)) {
                        translated++;
                    } else {
                        failed++;
                        failedIds.add(id);
                    }
                }
            } catch (RuntimeException e) {
                failed++;
                failedIds.add(id);
                log.error("Backfill[{}] id={} failed ({}): {}", type, id, e.getClass().getSimpleName(), e.getMessage());
            }
            pause();
        }

        int remainingAfter = dryRun ? candidatesTotal : countMissing(type, includeTrashed);
        log.info("Backfill[{}] dryRun={} processed={} translated={} failed={} remaining={}",
                type, dryRun, ids.size(), translated, failed, remainingAfter);
        return new TypeResult(type, true, candidatesTotal, ids.size(), translated, failed,
                remainingAfter, failedIds, samples);
    }

    // ── Selection (native SQL; mirrors the read-only audit queries) ──────────────────────────────

    // FIELD-LEVEL selection: a record is a candidate when ANY field this tool can fill still has a
    // blank `_en` while its Vietnamese base is non-blank — not merely when the anchor (name_en/title_en)
    // is blank. The old anchor-only selection marked a record "done" once its name/title was translated,
    // so any sub-field Gemini omitted in that one pass (a short description/seo/spec value) stayed blank
    // forever (never re-picked). The pairs below must stay a SUBSET of what build*Source() translates,
    // otherwise a record could be selected for a field the tool can never fill and loop forever.
    private String whereClause(String type, boolean includeTrashed) {
        return switch (type) {
            case "product" -> "FROM products WHERE COALESCE(TRIM(name),'')<>''"
                    + (includeTrashed ? "" : " AND publish_status <> 'TRASH'")
                    + " AND (" + String.join(" OR ",
                        gap("name_en", "name"),
                        gap("short_description_en", "short_description"),
                        gap("description_en", "description"),
                        gap("seo_title_en", "seo_title"),
                        gap("seo_description_en", "seo_description"),
                        gap("specifications_html_en", "specifications_html"),
                        gap("spec_stats_html_en", "spec_stats_html"),
                        gap("trust_badges_html_en", "trust_badges_html"),
                        gap("suitability_advisory_en", "suitability_advisory"),
                        "(jsonb_typeof(description_blocks)='array' AND jsonb_array_length(description_blocks)>0"
                          + " AND (description_blocks_en IS NULL OR jsonb_typeof(description_blocks_en)<>'array'"
                          + " OR jsonb_array_length(description_blocks_en)=0))",
                        childGap("product_specifications", "name_en", "name", "spec_value_en", "spec_value", "group_name_en", "group_name"),
                        childGap("product_spec_stats", "stat_value_en", "stat_value", "label_en", "label"),
                        childGap("product_faqs", "question_en", "question", "answer_en", "answer"),
                        childGap("product_commitments", "title_en", "title", "subtitle_en", "subtitle"),
                        childGap("product_trust_badges", "content_en", "content"),
                        childGap("product_highlights", "content_en", "content")
                    ) + ")";
            case "category" -> "FROM categories WHERE deleted IS NOT TRUE AND COALESCE(TRIM(name),'')<>'' AND ("
                    + String.join(" OR ",
                        gap("name_en", "name"),
                        gap("description_en", "description"),
                        gap("intro_content_en", "intro_content"),
                        gap("seo_title_en", "seo_title"),
                        gap("seo_description_en", "seo_description")) + ")";
            case "brand" -> "FROM brands WHERE COALESCE(TRIM(name),'')<>'' AND ("
                    + String.join(" OR ",
                        gap("name_en", "name"),
                        gap("description_en", "description"),
                        gap("seo_title_en", "seo_title"),
                        gap("seo_description_en", "seo_description")) + ")";
            case "article" -> "FROM articles WHERE COALESCE(TRIM(title),'')<>'' AND ("
                    + String.join(" OR ",
                        gap("title_en", "title"),
                        gap("excerpt_en", "excerpt"),
                        gap("body_en", "body"),
                        gap("seo_title_en", "seo_title"),
                        gap("seo_description_en", "seo_description")) + ")";
            default -> throw new IllegalArgumentException("Unknown type " + type);
        };
    }

    /** SQL predicate: this entity's `enCol` is blank while its `viCol` base is non-blank. */
    private static String gap(String enCol, String viCol) {
        return "(COALESCE(TRIM(" + enCol + "),'')='' AND COALESCE(TRIM(" + viCol + "),'')<>'')";
    }

    /** SQL predicate: a child row of the current product has any of the given (en,vi) column gaps. */
    private static String childGap(String table, String... enViPairs) {
        List<String> gaps = new ArrayList<>();
        for (int i = 0; i + 1 < enViPairs.length; i += 2) {
            gaps.add("(COALESCE(TRIM(s." + enViPairs[i] + "),'')='' AND COALESCE(TRIM(s." + enViPairs[i + 1] + "),'')<>'')");
        }
        return "EXISTS(SELECT 1 FROM " + table + " s WHERE s.product_id=products.id AND ("
                + String.join(" OR ", gaps) + "))";
    }

    private int countMissing(String type, boolean includeTrashed) {
        Object n = em.createNativeQuery("SELECT COUNT(*) " + whereClause(type, includeTrashed)).getSingleResult();
        return ((Number) n).intValue();
    }

    @SuppressWarnings("unchecked")
    private List<String> selectMissingIds(String type, boolean includeTrashed, int take) {
        if (take <= 0) {
            return List.of();
        }
        List<Object> rows = em.createNativeQuery(
                "SELECT id " + whereClause(type, includeTrashed) + " ORDER BY id LIMIT " + take).getResultList();
        List<String> ids = new ArrayList<>(rows.size());
        for (Object r : rows) {
            ids.add(String.valueOf(r));
        }
        return ids;
    }

    // ── Per-record translate + apply (write) ─────────────────────────────────────────────────────

    private boolean translateAndApply(String type, String id) {
        return switch (type) {
            case "product" -> {
                ProductEntity p = em.find(ProductEntity.class, id);
                if (p == null) yield false;
                Map<String, String> src = buildProductSource(p);
                // src is empty only when the sole remaining gap is structural with no translatable text
                // (e.g. a media-only description_blocks): apply the structural clone with empty output so
                // the record converges instead of being re-selected forever.
                Map<String, String> out;
                if (src.isEmpty()) {
                    out = Map.of();
                } else {
                    out = translateComplete(src, "name");
                    if (out == null) yield false;
                }
                applyProductResult(p, out);
                yield true;
            }
            case "category" -> {
                CategoryEntity c = em.find(CategoryEntity.class, id);
                if (c == null) yield false;
                Map<String, String> src = buildCategorySource(c);
                Map<String, String> out = translateComplete(src, "name");
                if (out == null) yield false;
                if (isBlank(c.getNameEn())) c.setNameEn(out.get("name"));
                if (out.containsKey("description")) c.setDescriptionEn(out.get("description"));
                if (out.containsKey("introContent")) c.setIntroContentEn(out.get("introContent"));
                if (out.containsKey("seoTitle")) c.setSeoTitleEn(out.get("seoTitle"));
                if (out.containsKey("seoDescription")) c.setSeoDescriptionEn(out.get("seoDescription"));
                yield true;
            }
            case "brand" -> {
                BrandEntity b = em.find(BrandEntity.class, id);
                if (b == null) yield false;
                Map<String, String> src = buildBrandSource(b);
                Map<String, String> out = translateComplete(src, "name");
                if (out == null) yield false;
                if (isBlank(b.getNameEn())) b.setNameEn(out.get("name"));
                if (out.containsKey("description")) b.setDescriptionEn(out.get("description"));
                if (out.containsKey("seoTitle")) b.setSeoTitleEn(out.get("seoTitle"));
                if (out.containsKey("seoDescription")) b.setSeoDescriptionEn(out.get("seoDescription"));
                yield true;
            }
            case "article" -> {
                ArticleEntity a = em.find(ArticleEntity.class, id);
                if (a == null) yield false;
                Map<String, String> src = buildArticleSource(a);
                Map<String, String> out = translateComplete(src, "title");
                if (out == null) yield false;
                if (isBlank(a.getTitleEn())) a.setTitleEn(out.get("title"));
                if (out.containsKey("excerpt")) a.setExcerptEn(out.get("excerpt"));
                if (out.containsKey("body")) a.setBodyEn(out.get("body"));
                if (out.containsKey("seoTitle")) a.setSeoTitleEn(out.get("seoTitle"));
                if (out.containsKey("seoDescription")) a.setSeoDescriptionEn(out.get("seoDescription"));
                yield true;
            }
            default -> false;
        };
    }

    // ── Source builders (only VI-present fields whose EN target is blank) ─────────────────────────

    private Map<String, String> buildCategorySource(CategoryEntity c) {
        Map<String, String> s = new LinkedHashMap<>();
        if (isBlank(c.getNameEn())) putIfText(s, "name", c.getName());
        if (isBlank(c.getDescriptionEn())) putIfText(s, "description", c.getDescription());
        if (isBlank(c.getIntroContentEn())) putIfText(s, "introContent", c.getIntroContent());
        if (isBlank(c.getSeoTitleEn())) putIfText(s, "seoTitle", c.getSeoTitle());
        if (isBlank(c.getSeoDescriptionEn())) putIfText(s, "seoDescription", c.getSeoDescription());
        return s;
    }

    private Map<String, String> buildBrandSource(BrandEntity b) {
        Map<String, String> s = new LinkedHashMap<>();
        if (isBlank(b.getNameEn())) putIfText(s, "name", b.getName());
        if (isBlank(b.getDescriptionEn())) putIfText(s, "description", b.getDescription());
        if (isBlank(b.getSeoTitleEn())) putIfText(s, "seoTitle", b.getSeoTitle());
        if (isBlank(b.getSeoDescriptionEn())) putIfText(s, "seoDescription", b.getSeoDescription());
        return s;
    }

    private Map<String, String> buildArticleSource(ArticleEntity a) {
        Map<String, String> s = new LinkedHashMap<>();
        if (isBlank(a.getTitleEn())) putIfText(s, "title", a.getTitle());
        if (isBlank(a.getExcerptEn())) putIfText(s, "excerpt", a.getExcerpt());
        if (isBlank(a.getBodyEn())) putIfText(s, "body", a.getBody());
        if (isBlank(a.getSeoTitleEn())) putIfText(s, "seoTitle", a.getSeoTitle());
        if (isBlank(a.getSeoDescriptionEn())) putIfText(s, "seoDescription", a.getSeoDescription());
        return s;
    }

    private Map<String, String> buildProductSource(ProductEntity p) {
        Map<String, String> s = new LinkedHashMap<>();
        if (isBlank(p.getNameEn())) putIfText(s, "name", p.getName());
        if (isBlank(p.getShortDescriptionEn())) putIfText(s, "shortDescription", p.getShortDescription());
        if (isBlank(p.getDescriptionEn())) putIfText(s, "description", p.getDescription());
        if (isBlank(p.getSeoTitleEn())) putIfText(s, "seoTitle", p.getSeoTitle());
        if (isBlank(p.getSeoDescriptionEn())) putIfText(s, "seoDescription", p.getSeoDescription());
        if (isBlank(p.getSpecificationsHtmlEn())) putIfText(s, "specificationsHtml", p.getSpecificationsHtml());
        if (isBlank(p.getSpecStatsHtmlEn())) putIfText(s, "specStatsHtml", p.getSpecStatsHtml());
        if (isBlank(p.getTrustBadgesHtmlEn())) putIfText(s, "trustBadgesHtml", p.getTrustBadgesHtml());

        List<ProductSpecificationEntity> specs = p.getSpecifications();
        if (specs != null) {
            for (int i = 0; i < specs.size(); i++) {
                ProductSpecificationEntity e = specs.get(i);
                if (isBlank(e.getNameEn())) putIfText(s, "spec." + i + ".name", e.getName());
                if (isBlank(e.getValueEn())) putIfText(s, "spec." + i + ".value", e.getValue());
                if (isBlank(e.getGroupNameEn())) putIfText(s, "spec." + i + ".group", e.getGroupName());
            }
        }
        List<ProductSpecStatEntity> stats = p.getSpecStats();
        if (stats != null) {
            for (int i = 0; i < stats.size(); i++) {
                ProductSpecStatEntity e = stats.get(i);
                if (isBlank(e.getValueEn())) putIfText(s, "stat." + i + ".value", e.getValue());
                if (isBlank(e.getLabelEn())) putIfText(s, "stat." + i + ".label", e.getLabel());
            }
        }
        List<ProductFaqEntity> faqs = p.getFaqs();
        if (faqs != null) {
            for (int i = 0; i < faqs.size(); i++) {
                ProductFaqEntity e = faqs.get(i);
                if (isBlank(e.getQuestionEn())) putIfText(s, "faq." + i + ".q", e.getQuestion());
                if (isBlank(e.getAnswerEn())) putIfText(s, "faq." + i + ".a", e.getAnswer());
            }
        }
        List<ProductCommitmentEntity> commits = p.getCommitments();
        if (commits != null) {
            for (int i = 0; i < commits.size(); i++) {
                ProductCommitmentEntity e = commits.get(i);
                if (isBlank(e.getTitleEn())) putIfText(s, "commit." + i + ".title", e.getTitle());
                if (isBlank(e.getSubtitleEn())) putIfText(s, "commit." + i + ".subtitle", e.getSubtitle());
            }
        }
        List<ProductTrustBadgeEntity> badges = p.getTrustBadges();
        if (badges != null) {
            for (int i = 0; i < badges.size(); i++) {
                ProductTrustBadgeEntity e = badges.get(i);
                if (isBlank(e.getContentEn())) putIfText(s, "badge." + i + ".content", e.getContent());
            }
        }
        List<ProductHighlightEntity> hls = p.getHighlights();
        if (hls != null) {
            for (int i = 0; i < hls.size(); i++) {
                ProductHighlightEntity e = hls.get(i);
                if (isBlank(e.getContentEn())) putIfText(s, "hl." + i + ".content", e.getContent());
            }
        }
        if (isBlank(toJson(p.getDescriptionBlocksEn())) && p.getDescriptionBlocks() != null
                && !p.getDescriptionBlocks().isEmpty()) {
            collectBlockTexts(p.getDescriptionBlocks(), s);
        }
        if (isBlank(p.getSuitabilityAdvisoryEn())) {
            collectSuitabilityAdvisory(p.getSuitabilityAdvisory(), s);
        }
        return s;
    }

    // ── Product apply ────────────────────────────────────────────────────────────────────────────

    private void applyProductResult(ProductEntity p, Map<String, String> out) {
        if (isBlank(p.getNameEn())) p.setNameEn(out.get("name"));
        if (out.containsKey("shortDescription")) p.setShortDescriptionEn(out.get("shortDescription"));
        if (out.containsKey("description")) p.setDescriptionEn(out.get("description"));
        if (out.containsKey("seoTitle")) p.setSeoTitleEn(out.get("seoTitle"));
        if (out.containsKey("seoDescription")) p.setSeoDescriptionEn(out.get("seoDescription"));
        if (out.containsKey("specificationsHtml")) p.setSpecificationsHtmlEn(out.get("specificationsHtml"));
        if (out.containsKey("specStatsHtml")) p.setSpecStatsHtmlEn(out.get("specStatsHtml"));
        if (out.containsKey("trustBadgesHtml")) p.setTrustBadgesHtmlEn(out.get("trustBadgesHtml"));

        List<ProductSpecificationEntity> specs = p.getSpecifications();
        if (specs != null) {
            for (int i = 0; i < specs.size(); i++) {
                ProductSpecificationEntity e = specs.get(i);
                if (out.containsKey("spec." + i + ".name")) e.setNameEn(out.get("spec." + i + ".name"));
                if (out.containsKey("spec." + i + ".value")) e.setValueEn(out.get("spec." + i + ".value"));
                if (out.containsKey("spec." + i + ".group")) e.setGroupNameEn(out.get("spec." + i + ".group"));
            }
        }
        List<ProductSpecStatEntity> stats = p.getSpecStats();
        if (stats != null) {
            for (int i = 0; i < stats.size(); i++) {
                ProductSpecStatEntity e = stats.get(i);
                if (out.containsKey("stat." + i + ".value")) e.setValueEn(out.get("stat." + i + ".value"));
                if (out.containsKey("stat." + i + ".label")) e.setLabelEn(out.get("stat." + i + ".label"));
            }
        }
        List<ProductFaqEntity> faqs = p.getFaqs();
        if (faqs != null) {
            for (int i = 0; i < faqs.size(); i++) {
                ProductFaqEntity e = faqs.get(i);
                if (out.containsKey("faq." + i + ".q")) e.setQuestionEn(out.get("faq." + i + ".q"));
                if (out.containsKey("faq." + i + ".a")) e.setAnswerEn(out.get("faq." + i + ".a"));
            }
        }
        List<ProductCommitmentEntity> commits = p.getCommitments();
        if (commits != null) {
            for (int i = 0; i < commits.size(); i++) {
                ProductCommitmentEntity e = commits.get(i);
                if (out.containsKey("commit." + i + ".title")) e.setTitleEn(out.get("commit." + i + ".title"));
                if (out.containsKey("commit." + i + ".subtitle")) e.setSubtitleEn(out.get("commit." + i + ".subtitle"));
            }
        }
        List<ProductTrustBadgeEntity> badges = p.getTrustBadges();
        if (badges != null) {
            for (int i = 0; i < badges.size(); i++) {
                ProductTrustBadgeEntity e = badges.get(i);
                if (out.containsKey("badge." + i + ".content")) e.setContentEn(out.get("badge." + i + ".content"));
            }
        }
        List<ProductHighlightEntity> hls = p.getHighlights();
        if (hls != null) {
            for (int i = 0; i < hls.size(); i++) {
                ProductHighlightEntity e = hls.get(i);
                if (out.containsKey("hl." + i + ".content")) e.setContentEn(out.get("hl." + i + ".content"));
            }
        }
        if (isBlank(toJson(p.getDescriptionBlocksEn())) && p.getDescriptionBlocks() != null
                && !p.getDescriptionBlocks().isEmpty()) {
            // Independent EN copy of the VI blocks; structure/urls/levels preserved, text overwritten.
            List<DescriptionBlock> enBlocks = blocksCodec.convertToEntityAttribute(
                    blocksCodec.convertToDatabaseColumn(p.getDescriptionBlocks()));
            applyBlockTexts(enBlocks, out);
            p.setDescriptionBlocksEn(enBlocks);
        }
        if (isBlank(p.getSuitabilityAdvisoryEn())) {
            String en = applySuitabilityAdvisory(p.getSuitabilityAdvisory(), out);
            if (en != null) p.setSuitabilityAdvisoryEn(en);
        }
    }

    // ── Description-block flatten / unflatten (text only; image/video/divider carry no text) ───────

    private void collectBlockTexts(List<DescriptionBlock> blocks, Map<String, String> s) {
        for (int i = 0; i < blocks.size(); i++) {
            DescriptionBlock b = blocks.get(i);
            String k = "blk." + i + ".";
            if (b instanceof DescriptionBlock.HeadingBlock x) {
                putIfText(s, k + "text", x.getText());
            } else if (b instanceof DescriptionBlock.ParagraphBlock x) {
                putIfText(s, k + "html", x.getHtml());
            } else if (b instanceof DescriptionBlock.CalloutBlock x) {
                putIfText(s, k + "html", x.getHtml());
            } else if (b instanceof DescriptionBlock.SizeGuideBlock x) {
                putIfText(s, k + "title", x.getTitle());
                putIfText(s, k + "html", x.getHtml());
            } else if (b instanceof DescriptionBlock.ListBlock x) {
                collectList(s, k + "item.", x.getItems());
            } else if (b instanceof DescriptionBlock.FeatureBlock x) {
                putIfText(s, k + "subheading", x.getSubheading());
                putIfText(s, k + "heading", x.getHeading());
                putIfText(s, k + "html", x.getHtml());
                collectList(s, k + "item.", x.getItems());
            } else if (b instanceof DescriptionBlock.ProsConsBlock x) {
                putIfText(s, k + "title", x.getTitle());
                collectList(s, k + "pos.", x.getPositive());
                collectList(s, k + "neg.", x.getNegative());
            } else if (b instanceof DescriptionBlock.SuitabilityBlock x) {
                putIfText(s, k + "title", x.getTitle());
                putIfText(s, k + "html", x.getHtml());
                if (x.getCards() != null) {
                    for (int j = 0; j < x.getCards().size(); j++) {
                        DescriptionBlock.SuitabilityBlock.SuitabilityCard card = x.getCards().get(j);
                        putIfText(s, k + "card." + j + ".audience", card.getAudience());
                        putIfText(s, k + "card." + j + ".advice", card.getAdvice());
                        putIfText(s, k + "card." + j + ".linkLabel", card.getLinkLabel());
                    }
                }
            }
        }
    }

    private void applyBlockTexts(List<DescriptionBlock> blocks, Map<String, String> out) {
        for (int i = 0; i < blocks.size(); i++) {
            DescriptionBlock b = blocks.get(i);
            String k = "blk." + i + ".";
            if (b instanceof DescriptionBlock.HeadingBlock x) {
                x.setText(pick(out, k + "text", x.getText()));
            } else if (b instanceof DescriptionBlock.ParagraphBlock x) {
                x.setHtml(pick(out, k + "html", x.getHtml()));
            } else if (b instanceof DescriptionBlock.CalloutBlock x) {
                x.setHtml(pick(out, k + "html", x.getHtml()));
            } else if (b instanceof DescriptionBlock.SizeGuideBlock x) {
                x.setTitle(pick(out, k + "title", x.getTitle()));
                x.setHtml(pick(out, k + "html", x.getHtml()));
            } else if (b instanceof DescriptionBlock.ListBlock x) {
                x.setItems(applyList(out, k + "item.", x.getItems()));
            } else if (b instanceof DescriptionBlock.FeatureBlock x) {
                x.setSubheading(pick(out, k + "subheading", x.getSubheading()));
                x.setHeading(pick(out, k + "heading", x.getHeading()));
                x.setHtml(pick(out, k + "html", x.getHtml()));
                x.setItems(applyList(out, k + "item.", x.getItems()));
            } else if (b instanceof DescriptionBlock.ProsConsBlock x) {
                x.setTitle(pick(out, k + "title", x.getTitle()));
                x.setPositive(applyList(out, k + "pos.", x.getPositive()));
                x.setNegative(applyList(out, k + "neg.", x.getNegative()));
            } else if (b instanceof DescriptionBlock.SuitabilityBlock x) {
                x.setTitle(pick(out, k + "title", x.getTitle()));
                x.setHtml(pick(out, k + "html", x.getHtml()));
                if (x.getCards() != null) {
                    for (int j = 0; j < x.getCards().size(); j++) {
                        DescriptionBlock.SuitabilityBlock.SuitabilityCard card = x.getCards().get(j);
                        card.setAudience(pick(out, k + "card." + j + ".audience", card.getAudience()));
                        card.setAdvice(pick(out, k + "card." + j + ".advice", card.getAdvice()));
                        card.setLinkLabel(pick(out, k + "card." + j + ".linkLabel", card.getLinkLabel()));
                    }
                }
            }
        }
    }

    private void collectList(Map<String, String> s, String prefix, List<String> items) {
        if (items == null) return;
        for (int j = 0; j < items.size(); j++) {
            putIfText(s, prefix + j, items.get(j));
        }
    }

    private List<String> applyList(Map<String, String> out, String prefix, List<String> items) {
        if (items == null) return null;
        List<String> result = new ArrayList<>(items.size());
        for (int j = 0; j < items.size(); j++) {
            result.add(pick(out, prefix + j, items.get(j)));
        }
        return result;
    }

    // ── suitability_advisory: opaque JSON array of cards [{audience, advice, linkLabel?, linkUrl?}] ─

    private void collectSuitabilityAdvisory(String viJson, Map<String, String> s) {
        if (isBlank(viJson)) return;
        try {
            JsonNode arr = json.readTree(viJson);
            if (!arr.isArray()) return;
            for (int i = 0; i < arr.size(); i++) {
                JsonNode c = arr.get(i);
                putIfText(s, "sa." + i + ".audience", c.path("audience").asText(null));
                putIfText(s, "sa." + i + ".advice", c.path("advice").asText(null));
                putIfText(s, "sa." + i + ".linkLabel", c.path("linkLabel").asText(null));
            }
        } catch (Exception e) {
            log.warn("Backfill: suitability_advisory not valid JSON, skipped ({}).", e.getMessage());
        }
    }

    private String applySuitabilityAdvisory(String viJson, Map<String, String> out) {
        if (isBlank(viJson)) return null;
        try {
            JsonNode arr = json.readTree(viJson);
            if (!arr.isArray()) return null;
            ArrayNode enArr = json.createArrayNode();
            for (int i = 0; i < arr.size(); i++) {
                JsonNode c = arr.get(i);
                ObjectNode en = json.createObjectNode();
                en.put("audience", pick(out, "sa." + i + ".audience", c.path("audience").asText("")));
                en.put("advice", pick(out, "sa." + i + ".advice", c.path("advice").asText("")));
                if (c.has("linkLabel")) {
                    en.put("linkLabel", pick(out, "sa." + i + ".linkLabel", c.path("linkLabel").asText("")));
                }
                if (c.has("linkUrl")) {
                    en.put("linkUrl", c.path("linkUrl").asText(""));   // url shared across languages
                }
                enArr.add(en);
            }
            return json.writeValueAsString(enArr);
        } catch (Exception e) {
            log.warn("Backfill: suitability_advisory rebuild failed, skipped ({}).", e.getMessage());
            return null;
        }
    }

    // ── Dry-run sample (READ only; never mutates) ────────────────────────────────────────────────

    private Sample buildSample(String type, String id) {
        return switch (type) {
            case "product" -> {
                ProductEntity p = em.find(ProductEntity.class, id);
                if (p == null) yield null;
                Map<String, String> src = buildProductSource(p);
                Map<String, String> out = gemini.translate(src, BACKFILL_OPTS);
                if (!hasAnchor(out, effectiveAnchor(src, "name"))) yield null;
                yield new Sample(id, clip(p.getName()), clip(out.get("name")), List.of(
                        new FieldPreview("name", clip(p.getName()), clip(out.get("name"))),
                        new FieldPreview("description", clip(p.getDescription()), clip(out.get("description"))),
                        new FieldPreview("seoTitle", clip(p.getSeoTitle()), clip(out.get("seoTitle")))));
            }
            case "category" -> {
                CategoryEntity c = em.find(CategoryEntity.class, id);
                if (c == null) yield null;
                Map<String, String> src = buildCategorySource(c);
                Map<String, String> out = gemini.translate(src, BACKFILL_OPTS);
                if (!hasAnchor(out, effectiveAnchor(src, "name"))) yield null;
                yield new Sample(id, clip(c.getName()), clip(out.get("name")), List.of(
                        new FieldPreview("name", clip(c.getName()), clip(out.get("name"))),
                        new FieldPreview("description", clip(c.getDescription()), clip(out.get("description")))));
            }
            case "brand" -> {
                BrandEntity b = em.find(BrandEntity.class, id);
                if (b == null) yield null;
                Map<String, String> src = buildBrandSource(b);
                Map<String, String> out = gemini.translate(src, BACKFILL_OPTS);
                if (!hasAnchor(out, effectiveAnchor(src, "name"))) yield null;
                yield new Sample(id, clip(b.getName()), clip(out.get("name")), List.of(
                        new FieldPreview("name", clip(b.getName()), clip(out.get("name"))),
                        new FieldPreview("description", clip(b.getDescription()), clip(out.get("description")))));
            }
            case "article" -> {
                ArticleEntity a = em.find(ArticleEntity.class, id);
                if (a == null) yield null;
                Map<String, String> src = buildArticleSource(a);
                Map<String, String> out = gemini.translate(src, BACKFILL_OPTS);
                if (!hasAnchor(out, effectiveAnchor(src, "title"))) yield null;
                yield new Sample(id, clip(a.getTitle()), clip(out.get("title")), List.of(
                        new FieldPreview("title", clip(a.getTitle()), clip(out.get("title"))),
                        new FieldPreview("excerpt", clip(a.getExcerpt()), clip(out.get("excerpt"))),
                        new FieldPreview("body", clip(a.getBody()), clip(out.get("body")))));
            }
            default -> null;
        };
    }

    // ── small helpers ────────────────────────────────────────────────────────────────────────────

    private static boolean isBlank(String s) {
        return !StringUtils.hasText(s);
    }

    private static void putIfText(Map<String, String> s, String key, String value) {
        if (StringUtils.hasText(value)) {
            s.put(key, value);
        }
    }

    /** Translated value when present and non-blank, else the existing (Vietnamese) fallback. */
    private static String pick(Map<String, String> out, String key, String fallback) {
        String v = out.get(key);
        return StringUtils.hasText(v) ? v : fallback;
    }

    private static boolean hasAnchor(Map<String, String> out, String anchorKey) {
        return out != null && StringUtils.hasText(out.get(anchorKey));
    }

    /**
     * Translate, retrying until the output looks COMPLETE (Gemini non-deterministically stops early
     * on long HTML, producing valid-JSON-but-truncated text). Returns the first complete result, or
     * null after {@link #MAX_TRANSLATE_ATTEMPTS} — caller then skips the record (re-tried next run).
     */
    private Map<String, String> translateComplete(Map<String, String> src, String preferredAnchor) {
        if (src.isEmpty()) {
            return null;
        }
        // The canonical anchor (name/title) is absent from src when it was already translated — only
        // the still-blank fields are sent. Use the first present source key as the empty-response guard
        // so anchor-done records with a residual sub-field gap can still be completed.
        String anchor = effectiveAnchor(src, preferredAnchor);
        for (int attempt = 1; attempt <= MAX_TRANSLATE_ATTEMPTS; attempt++) {
            Map<String, String> out = gemini.translate(src, BACKFILL_OPTS);
            if (isComplete(src, out, anchor)) {
                return out;
            }
            log.warn("Backfill: incomplete/empty translation (attempt {}/{}, anchor={}), retrying",
                    attempt, MAX_TRANSLATE_ATTEMPTS, anchor);
            if (attempt < MAX_TRANSLATE_ATTEMPTS) {
                pause();
            }
        }
        return null;
    }

    /** Preferred anchor when present in the source, else the first source key (src is never empty here). */
    private static String effectiveAnchor(Map<String, String> src, String preferred) {
        if (src.containsKey(preferred) || src.isEmpty()) {
            return preferred;
        }
        return src.keySet().iterator().next();
    }

    /** Anchor present + every substantial source field kept enough HTML tags / length in the output. */
    private static boolean isComplete(Map<String, String> src, Map<String, String> out, String anchorKey) {
        if (out == null || !StringUtils.hasText(out.get(anchorKey))) {
            return false;
        }
        for (Map.Entry<String, String> e : src.entrySet()) {
            String s = e.getValue();
            String o = out.get(e.getKey());
            int srcTags = countChar(s, '<');
            if (srcTags >= TAG_CHECK_MIN) {
                if (countChar(o, '<') < MIN_TAG_RATIO * srcTags) {
                    return false;
                }
            } else if (s != null && s.length() >= LEN_CHECK_MIN) {
                if (o == null || o.length() < MIN_LEN_RATIO * s.length()) {
                    return false;
                }
            }
        }
        return true;
    }

    private static int countChar(String s, char c) {
        if (s == null) {
            return 0;
        }
        int n = 0;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == c) {
                n++;
            }
        }
        return n;
    }

    private String toJson(List<DescriptionBlock> blocks) {
        return (blocks == null || blocks.isEmpty()) ? null : blocksCodec.convertToDatabaseColumn(blocks);
    }

    private static String clip(String s) {
        if (s == null) return null;
        String t = s.strip();
        return t.length() <= PREVIEW_MAX_CHARS ? t : t.substring(0, PREVIEW_MAX_CHARS) + "…";
    }

    private static void pause() {
        try {
            Thread.sleep(PAUSE_BETWEEN_RECORDS_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
