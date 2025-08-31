import { create } from 'zustand'

export const useGlobal = create<{
    searchDialogOpen: boolean
    setSearchDialogOpen: (open: boolean) => void
}>((set) => ({
    searchDialogOpen: false,
    setSearchDialogOpen: (open) => set({ searchDialogOpen: open })
}))
