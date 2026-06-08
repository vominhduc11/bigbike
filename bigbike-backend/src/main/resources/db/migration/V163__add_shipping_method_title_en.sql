-- Shipping method bilingual title (V163). The method title shown at checkout is
-- localized; Vietnamese `title` stays canonical and the optional English title is
-- stored in nullable `title_en`. Reads resolve via COALESCE(title_en, title).
alter table shipping_methods
    add column title_en varchar(255);
