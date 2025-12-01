"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Briefcase,
  Bell,
  PlusCircle,
  LogOut,
  Zap,
  Wrench,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { KadabraLayoutProvider, useKadabraLayout } from "./kadabra-layout-provider";
import { MagimanagerLogo } from "../../lib/kadabra-ui";
import { ABRA_URL, APP_VERSION, BUILD_SHA } from "../../lib/constants";

// ============================================================================
// SIDEBAR COMPONENT (uses context for data, pure nav otherwise)
// ============================================================================

function Sidebar() {
  const pathname = usePathname();
  const { user, unreadCount, setShowProfileModal } = useKadabraLayout();

  // Determine active nav item from pathname
  const getActiveNav = () => {
    if (pathname === "/admin" || pathname === "/admin/") return "dashboard";
    if (pathname.startsWith("/admin/accounts/")) return "account-detail";
    if (pathname === "/admin/accounts") return "accounts";
    if (pathname === "/admin/automations") return "automations";
    if (pathname.startsWith("/admin/tools")) return "tools";
    if (pathname === "/admin/action-queue") return "action-queue";
    if (pathname === "/admin/requests") return "requests";
    if (pathname === "/admin/notifications") return "notifications";
    return "dashboard";
  };

  const activeNav = getActiveNav();

  const navItems = [
    { id: "dashboard", href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { id: "accounts", href: "/admin/accounts", label: "My Accounts", icon: Briefcase, divider: true },
    { id: "automations", href: "/admin/automations", label: "Automations", icon: Zap },
    { id: "tools", href: "/admin/tools", label: "Tools", icon: Wrench },
    { id: "action-queue", href: "/admin/action-queue", label: "Action Queue", icon: ListChecks, divider: true },
    { id: "requests", href: "/admin/requests", label: "Requests", icon: PlusCircle },
    { id: "notifications", href: "/admin/notifications", label: "Notifications", icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
  ];

  return (
    <aside className="w-64 h-screen sticky top-0 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <MagimanagerLogo size={40} />
          <div>
            <h1 className="text-lg font-bold text-emerald-400">MagiManager</h1>
            <p className="text-xs text-slate-400">Ads Console</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item, index) => (
          <div key={item.id}>
            {item.divider && index > 0 && (
              <div className="my-2 border-t border-slate-800" />
            )}
            <Link
              href={item.href}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                activeNav === item.id || (item.id === "accounts" && activeNav === "account-detail")
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
          href={`${ABRA_URL}/admin`}
          className="w-full px-4 py-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg hover:from-indigo-500/20 hover:to-purple-500/20 transition text-sm flex flex-col items-center gap-0.5"
        >
          <span className="font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            MagiManager
          </span>
          <span className="text-[10px] text-indigo-400/70">Accounts Console</span>
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
          <div className="font-medium">KADABRA v{APP_VERSION}</div>
          <div className="text-slate-600">Build: {BUILD_SHA}</div>
        </div>
      </div>
    </aside>
  );
}

// ============================================================================
// MAIN LAYOUT (pure JSX - NO hooks except imported provider)
// ============================================================================

export default function KadabraAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <KadabraLayoutProvider>
      <div className="min-h-screen bg-slate-950 flex">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>
      </div>
    </KadabraLayoutProvider>
  );
}
