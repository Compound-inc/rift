'use client'

import { Button } from '@rift/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@rift/ui/dropdown-menu'
import { Plus } from 'lucide-react'
import { m } from '@/paraglide/messages.js'
import type { ChatVisibleTool } from '../chat-context'

export type PromptInputActionsMenuProps = {
  canAddMore: boolean
  canUploadFiles: boolean
  uploadUpgradeCallout?: string
  onOpenFilePicker: () => void
  isStudyModeEnabled: boolean
  isModeEnforced: boolean
  onToggleStudyMode: () => void
  visibleTools: readonly ChatVisibleTool[]
  disabledToolKeys: readonly string[]
  onToolDisabledKeysChange: (disabledToolKeys: readonly string[]) => void
  contextWindowSupportsMaxMode: boolean
  isMaxContextEnabled: boolean
  onMaxContextChange: (enabled: boolean) => void
}

/**
 * Unified composer actions menu used by the toolbar.
 */
export function PromptInputActionsMenu({
  canAddMore,
  canUploadFiles,
  uploadUpgradeCallout,
  onOpenFilePicker,
  isStudyModeEnabled,
  isModeEnforced,
  onToggleStudyMode,
  visibleTools,
  disabledToolKeys,
  onToolDisabledKeysChange,
  contextWindowSupportsMaxMode,
  isMaxContextEnabled,
  onMaxContextChange,
}: PromptInputActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={m.chat_prompt_actions_open_aria_label()}
            className="self-end size-8 rounded-full border border-transparent bg-transparent p-0 text-foreground-strong hover:bg-surface-inverse/5 active:bg-surface-inverse/10 focus-visible:ring-2 focus-visible:ring-border-strong/40"
          >
            <Plus className="size-[18px]" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="min-w-48 rounded-xl border border-border-light bg-surface-base p-1 text-foreground-primary shadow-lg ring-border-strong/10"
      >
        <DropdownMenuItem
          className="h-9 rounded-lg px-2 text-sm font-medium text-foreground-primary focus:bg-surface-inverse/8"
          disabled={!canAddMore || !canUploadFiles}
          onClick={onOpenFilePicker}
          title={!canUploadFiles ? uploadUpgradeCallout : undefined}
        >
          {!canUploadFiles
            ? m.chat_prompt_actions_attach_files()
            : canAddMore
            ? m.chat_prompt_actions_attach_files()
            : m.chat_prompt_actions_attach_files_max_reached()}
        </DropdownMenuItem>
        <DropdownMenuCheckboxItem
          className="h-9 rounded-lg px-2 text-sm font-medium text-foreground-primary focus:bg-surface-inverse/8"
          checked={isStudyModeEnabled}
          disabled={isModeEnforced}
          onCheckedChange={onToggleStudyMode}
          title={
            isModeEnforced
              ? m.chat_mode_study_enforced_by_org_title()
              : m.chat_mode_study_enable_title()
          }
        >
          {m.chat_mode_study_label()}
        </DropdownMenuCheckboxItem>
        {contextWindowSupportsMaxMode ? (
          <DropdownMenuCheckboxItem
            className="h-9 rounded-lg px-2 text-sm font-medium text-foreground-primary focus:bg-surface-inverse/8"
            checked={isMaxContextEnabled}
            onCheckedChange={onMaxContextChange}
          >
            Max
          </DropdownMenuCheckboxItem>
        ) : null}
        {!isStudyModeEnabled && visibleTools.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>{m.chat_prompt_actions_tools_label()}</DropdownMenuLabel>
              {visibleTools.map((tool) => (
                <DropdownMenuCheckboxItem
                  key={tool.key}
                  className="min-h-9 rounded-lg px-2 py-2 text-sm font-medium text-foreground-primary focus:bg-surface-inverse/8"
                  checked={!disabledToolKeys.includes(tool.key)}
                  disabled={tool.disabled}
                  onCheckedChange={(checked) => {
                    const nextDisabledToolKeys = checked
                      ? disabledToolKeys.filter((toolKey) => toolKey !== tool.key)
                      : [...disabledToolKeys, tool.key]
                    onToolDisabledKeysChange(nextDisabledToolKeys)
                  }}
                  title={tool.description}
                >
                  <span className="line-clamp-2">{tool.label}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
