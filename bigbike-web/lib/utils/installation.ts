/**
 * "Hướng dẫn lắp đặt" (V242) — field `installationGuide` lưu JSON object có cấu trúc
 * `{ steps: [{ icon, title, body, tip?, warning? }], maintenance? }` (trước V242 là rich-HTML
 * tự do). Helper parse dùng chung cho cả server (ProductView — gate hiển thị) lẫn client
 * (ProductInstallationGuide — render). Để ở module thuần (KHÔNG "use client") để server
 * component import an toàn, không vướng ranh giới RSC. Mirror `suitability.ts`.
 */
export type InstallationStep = {
  icon?: string | null;
  title?: string | null;
  body?: string | null;
  tip?: string | null;
  warning?: string | null;
};

export type InstallationGuide = {
  steps: InstallationStep[];
  maintenance: string;
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseInstallationGuide(raw: unknown): InstallationGuide {
  if (typeof raw !== "string" || !raw.trim()) return { steps: [], maintenance: "" };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { steps: [], maintenance: "" };
    }
    const rawSteps = Array.isArray((parsed as { steps?: unknown }).steps)
      ? ((parsed as { steps: unknown[] }).steps)
      : [];
    const steps: InstallationStep[] = rawSteps
      .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === "object")
      .map((s) => ({
        icon: str(s.icon),
        title: str(s.title),
        body: str(s.body),
        tip: str(s.tip),
        warning: str(s.warning),
      }));
    return { steps, maintenance: str((parsed as { maintenance?: unknown }).maintenance) };
  } catch {
    return { steps: [], maintenance: "" };
  }
}

/** Một bước "có nội dung" = có ít nhất tiêu đề hoặc nội dung. */
function stepHasContent(step: InstallationStep): boolean {
  return Boolean((step.title ?? "").trim() || (step.body ?? "").trim());
}

/** Khối "có nội dung" = có ít nhất một bước có nội dung, hoặc có ghi chú bảo dưỡng. */
export function hasInstallationContent(raw: unknown): boolean {
  const guide = parseInstallationGuide(raw);
  return guide.steps.some(stepHasContent) || guide.maintenance.trim().length > 0;
}
