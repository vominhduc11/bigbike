-- V272 — Article "home_experience" flag.
--
-- Lets admins hand-pick which articles appear in the homepage "Góc trải nghiệm cùng BigBike"
-- carousel instead of the storefront auto-pulling the 3 latest Reviews articles.
-- Drives the public ?homeExperience=true filter (GET /api/v1/articles) and the admin toggle.
-- When no article is flagged, the web storefront falls back to the latest Reviews articles.

ALTER TABLE articles ADD COLUMN home_experience boolean NOT NULL DEFAULT false;
