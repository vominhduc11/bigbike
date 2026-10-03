-- Remove the four verified-unused variant attribute types from the 2026-09-20
-- catalog cleanup. The guard runs immediately before the delete so a later use
-- of any type stops the migration instead of deleting live catalog references.

DO $$
DECLARE
    target_codes text[] := ARRAY['dungtich', 'kich-thuoc-oc', 'cap', 'solo'];
    target_count integer;
    usage_count bigint;
BEGIN
    SELECT count(*)
    INTO target_count
    FROM attributes
    WHERE code = ANY (target_codes);

    -- A second invocation after a successful cleanup is intentionally harmless.
    IF target_count = 0 THEN
        RETURN;
    END IF;

    IF target_count <> cardinality(target_codes) THEN
        RAISE EXCEPTION
            'V1089 stopped: expected all four target attribute types, found %',
            target_count;
    END IF;

    SELECT count(*)
    INTO usage_count
    FROM product_variant_options pvo
    WHERE pvo.attribute_id IN (
        SELECT a.id FROM attributes a WHERE a.code = ANY (target_codes)
    )
       OR pvo.attribute_value_id IN (
        SELECT av.id
        FROM attribute_values av
        JOIN attributes a ON a.id = av.attribute_id
        WHERE a.code = ANY (target_codes)
    );

    IF usage_count > 0 THEN
        RAISE EXCEPTION
            'V1089 stopped: target attribute types are used by % variant option rows',
            usage_count;
    END IF;

    -- Delete values explicitly so the intended scope is visible in the
    -- migration; the FK cascade would produce the same result.
    DELETE FROM attribute_values
    WHERE attribute_id IN (
        SELECT a.id FROM attributes a WHERE a.code = ANY (target_codes)
    );

    DELETE FROM attributes
    WHERE code = ANY (target_codes);
END $$;
