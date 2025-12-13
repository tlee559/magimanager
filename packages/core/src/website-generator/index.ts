/**
 * Website Generator Module
 *
 * Generates unique websites using AI (Gemini + Imagen) with preset themes.
 */

// Presets
export {
  // Types
  type ColorTheme,
  type LayoutPreset,
  type FontPairing,
  type AnimationPreset,
  type LogoIcon,
  type NicheType,
  type NicheDefinition,
  type FeatureLayout,
  type ButtonStyle,
  type CardStyle,
  type TypographyStyle,
  type HeroBackground,
  type HoverEffect,

  // Data
  COLOR_THEMES,
  LAYOUT_PRESETS,
  FONT_PAIRINGS,
  ANIMATION_PRESETS,
  LOGO_ICONS,
  NICHES,
  SLOT_SYMBOLS,
  FEATURE_LAYOUTS,
  BUTTON_STYLES,
  CARD_STYLES,
  TYPOGRAPHY_STYLES,
  HERO_BACKGROUNDS,
  HOVER_EFFECTS,

  // Functions
  selectRandomPresets,
  getTotalCombinations,
} from "./presets";

// Assembler
export {
  // Types
  type GeneratedContent,
  type GeneratedImages,
  type SelectedPresets,
  type AssembleOptions,

  // Functions
  assembleWebsiteFromFiles,
  getPresetInfo,
} from "./assembler";

// AI Services
export {
  // Types
  type GenerateContentOptions,
  type GenerateImagesOptions,
  type GenerateWebsiteContentOptions,
  type GeneratedWebsiteContent,

  // Functions
  generateContent,
  generateImages,
  generateWebsiteContent,
} from "./ai-services";
