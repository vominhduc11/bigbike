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
  passwordToggleLabels?: { show: string; hide: string };
  /** Class phụ cho wrapper của trường. */
  groupClassName?: string;
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
  passwordToggleLabels,
  groupClassName,
}: AuthFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const hintId = useId();
  const errorId = useId();
  const isPassword = type === "password";
  const describedBy = [hint ? hintId : undefined, error ? errorId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("mb-5", groupClassName)}>
      <Label htmlFor={id} className="mb-2 block text-a5-meta text-foreground">
        {label}
        <span aria-hidden="true" className="text-brand">
          *
        </span>
      </Label>
      <div className="relative">
        <Input
          className={cn("h-13 w-full px-5 text-a4-content", isPassword && "pr-13")}
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
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-a5-meta text-destructive">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
