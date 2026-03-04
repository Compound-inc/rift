import { Resend } from 'resend'

function requireEmailEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`)
  }
  return value
}

const resendClient = new Resend(requireEmailEnv('RESEND_API_KEY'))
const fromAddress = requireEmailEnv('RESEND_FROM_EMAIL')

export type SendAuthEmailInput = {
  to: string
  subject: string
  text: string
}


export async function sendAuthEmail(input: SendAuthEmailInput): Promise<void> {
  await resendClient.emails.send({
    from: fromAddress,
    to: input.to,
    subject: input.subject,
    text: input.text,
  })
}
