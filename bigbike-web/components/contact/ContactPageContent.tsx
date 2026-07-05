"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { Store, Clock, Phone, MapPin, MessageSquare, ChevronRight, ExternalLink } from "lucide-react";
import { telHref } from "@/lib/utils/format";

/**
 * Nội dung trang Liên hệ (/lien-he) — TRANG TĨNH HOÀN TOÀN, dựng lại theo mockup owner
 * (bigbike_contact_section): bản đồ tràn viền + lưới 2 cột ngăn bằng đường kẻ mảnh,
 * mỗi dòng có ô icon, tiêu đề cột là icon + chữ IN HOA gạch chân đỏ, hàng chỉ số ở dưới.
 *
 * ⚠️ TẠI SAO DÙNG INLINE STYLE THAY VÌ CLASS TAILWIND?
 * Trang nằm dưới `wp-theme-static.css` (nạp bởi WpStaticShell) — file này có rule element
 * trần UNLAYERED `a{color:#007bff}`, `p{margin-bottom:1rem}`… Tailwind v4 nằm trong @layer
 * nên LUÔN thua rule unlayered → màu/đậm/khoảng cách/link sẽ bị đè. Inline style thắng mọi
 * rule unlayered nên màu/viền/spacing/link đặt qua `style`. Chỉ CỠ CHỮ (text-ui-*) và LƯỚI
 * responsive (grid + md:) dùng Tailwind — đây là các thuộc tính WP không nhắm tới element
 * trần nên không bị đè, đồng thời cho phép co theo màn hình giống trang chủ / PDP.
 *
 * Owner đã chốt: góc vuông (đồng bộ web), bản đồ tràn 2 mép 420px, KHÔNG nút VI/EN riêng
 * (header đã có sẵn). Số điện thoại / địa chỉ / giờ / mạng xã hội lấy từ site_settings (props),
 * KHÔNG hardcode (AGENTS.md §6.5 — guard check-no-runtime-business-data).
 */

export type ContactInfo = {
  hotline: string;
  hotline2: string;
  hotline3?: string;
  address: string;
  hoursWeekday: string;
  hoursWeekend: string;
  hoursHoliday: string;
  zaloUrl: string;
  facebookUrl: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  shopeeUrl?: string;
  instagramUrl?: string;
  email?: string;
};

/* Brand palette — khớp WP gốc (đỏ #ff0c09 = .information--item h3) */
const RED = "#ff0c09";
const TEXT = "#111111";
const MUTED = "#6f6f6f";
const FAINT = "#999999";
const BORDER = "#dfdfdf";
const TILE_BG = "#f7f7f7";

function getVietnamTime() {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 7);
}

function getAddressParts(address: string) {
  if (!address) return { main: "", sub: "" };
  const parts = address.split(",");
  const main = parts[0]?.trim() || "";
  const sub = parts.slice(1).join(",").trim();
  return { main, sub };
}

function getSocialHandle(
  url: string,
  type: "facebook" | "youtube" | "tiktok" | "shopee"
): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+|\/+$/g, "");
    if (type === "facebook") return path ? `facebook.com/${path}` : u.host;
    if (type === "youtube") return path ? `@${path.replace(/^@/, "")}` : u.host;
    if (type === "tiktok") return path ? `@${path.replace(/^@/, "")}` : u.host;
    if (type === "shopee") return path ? path : u.host;
    return path ? `@${path}` : u.host;
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "");
  }
}

function getZaloDisplayPhone(zaloUrl: string): string {
  if (!zaloUrl) return "";
  const match = zaloUrl.match(/zalo\.me\/(\d+)/);
  if (match && match[1]) {
    let phone = match[1];
    if (phone.startsWith("84")) phone = "0" + phone.slice(2);
    if (phone.length === 10)
      return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
    return phone;
  }
  return "";
}

/* ─── Sub-components ─── */

function ColHeader({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 20,
        paddingBottom: 12,
        borderBottom: `2px solid ${RED}`,
      }}
    >
      {icon}
      <h2
        className="text-ui-22 max-md:text-ui-18"
        style={{
          margin: 0,
          fontWeight: 700,
          color: TEXT,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontFamily: "var(--bb-font-cta), sans-serif",
        }}
      >
        {children}
      </h2>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: TILE_BG,
          border: `1px solid ${BORDER}`,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          className="text-ui-12"
          style={{
            marginBottom: 4,
            color: FAINT,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 600,
          }}
        >
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

