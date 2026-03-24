export async function generateStaticParams() {
  return [{ lang: "en" }, { lang: "es" }];
}

export default function LangLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
