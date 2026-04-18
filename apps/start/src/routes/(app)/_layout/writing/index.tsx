import { createFileRoute } from '@tanstack/react-router'
import { WritingHomePage } from '@/components/writing/writing-home-page'

export const Route = createFileRoute('/(app)/_layout/writing/')({
  component: WritingPage,
})

function WritingPage() {
  return <WritingHomePage />
}
