# Background check block renders on row presence, not on entitlement

The Background check section on the Application detail page renders if and only if a `hrBackgroundCheck` row exists for the Application. The page does not read the org's entitlement to decide visibility, and there is no upsell state when entitlement is absent.

The alternative ("show an upsell when the org doesn't have the addon") was rejected because background checks are sold per-application — orgs with the addon may still not have run a check on a given Application, so entitlement-presence and row-presence already diverge. Driving visibility off the row is the simpler rule and produces the same UX in both cases (no row → no block).

A future reader's instinct will be to "fix" this by adding an entitlement check that gates the block independently. That would re-introduce the upsell state we deliberately rejected. Upsell belongs on the recruitment settings or add-ons surface, not inline in a recruiter's review flow.
