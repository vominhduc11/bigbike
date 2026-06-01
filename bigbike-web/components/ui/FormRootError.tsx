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
    <p role="alert" aria-live="assertive" className="mb-5 text-sm font-medium text-destructive">
      {message}
    </p>
  );
}
