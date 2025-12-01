/**
 * Ad Templates System
 * Pre-built layouts and configurations for different ad types and styles
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AdTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  style: TemplateStyle;
  layout: TemplateLayout;
  colorScheme: ColorScheme;
  textPositions: TextPositions;
  thumbnail?: string;
  tags: string[];
}

export type TemplateCategory =
  | "ecommerce"
  | "saas"
  | "lead-gen"
  | "brand-awareness"
  | "app-install"
  | "event"
  | "offer"
  | "comparison";

export type TemplateStyle =
  | "minimal"
  | "bold"
  | "elegant"
  | "playful"
  | "professional"
  | "urgent"
  | "lifestyle"
  | "product-focused";

export interface TemplateLayout {
  headlinePosition: "top" | "center" | "bottom";
  headlineAlignment: "left" | "center" | "right";
  subheadlinePosition?: "below-headline" | "top" | "bottom";
  ctaPosition: "bottom-center" | "bottom-right" | "inline" | "floating";
  logoPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  productImagePosition?: "center" | "left" | "right" | "background";
  overlayStyle: "gradient-top" | "gradient-bottom" | "full-overlay" | "side-panel" | "none";
  overlayOpacity: number;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  textColor: string;
  ctaBackground: string;
  ctaTextColor: string;
  overlayColor: string;
}

export interface TextPositions {
  headline: {
    x: number; // percentage from left
    y: number; // percentage from top
    maxWidth: number; // percentage of canvas width
    fontSize: "large" | "medium" | "small";
    fontWeight: "bold" | "semibold" | "normal";
  };
  subheadline?: {
    x: number;
    y: number;
    maxWidth: number;
    fontSize: "medium" | "small";
    fontWeight: "semibold" | "normal";
  };
  cta: {
    x: number;
    y: number;
    style: "button" | "link" | "pill";
    size: "large" | "medium" | "small";
  };
}

// ============================================================================
// DEFAULT COLOR SCHEMES
// ============================================================================

export const COLOR_SCHEMES: Record<string, ColorScheme> = {
  dark: {
    primary: "#0f172a",
    secondary: "#1e293b",
    accent: "#3b82f6",
    textColor: "#ffffff",
    ctaBackground: "#3b82f6",
    ctaTextColor: "#ffffff",
    overlayColor: "rgba(0, 0, 0, 0.5)",
  },
  light: {
    primary: "#ffffff",
    secondary: "#f1f5f9",
    accent: "#3b82f6",
    textColor: "#0f172a",
    ctaBackground: "#3b82f6",
    ctaTextColor: "#ffffff",
    overlayColor: "rgba(255, 255, 255, 0.7)",
  },
  vibrant: {
    primary: "#7c3aed",
    secondary: "#a855f7",
    accent: "#f59e0b",
    textColor: "#ffffff",
    ctaBackground: "#f59e0b",
    ctaTextColor: "#0f172a",
    overlayColor: "rgba(124, 58, 237, 0.6)",
  },
  warm: {
    primary: "#dc2626",
    secondary: "#f97316",
    accent: "#fbbf24",
    textColor: "#ffffff",
    ctaBackground: "#fbbf24",
    ctaTextColor: "#0f172a",
    overlayColor: "rgba(220, 38, 38, 0.5)",
  },
  cool: {
    primary: "#0ea5e9",
    secondary: "#06b6d4",
    accent: "#10b981",
    textColor: "#ffffff",
    ctaBackground: "#10b981",
    ctaTextColor: "#ffffff",
    overlayColor: "rgba(14, 165, 233, 0.5)",
  },
  neutral: {
    primary: "#374151",
    secondary: "#6b7280",
    accent: "#f59e0b",
    textColor: "#ffffff",
    ctaBackground: "#f59e0b",
    ctaTextColor: "#0f172a",
    overlayColor: "rgba(55, 65, 81, 0.6)",
  },
  luxury: {
    primary: "#1c1917",
    secondary: "#292524",
    accent: "#d4af37",
    textColor: "#ffffff",
    ctaBackground: "#d4af37",
    ctaTextColor: "#1c1917",
    overlayColor: "rgba(28, 25, 23, 0.7)",
  },
  fresh: {
    primary: "#16a34a",
    secondary: "#22c55e",
    accent: "#ffffff",
    textColor: "#ffffff",
    ctaBackground: "#ffffff",
    ctaTextColor: "#16a34a",
    overlayColor: "rgba(22, 163, 74, 0.5)",
  },
};

// ============================================================================
// TEMPLATES
// ============================================================================

export const AD_TEMPLATES: AdTemplate[] = [
  // E-commerce Templates
  {
    id: "ecom-product-hero",
    name: "Product Hero",
    description: "Clean product showcase with bold headline and prominent CTA",
    category: "ecommerce",
    style: "product-focused",
    layout: {
      headlinePosition: "top",
      headlineAlignment: "center",
      ctaPosition: "bottom-center",
      logoPosition: "top-left",
      productImagePosition: "center",
      overlayStyle: "gradient-bottom",
      overlayOpacity: 0.4,
    },
    colorScheme: COLOR_SCHEMES.dark,
    textPositions: {
      headline: { x: 50, y: 15, maxWidth: 80, fontSize: "large", fontWeight: "bold" },
      cta: { x: 50, y: 85, style: "button", size: "large" },
    },
    tags: ["product", "ecommerce", "clean", "modern"],
  },
  {
    id: "ecom-sale-urgent",
    name: "Flash Sale",
    description: "Urgency-driven layout for sales and limited offers",
    category: "offer",
    style: "urgent",
    layout: {
      headlinePosition: "center",
      headlineAlignment: "center",
      subheadlinePosition: "below-headline",
      ctaPosition: "bottom-center",
      logoPosition: "bottom-right",
      overlayStyle: "full-overlay",
      overlayOpacity: 0.6,
    },
    colorScheme: COLOR_SCHEMES.warm,
    textPositions: {
      headline: { x: 50, y: 40, maxWidth: 90, fontSize: "large", fontWeight: "bold" },
      subheadline: { x: 50, y: 55, maxWidth: 80, fontSize: "medium", fontWeight: "normal" },
      cta: { x: 50, y: 80, style: "pill", size: "large" },
    },
    tags: ["sale", "urgent", "discount", "limited-time"],
  },
  {
    id: "ecom-lifestyle",
    name: "Lifestyle Appeal",
    description: "Lifestyle-focused with aspirational imagery",
    category: "brand-awareness",
    style: "lifestyle",
    layout: {
      headlinePosition: "bottom",
      headlineAlignment: "left",
      ctaPosition: "inline",
      logoPosition: "top-left",
      overlayStyle: "gradient-bottom",
      overlayOpacity: 0.7,
    },
    colorScheme: COLOR_SCHEMES.dark,
    textPositions: {
      headline: { x: 10, y: 70, maxWidth: 60, fontSize: "large", fontWeight: "bold" },
      cta: { x: 10, y: 88, style: "link", size: "medium" },
    },
    tags: ["lifestyle", "aspirational", "brand", "modern"],
  },

  // SaaS Templates
  {
    id: "saas-feature-highlight",
    name: "Feature Spotlight",
    description: "Highlight a key feature or benefit",
    category: "saas",
    style: "professional",
    layout: {
      headlinePosition: "top",
      headlineAlignment: "left",
      subheadlinePosition: "below-headline",
      ctaPosition: "bottom-center",
      logoPosition: "top-right",
      overlayStyle: "side-panel",
      overlayOpacity: 0.8,
    },
    colorScheme: COLOR_SCHEMES.vibrant,
    textPositions: {
      headline: { x: 10, y: 20, maxWidth: 50, fontSize: "medium", fontWeight: "bold" },
      subheadline: { x: 10, y: 35, maxWidth: 45, fontSize: "small", fontWeight: "normal" },
      cta: { x: 50, y: 85, style: "button", size: "medium" },
    },
    tags: ["saas", "feature", "tech", "b2b"],
  },
  {
    id: "saas-social-proof",
    name: "Social Proof",
    description: "Testimonial or stats-focused layout",
    category: "saas",
    style: "professional",
    layout: {
      headlinePosition: "center",
      headlineAlignment: "center",
      subheadlinePosition: "below-headline",
      ctaPosition: "bottom-center",
      logoPosition: "top-left",
      overlayStyle: "full-overlay",
      overlayOpacity: 0.5,
    },
    colorScheme: COLOR_SCHEMES.cool,
    textPositions: {
      headline: { x: 50, y: 35, maxWidth: 85, fontSize: "medium", fontWeight: "bold" },
      subheadline: { x: 50, y: 55, maxWidth: 70, fontSize: "small", fontWeight: "normal" },
      cta: { x: 50, y: 80, style: "button", size: "medium" },
    },
    tags: ["testimonial", "stats", "trust", "b2b"],
  },

  // Lead Generation Templates
  {
    id: "leadgen-free-offer",
    name: "Free Offer",
    description: "Lead magnet or free trial promotion",
    category: "lead-gen",
    style: "bold",
    layout: {
      headlinePosition: "top",
      headlineAlignment: "center",
      subheadlinePosition: "below-headline",
      ctaPosition: "bottom-center",
      logoPosition: "top-left",
      overlayStyle: "gradient-top",
      overlayOpacity: 0.6,
    },
    colorScheme: COLOR_SCHEMES.fresh,
    textPositions: {
      headline: { x: 50, y: 20, maxWidth: 90, fontSize: "large", fontWeight: "bold" },
      subheadline: { x: 50, y: 40, maxWidth: 80, fontSize: "medium", fontWeight: "normal" },
      cta: { x: 50, y: 80, style: "pill", size: "large" },
    },
    tags: ["free", "lead-magnet", "offer", "signup"],
  },
  {
    id: "leadgen-question",
    name: "Question Hook",
    description: "Engaging question to spark curiosity",
    category: "lead-gen",
    style: "playful",
    layout: {
      headlinePosition: "center",
      headlineAlignment: "center",
      ctaPosition: "bottom-center",
      logoPosition: "bottom-right",
      overlayStyle: "full-overlay",
      overlayOpacity: 0.4,
    },
    colorScheme: COLOR_SCHEMES.vibrant,
    textPositions: {
      headline: { x: 50, y: 45, maxWidth: 85, fontSize: "large", fontWeight: "bold" },
      cta: { x: 50, y: 80, style: "button", size: "large" },
    },
    tags: ["question", "curiosity", "engagement", "hook"],
  },

  // Comparison Templates
  {
    id: "comparison-vs",
    name: "VS Comparison",
    description: "Direct competitor comparison layout",
    category: "comparison",
    style: "bold",
    layout: {
      headlinePosition: "top",
      headlineAlignment: "center",
      ctaPosition: "bottom-center",
      logoPosition: "top-right",
      overlayStyle: "full-overlay",
      overlayOpacity: 0.5,
    },
    colorScheme: COLOR_SCHEMES.neutral,
    textPositions: {
      headline: { x: 50, y: 15, maxWidth: 90, fontSize: "medium", fontWeight: "bold" },
      cta: { x: 50, y: 85, style: "button", size: "medium" },
    },
    tags: ["comparison", "vs", "competitive", "alternative"],
  },

  // Brand Awareness Templates
  {
    id: "brand-minimal",
    name: "Minimal Brand",
    description: "Clean, minimal design for brand recognition",
    category: "brand-awareness",
    style: "minimal",
    layout: {
      headlinePosition: "center",
      headlineAlignment: "center",
      ctaPosition: "bottom-center",
      logoPosition: "top-left",
      overlayStyle: "none",
      overlayOpacity: 0,
    },
    colorScheme: COLOR_SCHEMES.light,
    textPositions: {
      headline: { x: 50, y: 50, maxWidth: 70, fontSize: "large", fontWeight: "bold" },
      cta: { x: 50, y: 85, style: "link", size: "medium" },
    },
    tags: ["minimal", "clean", "brand", "recognition"],
  },
  {
    id: "brand-luxury",
    name: "Luxury Brand",
    description: "Elegant layout for premium brands",
    category: "brand-awareness",
    style: "elegant",
    layout: {
      headlinePosition: "center",
      headlineAlignment: "center",
      subheadlinePosition: "below-headline",
      ctaPosition: "bottom-center",
      logoPosition: "top-left",
      overlayStyle: "full-overlay",
      overlayOpacity: 0.3,
    },
    colorScheme: COLOR_SCHEMES.luxury,
    textPositions: {
      headline: { x: 50, y: 40, maxWidth: 80, fontSize: "large", fontWeight: "semibold" },
      subheadline: { x: 50, y: 55, maxWidth: 60, fontSize: "small", fontWeight: "normal" },
      cta: { x: 50, y: 85, style: "link", size: "medium" },
    },
    tags: ["luxury", "premium", "elegant", "high-end"],
  },

  // Event Templates
  {
    id: "event-announcement",
    name: "Event Announcement",
    description: "Bold announcement for events and webinars",
    category: "event",
    style: "bold",
    layout: {
      headlinePosition: "top",
      headlineAlignment: "center",
      subheadlinePosition: "below-headline",
      ctaPosition: "bottom-center",
      logoPosition: "top-left",
      overlayStyle: "gradient-bottom",
      overlayOpacity: 0.7,
    },
    colorScheme: COLOR_SCHEMES.vibrant,
    textPositions: {
      headline: { x: 50, y: 25, maxWidth: 90, fontSize: "large", fontWeight: "bold" },
      subheadline: { x: 50, y: 45, maxWidth: 80, fontSize: "medium", fontWeight: "normal" },
      cta: { x: 50, y: 80, style: "pill", size: "large" },
    },
    tags: ["event", "webinar", "announcement", "registration"],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TemplateCategory): AdTemplate[] {
  return AD_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get templates by style
 */
