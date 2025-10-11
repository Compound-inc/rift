import { redirect } from "next/navigation";

export default function RootPage() {
  console.log('🔄 Redirecting from root (/) to /chat');
  redirect("/chat");
}
