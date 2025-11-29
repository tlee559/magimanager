"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { ChevronRight, Calendar } from "lucide-react";
import Link from "next/link";
import { Suspense, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

export type DateRange = "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "LAST_14_DAYS" | "LAST_30_DAYS";

interface LayoutContentProps {
  children: React.ReactNode;
}

// ============================================================================
// DATE RANGE LABELS
// ============================================================================

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  TODAY: "Today",
  YESTERDAY: "Yesterday",
  LAST_7_DAYS: "Last 7 Days",
  LAST_14_DAYS: "Last 14 Days",
  LAST_30_DAYS: "Last 30 Days",
};

// ============================================================================
// BREADCRUMB COMPONENT
// ============================================================================

function Breadcrumbs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse the URL to build breadcrumbs
  // /admin/campaigns -> All Campaigns
  // /admin/campaigns/123/ad-groups -> Campaign > Ad Groups
  // /admin/campaigns/123/ad-groups/456/ads -> Campaign > Ad Group > Ads

  const parts = pathname.split("/").filter(Boolean);
  const breadcrumbs: { label: string; href: string }[] = [];

  // Always start with All Campaigns
  breadcrumbs.push({
    label: "Campaigns",
    href: `/admin/campaigns${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
  });

  let currentPath = "/admin/campaigns";

  // Skip 'admin' and 'campaigns' in the path
  for (let i = 2; i < parts.length; i++) {
    const part = parts[i];

    if (part === "ad-groups") {
      // Campaign ID is the previous part
      const campaignId = parts[i - 1];
      // We'll fetch the campaign name from context or URL state
      // For now, use a placeholder
      currentPath += `/${campaignId}/ad-groups`;
      breadcrumbs.push({
        label: `Campaign ${campaignId}`,
        href: `${currentPath}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
      });
    } else if (part === "ads") {
      const adGroupId = parts[i - 1];
      currentPath = pathname.substring(0, pathname.indexOf("/ads") + 4);
      breadcrumbs.push({
        label: `Ad Group ${adGroupId}`,
        href: `${currentPath}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
      });
    } else if (part === "keywords") {
      const adGroupId = parts[i - 1];
      currentPath = pathname.substring(0, pathname.indexOf("/keywords") + 9);
      breadcrumbs.push({
        label: `Ad Group ${adGroupId}`,
        href: pathname.replace("/keywords", "/ads") + (searchParams.toString() ? `?${searchParams.toString()}` : ""),
      });
    } else if (part === "settings") {
      breadcrumbs.push({
        label: "Settings",
        href: pathname + (searchParams.toString() ? `?${searchParams.toString()}` : ""),
      });
    }
  }

  // Only show breadcrumbs if we're deeper than the campaigns list
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm mb-4">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.href} className="flex items-center gap-2">
          {index > 0 && <ChevronRight className="w-4 h-4 text-slate-600" />}
          {index === breadcrumbs.length - 1 ? (
            <span className="text-slate-200">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="text-slate-400 hover:text-slate-200 transition"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// DATE RANGE PICKER
// ============================================================================

function DateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentRange = (searchParams.get("dateRange") as DateRange) || "LAST_7_DAYS";

  const handleChange = useCallback((newRange: DateRange) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("dateRange", newRange);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-slate-400" />
      <select
        value={currentRange}
        onChange={(e) => handleChange(e.target.value as DateRange)}
        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-violet-500"
      >
        {Object.entries(DATE_RANGE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================================================
// LAYOUT CONTENT (uses hooks that need Suspense)
// ============================================================================

function LayoutContent({ children }: LayoutContentProps) {
  return (
    <div className="space-y-4">
      {/* Header with date range picker */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Campaign Manager</h1>
        <DateRangePicker />
      </div>

      {/* Breadcrumbs */}
      <Breadcrumbs />

      {/* Page content */}
      {children}
    </div>
  );
}

// ============================================================================
// MAIN LAYOUT
// ============================================================================

export default function CampaignsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-100">Campaign Manager</h1>
          <div className="h-10 w-40 bg-slate-800 rounded-lg animate-pulse" />
        </div>
        <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
      </div>
    }>
      <LayoutContent>{children}</LayoutContent>
    </Suspense>
  );
}
