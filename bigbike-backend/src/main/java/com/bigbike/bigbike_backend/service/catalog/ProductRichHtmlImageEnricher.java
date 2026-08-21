package com.bigbike.bigbike_backend.service.catalog;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.SizeGuideSection;
import com.bigbike.bigbike_backend.domain.catalog.SuitabilitySection;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import java.util.ArrayList;
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

        Map<String, Dimensions> dimensions = resolveDimensions(fragments);
        return product.withRichHtml(
                decorate(product.description(), dimensions),
                decorateBlocks(product.descriptionBlocks(), dimensions),
                decorate(product.suitabilitySection(), dimensions),
                decorate(product.sizeGuideSection(), dimensions)
        );
    }

    private Map<String, Dimensions> resolveDimensions(List<String> fragments) {
        Set<String> sources = new HashSet<>();
        for (String fragment : fragments) {
            if (fragment == null || fragment.isBlank()) continue;
            for (Element image : Jsoup.parseBodyFragment(fragment).select("img[src]")) {
                String src = image.attr("src").trim();
                if (!src.isBlank()) sources.add(src);
            }
        }
        if (sources.isEmpty()) return Map.of();
        Map<String, Dimensions> result = new HashMap<>();
        for (MediaEntity media : mediaJpaRepository.findByPublicUrlIn(sources)) {
            if (media.getPublicUrl() != null && valid(media.getWidth()) && valid(media.getHeight())) {
                result.put(media.getPublicUrl(), new Dimensions(media.getWidth(), media.getHeight()));
            }
        }
        return result;
    }

    private static boolean valid(Integer value) {
        return value != null && value > 0;
    }

    private static String decorate(String html, Map<String, Dimensions> dimensions) {
        if (html == null || html.isBlank()) return html;
        Document document = Jsoup.parseBodyFragment(html);
        document.outputSettings().prettyPrint(false);
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
            List<DescriptionBlock> blocks, Map<String, Dimensions> dimensions) {
        if (blocks == null) return null;
        return blocks.stream().map(block -> decorateBlock(block, dimensions)).toList();
    }

    private static DescriptionBlock decorateBlock(DescriptionBlock block, Map<String, Dimensions> dimensions) {
        if (block instanceof DescriptionBlock.ParagraphBlock value) {
            return DescriptionBlock.ParagraphBlock.builder().type(value.getType())
                    .html(decorate(value.getHtml(), dimensions)).build();
        }
        if (block instanceof DescriptionBlock.CalloutBlock value) {
            return DescriptionBlock.CalloutBlock.builder().type(value.getType()).variant(value.getVariant())
                    .html(decorate(value.getHtml(), dimensions)).build();
        }
        if (block instanceof DescriptionBlock.FeatureBlock value) {
            return DescriptionBlock.FeatureBlock.builder()
                    .type(value.getType()).side(value.getSide()).url(value.getUrl()).alt(value.getAlt())
                    .caption(value.getCaption()).subheading(value.getSubheading()).heading(value.getHeading())
                    .html(decorate(value.getHtml(), dimensions)).build();
        }
        return block;
    }

    private static SuitabilitySection decorate(SuitabilitySection section, Map<String, Dimensions> dimensions) {
        if (section == null) return null;
        return SuitabilitySection.builder().title(section.getTitle())
                .html(decorate(section.getHtml(), dimensions)).build();
    }

    private static SizeGuideSection decorate(SizeGuideSection section, Map<String, Dimensions> dimensions) {
        if (section == null) return null;
        return SizeGuideSection.builder().title(section.getTitle())
                .html(decorate(section.getHtml(), dimensions)).build();
    }

    private static String htmlOf(DescriptionBlock block) {
        if (block instanceof DescriptionBlock.ParagraphBlock value) return value.getHtml();
        if (block instanceof DescriptionBlock.CalloutBlock value) return value.getHtml();
        if (block instanceof DescriptionBlock.FeatureBlock value) return value.getHtml();
        return null;
    }

    private record Dimensions(int width, int height) {}
}
