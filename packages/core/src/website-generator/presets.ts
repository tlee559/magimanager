/**
 * Website Generator Presets
 *
 * Provides 50,000+ unique combinations through:
 * - 12 color themes
 * - 6 layouts
 * - 8 font pairings
 * - 4 animations
 * - 22 logo icons
 */

// ============================================================================
// COLOR THEMES (12 presets)
// ============================================================================

export interface ColorTheme {
  name: string;
  primary: string;      // Main brand color
  secondary: string;    // Accent/highlight color
  accent: string;       // Call-to-action color
  background: string;   // Page background
  surface: string;      // Card/panel background
  text: string;         // Primary text color
  textMuted: string;    // Secondary text color
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    name: "Royal Vegas",
    primary: "#6B21A8",
    secondary: "#F59E0B",
    accent: "#10B981",
    background: "#0F172A",
    surface: "#1E293B",
    text: "#F8FAFC",
    textMuted: "#94A3B8",
  },
  {
    name: "Golden Night",
    primary: "#B45309",
    secondary: "#FBBF24",
    accent: "#F97316",
    background: "#18181B",
    surface: "#27272A",
    text: "#FAFAFA",
    textMuted: "#A1A1AA",
  },
  {
    name: "Ocean Blue",
    primary: "#0EA5E9",
    secondary: "#06B6D4",
    accent: "#22D3EE",
    background: "#0C1222",
    surface: "#162032",
    text: "#F0F9FF",
    textMuted: "#7DD3FC",
  },
  {
    name: "Emerald Fortune",
    primary: "#059669",
    secondary: "#10B981",
    accent: "#34D399",
    background: "#0D1117",
    surface: "#161B22",
    text: "#ECFDF5",
    textMuted: "#6EE7B7",
  },
  {
    name: "Ruby Red",
    primary: "#DC2626",
    secondary: "#EF4444",
    accent: "#F87171",
    background: "#1C1917",
    surface: "#292524",
    text: "#FEF2F2",
    textMuted: "#FCA5A5",
  },
  {
    name: "Midnight Purple",
    primary: "#7C3AED",
    secondary: "#8B5CF6",
    accent: "#A78BFA",
    background: "#09090B",
    surface: "#18181B",
    text: "#FAF5FF",
    textMuted: "#C4B5FD",
  },
  {
    name: "Sunset Orange",
    primary: "#EA580C",
    secondary: "#FB923C",
    accent: "#FDBA74",
    background: "#1A1A1A",
    surface: "#262626",
    text: "#FFF7ED",
    textMuted: "#FED7AA",
  },
  {
    name: "Pink Glamour",
    primary: "#DB2777",
    secondary: "#EC4899",
    accent: "#F472B6",
    background: "#0F0F0F",
    surface: "#1A1A1A",
    text: "#FDF2F8",
    textMuted: "#F9A8D4",
  },
  {
    name: "Cyber Neon",
    primary: "#00FF88",
    secondary: "#00FFFF",
    accent: "#FF00FF",
    background: "#0A0A0A",
    surface: "#141414",
    text: "#FFFFFF",
    textMuted: "#888888",
  },
  {
    name: "Classic Gold",
    primary: "#D4AF37",
    secondary: "#FFD700",
    accent: "#FFC107",
    background: "#1A1A2E",
    surface: "#16213E",
    text: "#FFFBEB",
    textMuted: "#FCD34D",
  },
  {
    name: "Arctic Blue",
    primary: "#3B82F6",
    secondary: "#60A5FA",
    accent: "#93C5FD",
    background: "#030712",
    surface: "#111827",
    text: "#EFF6FF",
    textMuted: "#BFDBFE",
  },
  {
    name: "Forest Green",
    primary: "#16A34A",
    secondary: "#22C55E",
    accent: "#4ADE80",
    background: "#14120E",
    surface: "#1C1A16",
    text: "#F0FDF4",
    textMuted: "#86EFAC",
  },
];

// ============================================================================
// LAYOUT PRESETS (6 presets)
// ============================================================================

