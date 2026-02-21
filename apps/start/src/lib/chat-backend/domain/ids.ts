import { Schema } from 'effect'

export const ThreadId = Schema.String.pipe(Schema.brand('@rift/ThreadId'))
export type ThreadId = Schema.Schema.Type<typeof ThreadId>

export const MessageId = Schema.String.pipe(Schema.brand('@rift/MessageId'))
export type MessageId = Schema.Schema.Type<typeof MessageId>

export const RequestId = Schema.String.pipe(Schema.brand('@rift/RequestId'))
export type RequestId = Schema.Schema.Type<typeof RequestId>

export const UserId = Schema.String.pipe(Schema.brand('@rift/UserId'))
export type UserId = Schema.Schema.Type<typeof UserId>
