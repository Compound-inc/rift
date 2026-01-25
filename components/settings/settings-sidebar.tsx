"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import authkitSignOut from "@/actions/signout";
import {
  Users,
  ReceiptText,
  MessageSquare,
  Bot,
  Palette,
  Bell,
  Mail,
  LogOut,
  Shield,
  Building2,
  BarChart3,
  File,
  Bug,
  TrendingUp,
  Brain,
} from "lucide-react";
import { usePermissionsContext } from "@/contexts/permissions-context";
import { PERMISSIONS } from "@/lib/permissions";
interface SettingsNavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SettingsSection {
  title: string;
  items: SettingsNavItem[];
}

// Inline components to avoid import issues
function SettingItem({
  title,
  href,
  icon: Icon,
  onClick,
  isLogout = false,
}: {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  isLogout?: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  const baseClasses = `
    w-full flex items-center px-2 py-1.5 mb-0.5 rounded-lg text-sm font-medium transition-colors border-2 border-transparent focus:outline-none focus-visible:border-blue-500 dark:focus-visible:border-border
    ${
      isLogout
        ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
        : isActive
          ? "text-gray-900 bg-gray-200 dark:text-white dark:bg-popover-secondary"
          : "text-gray-600 hover:bg-hover dark:text-text-secondary dark:hover:bg-hover/60"
    }
  `;

  const iconClasses = `
    w-5 h-5 mr-2 flex-shrink-0
    ${isLogout ? "text-red-500 dark:text-red-400" : isActive ? "text-gray-700 dark:text-white" : "text-gray-500 dark:text-text-muted"}
  `;

  // If it's a logout button or has onClick, render as button
  if (isLogout || onClick) {
    return (
      <button
        className={baseClasses}
        onClick={onClick}
        type={isLogout ? "button" : undefined}
      >
        <Icon className={iconClasses} />
        <span className="flex-1 text-left truncate">{title}</span>
      </button>
    );
  }

  // For external links (mailto, http, etc.), render as anchor tag
  if (href.startsWith('mailto:') || href.startsWith('http')) {
    return (
      <a 
        href={href}
        className={baseClasses}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        <Icon className={iconClasses} />
        <span className="flex-1 text-left truncate">{title}</span>
      </a>
    );
  }

  // For internal navigation items, render as Link with proper styling
  // Next.js Link automatically prefetches on hover/focus, which is critical for production latency
  return (
    <Link 
      href={href}
      className={baseClasses}
      prefetch={true}
      onClick={() => {
        // #region agent log
        const navStartTime = performance.now();
        (window as any).__navStartTime = navStartTime;
        fetch('http://127.0.0.1:7242/ingest/047d796f-87bb-4f09-adbd-1a615912b381',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'settings-sidebar.tsx:100',message:'Link click - navigation started',data:{href,fromPath:typeof window!=='undefined'?window.location.pathname:'unknown',navStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }}
    >
      <Icon className={iconClasses} />
      <span className="flex-1 text-left truncate">{title}</span>
    </Link>
  );
}

function SettingSection({
  title,
  items,
  isLast = false,
}: {
  title: string;
  items: SettingsNavItem[];
  isLast?: boolean;
}) {
  return (
    <div className="">
      <span className="text-xs font-semibold text-gray-500 dark:text-text-muted px-2 py-1.5 mt-4 mb-1.5 block">
        {title}
      </span>

      {items.map((item) => (
        <SettingItem
          key={item.href}
          title={item.title}
          href={item.href}
          icon={item.icon}
        />
      ))}

      {!isLast && (
        <div className="px-2 my-4">
          <hr className="border-gray-200 dark:border-border" />
        </div>
      )}
    </div>
  );
}

const settingsSections: SettingsSection[] = [
  {
    title: "Organización",
    items: [
      {
        title: "Miembros",
        href: "/settings/members",
        icon: Users,
      },
      {
        title: "Dominio y SSO",
        href: "/settings/domain-sso",
        icon: Building2,
      },
      {
        title: "Analytics",
        href: "/settings/insights",
        icon: TrendingUp,
      },
      {
        title: "Suscripción",
        href: "/settings/billing",
        icon: ReceiptText,
      },
    ],
  },
  {
    title: "Cuenta",
    items: [
      {
        title: "Perfil",
        href: "/settings/profile",
        icon: Users,
      },
      {
        title: "Seguridad",
        href: "/settings/security",
        icon: Shield,
      },
      {
        title: "Uso y Límites",
        href: "/settings/usage",
        icon: BarChart3,
      },
      {
        title: "Archivos",
        href: "/settings/files",
        icon: File,
      },
      // {
      //   title: "Claves API",
      //   href: "/settings/api-keys",
      //   icon: Key,
      // },
    ],
  },
  {
    title: "Configuración de la App",
    items: [
      // {
      //   title: "Respuestas",
      //   href: "/settings/responses",
      //   icon: MessageSquare,
      // },
      {
        title: "Instrucciones",
        href: "/settings/custom-instructions",
        icon: MessageSquare,
      },
      {
        title: "Modelos",
        href: "/settings/models",
        icon: Bot,
      },
      // {
      //   title: "Consejos",
      //   href: "/settings/tips",
      //   icon: Lightbulb,
      // },
      {
        title: "Apariencia",
        href: "/settings/appearance",
        icon: Palette,
      },
      {
        title: "Memoria",
        href: "/settings/memoria",
        icon: Brain,
      },
      // {
      //   title: "Atajos",
      //   href: "/settings/shortcuts",
      //   icon: Target,
      // },
    ],
  },
];

const footerItems: SettingsNavItem[] = [
  {
    title: "Actualizaciones",
    href: "/settings/updates",
    icon: Bell,
  },
  {
    title: "Reportar Errores",
    href: "/settings/reportar-errores",
    icon: Bug,
  },
  {
    title: "Contáctanos",
    href: "mailto:soporte@rift.mx",
    icon: Mail,
  },
];
export function SettingsSidebar() {
  const { permissions } = usePermissionsContext();
  
  // Check permissions from context
  const canManageMembers = permissions.has(PERMISSIONS.WIDGETS_USERS_TABLE_MANAGE);
  const canManageDomainSso = permissions.has(PERMISSIONS.WIDGETS_DOMAIN_VERIFICATION_MANAGE);
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const canViewAnalytics = isProduction ? false : permissions.has(PERMISSIONS.VIEW_ORG_ANALYTICS);
  const canManageBilling = permissions.has(PERMISSIONS.MANAGE_BILLING);

  const handleLogout = async () => {
    try {
      await authkitSignOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="w-full md:w-80 bg-background-settings dark:bg-popover-main dark:backdrop-blur-sm h-full md:h-screen overflow-y-auto scrollbar-hide select-none px-4 md:px-0 md:pr-6">
      <nav className="py-6 md:py-12 flex flex-col w-full md:w-48 md:ml-auto">
        <div className="relative">
          <ul className="flex flex-col -mt-1.5 list-none p-0">
            {/* Navigation Sections */}
            {settingsSections.map((section, sectionIndex) => {
              const filteredItems =
                section.title === "Organización"
                  ? section.items.filter((item) => {
                      if (item.href === "/settings/members") {
                        return canManageMembers;
                      }
                      if (item.href === "/settings/domain-sso") {
                        return canManageDomainSso;
                      }
                      if (item.href === "/settings/insights") {
                        return canViewAnalytics;
                      }
                      if (item.href === "/settings/billing") {
                        return canManageBilling;
                      }
                      return true;
                    })
                  : section.items;

              // Don't render the section if there are no filtered items
              if (filteredItems.length === 0) {
                return null;
              }

              return (
                <SettingSection
                  key={section.title}
                  title={section.title}
                  items={filteredItems}
                  isLast={sectionIndex === settingsSections.length - 1}
                />
              );
            })}

            {/* Footer Divider */}
            <div className="px-2 my-2.5">
              <hr className="border-gray-200 dark:border-border" />
            </div>

            {/* Footer Items */}
            {footerItems.map((item) => (
              <SettingItem
                key={item.href}
                title={item.title}
                href={item.href}
                icon={item.icon}
              />
            ))}

            {/* Final Divider */}
            <div className="px-2 my-2.5">
              <hr className="border-gray-200 dark:border-border" />
            </div>

            {/* Logout Button */}
            <SettingItem
              title="Cerrar sesión"
              href="#"
              icon={LogOut}
              onClick={handleLogout}
              isLogout={true}
            />
          </ul>
        </div>
      </nav>
    </div>
  );
}
