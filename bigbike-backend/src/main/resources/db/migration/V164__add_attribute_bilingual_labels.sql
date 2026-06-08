-- Variant attribute bilingual labels (V164). The attribute display name (e.g.
-- "Màu sắc") and value label (e.g. "Đỏ") get optional English variants. The PDP
-- variant selector resolves them by locale, falling back to Vietnamese via
-- COALESCE(name_en, name) / COALESCE(label_en, label). The code/slug keys stay
-- immutable (variant options resolve to attributes/values via them).
alter table attributes
    add column name_en varchar(255);
alter table attribute_values
    add column label_en varchar(255);
