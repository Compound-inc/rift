/**
 * Backend re-export of shared transport error codes.
 * Keeping this path stable avoids touching all internal imports.
 */
export {
  ChatErrorCode,
  chatErrorCodeFromTag,
  type ChatErrorCode,
} from '@/lib/chat-contracts/error-codes'
