package com.bigbike.bigbike_backend.service.review;

import java.math.BigDecimal;
import java.util.List;

/**
 * REVIEW_RULE_008: đánh giá chấp nhận bước 0,5 sao — 10 mức từ 1.0 đến 5.0.
 * Dùng chung giữa submit (validate) và ratingBreakdown (build đủ 9 dòng, key không số 0 thừa).
 */
public final class ReviewRatingLevels {

    /** Thứ tự giảm dần (5 → 1), đúng thứ tự hiển thị của ratingBreakdown. */
    public static final List<BigDecimal> DESCENDING = List.of(
            new BigDecimal("5.0"), new BigDecimal("4.5"), new BigDecimal("4.0"), new BigDecimal("3.5"),
            new BigDecimal("3.0"), new BigDecimal("2.5"), new BigDecimal("2.0"), new BigDecimal("1.5"),
            new BigDecimal("1.0"));

    private ReviewRatingLevels() {}

    public static boolean isValid(BigDecimal rating) {
        if (rating == null) {
            return false;
        }
        for (BigDecimal level : DESCENDING) {
            if (level.compareTo(rating) == 0) {
                return true;
            }
        }
        return false;
    }

    /** Key ổn định cho ratingBreakdown/JSON — "5"/"4.5", không phải "5.0". */
    public static String key(BigDecimal rating) {
        return rating.stripTrailingZeros().toPlainString();
    }
}
