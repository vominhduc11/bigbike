import { AccountShell } from "@/components/layout/AccountShell";
import { OrderDetailContentIsland } from "./OrderDetailContentIsland";

export const dynamic = "force-static";

export async function generateStaticParams() {
  return [];
}

export default function OrderDetailPage() {
  return (
    <AccountShell>
      <OrderDetailContentIsland />
    </AccountShell>
  );
}
