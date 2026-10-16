import { createFileRoute, redirect } from '@tanstack/react-router'
import { isSingularityAccessError } from '@/ee/singularity/shared/errors'
import { listSingularityUsers } from '@/ee/singularity/frontend/singularity.functions'
import { parseSingularityUserSearch } from '@/ee/singularity/components/singularity-users-page.logic'
import { SingularityUsersPage } from '@/ee/singularity/components/singularity-users-page'

export const Route = createFileRoute('/(ee)/singularity/_layout/users')({
  validateSearch: parseSingularityUserSearch,
  loader: async () => {
    try {
      return { users: await listSingularityUsers() }
    } catch (error) {
      if (isSingularityAccessError(error)) throw redirect({ to: '/' })
      throw error
    }
  },
  component: UsersRoute,
})

function UsersRoute() {
  const { users } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <SingularityUsersPage
      users={users}
      search={search}
      onSearchChange={(patch, replace = false) => {
        void navigate({
          search: (previous) => ({
            ...previous,
            page: 'user' in patch ? previous.page : undefined,
            ...patch,
          }),
          replace,
        })
      }}
    />
  )
}
