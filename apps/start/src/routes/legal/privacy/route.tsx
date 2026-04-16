import { createFileRoute } from '@tanstack/react-router'
import { buildPageMetadata } from '@/lib/frontend/metadata/metadata.functions'

/**
 * Privacy Policy legal page.
 */
export const Route = createFileRoute('/legal/privacy')({
  head: () => ({
    meta: buildPageMetadata({
      title: 'Privacy Policy',
      description:
        'Review how Rift collects, uses, stores, and protects personal information across the website and product.',
    }),
  }),
  component: PrivacyPolicyPage,
})

function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-surface-base dark:bg-surface-raised">
      <div className="fixed top-0 left-0 right-0 z-50 bg-surface-base/80 dark:bg-surface-raised/80 backdrop-blur-sm border-b border-border-base">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <p
            className="font-semibold text-lg text-foreground-primary dark:text-foreground-primary"
            aria-hidden="true"
          >
            Privacy Policy
          </p>
        </div>
      </div>

      <div className="pt-24 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col">
            <h1 className="font-semibold text-3xl leading-9 text-foreground-primary dark:text-foreground-primary mb-2">
              PRIVACY POLICY
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
                  This privacy policy (the "Policy") describes how The Unreal
                  Compound SA de CV ("Company", "Rift AI", "we") collects, uses,
                  and shares personal information from users of this website,
                  Rift AI `https://rift.mx` (the "Site"), as well as associated
                  products and services (collectively, the "Services"). It
                  applies to personal information we collect through the Site
                  and our Services, as well as personal information you provide
                  directly to us. This Policy also applies to any other website
                  or Service of ours that posts this Policy. By using the Site
                  or Services, you agree to the practices and policies described
                  in this Policy and consent to our collection, use, and sharing
                  of your personal information as described below. If you do not
                  agree to this Policy, please do not use the Site or Services.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  2. Personal Information We Collect
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  We collect personal information about you in various ways. Our
                  product, Rift AI, collects the following personal information:
                </p>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-base leading-6 text-foreground-primary dark:text-foreground-primary mb-2">
                      Personal information from Rift AI users:
                    </h3>
                    <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-2">
                      When you use our Rift AI product, we collect the following
                      personal information from you:
                    </p>
                    <ul className="list-disc pl-6 space-y-1 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                      <li>
                        User content, such as your instructions or queries to
                        the Rift AI product and other content you upload to the
                        product, including PDF files, images, and text files.
                      </li>
                      <li>
                        Information you provide to us, such as feedback or
                        opinions about the product.
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base leading-6 text-foreground-primary dark:text-foreground-primary mb-2">
                      Personal information from users of our websites in
                      general:
                    </h3>
                    <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-2">
                      When you use our Services, including our website and Rift
                      AI, we collect the personal information you provide to us,
                      which may include the following categories, depending on
                      how you use our Services and communicate with us:
                    </p>
                    <ul className="list-disc pl-6 space-y-1 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                      <li>
                        General identifiers, such as your full name, email
                        address, and Google Account ID.
                      </li>
                      <li>
                        Online identifiers, such as your username and passwords
                        for any of our Sites, or information we automatically
                        collect through cookies and similar technologies used on
                        our websites. This may include the type and version of
                        operating system on your computer or mobile device,
                        manufacturer and model, browser type, screen resolution,
                        internet protocol (IP) address, unique identifier, the
                        website you visited before navigating to our Site, and
                        general location information such as city, state, or
                        geographic area.
                      </li>
                      <li>
                        Protected classification characteristics that you choose
                        to provide in your communications with us or with the
                        Services, or that we collect in connection with
                        providing our Services, including age, race, color,
                        ancestry, national origin, citizenship, religion or
                        creed, marital status, medical condition, physical or
                        mental disability, sex, sexual orientation, veteran or
                        military status, or genetic information.
                      </li>
                      <li>
                        Commercial information, such as the billing data we use
                        to charge you for our Services, your billing and payment
                        history, and any personal property records we collect in
                        connection with providing our Services. We also collect
                        information about your preferences regarding marketing
                        communications.
                      </li>
                      <li>
                        Audio, electronic, and visual information we collect in
                        connection with providing our Services, such as video or
                        audio recordings of conversations made with your
                        consent, and any security camera recordings of your
                        activity at our physical locations.
                      </li>
                      <li>
                        Professional or employment information we collect in
                        connection with providing our Services, such as your
                        position, employer information, and work history.
                      </li>
                      <li>Other information you provide to us.</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base leading-6 text-foreground-primary dark:text-foreground-primary mb-2">
                      Information we automatically collect:
                    </h3>
                    <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                      We automatically log information about you and your
                      computer, phone, tablet, or other devices you use to
                      access the Site and Services. For example, when you visit
                      our Site or Services, we may log your computer or device
                      identification, operating system type, browser type,
                      browser language, the site you visited before navigating
                      to our Site or Services, the pages you viewed, the time
                      spent on each page, access times, and information about
                      your use of and actions on our Site or Services. The
                      amount of information collected depends on the type and
                      configuration of the device you use to access the Site and
                      Services.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base leading-6 text-foreground-primary dark:text-foreground-primary mb-2">
                      Cookies:
                    </h3>
                    <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                      We may record information through "cookies." Cookies are
                      small data files that a website stores on your hard drive.
                      We may use session cookies (which expire when you close
                      your browser) and persistent cookies (which remain on your
                      computer until you delete them) to provide you with a more
                      personalized and interactive experience on our Site. Other
                      similar tools we may use to collect information
                      automatically include web server logs, web beacons, and
                      pixel tags. This type of information is collected to make
                      the Site and Services more useful to you and to tailor
                      your experience according to your interests and needs.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base leading-6 text-foreground-primary dark:text-foreground-primary mb-2">
                      Analytics information:
                    </h3>
                    <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                      We may use analytics tools to help analyze how users use
                      the Site and Services. These analytics services use
                      cookies to collect information such as how often users
                      visit the Site or use the Services, what pages they visit,
                      types of files uploaded, storage usage, message volume,
                      and what other sites they used before reaching the Site.
                      The information obtained through these services is used
                      only to improve our Site and Services. The analytics
                      services place persistent cookies in your browser to
                      identify you as a unique user the next time you visit the
                      Site or use the Services.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  3. How We Use Your Personal Information
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  Subject to this Privacy Policy, our terms of use, and the
                  applicable terms and conditions of third-party applications,
                  all data transmitted through the Site and Services is owned by
                  Rift AI. Generally, we may use the information in the
                  following ways and as described in this Privacy Policy:
                </p>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-base leading-6 text-foreground-primary dark:text-foreground-primary mb-2">
                      To provide the Services and personalize your experience:
                    </h3>
                    <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-2">
                      We use your personal information to provide you with the
                      Services, including:
                    </p>
                    <ul className="list-disc pl-6 space-y-1 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                      <li>Helping to establish and verify your identity;</li>
                      <li>
                        For the specific purposes for which you provided it,
                        including, without limitation, processing and handling
                        your requests or providing the Services to you;
                      </li>
                      <li>Providing you with effective customer service;</li>
                      <li>
                        Offering you a personalized experience when using the
                        Site or delivering relevant Site content to you;
                      </li>
                      <li>
                        Sending information about your relationship or
                        transactions with us;
                      </li>
                      <li>
                        Contacting you with information we think may be of
                        interest to you, including marketing and promotional
                        communications; and
                      </li>
                      <li>
                        Improving or developing features, products, or services.
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base leading-6 text-foreground-primary dark:text-foreground-primary mb-2">
                      Research and development:
                    </h3>
                    <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                      We may use your general identifiers, online identifiers,
                      internet activity information, and commercial information
                      for research and development purposes, including analyzing
                      and improving the Services, our Sites, and our business.
                      As part of these activities, we may create aggregated,
                      disassociated, or other anonymous data from the personal
                      information we collect. We convert personal information
                      into anonymous data by removing information that makes the
                      data personally identifiable. We may use and share this
                      anonymous data with third parties for legitimate business
                      purposes.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base leading-6 text-foreground-primary dark:text-foreground-primary mb-2">
                      AI model training:
                    </h3>
                    <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                      We do not use your personal information to train
                      artificial intelligence models.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base leading-6 text-foreground-primary dark:text-foreground-primary mb-2">
                      Marketing:
                    </h3>
                    <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                      We may use your general identifiers, online identifiers,
                      internet activity information, and commercial information
                      in connection with sending marketing communications as
                      permitted by law, including by postal and email mail. You
                      may opt out of receiving marketing communications by
                      following the unsubscribe instructions included in
                      marketing emails or by emailing us at support@rift.chat.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base leading-6 text-foreground-primary dark:text-foreground-primary mb-2">
                      Compliance and protection:
                    </h3>
                    <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-2">
                      We may use any of the categories of personal information
                      described above to:
                    </p>
                    <ul className="list-disc pl-6 space-y-1 text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                      <li>
                        Comply with applicable laws, legitimate requests, and
                        legal processes, such as responding to subpoenas or
                        government authority requests.
                      </li>
                      <li>
                        Protect our rights, yours, and those of third parties,
                        as well as privacy, security, and property (including
                        formulating and defending legal claims).
                      </li>
                      <li>
                        Auditing our internal processes to verify compliance
                        with legal and contractual requirements and internal
                        policies.
                      </li>
                      <li>
                        Enforcing the terms and conditions that govern the Site
                        and our Services.
                      </li>
                      <li>
                        Preventing, identifying, investigating, and deterring
                        fraudulent, harmful, unauthorized, unethical, or illegal
                        activities, including cyberattacks and identity theft.
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  4. How We Share Your Personal Information
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  We may disclose all categories of personal information
                  described above with the following categories of third
                  parties:
                </p>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-base leading-6 text-foreground-primary dark:text-foreground-primary mb-2">
                      Affiliates:
                    </h3>
                    <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                      We may share your personal information with our affiliated
                      companies, for purposes consistent with this notice or
                      that operate shared infrastructure, systems, and
                      technology.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base leading-6 text-foreground-primary dark:text-foreground-primary mb-2">
                      Third-party service providers:
                    </h3>
                    <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-3">
                      We may provide your personal information to external
                      service providers who help us provide the Services we
                      offer through the Site or by other means, and to operate
                      our business. Our service providers with whom we may share
                      your personal information include, among others:
                    </p>

                    <div className="space-y-4 pl-4">
                      <div>
                        <h4 className="font-medium text-sm text-foreground-primary dark:text-foreground-primary mb-1">
                          Microsoft Azure.
                        </h4>
                        <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                          We use Microsoft Azure to assist with web hosting.
                          <br />
                          You can view Microsoft's privacy notice here:{' '}
                          <a
                            href="https://www.microsoft.com/en-us/privacy/privacystatement"
                            className="text-foreground-info hover:underline"
                          >
                            https://www.microsoft.com/en-us/privacy/privacystatement
                          </a>
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm text-foreground-primary dark:text-foreground-primary mb-1">
                          Amazon Web Services.
                        </h4>
                        <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                          We use Amazon Web Services ("AWS") to assist with web
                          hosting.
                          <br />
                          You can view AWS's privacy notice here:{' '}
                          <a
                            href="https://aws.amazon.com/privacy/"
                            className="text-foreground-info hover:underline"
                          >
                            https://aws.amazon.com/privacy/
                          </a>
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm text-foreground-primary dark:text-foreground-primary mb-1">
                          Vercel (Vercel Inc.).
                        </h4>
                        <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                          We use Vercel to assist with web hosting, deployment,
                          and content delivery network (CDN) services.
                          <br />
                          You can view Vercel's privacy policy here:{' '}
                          <a
                            href="https://vercel.com/legal/privacy-policy"
                            className="text-foreground-info hover:underline"
                          >
                            https://vercel.com/legal/privacy-policy
                          </a>
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm text-foreground-primary dark:text-foreground-primary mb-1">
                          OpenAI (OpenAI OpCo, LLC).
                        </h4>
                        <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                          We use OpenAI to provide AI and chatbot technology and
                          functionality. When you use our services that depend
                          on OpenAI technology, we send the necessary input data
                          to OpenAI's servers to process your request.
                          <br />
                          You can view OpenAI's privacy policy here:{' '}
                          <a
                            href="https://openai.com/policies/privacy-policy/"
                            className="text-foreground-info hover:underline"
                          >
                            https://openai.com/policies/privacy-policy/
                          </a>
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm text-foreground-primary dark:text-foreground-primary mb-1">
                          Google Gemini (Google, Inc.).
                        </h4>
                        <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                          We use Google Gemini to provide AI and chatbot
                          technology and functionality. When you use our
                          services that depend on Google technology, we send the
                          necessary input data to Google's servers to process
                          your request.
                          <br />
                          You can view Google's privacy policy here:{' '}
                          <a
                            href="https://policies.google.com/privacy"
                            className="text-foreground-info hover:underline"
                          >
                            https://policies.google.com/privacy
                          </a>
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm text-foreground-primary dark:text-foreground-primary mb-1">
                          Anthropic Claude (Anthropic, PBC).
                        </h4>
                        <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                          We use Anthropic Claude to provide AI and chatbot
                          technology and functionality. When you use our
                          services that depend on Anthropic technology, we send
                          the necessary input data to Anthropic's servers to
                          process your request.
                          <br />
                          You can view Anthropic's privacy policy here:{' '}
                          <a
                            href="https://www.anthropic.com/legal/privacy"
                            className="text-foreground-info hover:underline"
                          >
                            https://www.anthropic.com/legal/privacy
                          </a>
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm text-foreground-primary dark:text-foreground-primary mb-1">
                          OpenRouter (OpenRouter, Inc.).
                        </h4>
                        <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                          We use OpenRouter to provide AI and chatbot technology
                          and functionality. When you use our services that
                          depend on OpenRouter technology, we send the necessary
                          input data to OpenRouter's servers to process your
                          request.
                          <br />
                          You can view OpenRouter's privacy policy here:{' '}
                          <a
                            href="https://openrouter.ai/privacy"
                            className="text-foreground-info hover:underline"
                          >
                            https://openrouter.ai/privacy
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base leading-6 text-foreground-primary dark:text-foreground-primary mb-2">
                      Corporate restructuring:
                    </h3>
                    <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                      We may share some or all of your personal information in
                      connection with, or during negotiation of, any merger,
                      financing, acquisition, or dissolution, transaction, or
                      procedure involving the sale, transfer, divestment, or
                      disclosure of all or a portion of our business or assets.
                      In the event of insolvency, bankruptcy, or receivership,
                      personal information may also transfer as a business
                      asset. If another company acquires The Unreal Compound SA
                      de CV, our business, or our assets, that company will own
                      the personal information collected by us and will assume
                      the rights and obligations regarding your personal
                      information described in this Privacy Policy.
                    </p>
                  </div>

                  <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 font-medium">
                    We do not sell your personal information.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  5. Your Choices Regarding Your Personal Information
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-4">
                  You have several choices regarding the use of your personal
                  information on the Site and our Services:
                </p>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-base leading-6 text-foreground-primary dark:text-foreground-primary mb-2">
                      Email communications:
                    </h3>
                    <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                      We may periodically send you free newsletters and
                      promotional emails that directly promote the use of our
                      Site or Services. When you receive newsletters or
                      promotional communications from us, you may indicate a
                      preference to stop receiving them and will have the
                      opportunity to "opt-out" by following the unsubscribe
                      instructions included in the email you receive or by
                      contacting us directly (see contact information below).
                      Despite your email preferences, we may send you
                      communications related to the Service, including notices
                      of updates to this Privacy Policy or our terms of
                      service/terms of use.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base leading-6 text-foreground-primary dark:text-foreground-primary mb-2">
                      Cookies:
                    </h3>
                    <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                      If at any time you decide that you no longer wish to
                      accept cookies from our Site for any of the purposes
                      described above, you can instruct your browser, by
                      changing its settings, to stop accepting cookies or to
                      prompt you before accepting cookies from the sites you
                      visit. Consult your browser's technical information. If
                      you do not accept cookies, you may not be able to use all
                      sections of the Site or all functionality of the Services.
                      If you have questions about how to disable or modify
                      cookies, visit{' '}
                      <a
                        href="https://www.allaboutcookies.org/"
                        className="text-foreground-info hover:underline"
                      >
                        https://www.allaboutcookies.org/
                      </a>
                      .
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  6. Security of Your Personal Information
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  We are committed to protecting the security of your personal
                  information. We use various security technologies and
                  procedures to help protect your personal information against
                  unauthorized access, use, or disclosure. However, no method of
                  transmission over the internet or electronic storage is 100%
                  secure. Therefore, although we make reasonable efforts to
                  protect your personal information, we cannot guarantee its
                  absolute security.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  7. International Users
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  Please note that our Site and Services are provided in Mexico.
                  Accordingly, they are governed by the laws of Mexico,
                  including the Federal Law on Protection of Personal Data Held
                  by Private Parties (LFPDPPP). If you use our Site or Services,
                  your personal information will be subject to Mexican
                  legislation and will be processed in Mexico or other countries
                  in compliance with applicable data protection regulations.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  8. Children
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  Our Site and Services are not directed to children under 13
                  years of age, and you must be at least 13 years old to have
                  our permission to use the Site or Services. We do not
                  knowingly collect, use, or disclose personally identifiable
                  information from children under 13. If you believe we have
                  collected, used, or disclosed personally identifiable
                  information from a child under 13, contact us using the
                  contact information below so that we can take appropriate
                  action.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  9. Updates to This Privacy Policy
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6">
                  We reserve the right to modify this Privacy Policy at any
                  time. If we make material changes, we will post the revised
                  version on our website and update the "Effective Date" at the
                  top of this Policy. Unless otherwise stated, any change will
                  be effective when we post the revised Privacy Policy on our
                  website.
                </p>
              </section>

              <section>
                <h2 className="font-semibold text-xl leading-7 text-foreground-primary dark:text-foreground-primary mb-3">
                  10. Contact
                </h2>
                <p className="text-foreground-primary dark:text-foreground-primary text-sm leading-6 mb-2">
                  Our contact information is as follows:
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
                      href="mailto:privacy@rift.mx"
                      className="text-foreground-info hover:underline"
                    >
                      privacy@rift.mx
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
