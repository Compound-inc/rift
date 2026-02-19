'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Button } from '@rift/ui/button'
import { Link } from '@tanstack/react-router'
import { SETTINGS_HREF } from '@/routes/(app)/_layout/settings/-settings-nav'

export type UserProfileAvatarUser = {
  profilePictureUrl?: string | null
  email?: string | null
  firstName?: string | null
  lastName?: string | null
}

function getInitials(user: UserProfileAvatarUser): string {
  if (user.firstName || user.lastName) {
    const first = (user.firstName ?? '').slice(0, 1)
    const last = (user.lastName ?? '').slice(0, 1)
    return (first + last).toUpperCase() || '?'
  }
  const email = user.email ?? ''
  const part = email.split('@')[0]
  return part.slice(0, 2).toUpperCase() || '?'
}

export type UserProfileAvatarProps = {
  user?: UserProfileAvatarUser | null
  settingsHref?: string
  size?: 'default' | 'sm' | 'lg' | 'xs'
}

export function UserProfileAvatar({
  user,
  settingsHref = SETTINGS_HREF,
  size = 'xs',
}: UserProfileAvatarProps) {
  const initials = user ? getInitials(user) : '?'

  return (
    <Button
      asChild
      variant="sidebarIcon"
      size="iconSidebar"
      aria-label="Open settings"
    >
      <Link to={settingsHref}>
        <Avatar size={size}>
          {user?.profilePictureUrl ? (
            <AvatarImage
              src={user.profilePictureUrl}
              alt=""
            />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </Link>
    </Button>
  )
}