export interface LayoutPreset {
  name: string;
  id: string;
  heroStyle: "centered" | "left" | "split" | "video" | "cards" | "minimal";
  description: string;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    name: "Centered Hero",
    id: "hero-centered",
    heroStyle: "centered",
    description: "Bold centered headline with CTA button",
  },
  {
    name: "Left Aligned",
    id: "hero-left",
    heroStyle: "left",
    description: "Text on left, image on right",
  },
  {
    name: "Split Screen",
    id: "hero-split",
    heroStyle: "split",
    description: "50/50 split with text and image",
  },
  {
    name: "Video Background",
    id: "hero-video",
    heroStyle: "video",
    description: "Full-width hero with video/animated background",
  },
  {
    name: "Card Grid",
    id: "hero-cards",
    heroStyle: "cards",
    description: "Hero with featured cards below",
  },
  {
    name: "Minimal",
    id: "hero-minimal",
    heroStyle: "minimal",
    description: "Clean, minimal design with lots of whitespace",
  },
];

// ============================================================================
// FONT PAIRINGS (8 presets)
// ============================================================================

export interface FontPairing {
  name: string;
  heading: string;
  body: string;
  googleFontsUrl: string;
}

export const FONT_PAIRINGS: FontPairing[] = [
  {
    name: "Modern",
    heading: "Inter",
    body: "Inter",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
  },
  {
    name: "Friendly",
    heading: "Poppins",
    body: "Open Sans",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Open+Sans:wght@400;500;600&display=swap",
  },
  {
    name: "Elegant",
    heading: "Playfair Display",
    body: "Lato",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700;800&family=Lato:wght@400;500;700&display=swap",
  },
  {
    name: "Bold",
    heading: "Montserrat",
    body: "Roboto",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&family=Roboto:wght@400;500&display=swap",
  },
  {
    name: "Playful",
    heading: "Fredoka One",
    body: "Nunito",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;500;600;700&display=swap",
  },
  {
    name: "Tech",
    heading: "Orbitron",
    body: "Rajdhani",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700;800;900&family=Rajdhani:wght@400;500;600;700&display=swap",
  },
  {
    name: "Classic",
    heading: "Merriweather",
    body: "Source Sans Pro",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Merriweather:wght@700;900&family=Source+Sans+Pro:wght@400;600&display=swap",
  },
  {
    name: "Sharp",
    heading: "Bebas Neue",
    body: "Barlow",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600&display=swap",
  },
];

// ============================================================================
// ANIMATION PRESETS (4 presets)
// ============================================================================

export interface AnimationPreset {
  name: string;
  id: string;
  fadeIn: string;
  hover: string;
  buttonHover: string;
}

export const ANIMATION_PRESETS: AnimationPreset[] = [
  {
    name: "Smooth",
    id: "smooth",
    fadeIn: "opacity 0.6s ease-out, transform 0.6s ease-out",
    hover: "transform 0.3s ease, box-shadow 0.3s ease",
    buttonHover: "transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3);",
  },
  {
    name: "Bouncy",
    id: "bouncy",
    fadeIn: "opacity 0.5s ease-out, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
    hover: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
    buttonHover: "transform: scale(1.05); box-shadow: 0 6px 20px rgba(0,0,0,0.25);",
  },
  {
    name: "Snappy",
    id: "snappy",
    fadeIn: "opacity 0.3s ease-out, transform 0.3s ease-out",
    hover: "transform 0.15s ease",
    buttonHover: "transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.2);",
  },
  {
    name: "None",
    id: "none",
    fadeIn: "none",
    hover: "none",
    buttonHover: "",
  },
];

// ============================================================================
// LOGO ICONS (22 options)
// ============================================================================

export interface LogoIcon {
  name: string;
  id: string;
  svg: string; // SVG path data
}

