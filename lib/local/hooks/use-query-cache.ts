import { useQuery, type OptionalRestArgsOrSkip } from 'convex/react'
import { getFunctionName, type FunctionReference } from 'convex/server'
import { useEffect, useMemo, useState } from 'react'

const CACHE_DURATION = 5 * 60 * 1000

export function useQueryCache<Query extends FunctionReference<'query'>>(
    query: Query,
    ...args: OptionalRestArgsOrSkip<Query>
): Query['_returnType'] | undefined {
    const cacheKey = useMemo(() => getFunctionName(query), [query])

    const [cachedData, setCachedData] = useState<Query['_returnType'] | undefined>(() => {
        try {
            const cached = localStorage.getItem(cacheKey)
            const timestamp = localStorage.getItem(`${cacheKey}:timestamp`)
            if (cached && timestamp) {
                if (Date.now() - parseInt(timestamp) < CACHE_DURATION) {
                    return JSON.parse(cached)
                } else {
                    clearQueryCache(cacheKey)
                }
            }
            return undefined
        } catch {
            return undefined
        }
    })

    const freshData = useQuery(query, ...args)

    useEffect(() => {
        if (freshData !== undefined) {
            try {
                localStorage.setItem(cacheKey, JSON.stringify(freshData))
                localStorage.setItem(`${cacheKey}:timestamp`, Date.now().toString())
                setCachedData(freshData)
            } catch (error) {
                console.warn('Failed to cache data:', error)
            }
        }
    }, [freshData, cacheKey])

    return freshData !== undefined ? freshData : cachedData
}

function clearQueryCache(key: string) {
    try {
        localStorage.removeItem(key)
        localStorage.removeItem(`${key}:timestamp`)
    } catch (error) {
        console.warn(`Failed to clear cache for ${key}:`, error)
    }
}
