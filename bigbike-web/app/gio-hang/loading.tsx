import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Tr } from "@/components/i18n/Tr";
import { Skeleton } from "@/components/ui/skeleton";

export default function CartLoading() {
  return (
    <div id="main-content" className="bb-cart-page" aria-busy="true">
      <Container>
        <div className="mt-5">
          <h1 className="m-0 font-cta text-a2-page font-semibold uppercase text-foreground"><Tr ns="Cart" k="title" /></h1>
          <nav className="py-8 text-a5-meta text-muted-foreground" aria-label="Breadcrumb">
            <ol className="m-0 flex list-none items-center gap-1 p-0">
              <li><Link href="/" className="font-semibold hover:text-brand">Bigbike.vn</Link></li>
              <li aria-hidden>/</li>
              <li aria-current="page"><Tr ns="Cart" k="title" /></li>
            </ol>
          </nav>
        </div>
        <div className="space-y-4 pb-15">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 border-b border-border py-5">
              <Skeleton className="h-24 w-24 rounded-none" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-2/3 rounded-none" />
                <Skeleton className="h-4 w-1/3 rounded-none" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
