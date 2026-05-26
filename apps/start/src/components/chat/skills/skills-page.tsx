/**
 * Skills management page. Shared by `/chat/skills` (global) and
 * `/chat/projects/$projectId/skills` (project) via the `scope` prop.
 * Composition + state only — single-row rendering, the editor dialog,
 * mutation wrapping, and the policy live in sibling files.
 */
'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@rocicorp/zero/react'
import { Button } from '@rift/ui/button'
import Plus from 'lucide-react/dist/esm/icons/plus'

import { ContentPage } from '@/components/layout'
import { queries } from '@/integrations/zero'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { m } from '@/paraglide/messages.js'

import {
  EMPTY_EDITOR_STATE,
  SkillEditorDialog,
  editorStateFromSkill,
} from './skill-editor-dialog'
import type { SkillEditorState } from './skill-editor-dialog'
import { SkillOverrideSection } from './skill-override-section'
import { SkillShareDialog } from './skill-share-dialog'
import { SkillsEmptyState } from './skills-empty-state'
import { SkillsSection } from './skills-section'
import { canEditSkill } from './skills-page.logic'
import type { SkillRow } from './skills-page.logic'
import { useSkillsPageMutations } from './use-skills-page-mutations'

/**
 * - `global`: shows the user's Personal + Org-Shared skills.
 * - `project`: shows the project's Project Skills plus, for the owner,
 *   an override toggle list for visible globals.
 */
export type SkillsPageScope =
  | { readonly kind: 'global' }
  | { readonly kind: 'project'; readonly projectId: string }

export function SkillsPage({ scope }: { scope: SkillsPageScope }) {
  const auth = useAppAuth()
  const userId = auth.user?.id

  // Personal + Org-Shared are loaded on both surfaces — the global page
  // renders them, the project page consumes them as the override picker
  // source. Zero deduplicates the subscriptions.
  const [personal, personalResult] = useQuery(queries.skills.listPersonal({}))
  const [orgShared, orgSharedResult] = useQuery(queries.skills.listOrgShared({}))

  const globalSkills = useMemo(
    () => [...(personal ?? []), ...(orgShared ?? [])],
    [personal, orgShared],
  )

  // Gate the empty-state on query completion so we don't flash the
  // marketing copy while the lists are still hydrating.
  const globalLoading =
    personalResult.type !== 'complete' || orgSharedResult.type !== 'complete'
  const showGlobalEmptyState =
    scope.kind === 'global' && !globalLoading && globalSkills.length === 0

  const projectId = scope.kind === 'project' ? scope.projectId : undefined
  const [project] = useQuery(
    projectId ? queries.projects.byId({ projectId }) : null,
  )
  const [projectSkills] = useQuery(
    projectId ? queries.skills.listForProject({ projectId }) : null,
  )
  const [overrides] = useQuery(
    projectId ? queries.skills.overridesForProject({ projectId }) : null,
  )

  const overrideSkillIds = useMemo(
    () => new Set((overrides ?? []).map((row) => row.skillId)),
    [overrides],
  )

  // Override mutations are owner-only server-side; hide the section
  // entirely for non-owners so they never see UI that would 500.
  const isProjectOwner = !!project && project.userId === userId

  const canEditSkillFn = useMemo(() => {
    const context = {
      currentUserId: userId,
      activeOrganizationId: auth.activeOrganizationId,
      activeOrganizationRole: auth.activeOrganizationRole,
      project,
    }
    return (skill: SkillRow) => canEditSkill({ skill, context })
  }, [
    userId,
    auth.activeOrganizationId,
    auth.activeOrganizationRole,
    project,
  ])

  // Sharing is creator-only and not applicable to Project Skills (ADR-0005).
  const canManageSharingFor = useMemo(() => {
    return (skill: SkillRow) =>
      !!userId && skill.userId === userId && !skill.projectId
  }, [userId])

  const [editorState, setEditorState] = useState<SkillEditorState | null>(null)
  const [shareSkillId, setShareSkillId] = useState<string | null>(null)

  const {
    deleteSkill,
    shareSkill,
    unshareSkill,
    toggleAdminEdit,
    toggleOverride,
    submitEditor,
  } = useSkillsPageMutations({ projectId })

  // Look up the live row by id rather than snapshotting it when Edit
  // is clicked, so the dialog reflects fresh state if the row mutates
  // underneath us.
  const editingSkill = useMemo<SkillRow | undefined>(() => {
    const id = editorState?.skillId
    if (!id) return undefined
    return (
      globalSkills.find((row) => row.id === id) ??
      (projectSkills ?? []).find((row) => row.id === id)
    )
  }, [editorState?.skillId, globalSkills, projectSkills])

  const skillInShareDialog = useMemo<SkillRow | null>(() => {
    if (!shareSkillId) return null
    return (
      globalSkills.find((row) => row.id === shareSkillId) ??
      (projectSkills ?? []).find((row) => row.id === shareSkillId) ??
      null
    )
  }, [shareSkillId, globalSkills, projectSkills])

  const editingCanEdit = editingSkill ? canEditSkillFn(editingSkill) : false

  const onEdit = (skill: SkillRow) =>
    setEditorState(editorStateFromSkill(skill))
  const onOpenShareDialog = (skill: SkillRow) => setShareSkillId(skill.id)

  return (
    <ContentPage
      title={m.chat_skill_page_title()}
      description={
        scope.kind === 'global'
          ? m.chat_skill_page_description_global()
          : m.chat_skill_page_description_project()
      }
    >
      {/* Empty state has its own primary CTA, so suppress the top bar there. */}
      {showGlobalEmptyState ? null : (
        <div className="flex items-center justify-end">
          <Button onClick={() => setEditorState(EMPTY_EDITOR_STATE)}>
            <Plus className="size-4" />
            {m.chat_skill_action_new()}
          </Button>
        </div>
      )}

      {scope.kind === 'global' ? (
        showGlobalEmptyState ? (
          <SkillsEmptyState
            onCreateSkill={() => setEditorState(EMPTY_EDITOR_STATE)}
          />
        ) : (
          <SkillsSection
            skills={globalSkills}
            canEditSkill={canEditSkillFn}
            canManageSharingFor={canManageSharingFor}
            onEdit={onEdit}
            onOpenShareDialog={onOpenShareDialog}
            emptyHint={m.chat_skill_section_personal_empty()}
          />
        )
      ) : (
        <>
          <SkillsSection
            heading={m.chat_skill_section_project_heading()}
            description={m.chat_skill_section_project_description()}
            skills={projectSkills ?? []}
            canEditSkill={canEditSkillFn}
            canManageSharingFor={canManageSharingFor}
            onEdit={onEdit}
            onOpenShareDialog={onOpenShareDialog}
            emptyHint={m.chat_skill_section_project_empty()}
          />
          {isProjectOwner ? (
            <SkillOverrideSection
              personalGlobals={personal ?? []}
              orgGlobals={orgShared ?? []}
              overrideSkillIds={overrideSkillIds}
              onToggleOverride={toggleOverride}
            />
          ) : null}
        </>
      )}

      <SkillEditorDialog
        state={editorState}
        skill={editingSkill}
        canEdit={editingCanEdit}
        onChange={setEditorState}
        onClose={() => setEditorState(null)}
        onSubmit={submitEditor}
        onDelete={deleteSkill}
      />

      <SkillShareDialog
        skill={skillInShareDialog}
        onClose={() => setShareSkillId(null)}
        onShare={shareSkill}
        onUnshare={unshareSkill}
        onToggleAdminEdit={toggleAdminEdit}
      />
    </ContentPage>
  )
}
