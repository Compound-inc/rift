'use client'

import { Form } from '@rift/ui/form'
import { ContentPage } from '@/components/layout'
import { m } from '@/paraglide/messages.js'
import { useSecurityPageLogic } from './security-page.logic'

/**
 * User security settings page for updating account password.
 */
export function SecurityPage() {
  const {
    currentPassword,
    newPassword,
    confirmPassword,
    passwordMessage,
    canEdit,
    setCurrentPasswordInput,
    setNewPasswordInput,
    setConfirmPasswordInput,
    submitPasswordChange,
  } = useSecurityPageLogic()

  const passwordSuccessMessage =
    passwordMessage === m.settings_security_success() ? passwordMessage : undefined

  // Reveal the confirm + current fields only once the user starts typing a new password.
  // This keeps the form compact and guides the user through the flow step-by-step.
  const showExtraFields = newPassword.trim().length > 0

  return (
    <ContentPage
      title={m.settings_security_page_title()}
      description={m.settings_security_page_description()}
    >
      <Form
        title={m.settings_security_form_title()}
        description={m.settings_security_form_description()}
        inputFields={[
          {
            name: 'newPassword',
            label: m.settings_security_label_new_password(),
            inputAttrs: {
              type: 'password',
              autoComplete: 'new-password',
              disabled: !canEdit,
            },
            value: newPassword,
            onValueChange: setNewPasswordInput,
          },
          {
            name: 'confirmPassword',
            label: m.settings_security_label_confirm_password(),
            hidden: !showExtraFields,
            inputAttrs: {
              type: 'password',
              autoComplete: 'new-password',
              disabled: !canEdit,
            },
            value: confirmPassword,
            onValueChange: setConfirmPasswordInput,
          },
          {
            name: 'currentPassword',
            label: m.settings_security_label_current_password(),
            hidden: !showExtraFields,
            inputAttrs: {
              type: 'password',
              autoComplete: 'current-password',
              disabled: !canEdit,
            },
            value: currentPassword,
            onValueChange: setCurrentPasswordInput,
          },
        ]}
        buttonText={m.settings_security_button_update_password()}
        buttonDisabled={
          !canEdit ||
          currentPassword.trim().length === 0 ||
          newPassword.trim().length === 0 ||
          confirmPassword.trim().length === 0
        }
        handleSubmit={async () => {
          await submitPasswordChange()
        }}
        error={
          passwordMessage != null && passwordMessage !== m.settings_security_success()
            ? passwordMessage
            : undefined
        }
        success={passwordSuccessMessage}
        helpText={
          <p className="text-sm text-content-subtle">
            {m.settings_security_help_sessions()}
          </p>
        }
      />
    </ContentPage>
  )
}
