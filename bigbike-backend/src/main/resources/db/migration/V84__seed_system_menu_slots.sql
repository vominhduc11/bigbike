-- V84: Ensure all three system menu slots exist.
--
-- The public web frontend (header / footer / guide widget) only consumes
-- menus at the locations 'primary', 'footer', 'guide'. Earlier migrations
-- seeded 'footer' and 'guide' (V22) but never seeded 'primary' for prod —
-- that location was previously created only by dev migrations or by manual
-- WordPress imports. As of V84 the admin API also blocks creation of
-- non-system locations and blocks deletion of system locations, so the
-- canonical lifecycle of these slots is "always present".
--
-- This migration is idempotent: it only inserts missing rows. It also
-- recovers prod databases where an admin previously deleted a system menu
-- through the (now-blocked) DELETE endpoint.

insert into menus (id, location, name, status, created_at, updated_at)
select '00000000-0000-0000-0000-000000000840',
       'primary',
       'Header Menu',
       'ACTIVE',
       now(),
       now()
where not exists (select 1 from menus where location = 'primary');

insert into menus (id, location, name, status, created_at, updated_at)
select '00000000-0000-0000-0000-000000000841',
       'footer',
       'Footer Navigation',
       'ACTIVE',
       now(),
       now()
where not exists (select 1 from menus where location = 'footer');

insert into menus (id, location, name, status, created_at, updated_at)
select '00000000-0000-0000-0000-000000000842',
       'guide',
       'Buying Guide Menu',
       'ACTIVE',
       now(),
       now()
where not exists (select 1 from menus where location = 'guide');
