import { Navigate, createFileRoute } from '@tanstack/react-router'
import { HrApplicationDetailPage } from '@/components/hr/recruitment/application'
import {
  useHrApplication,
  useHrCandidate,
  useHrPosition,
} from '@/lib/frontend/hr/recruitment'

export const Route = createFileRoute(
  '/(app)/_layout/hr/recruitment/candidates/$candidateId/applications/$applicationId',
)({
  component: HrApplicationDetailRoutePage,
})

/**
 * Application detail route.
 *
 * - If the URL's `candidateId` doesn't match the Application's actual
 *   `candidateId`, redirect to the Application's real owner profile.
 * - If the Application doesn't exist, redirect up to the URL's
 *   candidate profile (or `/hr/recruitment` if that's also missing).
 * - If the Candidate doesn't exist, redirect to `/hr/recruitment`.
 *
 * Position lookup is best-effort: a missing position renders with an
 * "Unknown position" header rather than redirecting. Archived positions
 * still load because they remain historical Application context.
 */
function HrApplicationDetailRoutePage() {
  const { candidateId, applicationId } = Route.useParams()
  const { application, loading: applicationLoading } =
    useHrApplication(applicationId)
  const { candidate, loading: candidateLoading } = useHrCandidate(candidateId)
  const { position, loading: positionLoading } = useHrPosition(
    application?.positionId ?? null,
  )

  if (applicationLoading || candidateLoading || positionLoading) return null

  if (!application) {
    if (!candidate) return <Navigate to="/hr/recruitment" />
    return (
      <Navigate
        to="/hr/recruitment/candidates/$candidateId"
        params={{ candidateId: candidate.id }}
      />
    )
  }

  if (application.candidateId !== candidateId) {
    return (
      <Navigate
        to="/hr/recruitment/candidates/$candidateId/applications/$applicationId"
        params={{
          candidateId: application.candidateId,
          applicationId: application.id,
        }}
      />
    )
  }

  if (!candidate) {
    return <Navigate to="/hr/recruitment" />
  }

  return (
    <HrApplicationDetailPage
      application={application}
      candidate={candidate}
      position={position}
    />
  )
}
