// Sidebar section listing the user's Projects. Sits between the static
// "New chat / Search" actions and the date-grouped thread history.
'use client'

import { useCallback, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useZero } from '@rocicorp/zero/react'
import Folder from 'lucide-react/dist/esm/icons/folder'
import Plus from 'lucide-react/dist/esm/icons/plus'
import { toast } from 'sonner'
import { mutators, queries } from '@/integrations/zero'
import { SidebarNavItem } from '@/components/layout/sidebar/sidebar-nav-item'
import type { NavItemType } from '@/components/layout/sidebar/app-sidebar-nav.config'
import { m } from '@/paraglide/messages.js'

export const PROJECTS_HREF_BASE = '/chat/projects'

export function ChatSidebarProjects({ pathname }: { pathname: string }) {
  const z = useZero()
  const navigate = useNavigate()
  const [projects] = useQuery(queries.projects.list({}))
  const [creating, setCreating] = useState(false)

  const handleCreateProject = useCallback(async () => {
    if (creating) return
    setCreating(true)
    const projectId = crypto.randomUUID()
    const createdAt = Date.now()
    try {
      await z.mutate(
        mutators.projects.create({
          projectId,
          name: m.chat_sidebar_project_default_name(),
          createdAt,
        }),
      ).client
      navigate({
        to: '/chat/projects/$projectId/settings',
        params: { projectId },
      })
    } catch (error) {
      console.error('Failed to create project:', error)
      toast.error(m.chat_sidebar_project_create_failed())
    } finally {
      setCreating(false)
    }
  }, [creating, navigate, z])

  const newProjectItem: NavItemType = {
    name: m.chat_sidebar_project_create(),
    icon: Plus,
    onSelect: () => {
      void handleCreateProject()
    },
  }

  return (
    <div className="flex flex-col gap-0.5 pr-3">
      <div className="mb-2 pl-3 pr-3 text-sm text-foreground-secondary">
        {m.chat_sidebar_projects()}
      </div>
      {projects.map((project) => {
        const item: NavItemType = {
          name: project.name,
          href: `${PROJECTS_HREF_BASE}/${project.id}`,
          icon: Folder,
        }
        return (
          <SidebarNavItem key={project.id} item={item} pathname={pathname} />
        )
      })}
      <SidebarNavItem item={newProjectItem} pathname={pathname} />
    </div>
  )
}
