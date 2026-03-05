'use client'

import { useEffect, useState } from 'react'
import { FormDialog } from '@rift/ui/dialog'
import { Form } from '@rift/ui/form'
import { Label } from '@rift/ui/label'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@rift/ui/input-otp'
import { m } from '@/paraglide/messages.js'
import QRCode from 'qrcode'

export type MfaSectionProps = {
  canEdit: boolean
  mfaEnabled: boolean
  mfaPendingVerification: boolean
  mfaBusy: boolean
  mfaMessage: string | null
  mfaSetupTotpURI: string | null
  mfaSetupStep: 'verify' | 'backup-codes' | null
  mfaBackupCodes: Array<string>
  mfaSetupPassword: string
  mfaSetupCode: string
  mfaDisablePassword: string
  setMfaSetupPasswordInput: (nextValue: string) => void
  setMfaSetupCodeInput: (nextValue: string) => void
  setMfaDisablePasswordInput: (nextValue: string) => void
  enableMfa: () => Promise<void>
  verifyMfaTotp: () => Promise<void>
  cancelMfaSetup: () => void
  finishMfaSetup: () => Promise<void>
  disableMfa: () => Promise<void>
}

/**
 * Standalone MFA section UI used by the Security settings page.
 * Keeps setup, verification, and backup-code interactions isolated from page-level form wiring.
 */
