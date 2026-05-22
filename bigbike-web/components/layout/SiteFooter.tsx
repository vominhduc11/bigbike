import Image from "next/image";
import Link from "next/link";
import { Mail, PhoneCall } from "lucide-react";
import { FooterCollapsible } from "./FooterCollapsible";
import { ScrollToTopButton } from "./ScrollToTopButton";

type FooterContact = { id: string; label: string; hrefValue: string; icon: "phone" | "email" };
type FooterLink = { id: string; label: string; url: string };

const WP_FOOTER_HEADING = "Bigbike mong được lắng nghe\nvà thấu hiểu bạn hơn";
const WP_FOOTER_DESCRIPTION =
  "Shop Bigbike.vn chuyên cung cấp đồ bảo hộ moto, xe máy, phượt, mũ bảo hộ Full Face, Mũ lật cằm, mũ 3/4, mũ cào cào, áo giáp quần bảo hộ, găng tay, balo, túi đeo moto, xe máy và các phụ kiện thời trang....";
const WP_FACEBOOK_URL = "https://www.facebook.com/bigbikegear";
const WP_FACEBOOK_LABEL = "fb/bigbikegear";
const WP_BCT_URL = "http://online.gov.vn/Home/WebDetails/27044";
const WP_BUSINESS_LICENSE =
  "Giấy chứng nhận đăng ký kinh doanh số: 41K8017383 | Ngày cấp 8 tháng 3 năm 2016 | Nơi cấp: Ủy Ban Nhân Dân Quận 11";

const WP_CONTACTS: FooterContact[] = [
  { id: "hotline-main", label: "028 6279 7251", hrefValue: "028 6279 7251", icon: "phone" },
  { id: "hotline-zalo", label: "0764 640 679 - Mrs. Thư / Zalo", hrefValue: "0764 640 679", icon: "phone" },
  { id: "hotline-tri", label: "0906 902 404 - Mr. Trí", hrefValue: "0906 902 404", icon: "phone" },
  { id: "email", label: "bigbikevnshop@gmail.com", hrefValue: "bigbikevnshop@gmail.com", icon: "email" },
];

const WP_INFO_LINKS: FooterLink[] = [
  { id: "buying-guide", label: "Hướng dẫn mua hàng", url: "/huong-dan-mua-hang/" },
  { id: "online-buying-guide", label: "Hướng dẫn mua hàng Online", url: "/huong-dan-mua-hang-online/" },
  { id: "warranty", label: "Chính sách bảo hành", url: "/chinh-sach/bao-hanh/" },
  { id: "returns", label: "Chính Sách Đổi Trả Hàng", url: "/chinh-sach/doi-tra/" },
  { id: "privacy", label: "Chính sách Bảo vệ thông tin cá nhân", url: "/chinh-sach/bao-mat/" },
  { id: "terms", label: "Các Điều Kiện và Điều khoản", url: "/chinh-sach/dieu-kien-dieu-khoan/" },
];

function telHref(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function splitHeading(value: string): string[] {
  return value
    .split(/\n|<br\s*\/?>/i)
    .map((line) => line.trim())
    .filter(Boolean);
}

function ContactIcon({ icon }: { icon: FooterContact["icon"] }) {
  return (
    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border-2 border-brand text-brand md:h-[34px] md:w-[34px]">
      {icon === "phone" ? <PhoneCall size={22} strokeWidth={2.1} aria-hidden="true" /> : <Mail size={24} strokeWidth={2.1} aria-hidden="true" />}
    </span>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-black text-white">
      <div className="bg-footer-top py-[60px] max-md:pb-0">
        <div className="bb-container">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            <div className="md:col-span-7">
              <h2 className="m-0 mb-10 font-cta text-[2.875rem] font-medium uppercase leading-[1.2] text-white md:mb-[2.857rem] md:text-[3.429rem] md:leading-[4.143rem] lg:max-w-[43rem]">
                {splitHeading(WP_FOOTER_HEADING).map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </h2>

              <div className="space-y-3 max-md:mb-[30px] md:space-y-[0.55rem]">
                {WP_CONTACTS.map((item) => {
                  const isEmail = item.icon === "email";
                  const href = isEmail ? `mailto:${item.hrefValue}` : `tel:${telHref(item.hrefValue)}`;

                  return (
                    <a
                      key={item.id}
                      href={href}
                      className="flex items-start gap-5 font-cta text-[2rem] font-medium leading-[1.18] text-white no-underline transition-colors hover:text-brand md:text-[2.143rem]"
                    >
                      <ContactIcon icon={item.icon} />
                      <span>{item.label}</span>
                    </a>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-5">
              <p className="m-0 mb-[2.286rem] text-base leading-[1.786rem] text-white">{WP_FOOTER_DESCRIPTION}</p>

              <div className="grid grid-cols-1 gap-0 xl:grid-cols-12">
                <div className="xl:col-span-7">
                  <FooterCollapsible title="Thông tin">
                    <ul className="m-0 list-none p-0">
                      {WP_INFO_LINKS.map((item) => (
                        <li key={item.id} className="mb-[0.429rem] last:mb-0">
                          <Link href={item.url} className="text-base leading-[1.45] text-white no-underline transition-colors hover:text-brand">
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </FooterCollapsible>
                </div>

                <div className="xl:col-span-5">
                  <FooterCollapsible title="Mạng xã hội">
                    <ul className="m-0 list-none p-0">
                      <li className="mb-[1.571rem] last:mb-0">
                        <a
                          href={WP_FACEBOOK_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative inline-block min-h-5 whitespace-nowrap py-0 pl-10 text-base leading-none text-white no-underline transition-colors hover:text-brand"
                        >
                          <span className="absolute left-0 top-[-0.2rem] font-sans text-[1.55rem] font-bold leading-none text-brand" aria-hidden="true">
                            f
                          </span>
                          {WP_FACEBOOK_LABEL}
                        </a>
                      </li>
                    </ul>
                  </FooterCollapsible>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-black py-[30px] max-md:pb-[15px] max-md:pt-0">
        <div className="bb-container relative">
          <ScrollToTopButton />
          <div className="grid grid-cols-1 items-center md:grid-cols-12 max-md:grid-cols-3">
            <div className="md:col-span-2 max-md:order-2 max-md:col-span-1 max-md:pt-[15px]">
              <Image src="/wp/logo-footer.png" alt="BigBike" width={200} height={66} className="block h-auto w-[132px] max-md:w-[120px]" />
            </div>

            <div className="md:col-span-4 max-md:order-1 max-md:col-span-2 max-md:pt-[15px]">
              <p className="m-0 text-base text-white max-md:text-sm">Copyright © 2020. All Rights Reserved.</p>
            </div>

            <div className="md:col-span-6 max-md:order-0 max-md:col-span-3 max-md:bg-footer-top max-md:pr-[33.333333%]">
              <div>
                <a href={WP_BCT_URL} target="_blank" rel="noopener noreferrer" aria-label="Đã thông báo Bộ Công Thương">
                  <Image
                    src="/wp/license.png"
                    alt="Đã thông báo Bộ Công Thương"
                    width={250}
                    height={95}
                    className="mb-2.5 block h-auto w-[200px] md:w-[250px]"
                  />
                </a>
                <p className="m-0 mt-2.5 text-base leading-[1.214rem] text-white max-md:text-[#7e7e7e] max-md:leading-5">{WP_BUSINESS_LICENSE}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
