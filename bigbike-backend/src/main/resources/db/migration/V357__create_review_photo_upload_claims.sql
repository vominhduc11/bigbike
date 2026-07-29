CREATE TABLE review_photo_uploads (
    object_key VARCHAR(500) PRIMARY KEY,
    public_url VARCHAR(600) NOT NULL UNIQUE,
    product_id VARCHAR(64) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ NULL,
    review_id BIGINT NULL,
    CONSTRAINT fk_review_photo_upload_review
        FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE SET NULL
);

CREATE INDEX idx_review_photo_uploads_unclaimed_age
    ON review_photo_uploads (review_id, uploaded_at);
