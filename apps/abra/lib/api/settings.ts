// ============================================================================
// SETTINGS API - Client-side API calls for Settings operations
// ============================================================================

import { api } from "./client";
import type { AppSettings } from "@magimanager/shared";

export const settingsApi = {
  // Get app settings
  get: () => api.get<AppSettings>("/api/settings"),

  // Update settings
  update: (data: Partial<AppSettings>) => api.patch<AppSettings>("/api/settings", data),
};
