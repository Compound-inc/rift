'use client'

import { useState } from 'react'
import { Form } from '@rift/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@rift/ui/select'
import { ContentPage } from '@/components/layout'
import { AvatarUploadField } from '@/components/settings/avatar-upload'
import { locales } from '@/paraglide/runtime.js'
import { m } from '@/paraglide/messages.js'
import { useAccountPageLogic } from './account-page.logic'

/**
 * User account settings page for profile information.
 */
export function AccountPage() {
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const {
    name,
    email,
    language,
    languageOptions,
    languageError,
    avatarImage,
    avatarMessage,
    nameMessage,
    emailMessage,
    logoutMessage,
    isLoggingOut,
    canEdit,
    initials,
    setNameInput,
    setEmailInput,
    setLanguageInput,
    applyLanguageSelection,
    submitName,
    submitEmail,
    submitLogout,
    persistAvatar,
    applyAvatarChange,
  } = useAccountPageLogic()

  const nameSuccessMessage =
    nameMessage === m.settings_account_name_saved() ? nameMessage : undefined
  const emailSuccessMessage =
    emailMessage === m.settings_account_email_change_requested()
      ? emailMessage
      : undefined
  const selectedLanguageLabel =
    languageOptions.find((localeOption) => localeOption.value === language)?.label ?? language

  return (
    <ContentPage
      title={m.settings_account_page_title()}
      description={m.settings_account_page_description()}
    >
      <Form
        title={m.settings_account_avatar_title()}
        description={m.settings_account_avatar_description()}
        headerSlot={
          <AvatarUploadField
            image={avatarImage}
            fallbackText={initials}
            alt={m.settings_account_avatar_alt()}
            disabled={!canEdit}
            onPersistImage={persistAvatar}
            onImageChange={applyAvatarChange}
            onUploadError={setAvatarError}
          />
        }
        error={avatarError ?? undefined}
        success={avatarError == null ? avatarMessage ?? undefined : undefined}
        helpText={<p className="text-sm text-foreground-tertiary">{m.settings_account_avatar_help()}</p>}
      />

      <Form
        title={m.settings_account_name_title()}
        description={m.settings_account_name_description()}
        inputAttrs={{
          name: 'displayName',
          type: 'text',
          placeholder: m.settings_account_name_placeholder(),
          maxLength: 32,
          disabled: !canEdit,
        }}
        value={name}
        onValueChange={setNameInput}
        error={
          nameMessage != null && nameMessage !== m.settings_account_name_saved()
            ? nameMessage
            : undefined
        }
        success={nameSuccessMessage}
        helpText={
          <p className="text-sm text-foreground-tertiary">
            {m.settings_account_name_help()}
          </p>
        }
        buttonText={m.settings_account_save_button()}
        buttonDisabled={!canEdit || name.trim().length === 0}
        handleSubmit={submitName}
      />

      <Form
        title={m.settings_account_email_title()}
        description={m.settings_account_email_description()}
        inputAttrs={{
          name: 'email',
          type: 'email',
          placeholder: m.settings_account_email_placeholder(),
          disabled: !canEdit,
        }}
        value={email}
        onValueChange={setEmailInput}
        error={
          emailMessage != null &&
          emailMessage !== m.settings_account_email_change_requested()
            ? emailMessage
            : undefined
        }
        success={emailSuccessMessage}
        helpText={
          <p className="text-sm text-foreground-tertiary">
            {m.settings_account_email_help()}
          </p>
        }
        buttonText={m.settings_account_save_button()}
        buttonDisabled={!canEdit || email.trim().length === 0}
        handleSubmit={submitEmail}
      />

      <Form
        title={m.settings_account_language_title()}
        description={m.settings_account_language_description()}
        error={languageError ?? undefined}
        helpText={<p className="text-sm text-foreground-tertiary">{m.settings_account_language_help()}</p>}
        contentSlot={(
          <Select
            value={language}
            onValueChange={(next) => {
              if (!next || next === language) return
              if (!locales.includes(next)) return
              setLanguageInput(next)
              void applyLanguageSelection(next)
            }}
          >
            <SelectTrigger className="w-full max-w-md" aria-label={m.settings_account_language_title()}>
              <SelectValue>{selectedLanguageLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} align="start">
              {languageOptions.map((localeOption) => (
                <SelectItem key={localeOption.value} value={localeOption.value}>
                  {localeOption.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />

      <Form
        title={m.settings_account_logout_title()}
        description={m.settings_account_logout_description()}
        error={logoutMessage ?? undefined}
        helpText={
          <p className="text-sm text-foreground-tertiary">
            {m.settings_account_logout_help()}
          </p>
        }
        forceActions
        buttonText={m.settings_account_logout_button()}
        buttonVariant="danger"
        buttonDisabled={!canEdit || isLoggingOut}
        handleSubmit={submitLogout}
      />
    </ContentPage>
  )
}
