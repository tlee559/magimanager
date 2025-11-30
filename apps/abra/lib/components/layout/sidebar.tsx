"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import type { AdminView, UserRole } from "@magimanager/shared";
import { ProfileModal } from "@magimanager/features";
import { APP_VERSION, BUILD_SHA } from "@/lib/constants";

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
      { id: "team", label: "Team", icon: "👨‍👩‍👧‍👦" }
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

  // Settings always last for admins/managers
  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MANAGER") {
    items.push({ id: "settings", label: "Settings", icon: "⚙️" });
  }

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
  const { data: session, update: updateSession } = useSession();
  const navItems = buildNavItems(userRole);
  const [showProfileModal, setShowProfileModal] = useState(false);

  return (
    <aside className="w-72 h-screen flex-shrink-0 border-r border-slate-800 bg-slate-950/90 flex flex-col overflow-hidden">
      {/* Logo Header */}
      <div className="h-16 flex-shrink-0 px-6 flex items-center gap-3 border-b border-slate-800">
        <SquareMLogoIcon size={40} />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-purple-400">MagiManager</span>
          <span className="text-xs text-slate-400">Accounts Console</span>
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

      {/* User Info & Cross-App Navigation & Logout */}
      <div className="flex-shrink-0 w-full px-6 py-4 border-t border-slate-800 space-y-3">
        {/* User Profile Button */}
        <button
          onClick={() => setShowProfileModal(true)}
          className="w-full px-4 py-3 bg-slate-800/80 rounded-lg hover:bg-slate-700 transition text-left"
        >
          <div className="text-sm font-medium text-slate-100">{session?.user?.name || "Loading..."}</div>
          <div className="text-xs text-slate-400">{session?.user?.email || ""}</div>
        </button>

        {/* Kadabra Button - Green */}
        <a
          href="https://magimanager.com/admin"
          className="block w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-500 hover:to-teal-500 transition text-sm text-center"
        >
          <span className="font-semibold">Kadabra</span>
          <span className="block text-[11px] text-emerald-100/80">Ads Manager</span>
        </a>

        {/* Logout Button */}
        <button
          onClick={() => {
            // Redirect to local logout page which handles cookie cleanup
            window.location.href = "/logout";
          }}
          className="w-full px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm flex items-center justify-center gap-2"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>

        {/* Version Info */}
        <div className="pt-2 text-xs text-center">
          <div className="text-slate-400 font-medium">ABRA v{APP_VERSION}</div>
          <div className="text-slate-600">Build: {BUILD_SHA?.slice(0, 7) || "local"}</div>
        </div>
      </div>

      {/* Profile Modal */}
      {showProfileModal && session?.user && (
        <ProfileModal
          onClose={() => setShowProfileModal(false)}
          user={{
            name: session.user.name || "",
            email: session.user.email || "",
          }}
          onUpdate={() => {
            // Refresh the session to show updated user info
            updateSession();
          }}
        />
      )}
    </aside>
  );
}
