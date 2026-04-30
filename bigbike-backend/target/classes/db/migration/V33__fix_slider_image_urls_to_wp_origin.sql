-- V33: Replace localhost MinIO slider URLs with real bigbike.vn origin URLs.
-- V19 seeded sliders using http://localhost:9000/bigbike-media/wp-uploads/... which only
-- works when local MinIO is running with images pre-loaded. Slides 4 and 5 also had
-- incorrect -scaled suffixes that do not exist on the origin server.
-- Source of truth: wp_postmeta rows for post 12 (homepage) from sqldump.sql (2026-04-17).

update sliders
set    desktop_image = '{"url":"https://bigbike.vn/wp-content/uploads/2025/08/tro-chuyen-doi-ket-noi-mai-s9xm-4.jpg","alt":"SCS S9XM Bluetooth Intercom","width":1920,"height":720}',
       mobile_image  = '{"url":"https://bigbike.vn/wp-content/uploads/2025/08/tro-chuyen-doi-ket-noi-mai-s9xm-doc.jpg","alt":"SCS S9XM Bluetooth Intercom","width":768,"height":960}',
       updated_at    = now()
where  id = 'slider_home_0'
  and  desktop_image::text not like '%bigbike.vn/wp-content%';

update sliders
set    desktop_image = '{"url":"https://bigbike.vn/wp-content/uploads/2025/08/csbrdve-1.jpg","alt":"ILM Racing Helmet MF509","width":1920,"height":720}',
       mobile_image  = '{"url":"https://bigbike.vn/wp-content/uploads/2025/08/adfgsf-1.jpg","alt":"ILM Racing Helmet MF509","width":768,"height":960}',
       updated_at    = now()
where  id = 'slider_home_1'
  and  desktop_image::text not like '%bigbike.vn/wp-content%';

update sliders
set    desktop_image = '{"url":"https://bigbike.vn/wp-content/uploads/2025/08/jlm-jc08.jpg","alt":"ILM JC08 Gloves","width":1920,"height":720}',
       mobile_image  = null,
       updated_at    = now()
where  id = 'slider_home_2'
  and  desktop_image::text not like '%bigbike.vn/wp-content%';

update sliders
set    desktop_image = '{"url":"https://bigbike.vn/wp-content/uploads/2025/08/ls2-como-vs-garda.jpg","alt":"LS2 Garda Air","width":1920,"height":720}',
       mobile_image  = '{"url":"https://bigbike.vn/wp-content/uploads/2025/08/ls2-como-vs-garda-doc.jpg","alt":"LS2 Garda Air","width":768,"height":960}',
       updated_at    = now()
where  id = 'slider_home_3'
  and  desktop_image::text not like '%bigbike.vn/wp-content%';

-- Slide 4: V19 had wrong -scaled suffix; real filename is scs-s9x.jpg / scs-s9x-bia-2.jpg
update sliders
set    desktop_image = '{"url":"https://bigbike.vn/wp-content/uploads/2024/10/scs-s9x.jpg","alt":"SCS S9X Bluetooth","width":1920,"height":720}',
       mobile_image  = '{"url":"https://bigbike.vn/wp-content/uploads/2024/10/scs-s9x-bia-2.jpg","alt":"SCS S9X Bluetooth","width":768,"height":960}',
       updated_at    = now()
where  id = 'slider_home_4'
  and  desktop_image::text not like '%bigbike.vn/wp-content%';

-- Slide 5: V19 had wrong -scaled suffix; real filename is scs-s7x-banner-1.jpg
update sliders
set    desktop_image = '{"url":"https://bigbike.vn/wp-content/uploads/2024/06/scs-s7x-banner-1.jpg","alt":"SCS S7X Bluetooth","width":1920,"height":720}',
       mobile_image  = '{"url":"https://bigbike.vn/wp-content/uploads/2024/06/scs-s7x-banner-doc-1-1.jpg","alt":"SCS S7X Bluetooth","width":768,"height":960}',
       updated_at    = now()
where  id = 'slider_home_5'
  and  desktop_image::text not like '%bigbike.vn/wp-content%';

update sliders
set    desktop_image = '{"url":"https://bigbike.vn/wp-content/uploads/2023/12/spyke.jpg","alt":"ADV Spyke Sahara","width":1920,"height":720}',
       mobile_image  = '{"url":"https://bigbike.vn/wp-content/uploads/2023/12/spyke2.jpg","alt":"ADV Spyke Sahara","width":768,"height":960}',
       updated_at    = now()
where  id = 'slider_home_6'
  and  desktop_image::text not like '%bigbike.vn/wp-content%';

update sliders
set    desktop_image = '{"url":"https://bigbike.vn/wp-content/uploads/2023/08/SCS-NEW-03-03-2.png","alt":"Tai nghe Bluetooth SCS gan mu bao hiem","width":1920,"height":720}',
       mobile_image  = '{"url":"https://bigbike.vn/wp-content/uploads/2023/08/SCS-NEW-02-1.png","alt":"Tai nghe Bluetooth SCS gan mu bao hiem","width":768,"height":960}',
       updated_at    = now()
where  id = 'slider_home_7'
  and  desktop_image::text not like '%bigbike.vn/wp-content%';
