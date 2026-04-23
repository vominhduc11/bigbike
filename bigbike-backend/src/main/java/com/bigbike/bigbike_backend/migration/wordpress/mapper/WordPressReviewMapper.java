package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpComment;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpCommentMeta;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class WordPressReviewMapper {

    public record MappedReview(
            long legacyId,
            long wpProductPostId,
            String authorName,
            String authorEmail,
            short rating,
            String body,
            String status,
            java.time.LocalDateTime commentDateGmt
    ) {}

    public MappedReview map(WpComment comment, List<WpCommentMeta> metas) {
        short rating = 5;
        for (WpCommentMeta m : metas) {
            if ("rating".equals(m.metaKey())) {
                try {
                    int r = Integer.parseInt(m.metaValue().trim());
                    if (r >= 1 && r <= 5) rating = (short) r;
                } catch (NumberFormatException ignored) {}
            }
        }

        String status = switch (comment.commentApproved()) {
            case "1"    -> "APPROVED";
            case "spam" -> "SPAM";
            default     -> "PENDING";
        };

        String body = comment.commentContent();
        if (body != null && body.isBlank()) body = null;

        String authorName = comment.commentAuthor();
        if (authorName != null && authorName.isBlank()) authorName = null;

        String authorEmail = comment.commentAuthorEmail();
        if (authorEmail != null && authorEmail.isBlank()) authorEmail = null;

        return new MappedReview(
                comment.commentId(),
                comment.commentPostId(),
                authorName,
                authorEmail,
                rating,
                body,
                status,
                comment.commentDateGmt()
        );
    }
}
