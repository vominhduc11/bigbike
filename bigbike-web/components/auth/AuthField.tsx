import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AuthFieldProps = {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: { message?: string };
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  hint?: ReactNode;
  status?: { message: ReactNode; tone: "success" | "error" };
  labelAction?: ReactNode;
  passwordToggleLabels?: { show: string; hide: string };
  /** Class phụ cho wrapper của trường. */
  groupClassName?: string;
  /** Giữ chiều cao gọn trên điện thoại; nhãn vẫn có cho công cụ hỗ trợ. */
  compact?: boolean;
};

/**
 * Trường dùng chung cho đăng nhập, đăng ký và đặt lại mật khẩu. Mọi ô mật khẩu
 * có nút hiện/ẩn riêng, còn trạng thái lỗi/hướng dẫn dùng chung mô tả truy cập được.
 */
export function AuthField({
  id,
  label,
  registration,
  error,
  type = "text",
  autoComplete,
  placeholder,
  hint,
  status,
  labelAction,
  passwordToggleLabels,
  groupClassName,
  compact = false,
}: AuthFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const hintId = useId();
  const errorId = useId();
  const statusId = useId();
  const isPassword = type === "password";
  const describedBy = [
    hint ? hintId : undefined,
    status ? statusId : undefined,
    error ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn(compact ? "mb-4 md:mb-5" : "mb-5", groupClassName)}>
      <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
        <Label htmlFor={id} className="text-a5-meta text-foreground">
          {label}
          <span aria-hidden="true" className="ml-1 text-brand">
            *
          </span>
        </Label>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          className={cn(
            compact ? "min-h-11 px-4 md:min-h-13 md:px-5" : "min-h-13 px-5",
            "w-full text-a4-content",
            isPassword && "pr-13",
          )}
          id={id}
          type={isPassword && isPasswordVisible ? "text" : type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-required="true"
          aria-describedby={describedBy || undefined}
          {...registration}
        />
        {isPassword ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute inset-y-0 right-0 h-11 w-11 self-center p-0 hover:scale-100"
            onClick={() => setIsPasswordVisible((visible) => !visible)}
            aria-label={isPasswordVisible ? passwordToggleLabels?.hide : passwordToggleLabels?.show}
          >
            {isPasswordVisible ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </Button>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="mt-2 text-a5-meta leading-body text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {status ? (
        <p
          id={statusId}
          role="status"
          aria-live="polite"
          className={cn(
            "mt-2 text-a5-meta leading-body",
            status.tone === "success" ? "text-state-success-text" : "text-destructive",
          )}
        >
          {status.message}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-a5-meta text-destructive">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
