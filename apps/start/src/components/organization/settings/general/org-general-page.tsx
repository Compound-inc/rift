'use client'

import { useState } from 'react'
import { Form } from '@rift/ui/form'
import { ContentPage } from '@/components/layout'
import { AvatarUploadField } from '@/components/settings/avatar-upload'
import { useOrgProductPolicy } from '@/lib/frontend/organizations/use-org-product-policy'
import { usePermissions } from '@/lib/frontend/permissions/use-permissions'
import {
  productCapabilityKey,
  readOrgProductCapability,
} from '@/lib/shared/org-product-capabilities'
import { EMPTY_ORG_PRODUCT_POLICY } from '@/lib/shared/org-product-policy'
import { m } from '@/paraglide/messages.js'
import { useOrgGeneralPageLogic } from './org-general-page.logic'

export function OrgGeneralPage() {
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const { canRaw } = usePermissions()
  const {
    policy: writingPolicy,
    saving: writingSaving,
    error: writingError,
    setPolicy: setWritingPolicy,
  } = useOrgProductPolicy('writing')
  const isWritingEntitled = canRaw('product.writing')
  const writingCapabilityEnabled = readOrgProductCapability({
    policy: writingPolicy,
    productKey: 'writing',
  })
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

      {isWritingEntitled ? (
        <Form
          title={m.org_settings_general_witting_title()}
          description={m.org_settings_general_witting_description()}
          error={writingError ?? undefined}
          helpText={
            <p className="text-sm text-foreground-tertiary">
              {m.org_settings_general_witting_help()}
            </p>
          }
          headerToggle={{
            checked: writingCapabilityEnabled,
            onCheckedChange: (enabled) => {
              const base = writingPolicy ?? EMPTY_ORG_PRODUCT_POLICY
              const key = productCapabilityKey({})
              void setWritingPolicy({
                ...base,
                capabilities: {
                  ...base.capabilities,
                  [key]: enabled,
                },
              })
            },
            disabled: !canEdit || loading || writingSaving,
          }}
        />
      ) : null}
    </ContentPage>
  )
}
