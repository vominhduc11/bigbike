/* .check-out-step-title h3 <span><b>n</b></span> — huy hiệu số bước hình thoi đỏ WP. */
export function CheckoutStepTitle({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="check-out-step-title">
      <h3>
        <span>
          <b>{step}</b>
        </span>{" "}
        {children}
      </h3>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="m-0 mt-1 text-sm text-brand">{message}</p>;
}
