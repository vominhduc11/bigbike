"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { setTheme, useTheme } from "@/lib/theme/theme-store";
import { cn } from "@/lib/utils";

/**
 * Công tắc bật/tắt dark mode (2 trạng thái: Sáng/Tối, không có "Theo hệ
 * thống") — sống trong `.user-control` của WpHeader, cạnh WpLangSwitch/
 * WpSearchIcon. Header LUÔN nền đen cố định ở CẢ HAI theme (không đổi theo
 * data-theme trên trang) — nên track/thumb ở đây dùng token PRIMITIVE cố
 * định (--bb-color-*, --bb-brand-primary-on-dark), KHÔNG dùng token phản ứng
 * theme trang (--bb-bg-surface/--bb-border-control/--bb-action-primary...):
 * những token đó đổi giá trị khi trang sang dark, nhưng nền header không đổi
 * theo — dùng nhầm sẽ khiến thumb tối trên track đỏ, gần như biến mất khi
 * khách BẬT dark mode (chính lúc cần thấy rõ trạng thái nhất).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("Header");
  const theme = useTheme();
  const isDark = theme === "dark";

  return (
    <label
      className={cn(
        "user-control--item theme-toggle inline-flex items-center gap-2 cursor-pointer text-[color:var(--bb-text-inverse)] opacity-80 hover:opacity-100 transition-opacity",
        className,
      )}
    >
      <span className="sr-only">{t("themeLabel")}</span>
      <Sun className="h-4 w-4 shrink-0" aria-hidden />
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label={t("themeLabel")}
        className="data-[state=checked]:bg-[color:var(--bb-brand-primary-on-dark)] data-[state=unchecked]:bg-[color:var(--bb-color-gray-500)]"
        thumbClassName="bg-[color:var(--bb-color-white)]"
      />
      <Moon className="h-4 w-4 shrink-0" aria-hidden />
    </label>
  );
}
