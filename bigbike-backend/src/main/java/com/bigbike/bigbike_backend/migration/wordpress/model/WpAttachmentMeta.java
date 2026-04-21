package com.bigbike.bigbike_backend.migration.wordpress.model;

/**
 * Derived from kd_postmeta for post_type=attachment.
 * _wp_attached_file   → relative path in wp-content/uploads
 * _wp_attachment_metadata → serialized PHP array with sizes/dimensions
 * _wp_attachment_image_alt → alt text
 */
public record WpAttachmentMeta(
        long postId,
        String attachedFile,    // relative path, e.g. 2024/03/honda-abc.jpg
        String mimeType,        // from kd_posts.post_mime_type
        String altText,
        String title,
        String serializedMetadata
) {}
