/* .check-out-step-title h3 <span><b>n</b></span> — huy hiệu số bước hình thoi đỏ WP.
   Bỏ `step` → tiêu đề trơn, không huy hiệu số (h3 mặc định chừa 35px cho badge nên
   ép pl-0 lại khi không có số). */
export function CheckoutStepTitle({ step, children }: { step?: number; children: React.ReactNode }) {
  return (
    <div className="check-out-step-title">
      {step == null ? (
        <h3 className="pl-0!">{children}</h3>
      ) : (
        <h3>
          <span>
            <b>{step}</b>
          </span>{" "}
          {children}
        </h3>
      )}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="m-0 mt-1 text-ui-14 max-md:text-ui-12 text-brand">{message}</p>;
}
