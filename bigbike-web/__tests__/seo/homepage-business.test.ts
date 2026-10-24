import { describe, expect, it } from "vitest";
import { buildHomepageBusinessJsonLd } from "@/lib/seo/homepage-business";
import { serializeJsonLd } from "@/lib/seo/json-ld";

function graph() {
  return buildHomepageBusinessJsonLd()["@graph"] as Record<string, unknown>[];
}

describe("hồ sơ doanh nghiệp trang chủ — SEO_RULE_012", () => {
  it("liên kết đúng doanh nghiệp và cửa hàng, không tạo LocalBusiness cũ", () => {
    const [organization, store] = graph();
    expect(graph()).toHaveLength(2);
    expect(organization).toMatchObject({
      "@type": "Organization",
      "@id": "https://bigbike.vn/#organization",
      name: "Shop Bigbike",
      url: "https://bigbike.vn/",
      foundingDate: "2014",
    });
    expect(store).toMatchObject({
      "@type": "SportingGoodsStore",
      "@id": "https://bigbike.vn/#store",
      name: organization.name,
      parentOrganization: { "@id": organization["@id"] },
      currenciesAccepted: "VND",
    });
    expect(serializeJsonLd(buildHomepageBusinessJsonLd())).not.toMatch(
      /LocalBusiness|0906 902 404/,
    );
  });

  it("dùng số chính, số bán hàng và địa chỉ Maps đã chốt trong phiếu", () => {
    const [, store] = graph();
    expect(store.telephone).toBe("+84764640679");
    expect(store.contactPoint).toMatchObject([
      { telephone: store.telephone, contactType: "customer service" },
      { telephone: "+84906902404", contactType: "sales" },
    ]);
    expect(store.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "79/30/52 Âu Cơ",
      addressLocality: "Phường Hòa Bình",
      addressRegion: "Thành phố Hồ Chí Minh",
      postalCode: "700000",
      addressCountry: "VN",
    });
    expect(store.geo).toMatchObject({ latitude: 10.7699006, longitude: 106.648536 });
    expect(store.hasMap).toBe("https://www.google.com/maps?cid=10172478217895770333");
    expect(store.sameAs).toContain(store.hasMap);
    expect(graph()[0].sameAs).toContain(store.hasMap);
  });

  it("khai đủ bảy ngày, Chủ nhật đóng lúc 17 giờ", () => {
    const [, store] = graph();
    expect(store.openingHoursSpecification).toMatchObject([
      {
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "09:00",
        closes: "21:00",
      },
      { dayOfWeek: "Sunday", opens: "09:00", closes: "17:00" },
    ]);
  });
});
