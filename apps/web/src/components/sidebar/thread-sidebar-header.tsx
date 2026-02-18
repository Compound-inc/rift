"use client";

import { Button } from "@rift/ui/button";
import { Input } from "@rift/ui/input";
import { AppLogo } from "@/components/ui/icons/svg-icons";
import { useChatSidebarControls } from "@/components/chat/ChatShellClient";
import { useSelectedThreadStore } from "@/store/selected-thread-store";
import { Search } from "lucide-react";

export function ThreadSidebarHeader() {
  const { closeSidebar, isMobile } = useChatSidebarControls();
  const setSelectedThreadId = useSelectedThreadStore((s) => s.setSelectedThreadId);

  const handleNewChatClick = (event: React.MouseEvent) => {
    event.preventDefault();
    setSelectedThreadId(null);
    if (isMobile) {
      closeSidebar();
    }
  };

  return (
    <>
      {/* Header */}
      <div className="pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center justify-center">
          <AppLogo className="h-8 text-foreground dark:text-white" />
        </div>
      </div>

      <div className="px-3 pb-2 flex-shrink-0">
        <div className="mb-2">
          <Button
            size="lg"
            variant="default"
            className="w-full"
            onClick={handleNewChatClick}
          >
            Nuevo Chat
          </Button>
        </div>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground/60 group-focus-within:text-muted-foreground transition-colors pointer-events-none z-10" />
          <Input
            id="thread-search-input"
            type="text"
            placeholder="Buscar"
            className="w-full pl-10 border-0 dark:bg-transparent dark:text-popover-text"
            readOnly
          />
        </div>
      </div>
    </>
  );
}
