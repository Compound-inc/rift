import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/_layout/chat')({
  component: ChatLayout,
})

function ChatLayout() {
  return <Outlet />
}
