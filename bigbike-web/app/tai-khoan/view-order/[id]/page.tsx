import { permanentRedirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LegacyViewOrderRedirect({ params }: Props) {
  const { id } = await params;
  permanentRedirect(`/tai-khoan/don-hang/${encodeURIComponent(id)}`);
}
