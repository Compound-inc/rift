'use client'

import { useState } from 'react'
import { Form } from '@rift/ui/form'
import { ContentPage } from '@/components/layout'
import { AvatarUploadField } from '@/components/settings/avatar-upload'
import { useAccountPageLogic } from './account-page.logic'

/**
 * User account settings page for profile information.
 */
export function AccountPage() {
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const {
    name,
    email,
    avatarImage,
    avatarMessage,
    nameMessage,
    emailMessage,
    canEdit,
    initials,
    setNameInput,
    setEmailInput,
    submitName,
    submitEmail,
    persistAvatar,
    applyAvatarChange,
  } = useAccountPageLogic()

  const nameSuccessMessage = nameMessage === 'Display name saved.' ? nameMessage : undefined
  const emailSuccessMessage =
    emailMessage === 'Email change request submitted. Check your inbox to finish verification.'
      ? emailMessage
      : undefined

  return (
    <ContentPage title="Account" description="Manage your account details and avatar.">
      <Form
        title="Avatar"
        description="This is your avatar. Click on the avatar to upload a custom image."
        headerSlot={
          <AvatarUploadField
            image={avatarImage}
            fallbackText={initials}
            alt="Profile avatar"
            disabled={!canEdit}
            onPersistImage={persistAvatar}
            onImageChange={applyAvatarChange}
            onUploadError={setAvatarError}
          />
        }
        error={avatarError ?? undefined}
        success={avatarError == null ? avatarMessage ?? undefined : undefined}
        helpText={<p className="text-sm text-content-subtle">An avatar is optional but strongly recommended.</p>}
      />

      <Form
        title="Display Name"
        description="Please enter your full name, or a display name you are comfortable with."
        inputAttrs={{
          name: 'displayName',
          type: 'text',
          placeholder: 'e.g. Ari Say',
          maxLength: 32,
          disabled: !canEdit,
        }}
        value={name}
        onValueChange={setNameInput}
        error={
          nameMessage != null && nameMessage !== 'Display name saved.'
            ? nameMessage
            : undefined
        }
        success={nameSuccessMessage}
        helpText={
          <p className="text-sm text-content-subtle">
            Please use 32 characters at maximum.
          </p>
        }
        buttonText="Save"
        buttonDisabled={!canEdit || name.trim().length === 0}
        handleSubmit={submitName}
      />

      <Form
        title="Email"
        description="This is your account email address."
        inputAttrs={{
          name: 'email',
          type: 'email',
          placeholder: 'you@example.com',
          disabled: !canEdit,
        }}
        value={email}
        onValueChange={setEmailInput}
        error={
          emailMessage != null &&
          emailMessage !== 'Email change request submitted. Check your inbox to finish verification.'
            ? emailMessage
            : undefined
        }
        success={emailSuccessMessage}
        helpText={
          <p className="text-sm text-content-subtle">
            Use a valid address you can access to complete secure verification.
          </p>
        }
        buttonText="Save"
        buttonDisabled={!canEdit || email.trim().length === 0}
        handleSubmit={submitEmail}
      />
    </ContentPage>
  )
}
