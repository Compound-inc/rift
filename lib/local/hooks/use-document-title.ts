import { useEffect } from 'react'

export function useDocumentTitle(title?: string) {
    useEffect(() => {
        if (title) {
            document.title = title
        } else {
            document.title = 'Ai Chat'
        }
        return () => {
            document.title = 'Ai Chat'
        }
    }, [title])
}
