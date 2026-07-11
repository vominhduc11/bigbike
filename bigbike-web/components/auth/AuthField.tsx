import type { UseFormRegisterReturn } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type AuthFieldProps = {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: { message?: string };
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  /** Class phụ gắn thêm vào `.form-group` (vd LoginForm dùng "login-email"). */
  groupClassName?: string;
};

/**
 * Field auth theo markup giao diện cũ: `.form-group > label(.required) + input.form-control`.
 * Dùng chung cho form đăng nhập / đăng ký / quên mật khẩu (port page-login.php,
 * page-register.php). Gom bản `AuthField` vốn copy y hệt ở RegisterForm và
 * ForgotPasswordFlow.
 */
export function AuthField({
  id,
  label,
  registration,
  error,
  type = "text",
  autoComplete,
  placeholder,
  groupClassName,
}: AuthFieldProps) {
  return (
    <div className={cn("mb-8", groupClassName)}>
      <label htmlFor={id} className="mb-2 block text-a5-meta text-foreground">
        {label}<span className="text-brand">*</span>
      </label>
      <Input
        className="h-13 w-full px-5 text-a5-meta"
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={!!error}
        {...registration}
      />
      {error && <p role="alert" className="mt-2 text-a5-meta text-destructive">{error.message}</p>}
    </div>
  );
}
