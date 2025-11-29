import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ============================================================================
// CLASS NAME UTILITIES (local - uses local clsx/tailwind-merge)
// ============================================================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// RE-EXPORT ALL UTILITIES FROM SHARED PACKAGE
// ============================================================================

export {
  // Formatting
  formatCid,
  normalizeCid,
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatDateToInputString,
  formatDateForDisplay,
  // Validation
  isValidEmail,
  isValidCid,
  // String
  truncate,
  getInitials,
  capitalize,
  toTitleCase,
  // Array
  groupBy,
  unique,
  // Async
  debounce,
  sleep,
  retry,
  // Constants
  GEO_OPTIONS,
} from "@magimanager/shared";
