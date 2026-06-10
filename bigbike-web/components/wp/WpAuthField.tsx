import type { UseFormRegisterReturn } from "react-hook-form";
import { cn } from "@/lib/utils";

export type WpAuthFieldProps = {
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
 * Field auth theo markup WP: `.form-group > label(.required) + input.form-control`.
 * Dùng chung cho form đăng nhập / đăng ký / quên mật khẩu (port page-login.php,
 * page-register.php). Gom bản `WpField` vốn copy y hệt ở RegisterForm và
 * ForgotPasswordFlow.
 */
export function WpAuthField({
  id,
  label,
  registration,
  error,
  type = "text",
  autoComplete,
  placeholder,
  groupClassName,
}: WpAuthFieldProps) {
  return (
    <div className={cn("form-group", groupClassName)}>
      <label htmlFor={id}>
        {label}<span className="required">*</span>
      </label>
      <input
        className="form-control"
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={!!error}
        {...registration}
      />
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error.message}</p>}
    </div>
  );
}
