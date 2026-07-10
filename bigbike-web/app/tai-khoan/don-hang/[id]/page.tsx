import { WpAccountShell } from "@/components/wp/WpAccountShell";
import { OrderDetailContentIsland } from "./OrderDetailContentIsland";

export const dynamic = "force-static";

export async function generateStaticParams() {
  return [];
}

export default function OrderDetailPage() {
  return (
    <WpAccountShell>
      <OrderDetailContentIsland />
    </WpAccountShell>
  );
}
