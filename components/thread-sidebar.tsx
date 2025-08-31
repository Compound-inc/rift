import { Button } from "@/components/ai/ui/button";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { ThreadSidebarInteractive } from "./thread-sidebar-interactive";

export default function ThreadSidebar() {
  return (
    <div className="h-full w-full bg-background border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Chats</h2>
          <Link href="/">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        
        {/* Keyboard shortcut tip */}
        <div className="mt-2 text-xs text-muted-foreground text-center">
          💡 Press ⌘+B to toggle sidebar
        </div>
      </div>

      {/* Search Bar Container - Server Rendered for Instant Appearance */}
      <div className="relative p-4">
        <input
          id="thread-search-input"
          type="text"
          placeholder="Search chats..."
          className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          readOnly
        />
      </div>

      {/* Thread List with Search - Interactive Part */}
      <div className="flex-1 overflow-y-auto">
        <ThreadSidebarInteractive />
      </div>
    </div>
  );
} 