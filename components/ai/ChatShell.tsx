import { ChatShellClient } from "./ChatShellClient";

type ChatShellProps = {
  children: React.ReactNode;
  className?: string;
  sidebar?: React.ReactNode;
};

export default function ChatShell({
  children,
  className,
  sidebar,
}: ChatShellProps) {
  return (
    <ChatShellClient className={className} sidebar={sidebar}>
      {children}
    </ChatShellClient>
  );
}
