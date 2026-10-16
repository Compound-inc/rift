import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { SingularityOrgListPage } from '@/ee/singularity/components/singularity-org-list-page'
import { parseSingularityDirectorySearch } from '@/ee/singularity/shared/singularity-search'

export const Route = createFileRoute('/(ee)/singularity/_layout/')({
  validateSearch: parseSingularityDirectorySearch,
  component: SingularityIndexRouteComponent,
})

function SingularityIndexRouteComponent() {
  const { organizations } = getRouteApi(
    '/(ee)/singularity/_layout',
  ).useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <SingularityOrgListPage
      organizations={organizations}
      search={search}
      onSearchChange={(patch, replace = false) => {
        void navigate({
          search: (previous) => ({ ...previous, page: undefined, ...patch }),
          replace,
        })
      }}
    />
  )
}
