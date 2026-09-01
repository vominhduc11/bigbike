import { CircleAlert } from "lucide-react";
import { FormNotice } from "@/components/ui/FormNotice";

type FormRootErrorProps = {
  message?: string;
};

/**
 * Form-level ("root") error alert shared by the auth forms. Renders nothing when
 * there is no message. Markup matches the previous per-form copies exactly.
 */
export function FormRootError({ message }: FormRootErrorProps) {
  if (!message) return null;
  return (
    <FormNotice
      data-form-root-error
      tone="danger"
      className="mb-5 flex items-start gap-3"
      aria-live="assertive"
    >
      <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p role="alert" className="font-medium leading-body">
        {message}
      </p>
    </FormNotice>
  );
}
