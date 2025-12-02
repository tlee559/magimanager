"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  UserPlus,
  Settings,
  LogOut,
  Sparkles,
  Bell,
  ClipboardList,
  Inbox,
} from "lucide-react";
import { AbraLayoutProvider, useAbraLayout } from "./abra-layout-provider";
import { APP_VERSION, BUILD_SHA, KADABRA_URL } from "@/lib/constants";

// ============================================================================
// LOGO COMPONENT
// ============================================================================

function MagimanagerLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hatGradientAbra" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
        <linearGradient id="wandGradientAbra" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <path d="M50 10 L75 45 L25 45 Z" fill="url(#hatGradientAbra)" stroke="#7C3AED" strokeWidth="2" />
      <ellipse cx="50" cy="45" rx="30" ry="8" fill="#4C1D95" stroke="#7C3AED" strokeWidth="2" />
      <rect x="48" y="52" width="4" height="35" rx="2" fill="url(#wandGradientAbra)" />
      <circle cx="50" cy="92" r="5" fill="#FBBF24">
        <animate attributeName="opacity" values="1;0.6;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="35" cy="25" r="2" fill="white" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="60" cy="30" r="1.5" fill="white" opacity="0.6">
        <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

function Sidebar() {
  const pathname = usePathname();
  const { user, unreadCount, setShowProfileModal } = useAbraLayout();

  // Determine active nav item from pathname
  const getActiveNav = () => {
    if (pathname === "/admin" || pathname === "/admin/") return "dashboard";
    if (pathname.startsWith("/admin/accounts")) return "accounts";
    if (pathname.startsWith("/admin/identities")) return "identities";
    if (pathname.startsWith("/admin/team")) return "team";
    if (pathname.startsWith("/admin/requests")) return "requests";
    if (pathname.startsWith("/admin/my-requests")) return "my-requests";
    if (pathname.startsWith("/admin/settings")) return "settings";
    if (pathname.startsWith("/admin/notifications")) return "notifications";
    return "dashboard";
  };

  const activeNav = getActiveNav();
  const userRole = user?.role;

  // Build navigation based on role
  const getNavItems = () => {
    const items: { id: string; href: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number; divider?: boolean }[] = [
      { id: "dashboard", href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    ];

    // Admin+ roles get full access
    if (userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MANAGER") {
      items.push(
        { id: "accounts", href: "/admin/accounts", label: "Account Profiles", icon: CreditCard, divider: true },
        { id: "identities", href: "/admin/identities", label: "ID Profiles", icon: Users },
        { id: "requests", href: "/admin/requests", label: "Account Requests", icon: Inbox },
        { id: "team", href: "/admin/team", label: "Team", icon: UserPlus }
      );
    }

    // All users can make requests
    items.push(
      { id: "my-requests", href: "/admin/my-requests", label: "My Requests", icon: ClipboardList, divider: true }
    );

    // Notifications
    items.push({
      id: "notifications",
      href: "/admin/notifications",
      label: "Notifications",
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : undefined,
    });

    // Settings for all
    items.push({ id: "settings", href: "/admin/settings", label: "Settings", icon: Settings });

    return items;
  };

  const navItems = getNavItems();

  return (
    <aside className="w-64 h-screen sticky top-0 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <MagimanagerLogo size={40} />
          <div>
            <h1 className="text-lg font-bold text-violet-400">MagiManager</h1>
            <p className="text-xs text-slate-400">Accounts Console</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item, index) => (
          <div key={item.id}>
            {item.divider && index > 0 && (
              <div className="my-2 border-t border-slate-800" />
            )}
            <Link
              href={item.href}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                activeNav === item.id
                  ? "bg-violet-500/10 text-violet-400"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
              {item.badge ? (
                <span className="ml-auto bg-violet-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <button
          onClick={() => setShowProfileModal(true)}
          className="w-full px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition text-left"
        >
          <div className="text-sm font-medium text-slate-100">{user?.name || "User"}</div>
          <div className="text-xs text-slate-500">{user?.email || "No email"}</div>
        </button>
        <a
          href={`${KADABRA_URL}/admin`}
          className="w-full px-4 py-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg hover:from-emerald-500/20 hover:to-teal-500/20 transition text-sm flex flex-col items-center gap-0.5"
        >
          <span className="font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            MagiManager
          </span>
          <span className="text-[10px] text-emerald-400/70">Ads Console</span>
        </a>
        <button
          onClick={() => {
            window.location.href = "/logout";
          }}
          className="w-full px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm flex flex-col items-center gap-0.5"
        >
          <span className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </span>
          <span className="text-[10px] text-slate-500">Signs out of both apps</span>
        </button>
        <div className="mt-3 text-xs text-slate-500">
          <div className="font-medium">ABRA v{APP_VERSION}</div>
          <div className="text-slate-600">Build: {BUILD_SHA}</div>
        </div>
      </div>
    </aside>
  );
}

// ============================================================================
// MAIN LAYOUT
// ============================================================================

export default function AbraAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AbraLayoutProvider>
      <div className="min-h-screen bg-slate-950 flex">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </AbraLayoutProvider>
  );
}
