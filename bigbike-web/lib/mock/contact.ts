export const CONTACT_INFO = {
  phones: [
    { number: "028.62797251", label: "Hotline" },
    { number: "0764640679", label: "Mrs. Thư / Zalo" },
    { number: "0906902404", label: "Mr. Trí" },
  ],
  address: "79/30/52 Âu Cơ, Phường 14, Quận 11, TP.HCM",
  email: "info@bigbike.vn",
  hours: {
    weekdays: { label: "Thứ 2 — Thứ 6", value: "09:00 — 21:00" },
    weekend: { label: "Thứ 7 / Chủ Nhật", value: "09:00 — 18:00" },
  },
  social: {
    facebook: "https://www.facebook.com/bigbikegear",
    youtube: "https://www.youtube.com/@bigbikevn",
    zalo: "https://zalo.me/0764640679",
  },
  geo: {
    lat: 10.769986186087817,
    lng: 106.64855745664354,
  },
  schemaOrg: {
    "@type": ["AutoBodyShop", "LocalBusiness"],
    name: "BigBike.vn",
    telephone: "+842862797251",
    address: {
      "@type": "PostalAddress",
      streetAddress: "79/30/52 Âu Cơ",
      addressLocality: "Phường 14, Quận 11",
      addressRegion: "Hồ Chí Minh",
      addressCountry: "VN",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "21:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Saturday", "Sunday"],
        opens: "09:00",
        closes: "18:00",
      },
    ],
    sameAs: ["https://www.facebook.com/bigbikegear"],
  },
} as const;
