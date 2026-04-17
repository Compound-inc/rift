'use client'

import { useState } from 'react'
import { Form } from '@rift/ui/form'
import { ContentPage } from '@/components/layout'
import { AvatarUploadField } from '@/components/settings/avatar-upload'
import { useOrgProductFeatures } from '@/lib/frontend/organizations/use-org-product-features'
import { m } from '@/paraglide/messages.js'
import { useOrgGeneralPageLogic } from './org-general-page.logic'

export function OrgGeneralPage() {
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const { states, updatingKey, error: productFeatureError, setFeatureEnabled } =
    useOrgProductFeatures()
  const {
    name,
    savedName,
    avatarImage,
    avatarMessage,
    nameMessage,
    canEdit,
    loading,
    setNameInput,
    submitName,
    persistAvatar,
    applyAvatarChange,
  } = useOrgGeneralPageLogic()

  const nameSuccessMessage =
    nameMessage === m.org_settings_general_name_saved()
      ? nameMessage
      : undefined

  return (
    <ContentPage
      title={m.org_settings_general_page_title()}
      description={m.org_settings_general_page_description()}
    >
      <Form
        title={m.org_settings_general_avatar_title()}
        description={m.org_settings_general_avatar_description()}
        headerSlot={
          <AvatarUploadField
            image={avatarImage}
            fallbackText={savedName}
            alt={m.org_settings_general_avatar_alt()}
            disabled={!canEdit || loading}
            onPersistImage={persistAvatar}
            onImageChange={applyAvatarChange}
            onUploadError={setAvatarError}
          />
        }
        error={avatarError ?? undefined}
        success={avatarError == null ? (avatarMessage ?? undefined) : undefined}
        helpText={
          <p className="text-sm text-foreground-tertiary">
            {m.org_settings_general_avatar_help()}
          </p>
        }
      />

      <Form
        title={m.org_settings_general_name_title()}
        description={m.org_settings_general_name_description()}
        inputAttrs={{
          name: 'organizationName',
          type: 'text',
          placeholder: m.org_settings_general_name_placeholder(),
          maxLength: 64,
          disabled: !canEdit || loading,
        }}
        value={name}
        onValueChange={setNameInput}
        error={
          nameMessage != null &&
          nameMessage !== m.org_settings_general_name_saved()
            ? nameMessage
            : undefined
        }
        success={nameSuccessMessage}
        helpText={
          <p className="text-sm text-foreground-tertiary">
            {m.org_settings_general_name_help()}
          </p>
        }
        buttonText={m.common_save()}
        buttonDisabled={!canEdit || loading || name.trim().length === 0}
        handleSubmit={submitName}
      />

      <Form
        title={m.org_settings_general_witting_title()}
        description={m.org_settings_general_witting_description()}
        error={productFeatureError ?? undefined}
        helpText={
          <p className="text-sm text-foreground-tertiary">
            {m.org_settings_general_witting_help()}
          </p>
        }
        headerToggle={{
          checked: states.writing,
          onCheckedChange: (enabled) =>
            void setFeatureEnabled('writing', enabled),
          disabled: !canEdit || loading || updatingKey === 'writing',
        }}
      />
    </ContentPage>
  )
}
