/** STORE_HOURS_RULE_001 — owner DEV-8, 06/11/2026. */
export const STORE_HOURS = {
  opens: "09:00",
  weekdayCloses: "21:00",
  sundayCloses: "17:00",
} as const;

export function getStoreHours(locale: string) {
  const display = (time: string) => time.replace(/^0/, "");
  const span = (close: string) => `${display(STORE_HOURS.opens)} – ${display(close)}`;
  return locale === "en"
    ? {
        weekday: `Mon – Sat: ${span(STORE_HOURS.weekdayCloses)}`,
        weekend: `Sun: ${span(STORE_HOURS.sundayCloses)}`,
        holiday: "Public holidays: see Google Maps for closures",
      }
    : {
        weekday: `T2 – T7: ${span(STORE_HOURS.weekdayCloses)}`,
        weekend: `CN: ${span(STORE_HOURS.sundayCloses)}`,
        holiday: "Lễ, Tết: xem lịch nghỉ trên Google Maps",
      };
}

/** Placeholder for editable shop prose; unrelated content must opt in explicitly. */
export const STORE_HOURS_PLACEHOLDER = "{{store_hours}}";

export function resolveStoreHours(content: string, locale: string) {
  return content.replaceAll(
    STORE_HOURS_PLACEHOLDER,
    Object.values(getStoreHours(locale)).join(" · "),
  );
}

/** Regular weekly schedule; holiday exceptions are published on Google Maps. */
export function isStoreOpenAt(vietnamTime: Date) {
  const close = vietnamTime.getDay() === 0 ? STORE_HOURS.sundayCloses : STORE_HOURS.weekdayCloses;
  const minutes = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
  };
  const current = vietnamTime.getHours() * 60 + vietnamTime.getMinutes();
  return current >= minutes(STORE_HOURS.opens) && current < minutes(close);
}
