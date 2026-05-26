/**
 * Page-level mutation handlers for Skills, each wrapped in
 * `runSkillMutation` so failures surface as toasts and consumers stay
 * on a boolean return.
 */
'use client'

import { useZero } from '@rocicorp/zero/react'

import { mutators } from '@/integrations/zero'
import { m } from '@/paraglide/messages.js'

import type { SkillEditorState } from './skill-editor-dialog'
import { runSkillMutation } from './skills-page.logic'
import type { SkillRow } from './skills-page.logic'

type SkillCallback = (skill: SkillRow) => Promise<boolean>

type ToggleOverrideParams = {
  readonly skillId: string
  readonly hidden: boolean
}

export function useSkillsPageMutations(input: {
  /** Active project id when the page is project-scoped. */
  readonly projectId: string | undefined
}): {
  readonly deleteSkill: SkillCallback
  readonly shareSkill: SkillCallback
  readonly unshareSkill: SkillCallback
  readonly toggleAdminEdit: (skill: SkillRow, allow: boolean) => Promise<boolean>
  readonly toggleOverride: (params: ToggleOverrideParams) => Promise<boolean>
  readonly submitEditor: (state: SkillEditorState) => Promise<boolean>
} {
  const z = useZero()
  const { projectId } = input

  const deleteSkill: SkillCallback = (skill) =>
    runSkillMutation({
      fn: () => z.mutate(mutators.skills.delete({ skillId: skill.id })).client,
    })

  const shareSkill: SkillCallback = (skill) =>
    runSkillMutation({
      fn: () => z.mutate(mutators.skills.share({ skillId: skill.id })).client,
      successMessage: m.chat_skill_toast_share_success(),
    })

  const unshareSkill: SkillCallback = (skill) =>
    runSkillMutation({
      fn: () =>
        z.mutate(mutators.skills.unshare({ skillId: skill.id })).client,
      successMessage: m.chat_skill_toast_unshare_success(),
    })

  const toggleAdminEdit = (skill: SkillRow, allow: boolean) =>
    runSkillMutation({
      fn: () =>
        z.mutate(
          mutators.skills.update({
            skillId: skill.id,
            patch: { allowAdminEdit: allow },
          }),
        ).client,
    })

  const toggleOverride = async (params: ToggleOverrideParams) => {
    // Defensive no-op; the override section already gates rendering on
    // the project page being loaded.
    if (!projectId) return false
    return runSkillMutation({
      fn: () =>
        z.mutate(
          mutators.skills.setProjectOverride({
            overrideId: crypto.randomUUID(),
            projectId,
            skillId: params.skillId,
            hidden: params.hidden,
            createdAt: Date.now(),
          }),
        ).client,
    })
  }

  /**
   * Dispatches to `create` or `update`. New skills are scoped to the
   * active project when one is loaded, so the page's create button
   * "creates a Project Skill" without any UI branching.
   */
  const submitEditor = async (
    state: SkillEditorState,
  ): Promise<boolean> => {
    if (state.mode === 'create') {
      return runSkillMutation({
        fn: () =>
          z.mutate(
            mutators.skills.create({
              skillId: crypto.randomUUID(),
              name: state.name.trim(),
              body: state.body,
              description: state.description.trim() || undefined,
              projectId,
              createdAt: Date.now(),
            }),
          ).client,
      })
    }

    const targetSkillId = state.skillId
    if (!targetSkillId) return false
    return runSkillMutation({
      fn: () =>
        z.mutate(
          mutators.skills.update({
            skillId: targetSkillId,
            patch: {
              name: state.name.trim(),
              body: state.body,
              description: state.description.trim() || null,
            },
          }),
        ).client,
    })
  }

  return {
    deleteSkill,
    shareSkill,
    unshareSkill,
    toggleAdminEdit,
    toggleOverride,
    submitEditor,
  }
}
