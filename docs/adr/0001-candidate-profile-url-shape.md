# Candidate profile and Application detail share a parent/child URL

A **Candidate profile** lives at `/hr/recruitment/candidates/$candidateId` and an **Application detail** at `/hr/recruitment/candidates/$candidateId/applications/$applicationId`. The position's candidate table links directly to the Application detail (the position-specific sub-page), not to the profile root.

The alternative was to land on the profile and require an extra click into the right Application. We rejected it because the recruiter's intent at click time is "show me what we know about this person _for this role_," and forcing one more click breaks flow. The profile is reachable by climbing one level up.

The route enforces strict id matching: if the URL's `candidateId` doesn't match the Application's actual `candidateId`, we redirect to the Application's real owner profile rather than rendering or 404-ing. Mismatch comes from stale links and hand-edited URLs; silently rendering the wrong relationship would be worse than a redirect.
