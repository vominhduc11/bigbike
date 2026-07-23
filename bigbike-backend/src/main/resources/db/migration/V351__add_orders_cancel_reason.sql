ALTER TABLE orders ADD COLUMN cancel_reason text;

UPDATE orders o
SET cancel_reason = sub.content
FROM (
    SELECT DISTINCT ON (order_id) order_id, content
    FROM order_notes
    WHERE note_type = 'ADMIN'
    ORDER BY order_id, created_at DESC
) sub
WHERE o.id = sub.order_id AND o.status = 'CANCELLED';
