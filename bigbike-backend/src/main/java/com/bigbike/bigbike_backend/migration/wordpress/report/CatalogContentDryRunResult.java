package com.bigbike.bigbike_backend.migration.wordpress.report;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

/**
 * Immutable result object returned by WordPressCatalogContentDryRunService.run().
 * Contains per-domain counts and accumulated warnings. No DB writes are performed.
 */
public record CatalogContentDryRunResult(
        // Metadata
        boolean dryRun,
        Instant generatedAt,
        String dumpPath,

        // Products
        int productsSource,
        int productsMapped,
        int productsSkipped,
        List<String> productWarnings,

        // Variations
        int variationsSource,
        int variationsMapped,
        int variationsDeferred,
        List<String> variationWarnings,

        // Categories (product_cat)
        int categoriesSource,
        int categoriesMapped,
        int categoriesSkipped,
        List<String> categoryWarnings,

        // Brands (pwb-brand)
        int brandsSource,
        int brandsMapped,
        int brandsSkipped,
        List<String> brandWarnings,

        // Tags (product_tag)
        int tagsSource,
        int tagsMapped,
        int tagsDeferred,

        // Media (attachments)
        int mediaSource,
        int mediaMapped,
        int mediaSkipped,
        List<String> mediaWarnings,

        // Pages
        int pagesSource,
        int pagesMapped,
        int pagesSkipped,
        List<String> pageWarnings,

        // Articles (posts)
        int articlesSource,
        int articlesMapped,
        int articlesSkipped,
        List<String> articleWarnings,

        // Menus
        int menusSource,
        int menusMapped,
        int menusSkipped,
        int menuItemsSource,
        int menuItemsMapped,
        int menuItemsSkipped,
        List<String> menuWarnings,

        // Redirects from RankMath
        int rankMathRedirectsSource,
        int rankMathRedirectsMapped,
        int rankMathRedirectsSkipped,
        List<String> rankMathRedirectWarnings,

        // Redirects from fg_redirect
        int fgRedirectsSource,
        int fgRedirectsMapped,
        int fgRedirectsSkipped,
        List<String> fgRedirectWarnings,

        // Permalink Manager URIs
        int permalinkEntriesSource,
        int permalinkEntriesParsed,
        List<String> permalinkWarnings,
        List<String> permalinkConflicts,

        // SQL streaming warnings
        List<String> streamingWarnings
) {
    /** Total source rows across catalog+content+media domains (excludes redirects and permalink). */
    public int totalSourceRows() {
        return productsSource + variationsSource + categoriesSource + brandsSource
                + tagsSource + mediaSource + pagesSource + articlesSource
                + menusSource + menuItemsSource;
    }

    /** Total mapped rows across catalog+content+media domains. */
    public int totalMapped() {
        return productsMapped + variationsMapped + categoriesMapped + brandsMapped
                + tagsMapped + mediaMapped + pagesMapped + articlesMapped
                + menusMapped + menuItemsMapped;
    }

    /** Total warning count across all domains. */
    public int totalWarnings() {
        return productWarnings.size() + variationWarnings.size()
                + categoryWarnings.size() + brandWarnings.size()
                + mediaWarnings.size() + pageWarnings.size()
                + articleWarnings.size() + menuWarnings.size()
                + rankMathRedirectWarnings.size() + fgRedirectWarnings.size()
                + permalinkWarnings.size() + streamingWarnings.size();
    }

    public static Builder builder(Path dumpPath) {
        return new Builder(dumpPath);
    }

    public static final class Builder {
        private final String dumpPath;
        private int productsSource, productsMapped, productsSkipped;
        private List<String> productWarnings = List.of();
        private int variationsSource, variationsMapped, variationsDeferred;
        private List<String> variationWarnings = List.of();
        private int categoriesSource, categoriesMapped, categoriesSkipped;
        private List<String> categoryWarnings = List.of();
        private int brandsSource, brandsMapped, brandsSkipped;
        private List<String> brandWarnings = List.of();
        private int tagsSource, tagsMapped, tagsDeferred;
        private int mediaSource, mediaMapped, mediaSkipped;
        private List<String> mediaWarnings = List.of();
        private int pagesSource, pagesMapped, pagesSkipped;
        private List<String> pageWarnings = List.of();
        private int articlesSource, articlesMapped, articlesSkipped;
        private List<String> articleWarnings = List.of();
        private int menusSource, menusMapped, menusSkipped;
        private int menuItemsSource, menuItemsMapped, menuItemsSkipped;
        private List<String> menuWarnings = List.of();
        private int rankMathRedirectsSource, rankMathRedirectsMapped, rankMathRedirectsSkipped;
        private List<String> rankMathRedirectWarnings = List.of();
        private int fgRedirectsSource, fgRedirectsMapped, fgRedirectsSkipped;
        private List<String> fgRedirectWarnings = List.of();
        private int permalinkEntriesSource, permalinkEntriesParsed;
        private List<String> permalinkWarnings = List.of();
        private List<String> permalinkConflicts = List.of();
        private List<String> streamingWarnings = List.of();

        private Builder(Path dumpPath) {
            this.dumpPath = dumpPath != null ? dumpPath.toString() : "<none>";
        }

        public Builder products(int source, int mapped, int skipped, List<String> warnings) {
            this.productsSource = source; this.productsMapped = mapped;
            this.productsSkipped = skipped; this.productWarnings = List.copyOf(warnings);
            return this;
        }
        public Builder variations(int source, int mapped, int deferred, List<String> warnings) {
            this.variationsSource = source; this.variationsMapped = mapped;
            this.variationsDeferred = deferred; this.variationWarnings = List.copyOf(warnings);
            return this;
        }
        public Builder categories(int source, int mapped, int skipped, List<String> warnings) {
            this.categoriesSource = source; this.categoriesMapped = mapped;
            this.categoriesSkipped = skipped; this.categoryWarnings = List.copyOf(warnings);
            return this;
        }
        public Builder brands(int source, int mapped, int skipped, List<String> warnings) {
            this.brandsSource = source; this.brandsMapped = mapped;
            this.brandsSkipped = skipped; this.brandWarnings = List.copyOf(warnings);
            return this;
        }
        public Builder tags(int source, int mapped, int deferred) {
            this.tagsSource = source; this.tagsMapped = mapped; this.tagsDeferred = deferred;
            return this;
        }
        public Builder media(int source, int mapped, int skipped, List<String> warnings) {
            this.mediaSource = source; this.mediaMapped = mapped;
            this.mediaSkipped = skipped; this.mediaWarnings = List.copyOf(warnings);
            return this;
        }
        public Builder pages(int source, int mapped, int skipped, List<String> warnings) {
            this.pagesSource = source; this.pagesMapped = mapped;
            this.pagesSkipped = skipped; this.pageWarnings = List.copyOf(warnings);
            return this;
        }
        public Builder articles(int source, int mapped, int skipped, List<String> warnings) {
            this.articlesSource = source; this.articlesMapped = mapped;
            this.articlesSkipped = skipped; this.articleWarnings = List.copyOf(warnings);
            return this;
        }
        public Builder menus(int menuSrc, int menuMapped, int menuSkipped,
                int itemSrc, int itemMapped, int itemSkipped, List<String> warnings) {
            this.menusSource = menuSrc; this.menusMapped = menuMapped; this.menusSkipped = menuSkipped;
            this.menuItemsSource = itemSrc; this.menuItemsMapped = itemMapped; this.menuItemsSkipped = itemSkipped;
            this.menuWarnings = List.copyOf(warnings);
            return this;
        }
        public Builder rankMathRedirects(int source, int mapped, int skipped, List<String> warnings) {
            this.rankMathRedirectsSource = source; this.rankMathRedirectsMapped = mapped;
            this.rankMathRedirectsSkipped = skipped; this.rankMathRedirectWarnings = List.copyOf(warnings);
            return this;
        }
        public Builder fgRedirects(int source, int mapped, int skipped, List<String> warnings) {
            this.fgRedirectsSource = source; this.fgRedirectsMapped = mapped;
            this.fgRedirectsSkipped = skipped; this.fgRedirectWarnings = List.copyOf(warnings);
            return this;
        }
        public Builder permalinkManager(int source, int parsed, List<String> warnings, List<String> conflicts) {
            this.permalinkEntriesSource = source; this.permalinkEntriesParsed = parsed;
            this.permalinkWarnings = List.copyOf(warnings);
            this.permalinkConflicts = List.copyOf(conflicts);
            return this;
        }
        public Builder streamingWarnings(List<String> warnings) {
            this.streamingWarnings = List.copyOf(warnings);
            return this;
        }

        public CatalogContentDryRunResult build() {
            return new CatalogContentDryRunResult(
                    true, Instant.now(), dumpPath,
                    productsSource, productsMapped, productsSkipped, productWarnings,
                    variationsSource, variationsMapped, variationsDeferred, variationWarnings,
                    categoriesSource, categoriesMapped, categoriesSkipped, categoryWarnings,
                    brandsSource, brandsMapped, brandsSkipped, brandWarnings,
                    tagsSource, tagsMapped, tagsDeferred,
                    mediaSource, mediaMapped, mediaSkipped, mediaWarnings,
                    pagesSource, pagesMapped, pagesSkipped, pageWarnings,
                    articlesSource, articlesMapped, articlesSkipped, articleWarnings,
                    menusSource, menusMapped, menusSkipped,
                    menuItemsSource, menuItemsMapped, menuItemsSkipped, menuWarnings,
                    rankMathRedirectsSource, rankMathRedirectsMapped, rankMathRedirectsSkipped, rankMathRedirectWarnings,
                    fgRedirectsSource, fgRedirectsMapped, fgRedirectsSkipped, fgRedirectWarnings,
                    permalinkEntriesSource, permalinkEntriesParsed, permalinkWarnings, permalinkConflicts,
                    streamingWarnings
            );
        }
    }
}
