import { Navigate, createFileRoute } from '@tanstack/react-router'
import { HrCandidateProfilePage } from '@/components/hr/recruitment/candidate'
import { useHrCandidate } from '@/lib/frontend/hr/recruitment'

export const Route = createFileRoute(
  '/(app)/_layout/hr/recruitment/candidates/$candidateId/',
)({
  component: HrCandidateProfileRoutePage,
})

/**
 * Candidate profile root route. Loads the candidate via Zero and
 * redirects up to `/hr/recruitment` if the candidate doesn't exist
 * (deleted, merged into another, or wrong org). The "loading" branch
 * returns null so we don't flash a redirect before Zero finishes.
 */
function HrCandidateProfileRoutePage() {
  const { candidateId } = Route.useParams()
  const { candidate, loading } = useHrCandidate(candidateId)
  if (loading) return null
  if (!candidate) {
    return <Navigate to="/hr/recruitment" />
  }
  return <HrCandidateProfilePage candidateId={candidate.id} />
}
