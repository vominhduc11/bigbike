package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpAttachmentMeta;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class WordPressMediaMapper {

    public record MappedMedia(
            long sourceId,
            String storagePath,
            String mimeType,
            String altText,
            String title,
            String status,
            List<String> warnings
    ) {}

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

        // Phase 2A: storagePath stays as relative WP uploads path; actual file copy is Phase 2E
        return new MappedMedia(
                attachment.postId(),
                storagePath,
                mimeType,
                attachment.altText(),
                attachment.title(),
                "ACTIVE",
                warnings
        );
    }
}
