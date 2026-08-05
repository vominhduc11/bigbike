package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Action;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Issue;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.RedirectPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.RedirectSummary;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.RedirectPolicy;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.Snapshot;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetArticle;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetCategory;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetProduct;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressPermalinkManagerMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressRedirectMapper;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpFgRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpRedirectRow;
import com.bigbike.bigbike_backend.migration.wordpress.parser.PhpSerializeParser;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Produces direct, conflict-aware 301 candidates; it never persists redirect rows. */
final class LiveRedirectPlanner {

    Result plan(
            LiveWordPressSnapshotReader.Snapshot source,
            Snapshot target,
            Map<Long, LiveMigrationPreflightService.ProductContext> productContexts,
            Map<Long, LiveMigrationPreflightService.ArticleContext> articleContexts,
            Collection<String> targetContentLegacyPaths) {
        return plan(
                source, target, productContexts, articleContexts, targetContentLegacyPaths,
                new RedirectPolicy(false, "ACKNOWLEDGED_NO_SAFE_TARGET", false, false));
    }

    Result plan(
            LiveWordPressSnapshotReader.Snapshot source,
            Snapshot target,
            Map<Long, LiveMigrationPreflightService.ProductContext> productContexts,
            Map<Long, LiveMigrationPreflightService.ArticleContext> articleContexts,
            Collection<String> targetContentLegacyPaths,
            RedirectPolicy policy) {

        List<Candidate> candidates = new ArrayList<>();
        List<Issue> issues = new ArrayList<>();
        Map<String, TargetCategory> activeCategories = target.categories().stream()
                .filter(category -> !category.deleted())
                .filter(category -> LiveMigrationPreflightService.normalizeSlug(category.slug()) != null)
                .collect(Collectors.toMap(
                        category -> LiveMigrationPreflightService.normalizeSlug(category.slug()),
                        Function.identity(), (a, b) -> a));
        Map<String, List<TargetProduct>> productsBySku = multiIndex(
                target.products(), product -> LiveMigrationPreflightService.normalizeSku(product.sku()));
        Map<String, List<TargetProduct>> productsBySlug = multiIndex(
                target.products(), product -> LiveMigrationPreflightService.normalizeSlug(product.slug()));
        Map<String, List<TargetArticle>> articlesBySlug = multiIndex(
                target.articles(), article -> LiveMigrationPreflightService.normalizeSlug(article.slug()));
        Map<String, LiveMigrationPreflightService.ProductContext> productContextsByTargetId =
                productContexts.values().stream()
                        .filter(context -> context.target() != null)
                        .collect(Collectors.toMap(
                                context -> context.target().id(), Function.identity(), (a, b) -> a));
        Set<String> plannedNonPublicProductIds = productContexts.values().stream()
                .filter(context -> context.target() != null)
                .filter(context -> "DOWNGRADE_CONFIRMED_LEGACY_TO_DRAFT"
                        .equals(context.plan().statusDecision()))
                .map(context -> context.target().id())
                .collect(Collectors.toUnmodifiableSet());
        Set<String> knownLiveDestinations = knownLiveDestinations(
                target, activeCategories, plannedNonPublicProductIds, articleContexts.values());

        // Canonical legacy product paths and redirect-only products.
        for (WpPost post : source.postsOfType("product")) {
            if (post.postName() == null || post.postName().isBlank()) continue;
            Destination destination;
            LiveMigrationPreflightService.ProductContext context = productContexts.get(post.id());
            if (context != null) {
                destination = destinationForProductContext(context);
            } else {
                destination = destinationForLegacyProduct(
                        post, source, productsBySku, productsBySlug, activeCategories,
                        knownLiveDestinations);
            }
            String oldPath = "/sp/" + post.postName() + ".html";
            addCandidate(candidates, oldPath, destination, "PRODUCT", post.id(),
                    "Legacy WooCommerce product URL", destination.confidence());
            for (String oldSlug : oldSlugs(source, post.id())) {
                addCandidate(candidates, "/sp/" + oldSlug + ".html", destination,
                        "WORDPRESS_OLD_SLUG", post.id(),
                        "WordPress _wp_old_slug for product", destination.confidence());
            }
        }

        // Article .html paths. Draft/archived targets fall back to the news listing.
        for (LiveMigrationPreflightService.ArticleContext context : articleContexts.values()) {
            WpPost post = context.post();
            if (post.postName() == null || post.postName().isBlank()) continue;
            String targetPath;
            String confidence;
            boolean publicTarget = context.target() != null
                    ? "PUBLISHED".equals(context.target().publishStatus())
                    : context.plan().action() == Action.INSERT
                            && "PUBLISHED".equals(context.plan().sourceStatus());
            if (publicTarget) {
                targetPath = "/tin-tuc/" + context.plan().targetSlug() + "/";
                confidence = "EXACT_ARTICLE_MAPPING";
            } else {
                targetPath = "/tin-tuc/";
                confidence = "SAFE_STATUS_FALLBACK";
            }
            candidates.add(new Candidate(
                    normalizeSourcePath("/tin-tuc/" + post.postName() + ".html"),
                    targetPath, "ARTICLE", post.id(), "Legacy WordPress article URL", confidence));
            Destination destination = new Destination(targetPath, confidence, null);
            for (String oldSlug : oldSlugs(source, post.id())) {
                addCandidate(candidates, "/tin-tuc/" + oldSlug + ".html", destination,
                        "WORDPRESS_OLD_SLUG", post.id(),
                        "WordPress _wp_old_slug for article", confidence);
            }
        }

        // Target-only rows can outlive or predate the selected WordPress snapshot. Their
        // exact target slug still provides a deterministic old .html alias. A non-public
        // target never points at its detail page.
        for (TargetProduct product : target.products()) {
            if (product.slug() == null || product.slug().isBlank()) continue;
            LiveMigrationPreflightService.ProductContext context =
                    productContextsByTargetId.get(product.id());
            Destination destination = context != null
                    ? destinationForProductContext(context)
                    : "PUBLISHED".equals(product.publishStatus())
                            ? new Destination("/product/" + product.slug() + "/",
                                    "EXACT_TARGET_PUBLIC_SLUG", null)
                            : primaryCategoryFallback(product.categorySlugs(),
                                    "Target-only product is not public");
            addCandidate(candidates, "/sp/" + product.slug() + ".html", destination,
                    "TARGET_PRODUCT_ALIAS", legacyNumericId(product.id()),
                    "Exact legacy alias for target product " + product.id(), destination.confidence());
        }
        for (TargetArticle article : target.articles()) {
            if (article.slug() == null || article.slug().isBlank()) continue;
            Destination destination = "PUBLISHED".equals(article.publishStatus())
                    ? new Destination("/tin-tuc/" + article.slug() + "/",
                            "EXACT_TARGET_PUBLIC_SLUG", null)
                    : new Destination("/tin-tuc/", "SAFE_STATUS_FALLBACK", null);
            addCandidate(candidates, "/tin-tuc/" + article.slug() + ".html", destination,
                    "TARGET_ARTICLE_ALIAS", legacyNumericId(article.id()),
                    "Exact legacy alias for target article " + article.id(), destination.confidence());
        }

        addStaticRouteCandidates(candidates);

        // Old content-category archives intentionally converge on the news listing.
        int contentCategoryRedirects = 0;
        for (var taxonomy : source.taxonomyById().values()) {
            if (!"category".equals(taxonomy.taxonomy())) continue;
            var term = source.termsById().get(taxonomy.termId());
            if (term == null || term.slug() == null || term.slug().isBlank()) continue;
            candidates.add(new Candidate(normalizeSourcePath("/category/" + term.slug() + "/"),
                    "/tin-tuc/", "CONTENT_CATEGORY", term.termId(),
                    "Content categories were removed", "EXACT_TAXONOMY_FALLBACK"));
            candidates.add(new Candidate(normalizeSourcePath("/en/category/" + term.slug() + "/"),
                    "/en/tin-tuc/", "CONTENT_CATEGORY", term.termId(),
                    "English content category fallback", "EXACT_TAXONOMY_FALLBACK"));
            contentCategoryRedirects += 2;
        }

        // FG Redirect aliases resolve through their target WordPress product ID.
        for (WpFgRedirect row : source.fgRedirects()) {
            if (!row.activated() || !"product".equalsIgnoreCase(row.type())) continue;
            WpPost targetPost = source.postsById().get(row.targetPostId());
            Destination destination = targetPost == null
                    ? Destination.unresolved("FG target post does not exist")
                    : destinationForPostId(targetPost, source, productContexts,
                            productsBySku, productsBySlug, activeCategories,
                            knownLiveDestinations);
            addCandidate(candidates, row.oldUrl(), destination, "FG_REDIRECT", row.targetPostId(),
                    "FG Redirect product alias", destination.confidence());
        }

        // Permalink Manager custom paths are additional legacy aliases for known posts.
        String permalinkRaw = source.options().get("permalink-manager_uris");
        if (permalinkRaw != null && !permalinkRaw.isBlank()) {
            var parsed = new WordPressPermalinkManagerMapper(new PhpSerializeParser()).parse(permalinkRaw);
            for (String warning : parsed.warnings()) {
                issues.add(new Issue("WARNING", "REDIRECT", "", "PERMALINK_PARSE_WARNING", warning));
            }
            for (var entry : parsed.entries()) {
                if (entry.type() != WordPressPermalinkManagerMapper.EntryType.POST) continue;
                WpPost post = source.postsById().get(entry.resolvedId());
                if (post == null) continue;
                Destination destination;
                if ("product".equals(post.postType())) {
                    destination = destinationForPostId(post, source, productContexts,
                            productsBySku, productsBySlug, activeCategories,
                            knownLiveDestinations);
                } else if ("post".equals(post.postType())) {
                    LiveMigrationPreflightService.ArticleContext article = articleContexts.get(post.id());
                    destination = article == null
                            ? Destination.unresolved("Article is outside migration status scope")
                            : destinationForArticle(article);
                } else {
                    continue;
                }
                addCandidate(candidates, entry.uri(), destination, "PERMALINK_MANAGER", post.id(),
                        "Custom WordPress permalink", destination.confidence());
            }
        }

        // RankMath may store multiple PHP-serialized source patterns per row. Its target
        // can be an older alias, but we only flatten it when that alias has one reviewed,
        // direct canonical destination. Fixed target queries remain manual review.
        Map<String, String> baseDestinations = uniqueResolvedCandidateDestinations(candidates);
        Map<String, String> existingDirectDestinations = uniqueExistingDirectDestinations(target.redirects());
        int rankMathSourceParseErrors = 0;
        for (WpRedirectRow row : source.rankMathRedirects()) {
            if (!"active".equalsIgnoreCase(row.status())) continue;
            List<String> sourcePatterns;
            if (row.sources() != null && !row.sources().isBlank()) {
                var parsed = WordPressRedirectMapper.parseSourcePatterns(row.sources());
                sourcePatterns = parsed.patterns();
                for (String warning : parsed.warnings()) {
                    issues.add(new Issue("WARNING", "REDIRECT", Long.toString(row.id()),
                            "RANK_MATH_SOURCE_PARSE_WARNING", warning));
                }
            } else {
                sourcePatterns = row.sourcePattern() == null || row.sourcePattern().isBlank()
                        ? List.of() : List.of(row.sourcePattern());
            }
            if (sourcePatterns.isEmpty()) {
                rankMathSourceParseErrors++;
                issues.add(new Issue("BLOCKER", "REDIRECT", Long.toString(row.id()),
                        "RANK_MATH_SOURCE_PARSE_FAILED",
                        "No exact source path could be parsed from the active RankMath row"));
                continue;
            }
            Destination declaredDestination = resolveRankMathDestination(
                    row.urlTo(), baseDestinations, existingDirectDestinations);
            for (String sourcePattern : sourcePatterns) {
                Destination destination = declaredDestination.path() == null
                        ? exactTargetDestinationForAlias(
                                sourcePattern, productsBySlug, articlesBySlug,
                                knownLiveDestinations)
                        : declaredDestination;
                if (destination.path() == null) destination = declaredDestination;
                addCandidate(candidates, sourcePattern, destination, "RANK_MATH", row.id(),
                        "Existing RankMath redirect", destination.confidence());
            }
        }

        addReferencedArticleFallbackCandidates(candidates, targetContentLegacyPaths);
        addReferencedContentCandidates(
                candidates, targetContentLegacyPaths, productsBySlug, articlesBySlug,
                knownLiveDestinations);

        Map<String, List<Candidate>> candidatesBySource = candidates.stream()
                .filter(candidate -> candidate.sourcePath() != null)
                .collect(Collectors.groupingBy(Candidate::sourcePath, LinkedHashMap::new, Collectors.toList()));
        Map<String, List<TargetRedirect>> existingBySource = target.redirects().stream()
                .filter(row -> normalizeSourcePath(row.sourcePath()) != null)
                .collect(Collectors.groupingBy(
                        row -> normalizeSourcePath(row.sourcePath()), LinkedHashMap::new, Collectors.toList()));

        // Candidate terminal map is used solely to detect chains; conflicts are handled below.
        Map<String, String> plannedTerminal = new HashMap<>();
        for (var entry : candidatesBySource.entrySet()) {
            Set<String> targets = entry.getValue().stream().map(Candidate::targetPath)
                    .filter(java.util.Objects::nonNull).collect(Collectors.toCollection(LinkedHashSet::new));
            if (targets.size() == 1) plannedTerminal.put(entry.getKey(), targets.iterator().next());
        }
        Map<String, String> existingTerminal = new HashMap<>();
        for (var entry : existingBySource.entrySet()) {
            Set<String> targets = entry.getValue().stream().filter(TargetRedirect::enabled)
                    .map(TargetRedirect::targetPath)
                    .map(LiveRedirectPlanner::normalizeTargetPath).filter(java.util.Objects::nonNull)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            if (targets.size() == 1) existingTerminal.put(entry.getKey(), targets.iterator().next());
        }

        List<RedirectPlan> plans = new ArrayList<>();
        int preserved = 0, updates = 0, conflicts = 0, unresolved = 0;
        int contentRewriteOnly = 0;
        int acknowledged = 0, loops = 0, chains = 0, inserts = 0;
        for (var entry : candidatesBySource.entrySet()) {
            String sourcePath = entry.getKey();
            List<Candidate> sourceCandidates = entry.getValue();
            Set<String> targets = sourceCandidates.stream().map(Candidate::targetPath)
                    .filter(java.util.Objects::nonNull).collect(Collectors.toCollection(LinkedHashSet::new));
            Candidate representative = sourceCandidates.get(0);
            boolean targetContentReferenceOnly = sourceCandidates.stream()
                    .allMatch(candidate -> "TARGET_CONTENT_REFERENCE".equals(candidate.sourceType()));
            List<String> planIssues = new ArrayList<>();
            String targetPath = targets.size() == 1 ? targets.iterator().next() : null;
            Action action;
            TargetRedirect existingRow = null;

            if (targets.isEmpty()) {
                if (policy.acknowledgeNoSafeTarget()) {
                    action = Action.ACKNOWLEDGED_NO_SAFE_TARGET;
                    acknowledged++;
                } else {
                    action = Action.SKIP;
                    unresolved++;
                }
                planIssues.addAll(sourceCandidates.stream().map(Candidate::unresolvedReason)
                        .filter(java.util.Objects::nonNull).distinct().toList());
            } else if (targets.size() > 1) {
                action = Action.CONFLICT;
                conflicts++;
                planIssues.add("Same source path resolves to multiple targets: " + targets);
            } else if (sourcePath.equals(targetPath)) {
                action = Action.CONFLICT;
                conflicts++;
                loops++;
                planIssues.add("Self-loop redirect");
            } else {
                List<TargetRedirect> existing = existingBySource.getOrDefault(sourcePath, List.of());
                Set<String> existingTargets = existing.stream().map(TargetRedirect::targetPath)
                        .map(LiveRedirectPlanner::normalizeTargetPath).filter(java.util.Objects::nonNull)
                        .collect(Collectors.toCollection(LinkedHashSet::new));
                if (existing.size() > 1 || existingTargets.size() > 1) {
                    action = Action.CONFLICT;
                    conflicts++;
                    planIssues.add("Multiple enabled target redirects already use this source");
                } else if (existing.size() == 1) {
                    existingRow = existing.get(0);
                    boolean exactExistingRule = existingRow.enabled()
                            && existingRow.statusCode() == 301
                            && "PERMANENT".equalsIgnoreCase(existingRow.redirectType())
                            && targetPath.equals(existingRow.targetPath().trim().replace("\\/", "/"));
                    if (existingTargets.contains(targetPath) && exactExistingRule) {
                        action = Action.PRESERVE;
                        preserved++;
                    } else {
                        String replacementReason = safeReplacementReason(
                                existingRow, targetPath, knownLiveDestinations);
                        if (replacementReason != null) {
                            action = Action.UPDATE_REDIRECT_TARGET;
                            updates++;
                            planIssues.add(replacementReason);
                        } else {
                            action = Action.CONFLICT;
                            conflicts++;
                            if (existingTargets.contains(targetPath)) {
                                planIssues.add("Existing target redirect metadata or URL form differs "
                                        + "and is not safe to replace automatically");
                            } else {
                                planIssues.add("Existing target redirect has a different destination: "
                                        + existingTargets);
                            }
                        }
                    }
                } else {
                    if (targetContentReferenceOnly) {
                        action = Action.REWRITE_URLS_ONLY;
                        contentRewriteOnly++;
                    } else {
                        action = Action.INSERT;
                        inserts++;
                    }
                }

                String next = plannedTerminal.get(targetPath);
                if (next == null) next = existingTerminal.get(targetPath);
                if (next != null && !next.equals(targetPath)) {
                    chains++;
                    planIssues.add("Target is itself a redirect source; direct terminal is " + next);
                    if (action == Action.INSERT || action == Action.UPDATE_REDIRECT_TARGET
                            || action == Action.PRESERVE || action == Action.REWRITE_URLS_ONLY) {
                        if (action == Action.INSERT) inserts--;
                        else if (action == Action.UPDATE_REDIRECT_TARGET) updates--;
                        else if (action == Action.PRESERVE) preserved--;
                        else contentRewriteOnly--;
                        action = Action.CONFLICT;
                        conflicts++;
                    }
                }
            }

            if (!planIssues.isEmpty()) {
                String severity = action == Action.CONFLICT ? "CONFLICT" : "WARNING";
                String code = action == Action.SKIP ? "REDIRECT_UNRESOLVED"
                        : action == Action.ACKNOWLEDGED_NO_SAFE_TARGET
                                ? "REDIRECT_ACKNOWLEDGED_NO_SAFE_TARGET"
                        : action == Action.UPDATE_REDIRECT_TARGET
                                ? "REDIRECT_TARGET_UPDATE_PLANNED" : "REDIRECT_CONFLICT";
                issues.add(new Issue(severity, "REDIRECT",
                        Long.toString(representative.sourceId()),
                        code,
                        sourcePath + ": " + String.join("; ", planIssues)));
            }
            plans.add(new RedirectPlan(
                    sourcePath, targetPath, 301, representative.sourceType(),
                    representative.sourceId(), representative.reason(), representative.confidence(),
                    action,
                    existingRow == null ? null : existingRow.id(),
                    existingRow == null ? null : existingRow.sourcePath(),
                    existingRow == null ? null : existingRow.targetPath(),
                    existingRow == null ? null : existingRow.redirectType(),
                    existingRow == null ? null : existingRow.statusCode(),
                    existingRow == null ? null : existingRow.enabled(),
                    List.copyOf(planIssues)));
        }

        plans.sort(Comparator.comparing(RedirectPlan::sourcePath));
        List<String> blockers = new ArrayList<>();
        if (conflicts > 0) blockers.add("REDIRECT_CONFLICTS_PRESENT");
        if (loops > 0) blockers.add("REDIRECT_LOOPS_PRESENT");
        if (chains > 0) blockers.add("REDIRECT_CHAINS_PRESENT");
        if (unresolved > 0) blockers.add("REDIRECTS_REQUIRE_MANUAL_REVIEW");
        if (rankMathSourceParseErrors > 0) blockers.add("REDIRECT_SOURCE_PARSE_ERRORS");
        RedirectSummary summary = new RedirectSummary(
                inserts, updates, preserved, conflicts, unresolved, contentRewriteOnly,
                acknowledged, loops, chains, contentCategoryRedirects);
        return new Result(List.copyOf(plans), summary, List.copyOf(issues), List.copyOf(blockers));
    }

