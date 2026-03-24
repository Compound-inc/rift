import { ChatRouteClient } from "@/components/chat/ChatRouteClient";

export const metadata = {
  title: "Chat",
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ChatRouteClient />
      {children}
    </>
  );
}
