// Prompt input component exports.
export { TEXTAREA_MAX_HEIGHT } from './constants'
export { PromptInputRoot } from './prompt-input-root'
export type {
  PromptInputRootProps,
  PromptInputSlots,
} from './prompt-input-root'
export { PromptInputTextarea } from './prompt-input-textarea'
export type {
  PromptInputTextareaProps,
  PromptInputTextareaRef,
} from './prompt-input-textarea'
export { PromptInputToolbar } from './prompt-input-toolbar'
export type { PromptInputToolbarProps } from './prompt-input-toolbar'
export { PromptInputSubmit } from './prompt-input-submit'
export type { PromptInputSubmitProps } from './prompt-input-submit'

export { PromptInputThinking, PromptInputError, PromptInputAttachments } from './slots/top'
export type {
  PromptInputThinkingProps,
  PromptInputErrorProps,
  PromptInputAttachmentsProps,
  AttachedFile,
} from './slots/top'
