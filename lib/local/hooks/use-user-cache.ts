import { useEffect } from 'react'
import { useAuth } from '@workos-inc/authkit-nextjs/components'

import { useStore } from '../zustand/store'

export function useUserCache() {
    const { user, loading: isLoaded } = useAuth()
    const setUser = useStore((state: any) => state.setUser)

    useEffect(() => {
        if (isLoaded !== undefined) {
            const isSignedIn = !!user
            setUser({ 
                isSignedIn, 
                fullName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : undefined, 
                imageUrl: user?.profilePictureUrl || undefined 
            })
        }
    }, [isLoaded, setUser, user])

    return {
        user,
        isLoading: isLoaded,
        isSignedIn: !!user
    }
}
