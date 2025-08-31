import { useCallback, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Id } from '@/convex/_generated/dataModel'
import { MODELS, DEFAULT_MODEL } from '@/lib/ai/ai-providers'

// Use the current domain for API calls
const BASE_URL = typeof window !== 'undefined' ? window.location.origin : ''

export const useChatStore = create<{
    instances: Record<
        string,
        {
            input: string
            messages: any[]
            status: string
        }
    >
    setInputValue: (id: string, value: string) => void
    addMessage: (id: string, message: any) => void
    setStatus: (id: string, status: string) => void
    updateLastMessage: (id: string, content: string) => void
    updateMessageContent: (id: string, messageId: string, content: string) => void
}>()(
    persist(
        (set, get) => ({
            instances: {},
            setInputValue: (id: string, value: string) => {
                const instances = get().instances
                set({
                    instances: {
                        ...instances,
                        [id]: {
                            input: value,
                            messages: instances[id]?.messages || [],
                            status: instances[id]?.status || 'ready'
                        }
                    }
                })
            },
            addMessage: (id: string, message: any) => {
                const instances = get().instances
                const currentInstance = instances[id] || { input: '', messages: [], status: 'ready' }
                set({
                    instances: {
                        ...instances,
                        [id]: {
                            ...currentInstance,
                            messages: [...currentInstance.messages, message]
                        }
                    }
                })
            },
            setStatus: (id: string, status: string) => {
                const instances = get().instances
                const currentInstance = instances[id] || { input: '', messages: [], status: 'ready' }
                set({
                    instances: {
                        ...instances,
                        [id]: {
                            ...currentInstance,
                            status
                        }
                    }
                })
            },
            updateLastMessage: (id: string, content: string) => {
                const instances = get().instances
                const currentInstance = instances[id] || { input: '', messages: [], status: 'ready' }
                const messages = [...currentInstance.messages]
                if (messages.length > 0) {
                    const lastMessage = messages[messages.length - 1]
                    if (lastMessage.role === 'assistant') {
                        messages[messages.length - 1] = {
                            ...lastMessage,
                            content,
                            parts: [{ type: 'text', text: content }]
                        }
                    }
                }
                set({
                    instances: {
                        ...instances,
                        [id]: {
                            ...currentInstance,
                            messages
                        }
                    }
                })
            },
            updateMessageContent: (id: string, messageId: string, content: string) => {
                const instances = get().instances
                const currentInstance = instances[id] || { input: '', messages: [], status: 'ready' }
                const messages = currentInstance.messages.map(msg => 
                    msg.id === messageId 
                        ? { ...msg, content: msg.content + content, parts: [{ type: 'text', text: msg.content + content }] }
                        : msg
                )
                set({
                    instances: {
                        ...instances,
                        [id]: {
                            ...currentInstance,
                            messages
                        }
                    }
                })
            }
        }),
        {
            name: 'chat-store'
        }
    )
)

export interface UseChatReturn {
    id: Id<'threads'> | string
    input: string
    messages: any[]
    status: string
    isLoading: boolean
    handleInputChange: ({ id, value }: { id: string; value: string }) => void
    handleSubmit: ({ id, override, modelId, threadId }: { id: string; override?: string; modelId?: string; threadId?: string }) => Promise<void>
    stop: () => void
}

export function useAiChat({ id = 'home' }: { id: string }): UseChatReturn {
    const { instances, setInputValue, addMessage, setStatus, updateMessageContent } = useChatStore()
    const [isLoading, setIsLoading] = useState(false)
    const [abortController, setAbortController] = useState<AbortController | null>(null)

    const currentInstance = instances[id] || { input: '', messages: [], status: 'ready' }

    const handleInputChange = useCallback(({ id, value }: { id: string; value: string }) => setInputValue(id, value), [setInputValue])

    const stop = useCallback(() => {
        if (abortController) {
            abortController.abort()
            setAbortController(null)
        }
        setIsLoading(false)
        setStatus(id, 'ready')
    }, [abortController, id, setStatus])

    const handleSubmit = useCallback(
        async ({ id, override, modelId = DEFAULT_MODEL, threadId }: { id: string; override?: string; modelId?: string; threadId?: string }) => {
            const messageToSend = override || instances[id].input
            if (!messageToSend.trim()) {
                return
            }

            // Stop any ongoing request
            if (abortController) {
                abortController.abort()
            }

            const newAbortController = new AbortController()
            setAbortController(newAbortController)
            setIsLoading(true)
            setStatus(id, 'submitted')

            const userMessageId = `user-${Date.now()}`
            const assistantMessageId = `assistant-${Date.now()}`

            // Add user message
            addMessage(id, {
                id: userMessageId,
                role: 'user',
                content: messageToSend,
                createdAt: new Date(),
                parts: [{ type: 'text', text: messageToSend }]
            })

            // Add assistant message placeholder
            addMessage(id, {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                createdAt: new Date(),
                parts: [{ type: 'text', text: '' }]
            })

            setInputValue(id, '')

            try {
                // Call the /api/chat endpoint
                const response = await fetch(`${BASE_URL}/api/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        messages: [
                            ...currentInstance.messages,
                            {
                                id: userMessageId,
                                role: 'user',
                                content: messageToSend,
                                parts: [{ type: 'text', text: messageToSend }]
                            }
                        ],
                        modelId,
                        threadId: threadId || id
                    }),
                    signal: newAbortController.signal
                })

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }

                if (!response.body) {
                    throw new Error('No response body')
                }

                const reader = response.body.getReader()
                const decoder = new TextDecoder()

                while (true) {
                    const { done, value } = await reader.read()
                    
                    if (done) break
                    
                    const chunk = decoder.decode(value, { stream: true })
                    const lines = chunk.split('\n')
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6))
                                
                                if (data.type === 'text-delta' && data.textDelta) {
                                    // Update the assistant message with streaming content
                                    updateMessageContent(id, assistantMessageId, data.textDelta)
                                } else if (data.type === 'finish') {
                                    // Message is complete
                                    setIsLoading(false)
                                    setStatus(id, 'ready')
                                    setAbortController(null)
                                    return
                                }
                            } catch (e) {
                                // Skip invalid JSON lines
                            }
                        }
                    }
                }

                setIsLoading(false)
                setStatus(id, 'ready')
                setAbortController(null)

            } catch (error: any) {
                if (error.name === 'AbortError') {
                    // Request was cancelled
                    return
                }
                
                console.error('Chat error:', error)
                updateMessageContent(id, assistantMessageId, '\n\nSorry, there was an error processing your request.')
                setIsLoading(false)
                setStatus(id, 'ready')
                setAbortController(null)
            }
        },
        [addMessage, instances, setInputValue, setStatus, updateMessageContent, currentInstance.messages, abortController, updateMessageContent]
    )

    return {
        id,
        input: currentInstance.input,
        messages: currentInstance.messages || [],
        status: currentInstance.status || 'ready',
        isLoading,
        handleInputChange,
        handleSubmit,
        stop
    }
}
