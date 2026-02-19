import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { getAuth, getSignInUrl, getSignUpUrl } from '@workos/authkit-tanstack-react-start'

export const Route = createFileRoute('/(app)/_layout/')({
  loader: async () => {
    const { user } = await getAuth()
    const signInUrl = await getSignInUrl()
    const signUpUrl = await getSignUpUrl()
    return { user, signInUrl, signUpUrl }
  },
  component: Home,
})

function Home() {
  const { user, signInUrl, signUpUrl } = Route.useLoaderData()
  const { signOut } = useAuth()

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <h1 className="text-3xl font-bold">Welcome to Rift</h1>

        {user ? (
          <div className="space-y-4">
            <p className="text-lg">
              Hello, <span className="font-semibold">{user.email}</span>!
            </p>
            <p className="text-sm text-content-subtle">
              User ID: {user.id}
            </p>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 bg-bg-error text-content-error rounded-md hover:opacity-90 transition-colors"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-content-subtle">
              Sign in to get started
            </p>
            <div className="flex gap-4 justify-center">
              <a
                href={signInUrl}
                className="px-4 py-2 bg-bg-inverted text-content-inverted rounded-md hover:opacity-90 transition-colors"
              >
                Sign In
              </a>
              <a
                href={signUpUrl}
                className="px-4 py-2 border border-border-default text-content-emphasis rounded-md hover:bg-bg-subtle transition-colors"
              >
                Sign Up
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
