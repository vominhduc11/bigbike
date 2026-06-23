-- Remove the admin-managed contact page builder (was V224).
--
-- The contact page (/lien-he) is now a STATIC page: its layout is fixed in code
-- (bigbike-web/app/lien-he + components/contact/ContactPageContent). The shared contact
-- info (hotline / address / opening hours / social URLs) still lives in site_settings
-- group `contact` — single source for header/footer/about — it is simply no longer edited
-- through a page builder. This drops the now-orphaned singleton layout table; its Java
-- mapping (entity/repository/converter/service/controllers) has been deleted in the same change.

DROP TABLE IF EXISTS contact_page_layout;
