# Project context is unconditional within its Threads

A Thread that belongs to a Project applies the Project's `custom_instruction`
and Project files unconditionally. There is no per-Thread instruction
override and no per-Thread "ignore project context" toggle. The escape hatch
for users who want different behaviour is to move the Thread out of the
Project (move-as-metadata is supported in both directions).

The dangling `threads.custom_instruction_id` column is intentionally left
untouched by this feature. A future "saved instruction library" feature may
adopt it; it carries no commitment from Projects.

Considered allowing per-Thread overrides (replace or append). Rejected for
v1 because the value of a Project is *consistent* context across all its
Threads — per-Thread divergence defeats the promise and makes it invisible
*which* Thread is diverging. Per-Thread overrides would also need their own
UI surface, conflict-resolution rules, and mental model — a substantial
second feature dressed up as a toggle. Adding overrides later if users
genuinely need them is straightforward; removing them once habits form is
not.
