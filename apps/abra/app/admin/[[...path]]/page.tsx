// ============================================================================
// ABRA ADMIN CATCH-ALL ROUTE
// ============================================================================
//
// IMPORTANT: This is a catch-all route that renders the AdminApp component.
// DO NOT create individual page.tsx files for admin routes (accounts, team, etc.)
// The AdminApp component handles ALL admin views internally with URL sync.
//
// If you need to add a new admin view:
// 1. Add the view type to packages/features/src/admin/admin-ui.tsx (View type)
// 2. Add the path mapping to VIEW_TO_PATH and PATH_TO_VIEW in admin-ui.tsx
// 3. Add the view component rendering in AdminApp's main content area
//
// DO NOT:
// - Create apps/abra/app/admin/accounts/page.tsx
// - Create apps/abra/app/admin/team/page.tsx
// - Create apps/abra/app/admin/layout.tsx that wraps with a different sidebar
// - Any other route files that would bypass AdminApp
//
// ============================================================================

import { AdminApp } from "@magimanager/features/admin";
import { APP_VERSION, BUILD_SHA, KADABRA_URL } from "@/lib/constants";

export default function AdminCatchAllPage() {
  return (
    <AdminApp
      appVersion={APP_VERSION}
      buildSha={BUILD_SHA}
      kadabraUrl={KADABRA_URL}
    />
  );
}
