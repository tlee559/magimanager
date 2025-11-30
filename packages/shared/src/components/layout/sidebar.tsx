"use client";

import { useTheme, getAccentTextClasses } from "../theme-provider";
import type { AdminView, UserRole } from "../../types";

// ============================================================================
// LOGO COMPONENT
// ============================================================================

interface LogoProps {
  size?: number;
  gradientFrom?: string;
  gradientTo?: string;
}

export function SquareMLogoIcon({
  size = 40,
  gradientFrom = "#4f46e5",
  gradientTo = "#9333ea",
}: LogoProps) {
  const gradientId = `logoGradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="12" fill={`url(#${gradientId})`} />
      <path
        d="M25 70V30H35L50 55L65 30H75V70H65V45L50 70L35 45V70H25Z"
        fill="white"
      />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor={gradientFrom} />
          <stop offset="1" stopColor={gradientTo} />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ============================================================================
// NAV ITEMS BUILDER
// ============================================================================

export function buildNavItems(
  userRole: UserRole
): { id: AdminView; label: string; icon: string; comingSoon?: boolean }[] {
  const items: { id: AdminView; label: string; icon: string; comingSoon?: boolean }[] = [
    { id: "dashboard", label: "Dashboard", icon: "[D]" },
  ];

  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MANAGER") {
    items.push(
      { id: "ad-accounts", label: "Account Profiles", icon: "[A]" },
      { id: "identities", label: "ID Profiles", icon: "[I]" },
      { id: "admin-requests", label: "Account Requests", icon: "[R]" },
      { id: "team", label: "Team", icon: "[T]" },
      { id: "settings", label: "Settings", icon: "[S]" }
    );
  }

  // SMS Dashboard - Super Admin and Admin only (Coming Soon teaser)
  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN") {
    items.push({ id: "sms-dashboard", label: "SMS", icon: "[M]", comingSoon: true });
  }

  // Only Super Admin gets the System view
  if (userRole === "SUPER_ADMIN") {
    items.push({ id: "system", label: "System", icon: "[Y]" });
  }

  // Super Admin, Admin, and Media Buyer get My Accounts view
  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MEDIA_BUYER") {
    items.push({ id: "my-accounts", label: "My Accounts", icon: "[B]" });
  }

  // All users can see "My Requests"
  items.push({ id: "requests", label: "My Requests", icon: "[Q]" });

  return items;
}

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

interface SidebarProps {
  currentView: AdminView;
  onViewChange: (view: AdminView) => void;
  userRole: UserRole;
  userName?: string;
  userEmail?: string;
  appName?: string;
  appSubtitle?: string;
  logoGradientFrom?: string;
  logoGradientTo?: string;
  onLogout?: () => void;
  appVersion?: string;
  buildSha?: string;
  crossAppUrl?: string;
  crossAppName?: string;
  crossAppSubtitle?: string;
}

export function Sidebar({
  currentView,
  onViewChange,
  userRole,
  userName = "User",
  userEmail = "No email",
  appName = "Magimanager",
  appSubtitle = "Account Factory Console",
  logoGradientFrom = "#4f46e5",
  logoGradientTo = "#9333ea",
  onLogout,
  appVersion = "0.1.0",
  buildSha = "local",
  crossAppUrl,
  crossAppName,
  crossAppSubtitle,
}: SidebarProps) {
  const { theme } = useTheme();
  const navItems = buildNavItems(userRole);
  const accentText = getAccentTextClasses(theme);

  return (
    <aside className="w-72 h-screen flex-shrink-0 border-r border-slate-800 bg-slate-950/90 flex flex-col overflow-hidden">
      {/* Logo Header */}
      <div className="h-16 flex-shrink-0 px-6 flex items-center gap-3 border-b border-slate-800">
        <SquareMLogoIcon size={40} gradientFrom={logoGradientFrom} gradientTo={logoGradientTo} />
        <div className="flex flex-col">
          <span className={`text-sm font-semibold ${accentText}`}>{appName}</span>
          <span className="text-xs text-slate-400">{appSubtitle}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 mt-4 space-y-1 px-3 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => !item.comingSoon && onViewChange(item.id)}
            disabled={item.comingSoon}
            className={`w-full text-left flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              item.comingSoon
                ? "text-slate-500 cursor-not-allowed opacity-60"
                : currentView === item.id
                ? "bg-slate-800 text-white"
                : "text-slate-200 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className={`text-base ${item.comingSoon ? "grayscale" : ""}`}>{item.icon}</span>
            <span className="flex items-center gap-2">
              {item.label}
              {item.comingSoon && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded uppercase tracking-wide">
                  Soon
                </span>
              )}
            </span>
          </button>
        ))}
      </nav>

      {/* User Info & Logout */}
      <div className="flex-shrink-0 w-full px-6 py-4 border-t border-slate-800 space-y-3">
        {/* User Profile */}
        <div className="px-4 py-3 bg-slate-800/80 rounded-lg">
          <div className="text-sm font-medium text-slate-100">{userName}</div>
          <div className="text-xs text-slate-400">{userEmail}</div>
        </div>

        {/* Cross-App Navigation Button */}
        {crossAppUrl && crossAppName && (
          <a
            href={crossAppUrl}
            className="block w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-500 hover:to-teal-500 transition text-sm text-center"
          >
            <span className="font-semibold">{crossAppName}</span>
            {crossAppSubtitle && (
              <span className="block text-[11px] text-emerald-100/80">{crossAppSubtitle}</span>
            )}
          </a>
        )}

        {/* Logout Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm flex items-center justify-center gap-2"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        )}

        {/* Version Info */}
        <div className="pt-2 text-xs text-center">
          <div className="text-slate-400 font-medium">{appName.toUpperCase()} v{appVersion}</div>
          <div className="text-slate-600">Build: {buildSha?.slice(0, 7) || "local"}</div>
        </div>
      </div>
    </aside>
  );
}
