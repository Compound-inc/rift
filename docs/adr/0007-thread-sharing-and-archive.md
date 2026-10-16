# Live thread sharing and archive visibility

A share link publishes the active branch at the time of each server read. It is
not a frozen snapshot or a realtime subscription. Later messages and branch
changes appear when the visitor reloads. Sharing does not expose a thread
through Zero: a server service checks the current share status and organization
membership and constructs an explicit DTO for the public page.

Only completed user and assistant text is published. The branch resolver runs
before removing deleted messages, so deleting a message cannot promote its
children into roots or accidentally select a different branch. System messages,
reasoning, tool payloads, sources, analytics, errors and incomplete generations
are private. Attachment names may be shown; file keys and URLs are never included.
Creating or updating a link sets `allow_attachments = false`. Downloads require a
future share-authorized endpoint before that setting can be offered.

Organization threads default to members-only sharing. Personal account owners
can publish public links. Anonymous owners can inspect settings and revoke
existing links, but must create an account before activating a link. A
member-only link requires a non-anonymous session and a current membership row
in the thread's owning organization, regardless of the viewer's selected
organization. Every organization share also requires the owning organization
and the owner's current membership to exist. Missing, revoked, deleted-project,
owner-departed, deleted-organization and unauthorized links all return the same
not-found result. Tokens contain two random UUIDs without separators, with 244
random bits. Revocation preserves the old token on the revoked row; reactivation
replaces it. Read responses and pages are private and non-cacheable. Every shared
page is marked noindex, including public links, to avoid accidental search-engine
discovery.

On self-hosted instances, `publicAppLocked` disables public-audience activation
and requires an authenticated, non-anonymous viewer for every share read. The
sharing dialog explains this restriction. Existing public links remain readable
by account holders while the lock is on; anonymous access is unavailable.

A signed-in viewer may continue the published branch. Members-only shares and
shares subject to a public-sharing restriction must be continued in the owning
organization. A viewer in another workspace or personal context must switch
workspaces first. Unrestricted public shares can be continued in the viewer's
current organization or personal context, after checking destination membership.

Forks store server-written provenance with the source share, source thread and
all source organization IDs in `threads.share_provenance`. The thread had no
metadata column suitable for this data, so this nullable JSON column is needed.
Chained forks retain the full organization list. Public activation and public
reads check every source organization's current policy, even if the original
thread or link has been deleted. Missing source organizations fail closed.
Revoking a source link does not remove copies already made.

Forks own new message IDs and copy only text, with no files, tools, project,
share state or private message metadata. Markdown parsing removes raw HTML and
comments before text enters the fork's model context; literal HTML code examples
remain code. Shared rendering blocks images, including raw HTML and data images,
so opening a link cannot load an author-controlled tracking pixel.

Both reads and forks refuse conversations exceeding 300 persisted messages,
600 attachments or 4 MiB of serialized message and attachment data. These caps
include inactive branches and private payloads; Postgres checks sizes before
bodies are loaded, and bounded queries recheck concurrent growth. Authorized
viewers receive a clear size-limit message. Fork requests use the shared database
rate limiter, with ten attempts per viewer per minute in a separate counter from
chat requests. For five minutes, repeating the same viewer/share/destination
request returns the recent fork. A transaction-scoped advisory lock serializes
matching requests across server replicas. Authorization and current policies are
rechecked before returning a recent copy.

Archiving changes thread visibility, not access. History, default search and
project lists already select visible threads. The archive list shows only the
owner's archived threads in their current organization or personal context,
excluding deleted projects. Direct URLs still work. Appending a new user message
restores visibility in the same transaction. Archiving does not revoke a share;
deleting the thread or its project makes its share unavailable.

Organization admins can disable public sharing through the existing compliance
policy controls with `disable_public_sharing`. The same entitlement and admin
checks as other compliance flags apply. Both link activation and every public
read check this flag, so enabling it disables already published public links.
Those links become usable again if an admin lifts the restriction; revocation
is the operation that permanently invalidates a token. Member-only links still
work. ZDR remains a separate provider-retention rule and does not imply a sharing
restriction.
