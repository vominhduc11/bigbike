package com.bigbike.bigbike_backend.service.catalog;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.SizeGuideSection;
import com.bigbike.bigbike_backend.domain.catalog.SuitabilitySection;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Service;

/**
 * Public-read decoration for hand-authored product HTML (MEDIA_RULE_010).
 * It never rewrites image sources; known internal media only gains its stored dimensions.
 */
@Service
@RequiredArgsConstructor
public class ProductRichHtmlImageEnricher {

    private final MediaJpaRepository mediaJpaRepository;

    public Product enrich(Product product) {
        if (product == null) return null;

        List<String> fragments = new ArrayList<>();
        fragments.add(product.description());
        fragments.add(product.suitabilitySection() == null ? null : product.suitabilitySection().getHtml());
        fragments.add(product.sizeGuideSection() == null ? null : product.sizeGuideSection().getHtml());
        if (product.descriptionBlocks() != null) {
            product.descriptionBlocks().forEach(block -> fragments.add(htmlOf(block)));
        }

        // Keep parsed fragments only for this read. Source discovery and decoration previously
        // parsed the same HTML twice; sharing the DOM preserves Jsoup normalization exactly.
        Map<String, Document> documents = new HashMap<>();
        for (String fragment : fragments) {
            if (fragment == null || fragment.isBlank()) continue;
            documents.computeIfAbsent(fragment, html -> {
                Document document = Jsoup.parseBodyFragment(html);
                document.outputSettings().prettyPrint(false);
                return document;
            });
        }
        Map<String, Dimensions> dimensions = resolveDimensions(documents.values());
        Map<String, String> decorated = new HashMap<>();
        documents.forEach((html, document) -> decorated.put(html, decorate(document, dimensions)));
        return product.withRichHtml(
                decoratedHtml(product.description(), decorated),
                decorateBlocks(product.descriptionBlocks(), decorated),
                decorate(product.suitabilitySection(), decorated),
                decorate(product.sizeGuideSection(), decorated)
        );
    }

    private Map<String, Dimensions> resolveDimensions(Collection<Document> documents) {
        Set<String> sources = new HashSet<>();
        for (Document document : documents) {
            for (Element image : document.select("img[src]")) {
                String src = image.attr("src").trim();
                if (!src.isBlank()) sources.add(src);
            }
        }
        if (sources.isEmpty()) return Map.of();
        Map<String, Dimensions> result = new HashMap<>();
        for (MediaJpaRepository.PublicImageDimensions media : mediaJpaRepository.findImageDimensionsByPublicUrlIn(sources)) {
            if (media.getPublicUrl() != null && valid(media.getWidth()) && valid(media.getHeight())) {
                result.put(media.getPublicUrl(), new Dimensions(media.getWidth(), media.getHeight()));
            }
        }
        return result;
    }

    private static boolean valid(Integer value) {
        return value != null && value > 0;
    }

    private static String decoratedHtml(String html, Map<String, String> decorated) {
        return html == null || html.isBlank() ? html : decorated.get(html);
    }

    private static String decorate(Document document, Map<String, Dimensions> dimensions) {
        for (Element image : document.select("img[src]")) {
            if (!image.hasAttr("loading")) image.attr("loading", "lazy");
            if (!image.hasAttr("decoding")) image.attr("decoding", "async");
            Dimensions size = dimensions.get(image.attr("src").trim());
            if (size != null) {
                if (!image.hasAttr("width")) image.attr("width", Integer.toString(size.width()));
                if (!image.hasAttr("height")) image.attr("height", Integer.toString(size.height()));
            }
        }
        return document.body().html();
    }

    private static List<DescriptionBlock> decorateBlocks(
            List<DescriptionBlock> blocks, Map<String, String> decorated) {
        if (blocks == null) return null;
        return blocks.stream().map(block -> decorateBlock(block, decorated)).toList();
    }

    private static DescriptionBlock decorateBlock(DescriptionBlock block, Map<String, String> decorated) {
        if (block instanceof DescriptionBlock.ParagraphBlock value) {
            return DescriptionBlock.ParagraphBlock.builder().type(value.getType())
                    .html(decoratedHtml(value.getHtml(), decorated)).build();
        }
        if (block instanceof DescriptionBlock.CalloutBlock value) {
            return DescriptionBlock.CalloutBlock.builder().type(value.getType()).variant(value.getVariant())
                    .html(decoratedHtml(value.getHtml(), decorated)).build();
        }
        if (block instanceof DescriptionBlock.FeatureBlock value) {
            return DescriptionBlock.FeatureBlock.builder()
                    .type(value.getType()).side(value.getSide()).url(value.getUrl()).alt(value.getAlt())
                    .caption(value.getCaption()).subheading(value.getSubheading()).heading(value.getHeading())
                    .html(decoratedHtml(value.getHtml(), decorated)).build();
        }
        return block;
    }

    private static SuitabilitySection decorate(SuitabilitySection section, Map<String, String> decorated) {
        if (section == null) return null;
        return SuitabilitySection.builder().title(section.getTitle())
                .html(decoratedHtml(section.getHtml(), decorated)).build();
    }

    private static SizeGuideSection decorate(SizeGuideSection section, Map<String, String> decorated) {
        if (section == null) return null;
        return SizeGuideSection.builder().title(section.getTitle())
                .html(decoratedHtml(section.getHtml(), decorated)).build();
    }

    private static String htmlOf(DescriptionBlock block) {
        if (block instanceof DescriptionBlock.ParagraphBlock value) return value.getHtml();
        if (block instanceof DescriptionBlock.CalloutBlock value) return value.getHtml();
        if (block instanceof DescriptionBlock.FeatureBlock value) return value.getHtml();
        return null;
    }

    private record Dimensions(int width, int height) {}
}