    private Set<String> knownLiveDestinations(
            Snapshot target,
            Map<String, TargetCategory> activeCategories,
            Set<String> plannedNonPublicProductIds,
            Collection<LiveMigrationPreflightService.ArticleContext> articleContexts) {
        LinkedHashSet<String> result = new LinkedHashSet<>(List.of(
                "/", "/sp/", "/en/products/", "/tin-tuc/", "/en/tin-tuc/",
                "/lien-he/", "/gioi-thieu/"));
        for (TargetProduct product : target.products()) {
            if (!"PUBLISHED".equals(product.publishStatus()) || product.slug() == null
                    || plannedNonPublicProductIds.contains(product.id())) continue;
            result.add("/product/" + product.slug() + "/");
            result.add("/en/product/" + product.slug() + "/");
        }
        for (TargetArticle article : target.articles()) {
            if (!"PUBLISHED".equals(article.publishStatus()) || article.slug() == null) continue;
            result.add("/tin-tuc/" + article.slug() + "/");
            result.add("/en/tin-tuc/" + article.slug() + "/");
        }
        for (LiveMigrationPreflightService.ArticleContext context : articleContexts) {
            if (context.target() != null || context.plan().action() != Action.INSERT
                    || !"PUBLISHED".equals(context.plan().sourceStatus())) continue;
            result.add("/tin-tuc/" + context.plan().targetSlug() + "/");
            result.add("/en/tin-tuc/" + context.plan().targetSlug() + "/");
        }
        for (String slug : activeCategories.keySet()) {
            result.add("/danh-muc/" + slug + "/");
            result.add("/en/categories/" + slug + "/");
        }
        return Set.copyOf(result);
    }

