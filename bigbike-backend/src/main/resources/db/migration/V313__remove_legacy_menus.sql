-- DB migration V313: remove legacy menu locations (footer, guide, policy)
-- that are now hardcoded or static on the storefront, keeping only the header (primary) menu.

-- Set parent_id of menu items belonging to the target menus to NULL
-- to prevent self-referential parent_id foreign key constraint violation during delete.
UPDATE menu_items 
SET parent_id = NULL 
WHERE menu_id IN (
    SELECT id FROM menus WHERE location IN ('footer', 'guide', 'policy')
);

-- Delete the menus. ON DELETE CASCADE will automatically clean up the associated menu_items.
DELETE FROM menus 
WHERE location IN ('footer', 'guide', 'policy');
