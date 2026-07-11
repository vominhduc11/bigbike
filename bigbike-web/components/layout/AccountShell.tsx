import { AccountNav } from "@/components/account/AccountNav";
import { Container } from "@/components/layout/Container";

export function AccountShell({
  children,
  loginRedirect,
}: {
  children: React.ReactNode;
  loginRedirect?: string;
}) {
  // Hero-less: `bb-heroless` triggers the shared logo-emblem clearance in globals.css.
  return (
    <div id="main-content" className="bb-heroless">
      <Container>
        <AccountNav loginRedirect={loginRedirect}>{children}</AccountNav>
      </Container>
    </div>
  );
}