    static String safeReplacementReason(
            TargetRedirect existing, String plannedTarget, Set<String> knownLiveDestinations) {
        if (existing == null || existing.adminAudited() || hasFixedQueryOrFragment(existing.targetPath())) {
            return null;
        }
        String normalizedPlanned = normalizeTargetPath(plannedTarget);
        String normalizedExisting = normalizeTargetPath(existing.targetPath());
        if (normalizedPlanned == null || normalizedExisting == null
                || !knownLiveDestinations.contains(normalizedPlanned)) {
            return null;
        }
        if (normalizedPlanned.equals(normalizedExisting)) {
            return "Normalize an unaudited redirect to the reviewed canonical 301 target";
        }
        if (isLegacyContentAlias(normalizedExisting)) {
            return "Replace an unaudited redirect whose current target is a legacy URL that would chain";
        }
        if (isCanonicalContentDetail(normalizedExisting)
                && !knownLiveDestinations.contains(normalizedExisting)) {
            return "Replace an unaudited redirect whose current detail target is missing or non-public";
        }
        return null;
    }

    private static boolean isLegacyContentAlias(String path) {
        return path != null && (path.matches("/(?:vi/|en/)?sp/[^/?#]+\\.html")
                || path.matches("/(?:vi/|en/)?tin-tuc/[^/?#]+\\.html"));
    }