export function MfaSection({
  canEdit,
  mfaEnabled,
  mfaPendingVerification,
  mfaBusy,
  mfaMessage,
  mfaSetupTotpURI,
  mfaBackupCodes,
  mfaSetupPassword,
  mfaSetupCode,
  mfaDisablePassword,
  setMfaSetupPasswordInput,
  setMfaSetupCodeInput,
  setMfaDisablePasswordInput,
  enableMfa,
  verifyMfaTotp,
  cancelMfaSetup,
  finishMfaSetup,
  disableMfa,
  mfaSetupStep,
}: MfaSectionProps) {
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string | null>(null)
  const [setupDialogOpen, setSetupDialogOpen] = useState(false)
  const [copiedSetupKey, setCopiedSetupKey] = useState(false)
  const [copiedAllCodes, setCopiedAllCodes] = useState(false)
  const [activeSetupTotpURI, setActiveSetupTotpURI] = useState<string | null>(null)

  /**
   * Keep the TOTP URI stable while a setup session is pending so failed verify
   * attempts do not swap the QR/copy payload mid-flow.
   */
  useEffect(() => {
    if (mfaPendingVerification) {
      if (mfaSetupTotpURI && activeSetupTotpURI == null) {
        setActiveSetupTotpURI(mfaSetupTotpURI)
      }
      return
    }
    setActiveSetupTotpURI(null)
    setCopiedSetupKey(false)
  }, [mfaPendingVerification, mfaSetupTotpURI, activeSetupTotpURI])

  const setupTotpURI = activeSetupTotpURI ?? mfaSetupTotpURI

  const copySetupKey = async () => {
    if (!setupTotpURI) return
    try {
      await navigator.clipboard.writeText(setupTotpURI)
      setCopiedSetupKey(true)
      window.setTimeout(() => setCopiedSetupKey(false), 2000)
    } catch {
      /* clipboard may be unavailable */
    }
  }

  const copyAllBackupCodes = async () => {
    if (mfaBackupCodes.length === 0) return
    try {
      await navigator.clipboard.writeText(mfaBackupCodes.join('\n'))
      setCopiedAllCodes(true)
      window.setTimeout(() => setCopiedAllCodes(false), 2000)
    } catch {
      /* clipboard may be unavailable */
    }
  }

  const mfaSuccessMessages = [
    String(m.settings_security_mfa_success_enabled()),
    String(m.settings_security_mfa_success_disabled()),
  ]
  const mfaSuccessMessage =
    mfaMessage != null && mfaSuccessMessages.includes(mfaMessage) ? mfaMessage : undefined
  const mfaErrorMessage =
    mfaMessage != null && !mfaSuccessMessages.includes(mfaMessage) ? mfaMessage : undefined

  useEffect(() => {
    if (!setupTotpURI) {
      setQrCodeDataURL(null)
      return
    }

    let active = true
    void QRCode.toDataURL(setupTotpURI, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 192,
    })
      .then((dataUrl) => {
        if (active) setQrCodeDataURL(dataUrl)
      })
      .catch(() => {
        if (active) setQrCodeDataURL(null)
      })

    return () => {
      active = false
    }
  }, [setupTotpURI])

  /** Auto-open the verification dialog as soon as setup starts. */
  useEffect(() => {
    if (mfaPendingVerification) {
      setSetupDialogOpen(true)
      return
    }
    setSetupDialogOpen(false)
  }, [mfaPendingVerification])

  const setupDialogErrorMessage = mfaPendingVerification ? mfaErrorMessage : undefined
  const setupDialogSuccessMessage = mfaPendingVerification ? mfaSuccessMessage : undefined
  const inlineFormErrorMessage = mfaPendingVerification ? undefined : mfaErrorMessage
  const inlineFormSuccessMessage = mfaPendingVerification ? undefined : mfaSuccessMessage
  const setupDialogSecondaryButtonText =
    mfaSetupStep === 'backup-codes'
      ? copiedAllCodes
        ? m.common_copied()
        : m.common_copy()
      : copiedSetupKey
        ? m.common_copied()
        : m.common_copy()

  if (!mfaEnabled || mfaPendingVerification) {
    return (
      <>
        <Form
          title={m.settings_security_mfa_title()}
          description={m.settings_security_mfa_description()}
          inputFields={[
            {
              name: 'mfaSetupPassword',
              label: m.settings_security_mfa_label_password(),
              inputAttrs: {
                id: 'mfa-setup-password',
                type: 'password',
                autoComplete: 'current-password',
                disabled: !canEdit || mfaBusy,
              },
              value: mfaSetupPassword,
              onValueChange: setMfaSetupPasswordInput,
            },
          ]}
          buttonText={m.settings_security_mfa_button_enable()}
          buttonDisabled={!canEdit || mfaBusy || mfaSetupPassword.trim().length === 0}
          handleSubmit={async () => {
            await enableMfa()
          }}
          error={inlineFormErrorMessage}
          success={inlineFormSuccessMessage}
          helpText={
            <p className="text-sm text-content-subtle">
              {m.settings_security_mfa_state_disabled()}
            </p>
          }
        />
        {mfaPendingVerification ? (
          <FormDialog
            open={setupDialogOpen}
            onOpenChange={(open) => {
              setSetupDialogOpen(open)
              if (!open) {
                if (mfaSetupStep === 'backup-codes') {
                  void finishMfaSetup()
                } else {
                  cancelMfaSetup()
                }
              }
            }}
            title={
              mfaSetupStep === 'backup-codes'
                ? m.settings_security_mfa_success_enabled()
                : m.settings_security_mfa_button_verify()
            }
            description={
              mfaSetupStep === 'backup-codes'
                ? m.settings_security_mfa_backup_codes_warning()
                : m.settings_security_mfa_scan_instructions()
            }
            buttonText={
              mfaSetupStep === 'backup-codes'
                ? m.settings_security_mfa_button_close()
                : m.settings_security_mfa_button_verify()
            }
            buttonDisabled={!canEdit || mfaBusy}
            submitButtonDisabled={
              mfaSetupStep === 'backup-codes' ? false : mfaSetupCode.trim().length !== 6
            }
            secondaryButtonText={setupDialogSecondaryButtonText}
            onSecondaryClick={() => {
              if (mfaSetupStep === 'backup-codes') {
                void copyAllBackupCodes()
              } else {
                void copySetupKey()
              }
            }}
            secondaryButtonDisabled={
              mfaSetupStep === 'backup-codes' ? mfaBackupCodes.length === 0 : setupTotpURI == null
            }
            handleSubmit={
              mfaSetupStep === 'backup-codes'
                ? async () => {
                    await finishMfaSetup()
                  }
                : verifyMfaTotp
            }
            error={setupDialogErrorMessage}
            success={setupDialogSuccessMessage}
          >
            {mfaSetupStep === 'backup-codes' ? (
              mfaBackupCodes.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {mfaBackupCodes.map((code) => (
                    <code
                      key={code}
                      className="rounded bg-bg-muted px-2 py-1 text-xs text-content-default"
                    >
                      {code}
                    </code>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="h-7 animate-pulse rounded bg-bg-muted/70" />
                  ))}
                </div>
              )
            ) : (
              <div className="flex flex-col items-center space-y-10">
                {qrCodeDataURL ? (
                  <img
                    src={qrCodeDataURL}
                    alt={m.settings_security_mfa_qr_alt()}
                    className="mx-auto size-48 rounded-md bg-white p-2"
                  />
                ) : (
                  <p className="text-sm text-content-subtle">{m.settings_security_mfa_qr_loading()}</p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="mfa-verify-code" className="block text-center">
                    {m.settings_security_mfa_label_verification_code()}
                  </Label>
                  <InputOTP
                    id="mfa-verify-code"
                    name="mfaVerificationCode"
                    containerClassName="mx-auto justify-center"
                    maxLength={6}
                    value={mfaSetupCode}
                    onChange={(value) => setMfaSetupCodeInput(value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    disabled={!canEdit || mfaBusy}
                  >
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <InputOTPSlot key={index} index={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
            )}
          </FormDialog>
        ) : null}
      </>
    )
  }

  return (
    <Form
      title={m.settings_security_mfa_title()}
      description={m.settings_security_mfa_description()}
      inputFields={[
        {
          name: 'mfaManagePassword',
          label: m.settings_security_mfa_label_password(),
          inputAttrs: {
            id: 'mfa-manage-password',
            type: 'password',
            autoComplete: 'current-password',
            disabled: !canEdit || mfaBusy,
          },
          value: mfaDisablePassword,
          onValueChange: setMfaDisablePasswordInput,
        },
      ]}
      buttonText={m.settings_security_mfa_button_disable()}
      buttonVariant="dangerLight"
      buttonDisabled={!canEdit || mfaBusy || mfaDisablePassword.trim().length === 0}
      handleSubmit={async () => {
        await disableMfa()
      }}
      error={mfaErrorMessage}
      success={mfaSuccessMessage}
      helpText={<p className="text-sm text-content-subtle">{m.settings_security_mfa_state_enabled()}</p>}
    />
  )
}
