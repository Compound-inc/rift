import { AppLogo } from "@/components/ui/icons/svg-icons";
import NavbarAuthButtons from "./navbar-auth-buttons";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import Link from "next/link";
import type { Dictionary } from "@/types/dictionary";

const defaultNavbarDict: Dictionary["navbar"] = {
  goHome: "Ir al inicio",
  about: "Acerca",
  pricing: "Precio",
  models: "Modelos",
  mainNavLabel: "Navegación principal",
  signIn: "Iniciar sesión",
  signUp: "Registrarse",
  goToChat: "Ir al chat",
};

type NavbarProps = {
  dict?: Dictionary["navbar"];
  lang?: string;
};

export default function Navbar({ dict = defaultNavbarDict, lang = "es" }: NavbarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md dark:bg-popover-main/80 dark:border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href={lang ? `/${lang}` : "/"} className="flex items-center" aria-label={dict.goHome}>
              <AppLogo className="h-8 w-auto" />
              <span className="sr-only">RIFT</span>
            </Link>
            <nav className="hidden md:flex items-center gap-12 text-md font-medium text-muted-foreground" aria-label={dict.mainNavLabel}>
              <Link href={lang ? `/${lang}#about` : "/#about"} className="hover:text-foreground transition-colors">
                {dict.about}
              </Link>
              <Link href={lang ? `/${lang}#pricing` : "/#pricing"} className="hover:text-foreground transition-colors">
                {dict.pricing}
              </Link>
              <Link href={lang ? `/${lang}/models` : "/models"} className="hover:text-foreground transition-colors">
                {dict.models}
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle size="md" styleType="ghost" />
            <NavbarAuthButtons dict={dict} lang={lang} />
          </div>
        </div>
      </div>
    </header>
  );
}
