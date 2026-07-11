import { AccountNav } from "@/components/account/AccountNav";

export function AccountShell({
  children,
  loginRedirect,
}: {
  children: React.ReactNode;
  loginRedirect?: string;
}) {
  return (
    <div id="main-content">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <AccountNav loginRedirect={loginRedirect}>{children}</AccountNav>
      </div>
    </div>
  );
}