function SocialLink({
  href,
  bg,
  icon,
  name,
  sub,
}: {
  href: string;
  bg: string;
  icon: ReactNode;
  name: string;
  sub?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        border: `1px solid ${BORDER}`,
        background: "#fff",
        textDecoration: "none",
        color: TEXT,
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: bg,
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {icon}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="text-ui-16 max-md:text-ui-14" style={{ display: "block", fontWeight: 700, color: TEXT }}>
          {name}
        </span>
        {sub && (
          <span className="text-ui-14" style={{ display: "block", color: FAINT, marginTop: 2 }}>
            {sub}
          </span>
        )}
      </span>
      <ChevronRight size={14} color="#cecece" style={{ flexShrink: 0, marginLeft: "auto" }} />
    </a>
  );
}

/* Brand glyphs (logo nền tảng — màu thương hiệu riêng, không tokenise được) */
const FbIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" aria-hidden="true">
    <path d="M12 2.04c-5.5 0-9.96 4.46-9.96 9.96 0 4.41 3.21 8.08 7.44 8.81V15.4H7.9v-3.4h1.58v-2.6c0-1.56.93-2.42 2.35-2.42.68 0 1.39.12 1.39.12v1.53h-.78c-.77 0-1.01.48-1.01.97V12h1.72l-.28 3.4h-1.44v5.41c4.23-.73 7.44-4.4 7.44-8.81 0-5.5-4.46-9.96-9.96-9.96z" />
  </svg>
);
const TiktokIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.98a8.2 8.2 0 004.79 1.54V7.07a4.85 4.85 0 01-1.02-.38z" />
  </svg>
);
const ShopeeIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" aria-hidden="true">
    <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.9 18 9 18h12v-2H9.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0023.43 5H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
  </svg>
);
const YoutubeIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" aria-hidden="true">
    <path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z" />
  </svg>
);

