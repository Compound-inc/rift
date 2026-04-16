import { createFileRoute } from '@tanstack/react-router'
import { buildPageMetadata } from '@/lib/frontend/metadata/metadata.functions'

/**
 * Acceptable Use Policy legal page.
 */
export const Route = createFileRoute('/legal/acceptable-use')({
  head: () => ({
    meta: buildPageMetadata({
      title: 'Acceptable Use Policy',
      description:
        'Read Rift\'s acceptable use policy, including prohibited activity, content restrictions, and account security expectations.',
    }),
  }),
  component: AcceptableUsePolicyPage,
})

function AcceptableUsePolicyPage() {
  return (
    <div className="min-h-screen bg-surface-base dark:bg-surface-raised">
      <div className="fixed top-0 left-0 right-0 z-50 bg-surface-base/80 dark:bg-surface-raised/80 backdrop-blur-sm border-b border-border-base">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <p
            className="font-semibold text-lg text-foreground-primary dark:text-foreground-primary"
            aria-hidden="true"
          >
            Acceptable Use Policy
          </p>
        </div>
      </div>

      <div className="pt-24 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col">
            <h1 className="font-semibold text-3xl leading-9 text-foreground-primary dark:text-foreground-primary mb-2">
              ACCEPTABLE USE POLICY
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
                  This Acceptable Use Policy ("Policy") establishes the rules
                  and guidelines for acceptable use of Rift AI services,
                  including the website https://rift.mx and any associated
                  products or services (collectively, the "Services"). By using
                  the Services, you agree to comply with this Policy. If you do
                  not agree to this Policy, you may not access or use the
                  Services.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  2. Prohibited Use
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  You may not use the Services for:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  <li>Any illegal or unauthorized purpose;</li>
                  <li>
                    Violate any law, regulation, or rule local, national, or
                    international;
                  </li>
                  <li>
                    Infringe upon the rights of third parties, including
                    intellectual property rights;
                  </li>
                  <li>
                    Transmit viruses, malware, trojans, worms, or any other
                    malicious code;
                  </li>
                  <li>
                    Interfere with the proper functioning of the Services;
                  </li>
                  <li>
                    Attempt to gain unauthorized access to the Services or the
                    underlying systems;
                  </li>
                  <li>
                    Engage in activities that may damage, disable, overburden,
                    or harm the Services.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  3. Prohibited Content
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  You are not permitted to create, upload, post, transmit, or
                  store content that:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  <li>
                    Is illegal, harmful, threatening, abusive, harassing,
                    defamatory, vulgar, obscene, hateful, or racially or
                    ethnically objectionable;
                  </li>
                  <li>
                    Infringes upon patents, trademarks, copyrights, trade
                    secrets, or other property rights of third parties;
                  </li>
                  <li>
                    Contains software viruses or other code designed to disrupt,
                    destroy, or limit the functionality of any software,
                    hardware, or telecommunications equipment;
                  </li>
                  <li>Is false, misleading, or deceptive;</li>
                  <li>
                    Impersonates any person or entity, or falsely states or
                    implies affiliation with any person or entity;
                  </li>
                  <li>Promotes illegal activities or wrongdoing;</li>
                  <li>Is graphic violence or violent content.</li>
                </ul>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  4. Artificial Intelligence Use
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  By using Rift AI's AI Services, you agree to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  <li>
                    Not use the AI Services to generate illegal, harmful, or
                    abusive content;
                  </li>
                  <li>
                    Not use the AI Services to generate spam, malware, or
                    malicious content;
                  </li>
                  <li>
                    Not attempt to manipulate or bypass the security safeguards
                    of the AI Services;
                  </li>
                  <li>
                    Not use the AI Services to impersonate other persons without
                    their consent;
                  </li>
                  <li>
                    Be responsible for verifying and validating the accuracy of
                    AI-generated content;
                  </li>
                  <li>
                    Understand that Rift AI does not guarantee the accuracy,
                    completeness, or usefulness of AI-generated content;
                  </li>
                  <li>WE DO NOT USE YOUR CONTENT TO TRAIN AI MODELS.</li>
                </ul>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  5. Account Security
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  You are responsible for:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  <li>
                    Maintaining the confidentiality of your account and
                    password;
                  </li>
                  <li>
                    Notifying us immediately of any unauthorized use of your
                    account;
                  </li>
                  <li>
                    Accepting responsibility for all activities that occur under
                    your account;
                  </li>
                  <li>
                    Not sharing your access credentials with third parties;
                  </li>
                  <li>
                    Not using another user's account without their
                    authorization.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  6. Resources and Limits
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  The Services may be subject to usage and resource limits. You
                  agree to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  <li>Not exceed the usage limits established by Rift AI;</li>
                  <li>
                    Not use the Services in a manner that may negatively affect
                    the performance of Rift AI's servers or network;
                  </li>
                  <li>
                    Not use automated tools to access the Services without our
                    consent;
                  </li>
                  <li>
                    Respect the terms of any service plan or subscription you
                    have purchased.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  7. Violations
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  If Rift AI determines, at its sole discretion, that you have
                  violated this Policy, we may:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  <li>Warn you about the violation;</li>
                  <li>Suspend or terminate your access to the Services;</li>
                  <li>Remove content that violates this Policy;</li>
                  <li>Take appropriate legal action;</li>
                  <li>
                    Cooperate with competent authorities in the investigation of
                    illegal activities.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  8. Disclaimer
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  Rift AI shall not be liable for any damage or harm arising
                  from the user's violation of this Policy.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  9. Modifications
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  We reserve the right to modify this Policy at any time.
                  Changes will become effective when posted on our website. Your
                  continued use of the Services after the posting of changes
                  constitutes your acceptance of the modified Policy.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  10. Contact
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-2">
                  If you have questions about this Policy, contact us:
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
