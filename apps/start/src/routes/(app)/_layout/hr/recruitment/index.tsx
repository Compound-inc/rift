import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/_layout/hr/recruitment/')({
  component: HrRecruitmentIndex,
})

function HrRecruitmentIndex() {
  return <Navigate to="/hr/recruitment/positions" />
}
