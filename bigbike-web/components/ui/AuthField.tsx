import type { ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { authInput } from "@/lib/ui-classes";

type FieldErrorLike = { message?: string };

type AuthFieldProps = {
  id: string;
  label: ReactNode;
  /** The spread returned by react-hook-form's `register("name")`. */
  registration: UseFormRegisterReturn;
  /** The matching `errors.name` entry (undefined when valid). */
  error?: FieldErrorLike;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  /** Renders the trailing " *" required marker. Defaults to true. */
  required?: boolean;
  /**
   * When true, wires `aria-invalid` + `aria-describedby` on the input and gives
   * the error `<p>` an id + `role="alert"` (the login/reset forms). When false
   * (the register form) those attributes are omitted, matching that form's
   * existing markup exactly.
   */
  describeError?: boolean;
};

/**
 * Labelled RHF text field shared by the auth forms (login / register / reset).
 * Reproduces both the aria-wired (`describeError`) and plain shapes verbatim so
 * no rendered attribute changes at any call site.
 */
export function AuthField({
  id,
  label,
  registration,
  error,
  type,
  autoComplete,
  placeholder,
  required = true,
  describeError = false,
}: AuthFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <>
            {" "}
            <span className="text-destructive">*</span>
          </>
        ) : null}
      </Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={authInput}
        aria-invalid={describeError ? !!error : undefined}
        aria-describedby={describeError && error ? errorId : undefined}
        {...registration}
      />
      {error && (
        <p
          id={describeError ? errorId : undefined}
          role={describeError ? "alert" : undefined}
          className="text-caption text-destructive"
        >
          {error.message}
        </p>
      )}
    </div>
  );
}
