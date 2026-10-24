/** Hồ sơ Google Business theo phiếu owner 2026-10-22, SEO_RULE_012. */
export function buildHomepageBusinessJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://bigbike.vn/#organization",
        name: "Shop Bigbike",
        alternateName: ["BigBike.vn", "Shop Bảo Hộ Bigbike"],
        url: "https://bigbike.vn/",
        logo: "https://bigbike.vn/wp/logo.png",
        email: "bigbikevnshop@gmail.com",
        foundingDate: "2014",
        sameAs: [
          "https://www.google.com/maps?cid=10172478217895770333",
          "https://www.facebook.com/bigbikegear",
          "https://www.youtube.com/@bigbike-shop",
          "https://www.tiktok.com/@bigbike.vn",
          "https://shopee.vn/shopbaohobigbike",
          "https://zalo.me/84764640679",
        ],
      },
      {
        "@type": "SportingGoodsStore",
        "@id": "https://bigbike.vn/#store",
        name: "Shop Bigbike",
        alternateName: "BigBike.vn",
        description:
          "Shop đồ bảo hộ mô tô chính hãng tại TP.HCM từ 2014: mũ bảo hiểm, áo giáp, găng tay, giày bảo hộ, tai nghe bluetooth.",
        url: "https://bigbike.vn/",
        logo: "https://bigbike.vn/wp/logo.png",
        image: "https://bigbike.vn/wp/logo.png",
        telephone: "+84764640679",
        email: "bigbikevnshop@gmail.com",
        priceRange: "₫₫",
        currenciesAccepted: "VND",
        parentOrganization: { "@id": "https://bigbike.vn/#organization" },
        address: {
          "@type": "PostalAddress",
          streetAddress: "79/30/52 Âu Cơ",
          addressLocality: "Phường Hòa Bình",
          addressRegion: "Thành phố Hồ Chí Minh",
          postalCode: "700000",
          addressCountry: "VN",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: 10.7699006,
          longitude: 106.648536,
        },
        hasMap: "https://www.google.com/maps?cid=10172478217895770333",
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            opens: "09:00",
            closes: "21:00",
          },
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: "Sunday",
            opens: "09:00",
            closes: "17:00",
          },
        ],
        contactPoint: [
          {
            "@type": "ContactPoint",
            telephone: "+84764640679",
            contactType: "customer service",
            availableLanguage: ["Vietnamese", "English"],
          },
          {
            "@type": "ContactPoint",
            telephone: "+84906902404",
            contactType: "sales",
            availableLanguage: "Vietnamese",
          },
        ],
        areaServed: [
          { "@type": "City", name: "Thành phố Hồ Chí Minh" },
          { "@type": "Country", name: "Việt Nam" },
        ],
        sameAs: [
          "https://www.google.com/maps?cid=10172478217895770333",
          "https://www.facebook.com/bigbikegear",
          "https://www.tiktok.com/@bigbike.vn",
        ],
      },
    ],
  };
}
