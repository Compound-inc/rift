import { createFileRoute } from '@tanstack/react-router'

/**
 * Terms of Service legal page.
 */
export const Route = createFileRoute('/legal/terms')({
  component: TermsOfServicePage,
})

function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-surface-base dark:bg-surface-raised">
      <div className="fixed top-0 left-0 right-0 z-50 bg-surface-base/80 dark:bg-surface-raised/80 backdrop-blur-sm border-b border-border-base">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="font-semibold text-lg text-foreground-primary dark:text-foreground-primary">
            Terms of Service
          </h1>
        </div>
      </div>

      <div className="pt-24 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col">
            <h1 className="font-semibold text-3xl leading-9 text-foreground-primary dark:text-foreground-primary mb-2">
              TERMS OF SERVICE
            </h1>
            <p className="text-foreground-secondary text-sm leading-5 mb-8">
              Last updated: 2025-10-27
            </p>

            <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  1. Introduction
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  These Terms of Service (&quot;Terms&quot;) constitute a
                  legally binding agreement between The Unreal Compound SA de CV
                  (&quot;Company&quot;, &quot;Rift AI&quot;, &quot;we&quot;) and
                  you (&quot;User&quot;, &quot;you&quot;) regarding your use of
                  Rift AI services, including the website https://rift.mx and
                  any associated products or services (collectively, the
                  &quot;Services&quot;). By accessing or using the Services, you
                  agree to be bound by these Terms. If you do not agree to any
                  of these Terms, you may not access or use the Services.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  2. Eligibility
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  The Services are intended only for users who are at least 13
                  years old. By using the Services, you represent that you are
                  at least 13 years of age and have the legal capacity to enter
                  into a binding agreement. If you are using the Services on
                  behalf of a company, you represent that you have the authority
                  to bind such company to these Terms.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  3. User Account
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  To access certain features of the Services, you may need to
                  create an account. You are responsible for:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  <li>
                    Maintaining the confidentiality of your account and
                    password;
                  </li>
                  <li>Limiting access to your account and device;</li>
                  <li>
                    Accepting responsibility for all activities that occur under
                    your account;
                  </li>
                  <li>Providing accurate and up-to-date information;</li>
                  <li>
                    Notifying us immediately of any unauthorized use of your
                    account.
                  </li>
                </ul>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mt-4">
                  We reserve the right to suspend or terminate accounts that
                  violate these Terms or for any reason at our sole discretion.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  4. Use of the Services
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  By using the Services, you agree to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  <li>Comply with all applicable laws and regulations;</li>
                  <li>
                    Not use the Services for any illegal or unauthorized
                    purpose;
                  </li>
                  <li>
                    Not attempt to gain unauthorized access to the Services;
                  </li>
                  <li>
                    Not interfere with or disrupt the integrity or performance
                    of the Services;
                  </li>
                  <li>Not upload viruses, malware, or any harmful code;</li>
                  <li>
                    Not use the Services in a way that may damage, disable,
                    overburden, or impair the Services.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  5. User Content
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  The Services may allow you to submit, upload, post, or
                  transmit content, including text, images, files, and other
                  materials (&quot;User Content&quot;). You retain ownership of
                  your User Content.
                </p>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  By uploading User Content to the Services, you:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  <li>
                    Grant Rift AI a worldwide, royalty-free, transferable,
                    sublicensable, and exclusive license to use, reproduce,
                    display, distribute, and modify such content for the purpose
                    of providing the Services;
                  </li>
                  <li>
                    Warrant that you have all necessary rights to the User
                    Content and that such content does not infringe the rights
                    of third parties;
                  </li>
                  <li>
                    Accept that Rift AI may use the User Content to improve the
                    Services, but NOT to train artificial intelligence models.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  6. Intellectual Property
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  The Services and all content available through the Services,
                  including but not limited to text, graphics, logos, images,
                  audio, video, software, and other materials, are the property
                  of Rift AI or its licensors and are protected by copyright,
                  trademark, and other intellectual property laws.
                </p>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  You may not copy, reproduce, distribute, publish, display,
                  modify, create derivative works, or use any of these materials
                  without our prior written consent.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  7. Payments and Billing
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  Certain Services may be provided for a fee. By signing up for
                  a payment plan, you:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  <li>
                    Authorize Rift AI to charge the designated payment method
                    for applicable fees;
                  </li>
                  <li>
                    Warrant that the payment information provided is accurate
                    and complete;
                  </li>
                  <li>
                    Accept that we are authorized to charge fees to your payment
                    method;
                  </li>
                  <li>
                    Understand that fees are non-refundable unless otherwise
                    indicated.
                  </li>
                </ul>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mt-4">
                  We reserve the right to modify fees at any time. Any fee
                  change will take effect at the start of the next billing
                  period.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  8. Artificial Intelligence Disclaimer
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  THE SERVICES USE ARTIFICIAL INTELLIGENCE TECHNOLOGY PROVIDED
                  BY THIRD PARTIES, INCLUDING BUT NOT LIMITED TO OPENAI, GOOGLE
                  GEMINI, ANTHROPIC CLAUDE, AND OPENROUTER (&quot;AI
                  PROVIDERS&quot;).
                </p>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  YOU UNDERSTAND AND AGREE THAT:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  <li>
                    AI-generated results may be incomplete, inaccurate, or
                    inappropriate;
                  </li>
                  <li>
                    AI may generate content that does not reflect the views of
                    Rift AI;
                  </li>
                  <li>
                    Rift AI does not guarantee the accuracy, completeness, or
                    usefulness of any AI-generated content;
                  </li>
                  <li>
                    You are responsible for verifying and validating any
                    information provided by the AI Services;
                  </li>
                  <li>WE DO NOT USE YOUR CONTENT TO TRAIN AI MODELS.</li>
                </ul>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  9. Disclaimer of Warranties
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS
                  AVAILABLE.&quot; RIFT AI DOES NOT REPRESENT OR WARRANT THAT
                  THE SERVICES WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
                  RIFT AI DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED,
                  INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
                  FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  10. Limitation of Liability
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  IN NO EVENT SHALL RIFT AI BE LIABLE FOR ANY INDIRECT,
                  INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
                  INCLUDING LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER
                  INTANGIBLE LOSSES, RESULTING FROM (I) YOUR USE OR INABILITY TO
                  USE THE SERVICES; (II) ANY CONTENT OR INFORMATION OBTAINED
                  THROUGH THE SERVICES; (III) UNAUTHORIZED ACCESS TO OR
                  ALTERATION OF YOUR TRANSMISSIONS OR DATA.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  11. Indemnification
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  You agree to defend, indemnify, and hold harmless Rift AI, its
                  affiliates, directors, officers, employees, and agents from
                  any claim, action, demand, loss, damage, cost, or expense,
                  including reasonable legal fees, arising out of or related to
                  your use of the Services, your User Content, or your violation
                  of these Terms.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  12. Termination
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  We may suspend or terminate your access to the Services at any
                  time, with or without cause, with or without notice. Upon
                  termination:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  <li>
                    Your right to use the Services will cease immediately;
                  </li>
                  <li>
                    We may delete your account and all related information;
                  </li>
                  <li>Any license granted under these Terms will terminate.</li>
                </ul>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mt-4">
                  Provisions that by their nature should survive termination
                  will survive, including but not limited to intellectual
                  property, disclaimer, limitation of liability, and
                  indemnification.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  13. Governing Law and Dispute Resolution
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  These Terms shall be governed by and construed in accordance
                  with the laws of Mexico, without regard to its conflict of law
                  provisions.
                </p>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  Any controversy arising out of or related to these Terms shall
                  be resolved exclusively in the competent courts of Mexico
                  City, and you agree to submit to the exclusive jurisdiction of
                  said courts.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  14. Modifications
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  We reserve the right to modify these Terms at any time. If we
                  make material changes, we will notify you by posting the
                  updated version on our website. Your continued use of the
                  Services after such changes constitutes your acceptance of the
                  new Terms.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  15. Contact Information
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-2">
                  If you have any questions about these Terms, contact us:
                </p>
                <div className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  <p>The Unreal Compound SA de CV</p>
                  <p>Av. Lago Zurich 219,</p>
                  <p>Torre Carso II, Piso 12,</p>
                  <p>Col. Ampliacion Granada,</p>
                  <p>Miguel Hidalgo, CDMX, MX. 11529</p>
                  <p className="mt-2">
                    Email:{' '}
                    <a
                      href="mailto:legal@rift.mx"
                      className="text-foreground-info hover:underline"
                    >
                      legal@rift.mx
                    </a>
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
