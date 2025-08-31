import { MessagesCache } from './cache/messages'
import { useModelsCache } from './hooks/use-models-cache'
import { useThreadsCache } from './hooks/use-threads-cache'
import { useUserCache } from './hooks/use-user-cache'

export function Cache() {
    useUserCache()
    useThreadsCache()
    useModelsCache()

    return <MessagesCache />
}
