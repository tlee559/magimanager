"use client";

import { signOut, useSession } from "next-auth/react";
import type { AdminView, UserRole } from "@magimanager/shared";

// ============================================================================
// LOGO COMPONENT
// ============================================================================

function SquareMLogoIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="12" fill="url(#logoGradient)" />
      <path
        d="M25 70V30H35L50 55L65 30H75V70H65V45L50 70L35 45V70H25Z"
        fill="white"
      />
      <defs>
        <linearGradient id="logoGradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4f46e5" />
          <stop offset="1" stopColor="#9333ea" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ============================================================================
// NAV ITEMS BUILDER
// ============================================================================

export function buildNavItems(userRole: UserRole): { id: AdminView; label: string; icon: string; comingSoon?: boolean }[] {
  const items: { id: AdminView; label: string; icon: string; comingSoon?: boolean }[] = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
  ];

  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MANAGER") {
    items.push(
      { id: "ad-accounts", label: "Account Profiles", icon: "💳" },
      { id: "identities", label: "ID Profiles", icon: "👥" },
      { id: "admin-requests", label: "Account Requests", icon: "📥" },
      { id: "team", label: "Team", icon: "👨‍👩‍👧‍👦" },
      { id: "settings", label: "Settings", icon: "⚙️" }
    );
  }

  // SMS Dashboard - Super Admin and Admin only (Coming Soon teaser)
  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN") {
    items.push({ id: "sms-dashboard", label: "SMS", icon: "📱", comingSoon: true });
  }

  // Only Super Admin gets the System view
  if (userRole === "SUPER_ADMIN") {
    items.push({ id: "system", label: "System", icon: "🔧" });
  }

  // Super Admin, Admin, and Media Buyer get My Accounts view
  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MEDIA_BUYER") {
    items.push({ id: "my-accounts", label: "My Accounts", icon: "💼" });
  }

  // All users can see "My Requests"
  items.push({ id: "requests", label: "My Requests", icon: "📝" });

  return items;
}

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

interface SidebarProps {
  currentView: AdminView;
  onViewChange: (view: AdminView) => void;
  userRole: UserRole;
}

export function Sidebar({ currentView, onViewChange, userRole }: SidebarProps) {
  const { data: session } = useSession();
  const navItems = buildNavItems(userRole);

  return (
    <aside className="w-72 h-screen flex-shrink-0 border-r border-slate-800 bg-slate-950/90 flex flex-col overflow-hidden">
      {/* Logo Header */}
      <div className="h-16 flex-shrink-0 px-6 flex items-center gap-3 border-b border-slate-800">
        <SquareMLogoIcon size={40} />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-emerald-400">Magimanager</span>
          <span className="text-xs text-slate-400">Account Factory Console</span>
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
      <div className="flex-shrink-0 w-full px-6 py-4 border-t border-slate-800">
        <div className="mb-3 px-4 py-2 bg-slate-800 rounded-lg">
          <div className="text-sm font-medium text-slate-100">{session?.user?.name || "User"}</div>
          <div className="text-xs text-slate-500">{session?.user?.email || "No email"}</div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm flex items-center justify-center gap-2"
        >
          <span>🚪</span>
          Logout
        </button>
        <div className="mt-3 text-xs text-slate-600 opacity-50 cursor-not-allowed select-none">
          <div className="font-medium text-slate-500">Dev Environment · Local</div>
          <div className="text-slate-600">Coming soon</div>
        </div>
      </div>
    </aside>
  );
}