export const LOGO_ICONS: LogoIcon[] = [
  {
    name: "Sparkles",
    id: "sparkles",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/></svg>`,
  },
  {
    name: "Diamond",
    id: "diamond",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 9l9 14 9-14-9-8zm0 3.5L6.5 9 12 17.5 17.5 9 12 4.5z"/></svg>`,
  },
  {
    name: "Crown",
    id: "crown",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2 19h20v3H2v-3zm2-9l4 4 4-6 4 6 4-4v8H4v-8z"/></svg>`,
  },
  {
    name: "Star",
    id: "star",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
  },
  {
    name: "Lightning",
    id: "zap",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  },
  {
    name: "Flame",
    id: "flame",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-4.97 0-9-4.03-9-9 0-3.53 2.04-6.85 5.24-8.38l.76-.38V8c0 1.1.9 2 2 2s2-.9 2-2V5.24l.76.38C16.96 7.15 19 10.47 19 14c0 4.97-4.03 9-9 9zm-1-16.75A7.02 7.02 0 005 14c0 3.86 3.14 7 7 7s7-3.14 7-7c0-2.05-.88-4.01-2.42-5.37A4.02 4.02 0 0112 12a4.02 4.02 0 01-4-4v-.75H11v-1z"/></svg>`,
  },
  {
    name: "Rocket",
    id: "rocket",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1.5 0-6 4.5-6 12h2l-2 6 5-4h2l5 4-2-6h2c0-7.5-4.5-12-6-12zm0 4a2 2 0 110 4 2 2 0 010-4z"/></svg>`,
  },
  {
    name: "Trophy",
    id: "trophy",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>`,
  },
  {
    name: "Gem",
    id: "gem",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 9l10 13 10-13-10-7zm0 2.5l6.5 4.5H5.5L12 4.5zM4.5 10.5h15L12 20 4.5 10.5z"/></svg>`,
  },
  {
    name: "Coins",
    id: "coins",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M15 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/><path d="M3 12c0-2.39 1.4-4.46 3.43-5.42-.78-.6-1.74-.96-2.79-.96C1.64 5.62 0 7.26 0 9.26c0 1.61 1.03 2.98 2.48 3.48A8.1 8.1 0 013 12z"/></svg>`,
  },
  {
    name: "Dice",
    id: "dice",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9C6.67 9 6 8.33 6 7.5S6.67 6 7.5 6 9 6.67 9 7.5 8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9z"/></svg>`,
  },
  {
    name: "Gamepad",
    id: "gamepad",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`,
  },
  {
    name: "Heart",
    id: "heart",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
  },
  {
    name: "Spade",
    id: "spade",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8 6 4 9 4 13c0 2.76 2.24 5 5 5 .71 0 1.39-.15 2-.42V21h2v-3.42c.61.27 1.29.42 2 .42 2.76 0 5-2.24 5-5 0-4-4-7-8-11z"/></svg>`,
  },
  {
    name: "Club",
    id: "club",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1.66 0-3 1.34-3 3 0 .55.15 1.06.4 1.5C8.54 6.18 7.34 6 6 6c-2.21 0-4 1.79-4 4s1.79 4 4 4c1.34 0 2.54-.68 3.4-1.5-.25.44-.4.95-.4 1.5v7h4v-7c0-.55-.15-1.06-.4-1.5.86.82 2.06 1.5 3.4 1.5 2.21 0 4-1.79 4-4s-1.79-4-4-4c-1.34 0-2.54.18-3.4.5.25-.44.4-.95.4-1.5 0-1.66-1.34-3-3-3z"/></svg>`,
  },
  {
    name: "Seven",
    id: "seven",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h12v3l-8 13H6l8-13H6V4z"/></svg>`,
  },
  {
    name: "Clover",
    id: "clover",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a4 4 0 00-4 4c0 1.1.45 2.1 1.17 2.83L12 12l2.83-3.17A4 4 0 0016 6a4 4 0 00-4-4zm-6 6a4 4 0 00-4 4 4 4 0 004 4c1.1 0 2.1-.45 2.83-1.17L12 12 8.83 9.17A4 4 0 006 8zm12 0c-1.1 0-2.1.45-2.83 1.17L12 12l3.17 2.83A4 4 0 0018 16a4 4 0 004-4 4 4 0 00-4-4zm-6 6l-2.83 3.17A4 4 0 006 18a4 4 0 004 4 4 4 0 004-4c0-1.1-.45-2.1-1.17-2.83L12 14z"/></svg>`,
  },
  {
    name: "Shield",
    id: "shield",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>`,
  },
  {
    name: "Bolt",
    id: "bolt",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66l.1-.16L12 2h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15L11 21z"/></svg>`,
  },
  {
    name: "Horseshoe",
    id: "horseshoe",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12v10h4v-10c0-3.31 2.69-6 6-6s6 2.69 6 6v10h4V12c0-5.52-4.48-10-10-10z"/></svg>`,
  },
  {
    name: "Wheel",
    id: "wheel",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>`,
  },
  {
    name: "Cards",
    id: "cards",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z"/></svg>`,
  },
];