export function getTemplatesByStyle(style: TemplateStyle): AdTemplate[] {
  return AD_TEMPLATES.filter((t) => t.style === style);
}

/**
 * Get templates by tag
 */
export function getTemplatesByTag(tag: string): AdTemplate[] {
  return AD_TEMPLATES.filter((t) => t.tags.includes(tag.toLowerCase()));
}

/**
 * Get a specific template by ID
 */
export function getTemplateById(id: string): AdTemplate | undefined {
  return AD_TEMPLATES.find((t) => t.id === id);
}

/**
 * Search templates by query
 */
export function searchTemplates(query: string): AdTemplate[] {
  const lowerQuery = query.toLowerCase();
  return AD_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.includes(lowerQuery)) ||
      t.category.includes(lowerQuery) ||
      t.style.includes(lowerQuery)
  );
}

/**
 * Get recommended templates based on use case
 */
export function getRecommendedTemplates(useCase: {
  goal?: string;
  industry?: string;
  style?: string;
}): AdTemplate[] {
  const { goal, industry, style } = useCase;

  let templates = [...AD_TEMPLATES];

  // Filter by goal
  if (goal) {
    const goalMappings: Record<string, TemplateCategory[]> = {
      ctr: ["ecommerce", "lead-gen", "offer"],
      conversions: ["ecommerce", "lead-gen", "saas"],
      awareness: ["brand-awareness", "event"],
      engagement: ["lead-gen", "comparison"],
    };
    const relevantCategories = goalMappings[goal] || [];
    if (relevantCategories.length > 0) {
      templates = templates.filter((t) => relevantCategories.includes(t.category));
    }
  }

  // Filter by industry
  if (industry) {
    const industryMappings: Record<string, string[]> = {
      ecommerce: ["product", "sale", "lifestyle"],
      saas: ["saas", "feature", "tech"],
      finance: ["trust", "professional"],
      health: ["lifestyle", "trust"],
    };
    const relevantTags = industryMappings[industry] || [];
    if (relevantTags.length > 0) {
      templates = templates.filter((t) =>
        t.tags.some((tag) => relevantTags.includes(tag))
      );
    }
  }

  // Filter by style preference
  if (style) {
    templates = templates.filter((t) => t.style === style);
  }

  // Return top 5 or all if fewer
  return templates.slice(0, 5);
}
