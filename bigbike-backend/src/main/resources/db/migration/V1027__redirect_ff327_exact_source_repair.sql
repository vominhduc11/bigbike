-- Correct the exact reviewed FF327 source, including its .html suffix.
-- Preserve the row and hit history; only disable the unsafe mapping.
UPDATE redirects
SET enabled = false,
    updated_at = NOW()
WHERE source_pattern = '/sp/mu-bao-hiem-ls2-ff327-challenger-carbon-fold.html';