// ============================================================================
// FEATURE SECTION LAYOUTS (5 variants)
// ============================================================================

export interface FeatureLayout {
  name: string;
  id: string;
  gridClass: string;
  cardClass: string;
  description: string;
}

export const FEATURE_LAYOUTS: FeatureLayout[] = [
  {
    name: "Equal Grid",
    id: "grid-equal",
    gridClass: "features-grid-equal",
    cardClass: "feature-card-equal",
    description: "Three equal-sized cards in a row",
  },
  {
    name: "Large First",
    id: "large-first",
    gridClass: "features-grid-large-first",
    cardClass: "feature-card-varied",
    description: "One large card, two smaller cards",
  },
  {
    name: "Alternating",
    id: "alternating",
    gridClass: "features-grid-alternating",
    cardClass: "feature-card-horizontal",
    description: "Alternating left-right layout with images",
  },
  {
    name: "Stacked Cards",
    id: "stacked",
    gridClass: "features-grid-stacked",
    cardClass: "feature-card-stacked",
    description: "Vertically stacked with overlap effect",
  },
  {
    name: "Masonry",
    id: "masonry",
    gridClass: "features-grid-masonry",
    cardClass: "feature-card-masonry",
    description: "Pinterest-style masonry grid",
  },
];

// ============================================================================
// BUTTON STYLES (6 variants)
// ============================================================================

export interface ButtonStyle {
  name: string;
  id: string;
  className: string;
  css: string;
}

export const BUTTON_STYLES: ButtonStyle[] = [
  {
    name: "Rounded",
    id: "rounded",
    className: "btn-rounded",
    css: "border-radius: 8px;",
  },
  {
    name: "Pill",
    id: "pill",
    className: "btn-pill",
    css: "border-radius: 50px;",
  },
  {
    name: "Sharp",
    id: "sharp",
    className: "btn-sharp",
    css: "border-radius: 0;",
  },
  {
    name: "Gradient",
    id: "gradient",
    className: "btn-gradient",
    css: "background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); border-radius: 8px;",
  },
  {
    name: "Outline",
    id: "outline",
    className: "btn-outline-style",
    css: "background: transparent; border: 2px solid var(--primary); color: var(--primary); border-radius: 8px;",
  },
  {
    name: "Neon",
    id: "neon",
    className: "btn-neon",
    css: "border-radius: 8px; box-shadow: 0 0 20px var(--primary), 0 0 40px rgba(var(--primary-rgb), 0.3);",
  },
];

// ============================================================================
// CARD STYLES (5 variants)
// ============================================================================

export interface CardStyle {
  name: string;
  id: string;
  className: string;
  css: string;
}

export const CARD_STYLES: CardStyle[] = [
  {
    name: "Flat",
    id: "flat",
    className: "card-flat",
    css: "background: var(--surface); border-radius: 12px;",
  },
  {
    name: "Elevated",
    id: "elevated",
    className: "card-elevated",
    css: "background: var(--surface); border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);",
  },
  {
    name: "Glass",
    id: "glass",
    className: "card-glass",
    css: "background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;",
  },
  {
    name: "Gradient Border",
    id: "gradient-border",
    className: "card-gradient-border",
    css: "background: var(--surface); border-radius: 16px; border: 2px solid transparent; background-clip: padding-box; position: relative;",
  },
  {
    name: "Neon Glow",
    id: "neon-glow",
    className: "card-neon",
    css: "background: var(--surface); border-radius: 16px; box-shadow: 0 0 30px rgba(var(--primary-rgb), 0.3), inset 0 0 30px rgba(var(--primary-rgb), 0.05);",
  },
];

