import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/utils/routes";

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin().replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/gio-hang.html",
        "/gio-hang/",
        "/thanh-toan.html",
        "/thanh-toan/",
        "/tai-khoan",
        "/dang-nhap",
        "/dang-ky",
        "/quen-mat-khau",
        "/tim-kiem",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
