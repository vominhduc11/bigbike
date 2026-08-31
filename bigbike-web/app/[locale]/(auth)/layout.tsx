import { notFound } from "next/navigation";

import { isLocale } from "@/i18n/locale";

export default async function AuthLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();

  return (
    <div data-auth-shell className="flex min-h-svh flex-1 flex-col bg-background">
      <main
        id="main-content"
        data-auth-main
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col bg-background"
      >
        {children}
      </main>
    </div>
  );
}
