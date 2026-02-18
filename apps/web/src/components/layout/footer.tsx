import Link from "next/link";
import type { Dictionary } from "@/types/dictionary";

const defaultFooterDict: Dictionary["footer"] = {
  tagline: "La mejor manera para usar Inteligencia Artificial.",
  address: ["Av. Lago Zurich 219,", "Torre Carso II, Piso 12,", "Col. Ampliación Granada,", "Miguel Hidalgo, CDMX, MX. 11529"],
  product: "Producto",
  company: "Empresa",
  support: "Soporte",
  features: "Características",
  availableModels: "Modelos disponibles",
  pricing: "Precios",
  integrations: "Integraciones",
  updates: "Actualizaciones",
  about: "Acerca de",
  blog: "Blog",
  careers: "Carreras",
  contact: "Contacto",
  helpCenter: "Centro de ayuda",
  documentation: "Documentación",
  status: "Estado del servicio",
  privacyPolicy: "Política de privacidad",
  termsOfService: "Términos de servicio",
  copyright: "Todos los derechos reservados.",
};

type FooterProps = {
  dict?: Dictionary["footer"];
  lang?: string;
};

export default function Footer({ dict = defaultFooterDict, lang }: FooterProps) {
  return (
    <footer className="bg-white dark:bg-popover-main border-t border-gray-200 dark:border-border mt-12 md:mt-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-xl font-semibold text-gray-900 dark:text-popover-text">RIFT</span>
            </div>
            <p className="text-gray-600 dark:text-text-secondary text-sm leading-relaxed mb-6">
              {dict.tagline}
            </p>
            <address className="text-gray-600 dark:text-text-secondary text-sm mb-6 not-italic">
              {dict.address.map((line, i) => (
                <span key={i}>{line}{i < dict.address.length - 1 && <br />}</span>
              ))}
            </address>
            {/* <div className="flex space-x-3">
              <Link
                href="#"
                className="text-gray-400 dark:text-text-muted hover:text-gray-600 dark:hover:text-text-secondary transition-colors"
                aria-label="Twitter"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </Link>
              <Link
                href="#"
                className="text-gray-400 dark:text-text-muted hover:text-gray-600 dark:hover:text-text-secondary transition-colors"
                aria-label="GitHub"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </Link>
              <Link
                href="#"
                className="text-gray-400 dark:text-text-muted hover:text-gray-600 dark:hover:text-text-secondary transition-colors"
                aria-label="Discord"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0190 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9460 2.4189-2.1568 2.4189Z" />
                </svg>
              </Link>
            </div> */}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-popover-text mb-4">{dict.product}</h3>
            <ul className="space-y-3">
              <li>
                <Link href="#features" className="text-sm text-gray-600 dark:text-text-secondary hover:text-gray-900 dark:hover:text-popover-text transition-colors">
                  {dict.features}
                </Link>
              </li>
              <li>
                <Link href={lang ? `/${lang}/models` : "/models"} className="text-sm text-gray-600 dark:text-text-secondary hover:text-gray-900 dark:hover:text-popover-text transition-colors">
                  {dict.availableModels}
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="text-sm text-gray-600 dark:text-text-secondary hover:text-gray-900 dark:hover:text-popover-text transition-colors">
                  {dict.pricing}
                </Link>
              </li>
              <li>
                <Link href="#integrations" className="text-sm text-gray-600 dark:text-text-secondary hover:text-gray-900 dark:hover:text-popover-text transition-colors">
                  {dict.integrations}
                </Link>
              </li>
              <li>
                <Link href="#changelog" className="text-sm text-gray-600 dark:text-text-secondary hover:text-gray-900 dark:hover:text-popover-text transition-colors">
                  {dict.updates}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-popover-text mb-4">{dict.company}</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="https://compound.com.mx"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-gray-600 dark:text-text-secondary hover:text-gray-900 dark:hover:text-popover-text transition-colors"
                >
                  {dict.about}
                </Link>
              </li>
              <li>
                <Link
                  href=""
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-gray-600 dark:text-text-secondary hover:text-gray-900 dark:hover:text-popover-text transition-colors"
                >
                  {dict.blog}
                </Link>
              </li>
              <li>
                <Link href="mailto:careers@rift.mx" className="text-sm text-gray-600 dark:text-text-secondary hover:text-gray-900 dark:hover:text-popover-text transition-colors">
                  {dict.careers}
                </Link>
              </li>
              <li>
                <Link href="mailto:contact@rift.mx" className="text-sm text-gray-600 dark:text-text-secondary hover:text-gray-900 dark:hover:text-popover-text transition-colors">
                  {dict.contact}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-popover-text mb-4">{dict.support}</h3>
            <ul className="space-y-3">
              <li>
                <Link href="mailto:help@rift.mx" className="text-sm text-gray-600 dark:text-text-secondary hover:text-gray-900 dark:hover:text-popover-text transition-colors">
                  {dict.helpCenter}
                </Link>
              </li>
              <li>
                <Link href="mailto:contact@rift.mx?subject=Documentacion" className="text-sm text-gray-600 dark:text-text-secondary hover:text-gray-900 dark:hover:text-popover-text transition-colors">
                  {dict.documentation}
                </Link>
              </li>
              <li>
                <Link href="mailto:support@rift.mx?subject=Estado%20del%20servicio" className="text-sm text-gray-600 dark:text-text-secondary hover:text-gray-900 dark:hover:text-popover-text transition-colors">
                  {dict.status}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 md:mt-12 pt-8 border-t border-gray-200 dark:border-border">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex space-x-6 justify-center md:justify-start">
              <Link href="/privacy-policy" className="text-xs text-gray-500 dark:text-text-muted hover:text-gray-700 dark:hover:text-text-secondary transition-colors">
                {dict.privacyPolicy}
              </Link>
              <Link href="/terms-of-service" className="text-xs text-gray-500 dark:text-text-muted hover:text-gray-700 dark:hover:text-text-secondary transition-colors">
                {dict.termsOfService}
              </Link>
            </div>
            <div className="text-xs text-gray-500 dark:text-text-muted text-center md:text-left">
              © {new Date().getFullYear()} The Unreal Compound SA de CV. {dict.copyright}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
