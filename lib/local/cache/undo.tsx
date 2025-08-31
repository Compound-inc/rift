import { useStore } from '../zustand/store'
import { useEffect } from 'react'

export function UndoCache() {
    const setUser = useStore((state) => state.setUser)
    const setModels = useStore((state) => state.setModels)
    const setThreads = useStore((state) => state.setThreads)
    const setThreadSearch = useStore((state) => state.setThreadSearch)

    useEffect(() => {
        setUser({ isSignedIn: false })
        setModels([])
        setThreads([])
        setThreadSearch('')
    }, [setModels, setThreads, setUser, setThreadSearch])

    return null
}
