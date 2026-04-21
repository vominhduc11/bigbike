package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTerm;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class WordPressMenuMapper {

    public record MappedMenu(String location, String name, List<MappedMenuItem> items) {}

    public record MappedMenuItem(
            long sourceId,
            String label,
            String url,
            Long parentSourceId,
            int sortOrder,
            boolean openInNewTab,
            String cssClass,
            List<String> warnings
    ) {}

    public MappedMenu mapMenu(WpTerm navMenuTerm, List<WpPost> navMenuItems, List<WpPostMeta> allMetas) {
        Map<Long, Map<String, String>> metaByPost = allMetas.stream()
                .filter(m -> navMenuItems.stream().anyMatch(p -> p.id() == m.postId()))
                .collect(Collectors.groupingBy(
                        WpPostMeta::postId,
                        Collectors.toMap(WpPostMeta::metaKey, WpPostMeta::metaValue, (a, b) -> a)
                ));

        List<MappedMenuItem> items = navMenuItems.stream()
                .map(post -> mapMenuItem(post, metaByPost.getOrDefault(post.id(), Map.of())))
                .toList();

        return new MappedMenu(navMenuTerm.slug(), navMenuTerm.name(), items);
    }

    private MappedMenuItem mapMenuItem(WpPost post, Map<String, String> meta) {
        List<String> warnings = new ArrayList<>();

        String url = meta.getOrDefault("_menu_item_url", "#");
        String label = meta.getOrDefault("_menu_item_title", "");
        if (label.isBlank()) {
            label = post.postTitle();
        }
        if (label.isBlank()) {
            warnings.add("Empty label for nav_menu_item id=" + post.id());
            label = url;
        }

        Long parentId = null;
        String parentMeta = meta.get("_menu_item_menu_item_parent");
        if (parentMeta != null && !parentMeta.equals("0")) {
            try { parentId = Long.parseLong(parentMeta); }
            catch (NumberFormatException e) { warnings.add("Invalid parent id: " + parentMeta); }
        }

        String target = meta.getOrDefault("_menu_item_target", "");
        boolean openInNewTab = "_blank".equals(target);

        String classes = meta.getOrDefault("_menu_item_classes", "");
        // PHP serialized array: a:1:{i:0;s:0:"";} — extract if non-empty
        String cssClass = extractCssClass(classes);

        return new MappedMenuItem(
                post.id(), label, url, parentId,
                post.menuOrder(), openInNewTab, cssClass, warnings
        );
    }

    private String extractCssClass(String phpSerialized) {
        if (phpSerialized == null || phpSerialized.isBlank()) return "";
        // Minimal extraction: find s:\d+:"..." pattern and collect non-empty values
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("s:\\d+:\"([^\"]+)\"")
                .matcher(phpSerialized);
        List<String> classes = new ArrayList<>();
        while (m.find()) {
            String cls = m.group(1);
            if (!cls.isBlank()) classes.add(cls);
        }
        return String.join(" ", classes);
    }
}