// ============================================================================
// TYPOGRAPHY STYLES (5 variants)
// ============================================================================

export interface TypographyStyle {
  name: string;
  id: string;
  headingWeight: string;
  headingTransform: string;
  headingLetterSpacing: string;
  bodyLineHeight: string;
}

export const TYPOGRAPHY_STYLES: TypographyStyle[] = [
  {
    name: "Bold Impact",
    id: "bold",
    headingWeight: "800",
    headingTransform: "uppercase",
    headingLetterSpacing: "0.05em",
    bodyLineHeight: "1.7",
  },
  {
    name: "Elegant",
    id: "elegant",
    headingWeight: "500",
    headingTransform: "none",
    headingLetterSpacing: "0.02em",
    bodyLineHeight: "1.8",
  },
  {
    name: "Modern Clean",
    id: "modern",
    headingWeight: "700",
    headingTransform: "none",
    headingLetterSpacing: "-0.02em",
    bodyLineHeight: "1.6",
  },
  {
    name: "Playful",
    id: "playful",
    headingWeight: "700",
    headingTransform: "none",
    headingLetterSpacing: "0",
    bodyLineHeight: "1.7",
  },
  {
    name: "Dramatic",
    id: "dramatic",
    headingWeight: "900",
    headingTransform: "uppercase",
    headingLetterSpacing: "0.1em",
    bodyLineHeight: "1.6",
  },
];

// ============================================================================
// HERO BACKGROUND STYLES (4 variants)
// ============================================================================

export interface HeroBackground {
  name: string;
  id: string;
  className: string;
  hasOverlay: boolean;
  overlayStyle: string;
}

export const HERO_BACKGROUNDS: HeroBackground[] = [
  {
    name: "Image with Gradient",
    id: "gradient-overlay",
    className: "hero-bg-gradient",
    hasOverlay: true,
    overlayStyle: "linear-gradient(135deg, rgba(var(--bg-rgb), 0.9) 0%, rgba(var(--bg-rgb), 0.7) 50%, rgba(var(--bg-rgb), 0.4) 100%)",
  },
  {
    name: "Dark Vignette",
    id: "vignette",
    className: "hero-bg-vignette",
    hasOverlay: true,
    overlayStyle: "radial-gradient(ellipse at center, rgba(var(--bg-rgb), 0.3) 0%, rgba(var(--bg-rgb), 0.95) 100%)",
  },
  {
    name: "Color Tint",
    id: "color-tint",
    className: "hero-bg-tint",
    hasOverlay: true,
    overlayStyle: "linear-gradient(180deg, rgba(var(--primary-rgb), 0.4) 0%, rgba(var(--bg-rgb), 0.95) 100%)",
  },
  {
    name: "Minimal",
    id: "minimal",
    className: "hero-bg-minimal",
    hasOverlay: true,
    overlayStyle: "linear-gradient(180deg, rgba(var(--bg-rgb), 0.85) 0%, rgba(var(--bg-rgb), 0.95) 100%)",
  },
];

// ============================================================================
// HOVER EFFECTS (4 variants)
// ============================================================================

export interface HoverEffect {
  name: string;
  id: string;
  cardHover: string;
  buttonHover: string;
}

export const HOVER_EFFECTS: HoverEffect[] = [
  {
    name: "Lift",
    id: "lift",
    cardHover: "transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,0.3);",
    buttonHover: "transform: translateY(-3px); box-shadow: 0 10px 30px rgba(var(--primary-rgb), 0.4);",
  },
  {
    name: "Scale",
    id: "scale",
    cardHover: "transform: scale(1.03); box-shadow: 0 15px 35px rgba(0,0,0,0.25);",
    buttonHover: "transform: scale(1.05);",
  },
  {
    name: "Glow",
    id: "glow",
    cardHover: "box-shadow: 0 0 30px rgba(var(--primary-rgb), 0.4), 0 10px 40px rgba(0,0,0,0.3);",
    buttonHover: "box-shadow: 0 0 30px var(--primary), 0 0 60px rgba(var(--primary-rgb), 0.4);",
  },
  {
    name: "Border Glow",
    id: "border-glow",
    cardHover: "border-color: var(--primary); box-shadow: 0 0 20px rgba(var(--primary-rgb), 0.3);",
    buttonHover: "box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.3);",
  },
];

