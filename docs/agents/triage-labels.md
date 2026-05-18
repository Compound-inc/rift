# Triage Labels

The skills speak in terms of five canonical triage roles. In Linear, these map to **labels** on the `COM` team (or workspace-scoped labels if you'd rather share them across teams). Create them once via `linear label create -n "<name>"` if they don't already exist.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), apply the corresponding Linear label via `linear issue update <COM-N> --label "<name>"`.

Linear also has built-in workflow **states** (Triage, Backlog, Todo, In Progress, Done, Canceled). Don't confuse these with triage labels — labels mark the human/agent routing decision, states mark execution progress. The triage skill uses both: it sets the label and may also move the state to `Triage` or `Backlog` accordingly.
