'use client'

import { Form } from '@rift/ui/form'
import { ContentPage } from '@/components/layout'
import { m } from '@/paraglide/messages.js'
import { ConnectedLoginMethods } from './connected-login-methods'
import { MfaSection } from './mfa-section'
import { useSecurityPageLogic } from './security-page.logic'
import { SessionList } from './session-list'

/**
 * User security settings page for updating account password.
 */
export function SecurityPage() {
  const {
    currentPassword,
    newPassword,
    confirmPassword,
    passwordMessage,
    sessionsMessage,
    loginMethodsMessage,
    primaryEmail,
    passwordMode,
    mfaEnabled,
    mfaPendingVerification,
    mfaBusy,
    mfaMessage,
    mfaSetupTotpURI,
    mfaBackupCodes,
    mfaSetupPassword,
    mfaSetupCode,
    mfaDisablePassword,
    activeSessions,
    sessionsLoaded,
    loginMethodsLoaded,
    loginMethodsLoading,
    sessionsLoading,
    revokingSessionToken,
    linkingProviderId,
    unlinkingLoginMethodId,
    revokingAllOtherSessions,
    connectedLoginMethods,
    canEdit,
    setCurrentPasswordInput,
    setNewPasswordInput,
    setConfirmPasswordInput,
    setMfaSetupPasswordInput,
    setMfaSetupCodeInput,
    setMfaDisablePasswordInput,
    submitPasswordChange,
    enableMfa,
    verifyMfaTotp,
    cancelMfaSetup,
    finishMfaSetup,
    disableMfa,
    mfaSetupStep,
    revokeSessionByToken,
    connectLoginProvider,
    unlinkConnectedLoginMethod,
    revokeAllOtherSessions,
  } = useSecurityPageLogic()
  const passwordSuccessMessages = [
    String(m.settings_security_success()),
    String(m.settings_security_set_success()),
  ]
  const passwordSuccessMessage =
    passwordMessage != null && passwordSuccessMessages.includes(passwordMessage)
      ? passwordMessage
      : undefined
  const isSetPasswordMode = passwordMode === 'set'

  // Reveal the confirm + current fields only once the user starts typing a new password.
  // This keeps the form compact and guides the user through the flow step-by-step.
  const showExtraFields = newPassword.trim().length > 0
  const otherSessionsCount = activeSessions.filter((session) => !session.isCurrent).length

  return (
    <ContentPage
      title={m.settings_security_page_title()}
      description={m.settings_security_page_description()}
    >
      <Form
        title={m.settings_security_login_methods_title()}
        description={m.settings_security_login_methods_description()}
        contentSlot={
          <ConnectedLoginMethods
            connectedLoginMethods={connectedLoginMethods}
            loginMethodsLoaded={loginMethodsLoaded}
            loginMethodsLoading={loginMethodsLoading}
            primaryEmail={primaryEmail}
            canEdit={canEdit}
            linkingProviderId={linkingProviderId}
            unlinkingLoginMethodId={unlinkingLoginMethodId}
            onConnectProvider={connectLoginProvider}
            onUnlinkMethod={unlinkConnectedLoginMethod}
          />
        }
        error={loginMethodsMessage ?? undefined}
        helpText={
          loginMethodsMessage == null ? (
            <p className="text-sm text-foreground-tertiary">
              {m.settings_security_login_methods_help_unlink()}
            </p>
          ) : undefined
        }
      />

      <Form
        title={
          isSetPasswordMode ? m.settings_security_set_password_form_title() : m.settings_security_form_title()
        }
        description={
          isSetPasswordMode
            ? m.settings_security_set_password_form_description()
            : m.settings_security_form_description()
        }
        inputFields={[
          {
            name: 'newPassword',
            label: isSetPasswordMode
              ? m.settings_security_set_password_label_new_password()
              : m.settings_security_label_new_password(),
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
            label: isSetPasswordMode
              ? m.settings_security_set_password_label_confirm_password()
              : m.settings_security_label_confirm_password(),
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
            hidden: isSetPasswordMode || !showExtraFields,
            inputAttrs: {
              type: 'password',
              autoComplete: 'current-password',
              disabled: !canEdit,
            },
            value: currentPassword,
            onValueChange: setCurrentPasswordInput,
          },
        ]}
        buttonText={
          isSetPasswordMode
            ? m.settings_security_set_password_button_set_password()
            : m.settings_security_button_update_password()
        }
        buttonDisabled={
          !canEdit ||
          newPassword.trim().length === 0 ||
          confirmPassword.trim().length === 0 ||
          (!isSetPasswordMode && currentPassword.trim().length === 0)
        }
        handleSubmit={async () => {
          await submitPasswordChange()
        }}
        error={
          passwordMessage != null && !passwordSuccessMessages.includes(passwordMessage)
            ? passwordMessage
            : undefined
        }
        success={passwordSuccessMessage}
        helpText={
          <p className="text-sm text-foreground-tertiary">
            {isSetPasswordMode
              ? m.settings_security_set_password_help()
              : m.settings_security_help_sessions()}
          </p>
        }
      />
      <MfaSection
        canEdit={canEdit}
        mfaEnabled={mfaEnabled}
        mfaPendingVerification={mfaPendingVerification}
        mfaBusy={mfaBusy}
        mfaMessage={mfaMessage}
        mfaSetupTotpURI={mfaSetupTotpURI}
        mfaBackupCodes={mfaBackupCodes}
        mfaSetupPassword={mfaSetupPassword}
        mfaSetupCode={mfaSetupCode}
        mfaDisablePassword={mfaDisablePassword}
        setMfaSetupPasswordInput={setMfaSetupPasswordInput}
        setMfaSetupCodeInput={setMfaSetupCodeInput}
        setMfaDisablePasswordInput={setMfaDisablePasswordInput}
        enableMfa={enableMfa}
        verifyMfaTotp={verifyMfaTotp}
        cancelMfaSetup={cancelMfaSetup}
        finishMfaSetup={finishMfaSetup}
        disableMfa={disableMfa}
        mfaSetupStep={mfaSetupStep}
      />
      <Form
        title={m.settings_security_sessions_title()}
        description={m.settings_security_sessions_description()}
        contentSlot={
          <div className="space-y-3">
            <SessionList
              activeSessions={activeSessions}
              sessionsLoaded={sessionsLoaded}
              canEdit={canEdit}
              revokingSessionToken={revokingSessionToken}
              revokingAllOtherSessions={revokingAllOtherSessions}
              onRevokeSession={revokeSessionByToken}
            />
          </div>
        }
        forceActions
        buttonText={m.settings_security_sessions_revoke_others_button()}
        buttonVariant="dangerLight"
        buttonDisabled={
          !canEdit ||
          sessionsLoading ||
          revokingSessionToken != null ||
          revokingAllOtherSessions ||
          otherSessionsCount === 0
        }
        handleSubmit={async () => {
          await revokeAllOtherSessions()
        }}
        error={sessionsMessage ?? undefined}
        helpText={
          sessionsMessage == null ? (
            <p className="text-sm text-foreground-tertiary">{m.settings_security_sessions_help_revoke()}</p>
          ) : undefined
        }
      />
    </ContentPage>
  )
}
