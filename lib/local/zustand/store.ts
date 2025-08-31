import type { FunctionReturnType } from 'convex/server'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'

// Define types based on the actual API structure
type ThreadDoc = FunctionReturnType<typeof api.threads.getThreadInfo>
type ThreadsPage = FunctionReturnType<typeof api.threads.getUserThreadsPaginated>

export const useStore = create<{
    user: { isSignedIn: boolean; fullName?: string; imageUrl?: string }
    threads: ThreadDoc[] // Array of thread documents
    models: string[] // Array of model names/IDs
    model?: string // Selected model
    key: {
        openRouter: string
        openAi: string
        elevenLabs: string
    }
    threadSearch: string
    setUser: ({ isSignedIn, fullName, imageUrl }: { isSignedIn: boolean; fullName?: string; imageUrl?: string }) => void
    setThreads: (threads: ThreadDoc[]) => void
    setModels: (models: string[]) => void
    setModel: (modelId: string) => void
    setKey: (key: { openRouter?: string; openAi?: string; elevenLabs?: string }) => void
    setThreadSearch: (search: string) => void
}>()(
    persist(
        (set) => ({
            user: { isSignedIn: false },
            threads: [],
            models: [],
            model: undefined,
            key: {
                openRouter: '',
                openAi: '',
                elevenLabs: ''
            },
            threadSearch: '',
            setUser: ({ isSignedIn, fullName, imageUrl }) => {
                set({ user: { isSignedIn, fullName, imageUrl } })
            },
            setThreads: (threads: ThreadDoc[]) => {
                set({ threads })
            },
            setModels: (models: string[]) => {
                set({ models })
            },
            setModel: (model: string) => {
                set({ model })
            },
            setKey: (key: { openRouter?: string; openAi?: string; elevenLabs?: string }) => {
                set((state) => ({ key: { ...state.key, ...key } }))
            },
            setThreadSearch: (search: string) => {
                set({ threadSearch: search })
            }
        }),
        { name: 'eesy-chat-store' }
    )
)
