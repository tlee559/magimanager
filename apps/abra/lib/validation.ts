import { z } from "zod";

export const identityProfileInputSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name is required.")
    .max(200, "Full name is too long."),
  dob: z
    .string()
    .refine((value) => {
      // Validate date string (YYYY-MM-DD format from input type="date")
      const date = new Date(value);
      return !isNaN(date.getTime());
    }, { message: "Invalid date of birth" })
    .refine((value) => {
      const date = new Date(value);
      const currentYear = new Date().getFullYear();
      const year = date.getFullYear();
      return year >= 1900 && year <= currentYear;
    }, { message: "Date of birth must be between 1900 and current year" }),
  address: z
    .string()
    .min(5, "Address is required.")
    .max(500, "Address is too long."),
  city: z
    .string()
    .min(2, "City is required.")
    .max(100, "City is too long."),
  state: z
    .string()
    .min(2, "State is required.")
    .max(100, "State is too long."),
  zipcode: z
    .string()
    .max(20, "Zipcode is too long.")
    .optional()
    .or(z.literal("")),
  geo: z
    .string()
    .min(2, "Country/Region is required."),
  website: z.string().url("Website must be a valid URL").optional().or(z.literal("")),
});

export type IdentityProfileInput = z.infer<typeof identityProfileInputSchema>;

// Helper to convert date string to Date object
export function parseDateStringToDate(dateString: string): Date {
  return new Date(dateString);
}

// Helper to format Date to YYYY-MM-DD string (for input type="date")
export function formatDateToInputString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Helper to format Date for display (MM/DD/YYYY)
export function formatDateForDisplay(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const yyyy = dateObj.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

// List of countries/regions
export const GEO_OPTIONS = [
  "United States",
  "Canada",
  "United Kingdom",
  "Australia",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Belgium",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Poland",
  "Czech Republic",
  "Austria",
  "Switzerland",
  "Ireland",
  "Portugal",
  "Greece",
  "Japan",
  "South Korea",
  "Singapore",
  "New Zealand",
  "Brazil",
  "Mexico",
  "Argentina",
  "Chile",
  "India",
  "Other",
] as const;

// Ad Account Status Options
export const ACCOUNT_STATUS = {
  PROVISIONED: "provisioned",      // Just created
  WARMING_UP: "warming-up",        // In warmup phase
  READY: "ready",                  // Warmup complete, available
  HANDED_OFF: "handed-off",        // Assigned to media buyer
  ARCHIVED: "archived",            // No longer in use
} as const;

// Handoff Status Options
export const HANDOFF_STATUS = {
  AVAILABLE: "available",          // Ready to be handed off
  HANDED_OFF: "handed-off",        // Assigned to media buyer
  ARCHIVED: "archived",            // No longer in use
} as const;

export type AccountStatus = typeof ACCOUNT_STATUS[keyof typeof ACCOUNT_STATUS];
export type HandoffStatus = typeof HANDOFF_STATUS[keyof typeof HANDOFF_STATUS];
