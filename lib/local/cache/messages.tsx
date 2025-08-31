import { useQuery, usePaginatedQuery } from 'convex/react'
import { Fragment, useEffect } from 'react'

import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { useChatStore } from '../hooks/use-ai-chat'
import { useStore } from '../zustand/store'

export function MessagesCache() {
    const threads = useStore((state: any) => state.threads)

    return threads.slice(0, 20).map((thread: any) => (
        <Fragment key={thread._id}>
            <UserMessageCache id={thread._id} />
        </Fragment>
    ))
}

function UserMessageCache({ id }: { id: Id<'threads'> }) {
    const messages = usePaginatedQuery(
        api.threads.getThreadMessagesPaginated,
        { threadId: id.toString() },
        { initialNumItems: 20 }
    )
    const { setStatus } = useChatStore()

    useEffect(() => {
        if (messages.results?.some((m: any) => m.status !== 'done')) {
            setStatus(id.toString(), 'streaming')
            return
        }
        setStatus(id.toString(), 'ready')
    }, [id, messages.results, setStatus])

    return messages.results?.map((message: any) => <AssistantMessageCache key={message._id} message={message} />)
}

// WE SHOULD REMOVE THIS

function AssistantMessageCache({ message }: { message: Doc<'messages'> }) {
    
    return null
}
