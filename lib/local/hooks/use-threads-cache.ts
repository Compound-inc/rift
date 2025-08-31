import { usePaginatedQuery } from 'convex/react'
import { useEffect } from 'react'

import { api } from '@/convex/_generated/api'
import { useStore } from '../zustand/store'

export function useThreadsCache() {
    const threads = usePaginatedQuery(
        api.threads.getUserThreadsPaginated,
        { paginationOpts: { numItems: 50, cursor: null } },
        { initialNumItems: 50 }
    )
    const setThreads = useStore((state: any) => state.setThreads)

    useEffect(() => {
        if (threads.results && threads.results.length > 0) {
            // Filter out null results and set threads
            const validThreads = threads.results.filter(thread => thread !== null)
            setThreads(validThreads)
        }
    }, [setThreads, threads.results])

    // Return the full pagination object for components that need it
    return threads
}
