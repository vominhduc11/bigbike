package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpAttachmentMeta;
import com.bigbike.bigbike_backend.migration.wordpress.parser.PhpSerializeParser;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Maps WordPress attachment posts to MappedMedia records.
 * Parses _wp_attachment_metadata PHP-serialized value to extract width and height.
 * Physical file copy is deferred to Phase 2E.
 */
@Component
@RequiredArgsConstructor
public class WordPressMediaMapper {

    public record MappedMedia(
            long sourceId,
            String storagePath,
            String mimeType,
            String altText,
            String title,
            Integer width,
            Integer height,
            String sizesJson,
            String status,
            List<String> warnings
    ) {}

    private final PhpSerializeParser phpParser;

    public MappedMedia map(WpAttachmentMeta attachment) {
        List<String> warnings = new ArrayList<>();

        String storagePath = attachment.attachedFile();
        if (storagePath == null || storagePath.isBlank()) {
            warnings.add("Missing _wp_attached_file for attachment id=" + attachment.postId());
        }

        String mimeType = attachment.mimeType();
        if (mimeType == null || mimeType.isBlank()) {
            warnings.add("Missing post_mime_type for attachment id=" + attachment.postId());
            mimeType = "application/octet-stream";
        }

        // Parse width/height from PHP serialized _wp_attachment_metadata
        Integer width = null;
        Integer height = null;
        String sizesJson = null;

        String serialized = attachment.serializedMetadata();
        if (serialized != null && !serialized.isBlank()) {
            PhpSerializeParser.ParseResult parseResult = phpParser.parse(serialized);
            warnings.addAll(parseResult.warnings());

            if (parseResult.value() instanceof Map<?, ?> rawMeta) {
                @SuppressWarnings("unchecked")
                Map<Object, Object> meta = (Map<Object, Object>) rawMeta;

                Long w = PhpSerializeParser.getLong(meta, "width");
                Long h = PhpSerializeParser.getLong(meta, "height");
                if (w != null) width = w.intValue();
                if (h != null) height = h.intValue();

                // Collect sizes as a simple JSON-like summary for the dry-run report
                Object sizesObj = meta.get("sizes");
                if (sizesObj instanceof Map<?, ?> sizesMap) {
                    sizesJson = buildSizesJson(sizesMap);
                }
            } else if (parseResult.value() != null) {
                warnings.add("Unexpected _wp_attachment_metadata type for id=" + attachment.postId());
            }
        }

        return new MappedMedia(
                attachment.postId(),
                storagePath,
                mimeType,
                attachment.altText(),
                attachment.title(),
                width,
                height,
                sizesJson,
                "ACTIVE",
                warnings
        );
    }

    @SuppressWarnings("unchecked")
    private String buildSizesJson(Map<?, ?> sizesMap) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<?, ?> entry : sizesMap.entrySet()) {
            if (!first) sb.append(",");
            first = false;
            String sizeName = entry.getKey().toString();
            sb.append("\"").append(sizeName).append("\":{");
            if (entry.getValue() instanceof Map<?, ?> sizeData) {
                Map<Object, Object> sd = (Map<Object, Object>) sizeData;
                Long sw = PhpSerializeParser.getLong(sd, "width");
                Long sh = PhpSerializeParser.getLong(sd, "height");
                String file = PhpSerializeParser.getString(sd, "file");
                String mime = PhpSerializeParser.getString(sd, "mime-type");
                sb.append("\"width\":").append(sw != null ? sw : 0)
                  .append(",\"height\":").append(sh != null ? sh : 0);
                if (file != null) sb.append(",\"file\":\"").append(file.replace("\"", "\\\"")).append("\"");
                if (mime != null) sb.append(",\"mime\":\"").append(mime).append("\"");
            }
            sb.append("}");
        }
        sb.append("}");
        return sb.toString();
    }
}
