// Keep chat queries warm so revisiting threads stays local-first.
export const CACHE_CHAT_NAV = { ttl: 'none' } as const
