-- V134: Remove the stale "Ví điện tử (Momo, ZaloPay)" payment option from the
-- "huong-dan-mua-hang" static page body.
--
-- BigBike online checkout supports only COD and bank transfer. The Alepay/ZaloPay
-- payment-gateway plan was dropped, so the buying guide must no longer list any
-- e-wallet method. The page is served from the `pages` table; the earlier seed
-- migrations (V21, V97) used `where not exists` and never updated this row.

update pages
set body = replace(body,
                   E'<li><strong>Ví điện tử</strong> (Momo, ZaloPay)</li>\n',
                   ''),
    updated_at = now()
where slug = 'huong-dan-mua-hang'
  and body like '%Ví điện tử%';
