/**
 * FormField — label + control + helper/error.
 * Used inside modals and detail forms.
 */
export function FormField({ label, required, helper, error, htmlFor, children }) {
  return (
    <div className="form-field">
      {label ? (
        <label className="form-field-label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="form-field-required" aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      {children}
      {helper && !error ? <span className="form-field-helper">{helper}</span> : null}
      {error ? <span className="form-field-error" role="alert">{error}</span> : null}
    </div>
  )
}
