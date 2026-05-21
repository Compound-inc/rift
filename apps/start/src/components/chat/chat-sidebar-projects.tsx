// Sidebar section listing the user's Projects, sitting between the static
// "New chat / Search" actions and the date-grouped thread history.
'use client'

import { useCallback } from 'react'
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

/**
 * Resolves the icon component for a Project row. Project rows use a generic
 * folder glyph in v1; the schema reserves `icon` and `color` columns for a
 * future iteration where users can customise the visual.
 */
function ProjectIcon(props: React.ComponentProps<typeof Folder>) {
  return <Folder {...props} />
}

/**
 * Renders the "Projects" section in the chat sidebar. Subscribes directly to
 * `queries.projects.list`; the result set is small so we render flat without
 * virtualization.
 */
export function ChatSidebarProjects({ pathname }: { pathname: string }) {
  const z = useZero()
  const navigate = useNavigate()
  const [projects] = useQuery(queries.projects.list({}))

  const handleCreateProject = useCallback(async () => {
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
    }
  }, [navigate, z])

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
          icon: ProjectIcon,
        }
        return (
          <SidebarNavItem key={project.id} item={item} pathname={pathname} />
        )
      })}
      <SidebarNavItem item={newProjectItem} pathname={pathname} />
    </div>
  )
}
