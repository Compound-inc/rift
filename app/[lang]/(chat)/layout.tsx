import { notFound } from "next/navigation";
import ChatShell from "@/components/ai/ChatShell";
import { ThreadSidebar } from "@/components/sidebar";
import { NoOrgModal } from "@/components/ai/NoOrgModal";
import { ModelProvider } from "@/contexts/model-context";
import { LocaleProvider } from "@/contexts/locale-context";
import { cookies } from "next/headers";
import { getDictionary, hasLocale } from "@/app/[lang]/dictionaries";

export default async function ChatLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const dictionary = await getDictionary(lang);
  const cookieStore = await cookies();
  const initialModel = cookieStore.get("selectedModel")?.value;

  return (
    <LocaleProvider lang={lang} dictionary={dictionary}>
      <ModelProvider initialModel={initialModel}>
        <NoOrgModal />
        <ChatShell sidebar={<ThreadSidebar />}>
          {children}
        </ChatShell>
      </ModelProvider>
    </LocaleProvider>
  );
}
