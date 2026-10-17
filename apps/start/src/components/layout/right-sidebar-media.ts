import { useSyncExternalStore } from 'react'

const query = '(min-width: 1024px)'
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
/** Match the layout's lg breakpoint for both auto-open and sheet presentation. */
export function useDesktopRightSidebar() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
