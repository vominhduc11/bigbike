import { permanentRedirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
};

export default async function LegacyOrderReceivedRedirect({ params, searchParams }: Props) {
  const { id } = await params;
  const { key } = await searchParams;

  const query = new URLSearchParams({ so: id });
  if (key) {
    query.set("key", key);
  }

  permanentRedirect(`/don-hang/xac-nhan?${query.toString()}`);
}