    private static boolean isCanonicalContentDetail(String path) {
        return path != null && (path.matches("/(?:en/)?product/[^/?#]+/")
                || path.matches("/(?:en/)?tin-tuc/[^/?#]+/"));
    }

    private Destination destinationForPostId(
            WpPost post,
            LiveWordPressSnapshotReader.Snapshot source,
            Map<Long, LiveMigrationPreflightService.ProductContext> productContexts,
            Map<String, List<TargetProduct>> productsBySku,
            Map<String, List<TargetProduct>> productsBySlug,
            Map<String, TargetCategory> categories,
            Set<String> knownLiveDestinations) {
        LiveMigrationPreflightService.ProductContext context = productContexts.get(post.id());
        if (context != null) return destinationForProductContext(context);
        return destinationForLegacyProduct(
                post, source, productsBySku, productsBySlug, categories, knownLiveDestinations);
    }

    private Destination resolveRankMathDestination(
            String rawTarget,
            Map<String, String> baseDestinations,
            Map<String, String> existingDirectDestinations) {
        if (hasFixedQueryOrFragment(rawTarget)) {
            return Destination.unresolved(
                    "RankMath target has a fixed query or fragment that cannot be discarded");
        }
        String targetPath = normalizeTargetPath(rawTarget);
        if (isDirectCanonicalTarget(targetPath)) {
            return new Destination(targetPath, "EXISTING_DIRECT_RULE", null);
        }
        String sourceKey = normalizeSourcePath(rawTarget);
        String flattened = sourceKey == null ? null : baseDestinations.get(sourceKey);
        if (flattened != null) {
            return new Destination(flattened, "FLATTENED_TO_REVIEWED_TERMINAL", null);
        }
        flattened = sourceKey == null ? null : existingDirectDestinations.get(sourceKey);
        if (flattened != null) {
            return new Destination(flattened, "FLATTENED_TO_EXISTING_TERMINAL", null);
        }
        return Destination.unresolved("RankMath target has no unique direct canonical destination");
    }

