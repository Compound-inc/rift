'use client'

import { Link } from '@tanstack/react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Badge } from '@rift/ui/badge'
import { Button } from '@rift/ui/button'
import { ContentPage } from '@/components/layout'
import type { SingularityOrganizationListItem } from '@/ee/singularity/shared/singularity-admin'
import { useSingularityOrgListPageLogic } from './singularity-org-list-page.logic'

export function SingularityOrgListPage({
  organizations,
}: {
  organizations: Array<SingularityOrganizationListItem>
}) {
  const { rows, hasOrganizations } = useSingularityOrgListPageLogic(organizations)

  return (
    <ContentPage
      title="Singularity"
      description="Organization-level control plane for internal administrators."
    >
      <div className="overflow-hidden rounded-xl border border-border-light bg-surface-base">
        <table className="w-full min-w-[720px] table-fixed border-collapse">
          <thead className="bg-surface-overlay text-left text-xs uppercase tracking-[0.16em] text-foreground-tertiary">
            <tr>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Users</th>
              <th className="px-4 py-3 font-medium">Pending invites</th>
              <th className="px-4 py-3 font-medium text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((organization) => (
              <tr
                key={organization.organizationId}
                className="border-t border-border-light/80"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarImage
                        src={organization.logo ?? undefined}
                        alt={organization.name}
                      />
                      <AvatarFallback>{organization.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground-primary">
                        {organization.name}
                      </div>
                      <div className="truncate text-sm text-foreground-tertiary">
                        {organization.organizationId}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <Badge variant="outline">{organization.planName}</Badge>
                </td>
                <td className="px-4 py-4 text-sm text-foreground-secondary">
                  {organization.memberCount}
                </td>
                <td className="px-4 py-4 text-sm text-foreground-secondary">
                  {organization.pendingInvitationCount}
                </td>
                <td className="px-4 py-4 text-right">
                  <Button asChild variant="outline">
                    <Link
                      to="/singularity/orgs/$organizationId"
                      params={{ organizationId: organization.organizationId }}
                    >
                      Open profile
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
            {!hasOrganizations ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-sm text-foreground-tertiary"
                  colSpan={5}
                >
                  No organizations found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </ContentPage>
  )
}