export function ContactPageContent({ contact }: { contact: ContactInfo }) {
  const locale = useLocale();
  const vi = locale === "vi";
  const [isOpenNow, setIsOpenNow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMounted(true);
    });
    const checkOpenStatus = () => {
      const vnTime = getVietnamTime();
      const day = vnTime.getDay();
      const timeValue = vnTime.getHours() * 100 + vnTime.getMinutes();
      if (day === 0) {
        setIsOpenNow(timeValue >= 900 && timeValue < 1800);
      } else {
        setIsOpenNow(timeValue >= 900 && timeValue < 2100);
      }
    };
    checkOpenStatus();
    const interval = setInterval(checkOpenStatus, 60000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, []);

  if (!contact) return null;

  const { main: mainAddr, sub: subAddr } = getAddressParts(contact.address || "");
  const zaloPhone = getZaloDisplayPhone(contact.zaloUrl || "");
  const mapUrl = contact.address
    ? `https://www.google.com/maps?q=${encodeURIComponent(contact.address)}&z=17&output=embed`
    : "";

  const hasHours = contact.hoursWeekday || contact.hoursWeekend || contact.hoursHoliday;

  const stats = [
    { value: "11+", label: vi ? "Năm hoạt động" : "Years active" },
    { value: "36K+", label: vi ? "Followers Facebook" : "Facebook followers" },
    { value: "98%", label: vi ? "Khách recommend" : "Customers recommend" },
  ];

  return (
    <div>
      {/* MAP — tràn 2 mép viewport (100vw), ngay dưới header. html/body đã overflow-x:clip
          nên 100vw không sinh thanh cuộn ngang. Inline style để không phụ thuộc class theme. */}
      {mapUrl && (
        <div
          style={{
            position: "relative",
            left: "50%",
            right: "50%",
            width: "100vw",
            marginLeft: "-50vw",
            marginRight: "-50vw",
            marginBottom: 30,
            height: 420,
            overflow: "hidden",
            background: "#e8e4de",
          }}
        >
          <iframe
            src={mapUrl}
            title={vi ? "Bản đồ vị trí Shop Bảo Hộ Bigbike.vn" : "BigBike store location map"}
            style={{ width: "100%", height: "100%", border: 0, display: "block" }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          {/* Floating address card */}
          {mainAddr && (
            <div
              style={{
                position: "absolute",
                bottom: 16,
                left: 20,
                background: "#fff",
                border: `1px solid ${BORDER}`,
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                maxWidth: 270,
                boxShadow: "0 2px 8px rgba(0,0,0,.12)",
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: RED,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <MapPin size={16} color="#fff" />
              </span>
              <span>
                <span
                  className="text-ui-12"
                  style={{ color: FAINT, display: "block", fontWeight: 600 }}
                >
                  {vi ? "Cửa hàng chính" : "Main store"}
                </span>
                <strong
                  className="text-ui-14"
                  style={{ color: TEXT, display: "block", lineHeight: 1.4, fontWeight: 700 }}
                >
                  {mainAddr}
                </strong>
              </span>
            </div>
          )}
          {/* Open in Google Maps */}
          {contact.address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={vi ? "Mở Google Maps" : "Open in Google Maps"}
              className="text-ui-13"
              style={{
                position: "absolute",
                bottom: 16,
                right: 20,
                background: RED,
                color: "#fff",
                padding: "8px 12px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 6,
                textDecoration: "none",
                boxShadow: "0 2px 6px rgba(0,0,0,.2)",
              }}
            >
              <ExternalLink size={13} color="#fff" />
              <span>{vi ? "Xem trên Maps" : "Open in Maps"}</span>
            </a>
          )}
        </div>
      )}

      {/* LƯỚI 2 CỘT — ngăn nhau bằng đường kẻ mảnh (gap 1px trên nền xám). Responsive:
          1 cột trên điện thoại → 2 cột từ md (768px) giống col-md-6 cũ. */}
      <div
        className="grid grid-cols-1 md:grid-cols-2"
        style={{ gap: 1, background: BORDER, borderTop: `1px solid ${BORDER}` }}
      >
        {/* CỘT TRÁI: thông tin cửa hàng */}
        <div style={{ background: "#fff", padding: 20 }}>
          <ColHeader icon={<Store size={18} color={RED} />}>
            {vi ? "Thông tin cửa hàng" : "Store information"}
          </ColHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Giờ làm việc */}
            {hasHours && (
              <InfoRow
                icon={<Clock size={16} color={RED} />}
                label={vi ? "Giờ làm việc" : "Opening hours"}
              >
                <div
                  className="text-ui-16 max-md:text-ui-14"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: "4px 16px",
                  }}
                >
                  {contact.hoursWeekday && (
                    <>
                      <span style={{ color: MUTED }}>{vi ? "T2 – T7" : "Mon – Sat"}</span>
                      <span style={{ color: TEXT, fontWeight: 700 }}>{contact.hoursWeekday}</span>
                    </>
                  )}
                  {contact.hoursWeekend && (
                    <>
                      <span style={{ color: MUTED }}>{vi ? "Chủ nhật" : "Sunday"}</span>
                      <span style={{ color: TEXT, fontWeight: 700 }}>{contact.hoursWeekend}</span>
                    </>
                  )}
                  {contact.hoursHoliday && (
                    <>
                      <span style={{ color: MUTED }}>{vi ? "Lễ / Tết" : "Holidays"}</span>
                      <span style={{ color: TEXT, fontWeight: 700 }}>{contact.hoursHoliday}</span>
                    </>
                  )}
                </div>
                {/* Badge mở/đóng cửa — chỉ render sau mount (tránh hydration mismatch) */}
                {mounted && (
                  <div
                    className="text-ui-12"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 10,
                      padding: "3px 10px",
                      fontWeight: 700,
                      background: isOpenNow ? "#e8f7ed" : "#fff0f0",
                      color: isOpenNow ? "#1a7a3c" : RED,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: isOpenNow ? "#1a7a3c" : RED,
                        display: "inline-block",
                      }}
                    />
                    {isOpenNow
                      ? vi
                        ? "Đang mở cửa"
                        : "Open now"
                      : vi
                      ? "Đang đóng cửa"
                      : "Closed now"}
                  </div>
                )}
              </InfoRow>
            )}

            {/* Địa chỉ */}
            {contact.address && (
              <InfoRow
                icon={<MapPin size={16} color={RED} />}
                label={vi ? "Địa chỉ" : "Address"}
              >
                <div
                  className="text-ui-16 max-md:text-ui-14"
                  style={{ color: TEXT, fontWeight: 700, lineHeight: 1.4 }}
                >
                  {mainAddr}
                </div>
                {subAddr && (
                  <div className="text-ui-14" style={{ marginTop: 2, color: MUTED }}>
                    {subAddr}
                  </div>
                )}
              </InfoRow>
            )}

            {/* Hotline */}
            {contact.hotline && (
              <InfoRow icon={<Phone size={16} color={RED} />} label="Hotline">
                <div className="text-ui-18 max-md:text-ui-16" style={{ color: TEXT, fontWeight: 700 }}>
                  <a href={telHref(contact.hotline)} style={{ color: TEXT, textDecoration: "none" }}>
                    {contact.hotline}
                  </a>
                  {contact.hotline2 && (
                    <>
                      <span style={{ margin: "0 6px", color: "#cecece" }}>·</span>
                      <a
                        href={telHref(contact.hotline2)}
                        style={{ color: TEXT, textDecoration: "none" }}
                      >
                        {contact.hotline2}
                      </a>
                    </>
                  )}
                  {contact.hotline3 && (
                    <>
                      <span style={{ margin: "0 6px", color: "#cecece" }}>·</span>
                      <a
                        href={telHref(contact.hotline3)}
                        style={{ color: TEXT, textDecoration: "none" }}
                      >
                        {contact.hotline3}
                      </a>
                    </>
                  )}
                </div>
                {zaloPhone && contact.zaloUrl && (
                  <div className="text-ui-14" style={{ marginTop: 4, color: MUTED }}>
                    {vi ? "Zalo: " : "Zalo: "}
                    <a
                      href={contact.zaloUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontWeight: 600, color: TEXT, textDecoration: "none" }}
                    >
                      {zaloPhone} · Mrs. Thư
                    </a>
                  </div>
                )}
              </InfoRow>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: kênh liên hệ trực tuyến */}
        <div style={{ background: "#fff", padding: 20 }}>
          <ColHeader icon={<MessageSquare size={18} color={RED} />}>
            {vi ? "Liên hệ trực tuyến" : "Contact online"}
          </ColHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {contact.zaloUrl && (
              <SocialLink
                href={contact.zaloUrl}
                bg="#0068FF"
                icon={<span>Z</span>}
                name="Zalo · Mrs. Thư"
                sub={vi ? "Tư vấn nhanh nhất" : "Fastest response"}
              />
            )}
            {contact.facebookUrl && (
              <SocialLink
                href={contact.facebookUrl}
                bg="#1877F2"
                icon={FbIcon}
                name="Facebook"
                sub={getSocialHandle(contact.facebookUrl, "facebook")}
              />
            )}
            {contact.tiktokUrl && (
              <SocialLink
                href={contact.tiktokUrl}
                bg="#010101"
                icon={TiktokIcon}
                name="TikTok"
                sub={getSocialHandle(contact.tiktokUrl, "tiktok")}
              />
            )}
            {contact.shopeeUrl && (
              <SocialLink
                href={contact.shopeeUrl}
                bg="#EE4D2D"
                icon={ShopeeIcon}
                name="Shopee"
                sub={getSocialHandle(contact.shopeeUrl, "shopee")}
              />
            )}
            {contact.youtubeUrl && (
              <SocialLink
                href={contact.youtubeUrl}
                bg="#FF0000"
                icon={YoutubeIcon}
                name="YouTube"
                sub={getSocialHandle(contact.youtubeUrl, "youtube")}
              />
            )}
          </div>
        </div>
      </div>

      {/* HÀNG CHỈ SỐ */}
      <div
        className="grid grid-cols-3"
        style={{
          gap: 1,
          background: BORDER,
          borderTop: `1px solid ${BORDER}`,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        {stats.map((stat) => (
          <div key={stat.label} style={{ background: "#fff", padding: "16px 8px", textAlign: "center" }}>
            <div
              className="text-ui-24 max-md:text-ui-22"
              style={{
                fontWeight: 700,
                color: RED,
                lineHeight: 1.2,
                fontFamily: "var(--bb-font-cta), sans-serif",
              }}
            >
              {stat.value}
            </div>
            <div
              className="text-ui-12"
              style={{
                marginTop: 3,
                color: FAINT,
                textTransform: "uppercase",
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