// ============================================================================
// RANDOM SELECTION HELPERS
// ============================================================================

export function selectRandomPresets(): {
  colors: ColorTheme;
  layout: LayoutPreset;
  fonts: FontPairing;
  animation: AnimationPreset;
  logoIcon: LogoIcon;
  featureLayout: FeatureLayout;
  buttonStyle: ButtonStyle;
  cardStyle: CardStyle;
  typography: TypographyStyle;
  heroBackground: HeroBackground;
  hoverEffect: HoverEffect;
} {
  return {
    colors: COLOR_THEMES[Math.floor(Math.random() * COLOR_THEMES.length)],
    layout: LAYOUT_PRESETS[Math.floor(Math.random() * LAYOUT_PRESETS.length)],
    fonts: FONT_PAIRINGS[Math.floor(Math.random() * FONT_PAIRINGS.length)],
    animation: ANIMATION_PRESETS[Math.floor(Math.random() * ANIMATION_PRESETS.length)],
    logoIcon: LOGO_ICONS[Math.floor(Math.random() * LOGO_ICONS.length)],
    featureLayout: FEATURE_LAYOUTS[Math.floor(Math.random() * FEATURE_LAYOUTS.length)],
    buttonStyle: BUTTON_STYLES[Math.floor(Math.random() * BUTTON_STYLES.length)],
    cardStyle: CARD_STYLES[Math.floor(Math.random() * CARD_STYLES.length)],
    typography: TYPOGRAPHY_STYLES[Math.floor(Math.random() * TYPOGRAPHY_STYLES.length)],
    heroBackground: HERO_BACKGROUNDS[Math.floor(Math.random() * HERO_BACKGROUNDS.length)],
    hoverEffect: HOVER_EFFECTS[Math.floor(Math.random() * HOVER_EFFECTS.length)],
  };
}

export function getTotalCombinations(): number {
  return (
    COLOR_THEMES.length *
    LAYOUT_PRESETS.length *
    FONT_PAIRINGS.length *
    ANIMATION_PRESETS.length *
    LOGO_ICONS.length *
    FEATURE_LAYOUTS.length *
    BUTTON_STYLES.length *
    CARD_STYLES.length *
    TYPOGRAPHY_STYLES.length *
    HERO_BACKGROUNDS.length *
    HOVER_EFFECTS.length
  );
  // 12 × 6 × 8 × 4 × 22 × 5 × 6 × 5 × 5 × 4 × 4 = 304,128,000 combinations!
}

// ============================================================================
// NICHE DEFINITIONS
// ============================================================================

export type NicheType = "social-casino";

export interface NicheDefinition {
  id: NicheType;
  name: string;
  description: string;
  pages: string[];
  hasGame: boolean;
}

export const NICHES: Record<NicheType, NicheDefinition> = {
  "social-casino": {
    id: "social-casino",
    name: "Social Gaming Casino",
    description: "Social casino with free-to-play slots game",
    pages: ["index", "terms", "privacy", "play"],
    hasGame: true,
  },
};

// ============================================================================
// SLOT MACHINE SYMBOLS
// ============================================================================

export const SLOT_SYMBOLS = [
  { name: "cherry", emoji: "🍒", multiplier: 2 },
  { name: "lemon", emoji: "🍋", multiplier: 3 },
  { name: "orange", emoji: "🍊", multiplier: 4 },
  { name: "grape", emoji: "🍇", multiplier: 5 },
  { name: "diamond", emoji: "💎", multiplier: 10 },
  { name: "seven", emoji: "7️⃣", multiplier: 20 },
  { name: "bar", emoji: "📊", multiplier: 15 },
  { name: "star", emoji: "⭐", multiplier: 8 },
] as const;