    private Destination exactTargetDestinationForAlias(
            String rawSource,
            Map<String, List<TargetProduct>> productsBySlug,
            Map<String, List<TargetArticle>> articlesBySlug,
            Set<String> knownLiveDestinations) {
        String path = normalizeSourcePath(rawSource);
        if (path == null) return Destination.unresolved("RankMath source path is invalid");
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.startsWith("/vi/")) lower = lower.substring(3);
        else if (lower.startsWith("/en/")) lower = lower.substring(3);
        if (!lower.endsWith(".html") || lower.contains("/danh-muc-san-pham/")) {
            return Destination.unresolved("RankMath source is not an exact content .html alias");
        }

        boolean articleHint = lower.startsWith("/tin-tuc/");
        boolean productHint = lower.startsWith("/sp/");
        String fileName = lower.substring(lower.lastIndexOf('/') + 1, lower.length() - ".html".length());
        String slug = decodeSlug(fileName);
        if (slug == null) return Destination.unresolved("RankMath source slug is invalid");
        List<TargetProduct> products = articleHint
                ? List.of() : productsBySlug.getOrDefault(slug, List.of());
        List<TargetArticle> articles = productHint
                ? List.of() : articlesBySlug.getOrDefault(slug, List.of());
        if (products.size() + articles.size() != 1) {
            return Destination.unresolved("RankMath source slug has no unique target content match");
        }
        if (products.size() == 1) {
            TargetProduct product = products.get(0);
            String detailPath = "/product/" + product.slug() + "/";
            if (knownLiveDestinations.contains(detailPath)) {
                return new Destination(detailPath,
                        "EXACT_TARGET_SLUG_ALIAS", null);
            }
            return primaryCategoryFallback(product.categorySlugs(),
                    "Exact target-slug product is not public");
        }
        TargetArticle article = articles.get(0);
        return "PUBLISHED".equals(article.publishStatus())
                ? new Destination("/tin-tuc/" + article.slug() + "/",
                        "EXACT_TARGET_SLUG_ALIAS", null)
                : new Destination("/tin-tuc/", "SAFE_STATUS_FALLBACK", null);
    }

    private String decodeSlug(String value) {
        try {
            return LiveMigrationPreflightService.normalizeSlug(
                    URLDecoder.decode(value.replace("+", "%2B"), StandardCharsets.UTF_8));
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private void addStaticRouteCandidates(List<Candidate> candidates) {
        Map<String, String> routes = new LinkedHashMap<>();
        routes.put("/danh-muc-san-pham.html", "/sp/");
        routes.put("/san-pham.html", "/sp/");
        routes.put("/tin-tuc.html", "/tin-tuc/");
        routes.put("/lien-he.html", "/lien-he/");
        routes.put("/gioi-thieu.html", "/gioi-thieu/");
        routes.forEach((source, target) -> candidates.add(new Candidate(
                source, target, "STATIC_ROUTE", 0L,
                "Known legacy static route", "EXACT_STATIC_ROUTE_CONTRACT")));
    }

    private void addReferencedContentCandidates(
            List<Candidate> candidates,
            Collection<String> referencedPaths,
            Map<String, List<TargetProduct>> productsBySlug,
            Map<String, List<TargetArticle>> articlesBySlug,
            Set<String> knownLiveDestinations) {
        if (referencedPaths == null || referencedPaths.isEmpty()) return;
        Set<String> represented = candidates.stream().map(Candidate::sourcePath)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        LinkedHashSet<String> added = new LinkedHashSet<>();
        for (String raw : referencedPaths) {
            String source = normalizeSourcePath(raw);
            if (source == null) continue;
            String lookup = source;
            if (lookup.startsWith("/vi/")) lookup = lookup.substring(3);
            else if (lookup.startsWith("/en/")) lookup = lookup.substring(3);
            String lower = lookup.toLowerCase(Locale.ROOT);
            if (!lower.endsWith(".html") || represented.contains(source)
                    || represented.contains(lookup) || !added.add(lookup)) continue;

            Destination destination = exactTargetDestinationForAlias(
                    lookup, productsBySlug, articlesBySlug, knownLiveDestinations);
            if (destination.path() == null && lower.startsWith("/tin-tuc/")) {
                destination = new Destination(
                        "/tin-tuc/", "SAFE_NEWS_LISTING_FALLBACK", null);
            }
            if (destination.path() == null) {
                destination = Destination.unresolved(
                        "Target content legacy URL has no reviewed safe target; only an HTML anchor may be unlinked");
            }
            addCandidate(candidates, lookup, destination, "TARGET_CONTENT_REFERENCE", 0L,
                    "Legacy URL referenced only by existing target content",
                    destination.confidence());
        }
    }

    private void addReferencedArticleFallbackCandidates(
            List<Candidate> candidates, Collection<String> referencedPaths) {
        if (referencedPaths == null || referencedPaths.isEmpty()) return;
        Map<String, String> resolved = uniqueResolvedCandidateDestinations(candidates);
        LinkedHashSet<String> added = new LinkedHashSet<>();
        for (String raw : referencedPaths) {
            String source = normalizeSourcePath(raw);
            if (source == null) continue;
            String lookup = source;
            if (lookup.startsWith("/vi/")) lookup = lookup.substring(3);
            else if (lookup.startsWith("/en/")) lookup = lookup.substring(3);
            String lower = lookup.toLowerCase(Locale.ROOT);
            if (!lower.startsWith("/tin-tuc/") || !lower.endsWith(".html")) continue;
            if (resolved.containsKey(source) || resolved.containsKey(lookup)
                    || !added.add(lookup)) continue;
            candidates.add(new Candidate(
                    lookup, "/tin-tuc/", "REFERENCED_ARTICLE_FALLBACK", 0L,
                    "Referenced legacy article has no detail destination",
                    "SAFE_NEWS_LISTING_FALLBACK"));
        }
    }

    private List<String> oldSlugs(LiveWordPressSnapshotReader.Snapshot source, long postId) {
        return source.metaByPost().getOrDefault(postId, List.of()).stream()
                .filter(meta -> "_wp_old_slug".equals(meta.metaKey()))
                .map(meta -> LiveMigrationPreflightService.normalizeSlug(meta.metaValue()))
                .filter(java.util.Objects::nonNull)
                .filter(slug -> !slug.contains("/") && !slug.contains("?")
                        && !slug.contains("#") && !slug.endsWith(".html"))
                .distinct()
                .toList();
    }

    private long legacyNumericId(String targetId) {
        if (targetId == null) return 0L;
        int separator = targetId.lastIndexOf('-');
        String candidate = separator >= 0 ? targetId.substring(separator + 1) : targetId;
        try {
            return Long.parseLong(candidate);
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    private Map<String, String> uniqueResolvedCandidateDestinations(List<Candidate> candidates) {
        Map<String, Set<String>> grouped = new LinkedHashMap<>();
        for (Candidate candidate : candidates) {
            if (candidate.sourcePath() == null || candidate.targetPath() == null) continue;
            grouped.computeIfAbsent(candidate.sourcePath(), ignored -> new LinkedHashSet<>())
                    .add(candidate.targetPath());
        }
        Map<String, String> result = new LinkedHashMap<>();
        grouped.forEach((source, targets) -> {
            if (targets.size() == 1) result.put(source, targets.iterator().next());
        });
        return Map.copyOf(result);
    }

    private Map<String, String> uniqueExistingDirectDestinations(List<TargetRedirect> redirects) {
        Map<String, Set<String>> grouped = new LinkedHashMap<>();
        for (TargetRedirect redirect : redirects) {
            if (!redirect.enabled()) continue;
            String source = normalizeSourcePath(redirect.sourcePath());
            String target = normalizeTargetPath(redirect.targetPath());
            if (source == null || !isDirectCanonicalTarget(target)) continue;
            grouped.computeIfAbsent(source, ignored -> new LinkedHashSet<>()).add(target);
        }
        Map<String, String> result = new LinkedHashMap<>();
        grouped.forEach((source, targets) -> {
            if (targets.size() == 1) result.put(source, targets.iterator().next());
        });
        return Map.copyOf(result);
    }

    private static boolean hasFixedQueryOrFragment(String rawTarget) {
        if (rawTarget == null || rawTarget.isBlank()) return false;
        try {
            URI uri = URI.create(rawTarget.trim());
            return uri.getRawQuery() != null || uri.getRawFragment() != null;
        } catch (IllegalArgumentException ignored) {
            return rawTarget.contains("?") || rawTarget.contains("#");
        }
    }

    private Destination destinationForProductContext(LiveMigrationPreflightService.ProductContext context) {
        boolean remainsPublic = context.target() != null
                && "PUBLISHED".equals(context.target().publishStatus())
                && !"DOWNGRADE_CONFIRMED_LEGACY_TO_DRAFT"
                        .equals(context.plan().statusDecision());
        if (remainsPublic) {
            return new Destination("/product/" + context.target().slug() + "/",
                    "EXACT_PUBLIC_TARGET", null);
        }
        if (context.target() != null) {
            return primaryCategoryFallback(context.plan().targetCategorySlugs(),
                    "Existing target product is not public; use its target-authored primary category");
        }
        return categoryFallback(context.plan().targetCategorySlugs(),
                "Imported product remains DRAFT; exact category fallback is not unique");
    }

    private Destination destinationForLegacyProduct(
            WpPost post,
            LiveWordPressSnapshotReader.Snapshot source,
            Map<String, List<TargetProduct>> productsBySku,
            Map<String, List<TargetProduct>> productsBySlug,
            Map<String, TargetCategory> categories,
            Set<String> knownLiveDestinations) {
        String sku = LiveMigrationPreflightService.normalizeSku(source.meta(post.id()).get("_sku"));
        String slug = LiveMigrationPreflightService.normalizeSlug(post.postName());
        List<TargetProduct> skuMatches = sku == null ? List.of() : productsBySku.getOrDefault(sku, List.of());
        List<TargetProduct> slugMatches = slug == null ? List.of() : productsBySlug.getOrDefault(slug, List.of());
        TargetProduct target = skuMatches.size() == 1 ? skuMatches.get(0)
                : skuMatches.isEmpty() && slugMatches.size() == 1 ? slugMatches.get(0) : null;
        String targetPath = target == null ? null : "/product/" + target.slug() + "/";
        if (target != null && knownLiveDestinations.contains(targetPath)) {
            return new Destination(targetPath, "EXACT_PUBLIC_TARGET", null);
        }
        if (target != null) {
            Destination targetCategory = primaryCategoryFallback(
                    target.categorySlugs(),
                    "Matched target product is not public and has no target-authored category");
            if (targetCategory.path() != null) return targetCategory;
        }
        List<String> exactCategories = source.taxonomyTerms(post.id(), "product_cat").stream()
                .map(term -> LiveMigrationPreflightService.normalizeSlug(term.term().slug()))
                .filter(java.util.Objects::nonNull).filter(categories::containsKey).distinct().toList();
        return categoryFallback(exactCategories,
                "Non-public legacy product has no exact public product target");
    }

    private Destination categoryFallback(List<String> categories, String reason) {
        List<String> usable = categories == null ? List.of() : categories.stream()
                .filter(value -> value != null && !"uncategorized".equals(value)).distinct().toList();
        if (usable.size() == 1) {
            return new Destination("/danh-muc/" + usable.get(0) + "/", "EXACT_CATEGORY_FALLBACK", null);
        }
        if (usable.size() > 1) {
            return Destination.unresolved(reason + "; multiple category fallbacks are possible: " + usable);
        }
        return Destination.unresolved(reason + "; no suitable category fallback exists");
    }

    private Destination primaryCategoryFallback(List<String> categories, String reason) {
        List<String> usable = categories == null ? List.of() : categories.stream()
                .map(LiveMigrationPreflightService::normalizeSlug)
                .filter(java.util.Objects::nonNull)
                .filter(value -> !"uncategorized".equals(value)).distinct().toList();
        if (!usable.isEmpty()) {
            return new Destination("/danh-muc/" + usable.get(0) + "/",
                    "TARGET_PRIMARY_CATEGORY_FALLBACK", null);
        }
        return Destination.unresolved(reason + "; no suitable category fallback exists");
    }

    private Destination destinationForArticle(LiveMigrationPreflightService.ArticleContext article) {
        boolean publicTarget = article.target() != null
                ? "PUBLISHED".equals(article.target().publishStatus())
                : article.plan().action() == Action.INSERT
                        && "PUBLISHED".equals(article.plan().sourceStatus());
        return publicTarget
                ? new Destination("/tin-tuc/" + article.plan().targetSlug() + "/",
                        "EXACT_ARTICLE_MAPPING", null)
                : new Destination("/tin-tuc/", "SAFE_STATUS_FALLBACK", null);
    }

    private void addCandidate(
            List<Candidate> candidates,
            String rawSource,
            Destination destination,
            String sourceType,
            long sourceId,
            String reason,
            String confidence) {
        String sourcePath = normalizeSourcePath(rawSource);
        if (sourcePath == null) return;
        candidates.add(new Candidate(sourcePath, destination.path(), sourceType, sourceId,
                reason, confidence, destination.unresolvedReason()));
    }

    private boolean isDirectCanonicalTarget(String target) {
        if (target == null || target.startsWith("http://") || target.startsWith("https://")) return false;
        return target.equals("/tin-tuc/") || target.equals("/en/tin-tuc/")
                || target.matches("/(?:en/)?product/[^/?#]+/")
                || target.matches("/(?:en/)?tin-tuc/[^/?#]+/")
                || target.matches("/danh-muc/[^/?#]+/")
                || target.matches("/en/categories/[^/?#]+/")
                || target.equals("/sp/") || target.equals("/en/products/");
    }

    static String normalizeSourcePath(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim().replace("\\/", "/");
        try {
            if (value.startsWith("http://") || value.startsWith("https://")) {
                URI uri = URI.create(value);
                String host = uri.getHost();
                if (host == null || !(host.equalsIgnoreCase("bigbike.vn")
                        || host.equalsIgnoreCase("www.bigbike.vn"))) return null;
                value = uri.getRawPath();
            }
        } catch (IllegalArgumentException e) {
            return null;
        }
        int query = value.indexOf('?');
        if (query >= 0) value = value.substring(0, query);
        int fragment = value.indexOf('#');
        if (fragment >= 0) value = value.substring(0, fragment);
        if (!value.startsWith("/")) value = "/" + value;
        value = value.replaceAll("/{2,}", "/");
        return value.isBlank() ? null : value;
    }

    static String normalizeTargetPath(String raw) {
        String value = normalizeSourcePath(raw);
        if (value == null) return null;
        int query = value.indexOf('?');
        String suffix = query >= 0 ? value.substring(query) : "";
        String path = query >= 0 ? value.substring(0, query) : value;
        if (!path.equals("/") && !path.endsWith("/") && !path.endsWith(".html")) path += "/";
        return path + suffix;
    }

    private static <T> Map<String, List<T>> multiIndex(Collection<T> rows, Function<T, String> keyFn) {
        Map<String, List<T>> result = new HashMap<>();
        for (T row : rows) {
            String key = keyFn.apply(row);
            if (key != null) result.computeIfAbsent(key, ignored -> new ArrayList<>()).add(row);
        }
        return result;
    }

    record Result(
            List<RedirectPlan> plans,
            RedirectSummary summary,
            List<Issue> issues,
            List<String> blockers) {}

    private record Candidate(
            String sourcePath,
            String targetPath,
            String sourceType,
            long sourceId,
            String reason,
            String confidence,
            String unresolvedReason) {
        private Candidate(
                String sourcePath, String targetPath, String sourceType, long sourceId,
                String reason, String confidence) {
            this(sourcePath, targetPath, sourceType, sourceId, reason, confidence, null);
        }
    }

    private record Destination(String path, String confidence, String unresolvedReason) {
        static Destination unresolved(String reason) {
            return new Destination(null, "MANUAL_REVIEW", reason);
        }
    }
}
